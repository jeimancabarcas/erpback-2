import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { Invoice, InvoiceStatus } from '../sales/entities/invoice.entity';
import { CustomerCreditDto } from './dto/customer-credit.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreditPortfolioResponseDto } from './dto/credit-portfolio-response.dto';
import { PaymentRecordDto } from './dto/payment-record.dto';

@Injectable()
export class CustomersCreditService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepository: Repository<PaymentRecord>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly dataSource: DataSource,
  ) {}

  async getCreditPortfolio(customerId: string): Promise<CreditPortfolioResponseDto> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID ${customerId} no encontrado`,
      );
    }

    const creditLimit = customer.creditLimit
      ? Number(customer.creditLimit)
      : null;
    const currentBalance = Number(customer.currentBalance);

    let availableCredit: number | null = null;
    let utilizationPercent: number | null = null;

    if (creditLimit !== null) {
      availableCredit = creditLimit - currentBalance;
      utilizationPercent =
        creditLimit > 0
          ? Number(((currentBalance / creditLimit) * 100).toFixed(2))
          : 0;
    }

    return {
      creditLimit: creditLimit,
      currentBalance,
      availableCredit,
      utilizationPercent,
      creditStatus: customer.creditStatus,
      paymentTermsDays: customer.paymentTermsDays,
    };
  }

  async setCreditLimit(
    customerId: string,
    dto: CustomerCreditDto,
  ): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID ${customerId} no encontrado`,
      );
    }

    customer.creditLimit = dto.creditLimit;
    if (dto.paymentTermsDays !== undefined) {
      customer.paymentTermsDays = dto.paymentTermsDays;
    }

    return this.customerRepository.save(customer);
  }

  async recordPayment(
    customerId: string,
    dto: RecordPaymentDto,
  ): Promise<{
    newBalance: number;
    invoiceStatus: InvoiceStatus;
    paymentRecord: PaymentRecord;
  }> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID ${customerId} no encontrado`,
      );
    }

    const currentBalance = Number(customer.currentBalance);

    if (dto.amount > currentBalance) {
      throw new BadRequestException(
        'El pago excede el saldo pendiente',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Reload customer within transaction
      const lockedCustomer = await queryRunner.manager.findOne(Customer, {
        where: { id: customerId },
      });
      if (!lockedCustomer) {
        throw new NotFoundException(
          `Cliente con ID ${customerId} no encontrado`,
        );
      }

      // 2. Create payment record
      const paymentRecord = queryRunner.manager.create(PaymentRecord, {
        customerId,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        notes: dto.notes ?? null,
      });
      const savedRecord = await queryRunner.manager.save(paymentRecord);

      // 3. Update customer balance
      const newBalance = Number(lockedCustomer.currentBalance) - dto.amount;
      lockedCustomer.currentBalance = newBalance;
      await queryRunner.manager.save(lockedCustomer);

      // 4. Check if invoice should transition to PAID
      const paymentSumResult = await queryRunner.manager
        .createQueryBuilder(PaymentRecord, 'pr')
        .select('COALESCE(SUM(pr.amount), 0)', 'total')
        .where('pr.invoiceId = :invoiceId', { invoiceId: dto.invoiceId })
        .getRawOne<{ total: string }>();

      const totalPayments = Number(paymentSumResult?.total ?? 0);

      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: dto.invoiceId },
        relations: ['items', 'items.product'],
      });

      let invoiceStatus = invoice?.status ?? InvoiceStatus.ON_CREDIT;

      const invoiceTotal = (invoice?.items ?? []).reduce(
        (acc, item) => acc + Number(item.quantity) * Number(item.product?.sellingPrice || 0),
        0,
      );
      if (invoice && totalPayments >= invoiceTotal) {
        invoice.status = InvoiceStatus.PAID;
        await queryRunner.manager.save(invoice);
        invoiceStatus = InvoiceStatus.PAID;
      }

      await queryRunner.commitTransaction();

      return {
        newBalance,
        invoiceStatus,
        paymentRecord: savedRecord,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error instanceof BadRequestException ||
        error instanceof NotFoundException
        ? error
        : new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async getPaymentHistory(
    customerId: string,
    invoiceId?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: PaymentRecordDto[];
    meta: { total: number; page: number; lastPage: number; limit: number };
  }> {
    const where: any = { customerId };
    if (invoiceId) {
      where.invoiceId = invoiceId;
    }
    const skip = (page - 1) * limit;

    const [records, total] = await this.paymentRecordRepository.findAndCount({
      where,
      relations: ['invoice'],
      order: { paymentDate: 'DESC' },
      take: limit,
      skip,
    });

    const data = records.map((r) => ({
      id: r.id,
      invoiceId: r.invoiceId,
      invoiceNumber: (r as any).invoice?.invoiceNumber,
      amount: Number(r.amount),
      paymentDate: r.paymentDate,
      notes: r.notes,
      createdAt: r.createdAt,
    }));

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
        limit,
      },
    };
  }
}
