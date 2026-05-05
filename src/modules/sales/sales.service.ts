import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { InventoryService } from '../inventory/inventory.service';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateInvoiceDto): Promise<Invoice> {
    const { items, ...invoiceData } = createDto;

    if (!items || items.length === 0) {
      throw new BadRequestException('La factura debe tener al menos un producto');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Generar número de factura (FAC-0001, etc)
      const count = await this.invoiceRepository.count();
      const invoiceNumber = `FAC-${(count + 1).toString().padStart(4, '0')}`;

      // 2. Calcular totales y verificar stock
      let totalAmount = 0;
      const invoiceItems: InvoiceItem[] = [];

      for (const item of items) {
        // Verificar stock y disminuirlo (usando el manager de la transacción)
        await this.inventoryService.consumeStock(item.productId, item.quantity, queryRunner.manager);

        const subtotal = item.quantity * item.unitPrice;
        totalAmount += subtotal;

        invoiceItems.push(this.invoiceItemRepository.create({
          ...item,
          subtotal,
        }));
      }

      // 3. Crear la factura
      const invoice = this.invoiceRepository.create({
        ...invoiceData,
        date: invoiceData.date || new Date(),
        invoiceNumber,
        totalAmount,
        status: InvoiceStatus.PAID,
        items: invoiceItems,
      });

      const savedInvoice = await queryRunner.manager.save(invoice);
      await queryRunner.commitTransaction();

      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(queryDto: QueryInvoicesDto): Promise<PaginatedResult<Invoice>> {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'DESC' } = queryDto;
    const skip = (page - 1) * limit;

    const where = buildWhere(queryDto, ['invoiceNumber'], ['customerId', 'status']);

    const [data, total] = await this.invoiceRepository.findAndCount({
      where,
      order: { [sortBy]: order },
      take: limit,
      skip,
      relations: ['customer', 'items', 'items.product'],
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

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['customer', 'items', 'items.product'],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    return invoice;
  }
}
