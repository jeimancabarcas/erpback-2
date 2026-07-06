import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { Customer, CustomerStatus } from './entities/customer.entity';
import { Invoice } from '../sales/entities/invoice.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  async getStats(id: string) {
    const customer = await this.findOne(id);

    const stats = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COUNT(invoice.id)', 'invoiceCount')
      .addSelect('SUM(invoice.totalAmount)', 'totalInvoiced')
      .where('invoice.customer_id = :id', { id })
      .andWhere("invoice.status != 'CANCELLED'")
      .getRawOne<{ invoiceCount?: string; totalInvoiced?: string }>();

    return {
      customer,
      totalInvoiced: Number(stats?.totalInvoiced) || 0,
      invoiceCount: Number(stats?.invoiceCount) || 0,
      creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
      currentBalance: Number(customer.currentBalance),
      creditStatus: customer.creditStatus,
      paymentTermsDays: customer.paymentTermsDays,
    };
  }

  async create(createDto: CreateCustomerDto): Promise<Customer> {
    const existing = await this.customerRepository.findOne({
      where: { documentNumber: createDto.documentNumber },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un cliente con ese número de documento',
      );
    }

    if (createDto.email) {
      const existingEmail = await this.customerRepository.findOne({
        where: { email: createDto.email },
      });
      if (existingEmail) {
        throw new ConflictException(
          'Ya existe un cliente con ese correo electrónico',
        );
      }
    }

    const customer = this.customerRepository.create(createDto);
    return this.customerRepository.save(customer);
  }

  async findAll(
    queryDto: QueryCustomersDto,
  ): Promise<PaginatedResult<Customer>> {
    const { page = 1, limit = 10, sortBy = 'name', order = 'ASC' } = queryDto;
    const skip = (page - 1) * limit;

    let where: FindOptionsWhere<Customer> | FindOptionsWhere<Customer>[];
    if (queryDto.search) {
      const searchVal = `%${queryDto.search}%`;
      const targetStatus = queryDto.status || CustomerStatus.ACTIVE;
      where = [
        { name: ILike(searchVal), status: targetStatus },
        { documentNumber: ILike(searchVal), status: targetStatus },
      ];
    } else {
      where = buildWhere(
        queryDto,
        ['name', 'documentNumber'],
        ['status'],
      ) as FindOptionsWhere<Customer>;
    }

    const [data, total] = await this.customerRepository.findAndCount({
      where,
      order: { [sortBy]: order },
      take: limit,
      skip,
    });

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

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }
    return customer;
  }

  async update(id: string, updateDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    if (
      updateDto.documentNumber &&
      updateDto.documentNumber !== customer.documentNumber
    ) {
      const existing = await this.customerRepository.findOne({
        where: { documentNumber: updateDto.documentNumber },
      });
      if (existing)
        throw new ConflictException(
          'Ya existe un cliente con ese número de documento',
        );
    }

    if (updateDto.email && updateDto.email !== customer.email) {
      const existingEmail = await this.customerRepository.findOne({
        where: { email: updateDto.email },
      });
      if (existingEmail)
        throw new ConflictException(
          'Ya existe un cliente con ese correo electrónico',
        );
    }

    Object.assign(customer, updateDto);
    return this.customerRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customerRepository.remove(customer);
  }
}
