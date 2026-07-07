import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderSupportDocument } from './entities/purchase-order-support-document.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';
import { InventoryService } from '../inventory/inventory.service';
import type {
  IFactusInvoicingGateway,
  FactusSupportDocumentRequest,
} from '../factus/interfaces/factus-invoicing-gateway.interface';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { extname } from 'path';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,

    @InjectRepository(PurchaseOrderSupportDocument)
    private readonly supportDocumentRepository: Repository<PurchaseOrderSupportDocument>,
    private readonly inventoryService: InventoryService,
    @Inject('IFactusInvoicingGateway')
    private readonly factusGateway: IFactusInvoicingGateway,
    private readonly configService: ConfigService,
  ) {}

  async create(createDto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException(
        'La orden de compra debe tener al menos un producto',
      );
    }

    // Generate order number (OC-0001, etc)
    const count = await this.purchaseOrderRepository.count();
    const orderNumber = `OC-${(count + 1).toString().padStart(4, '0')}`;

    const purchaseOrder = this.purchaseOrderRepository.create({
      supplierId: createDto.supplierId,
      orderDate: new Date(createDto.orderDate),
      observations: createDto.observations ?? null,
      orderNumber,
      items: createDto.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
    });

    const savedOrder = await this.purchaseOrderRepository.save(purchaseOrder);

    // Reload with relations for the response
    return this.purchaseOrderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['supplier', 'items', 'items.product'],
    }) as Promise<PurchaseOrder>;
  }

  async complete(
    id: string,
    file?: Express.Multer.File,
  ): Promise<PurchaseOrder> {
    // Save file outside transaction — orphaned file on rollback is acceptable for V1
    let supportFileUrl: string | null = null;
    if (file) {
      const orderDir = join(process.cwd(), 'uploads', 'purchase-orders', id);
      mkdirSync(orderDir, { recursive: true });
      const fileExt = extname(file.originalname);
      const filename = `support-${Date.now()}${fileExt}`;
      const filePath = join(orderDir, filename);
      writeFileSync(filePath, file.buffer);
      supportFileUrl = `/uploads/purchase-orders/${id}/${filename}`;
    }

    return this.purchaseOrderRepository.manager.transaction(async (manager) => {
      const orderRepo = manager.getRepository(PurchaseOrder);

      // Lock row first without relations (FOR UPDATE + LEFT JOIN is invalid in PG)
      const locked = await orderRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!locked) {
        throw new NotFoundException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      // Then load relations (still inside transaction, row stays locked)
      const order = await orderRepo.findOne({
        where: { id },
        relations: ['items', 'items.product', 'supplier'],
      });

      if (!order) {
        throw new NotFoundException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      if (order.status !== 'CREATED') {
        throw new ConflictException(
          'Solo se pueden completar órdenes en estado CREATED',
        );
      }

      order.status = 'COMPLETED';
      if (supportFileUrl) {
        order.supportFileUrl = supportFileUrl;
      }

      await orderRepo.save(order);

      // Update stock for each item within the same transaction
      for (const item of order.items) {
        await this.inventoryService.updateStock(
          item.productId,
          item.quantity,
          item.price,
          order.id,
          undefined,
          manager,
        );
      }

      return orderRepo.findOne({
        where: { id: order.id },
        relations: ['supplier', 'items', 'items.product'],
      }) as Promise<PurchaseOrder>;
    });
  }

  async cancel(id: string): Promise<PurchaseOrder> {
    return this.purchaseOrderRepository.manager
      .transaction(async (manager) => {
        const orderRepo = manager.getRepository(PurchaseOrder);

        // Lock row first without relations (FOR UPDATE + LEFT JOIN is invalid in PG)
        const locked = await orderRepo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!locked) {
          throw new NotFoundException(
            `Orden de compra con ID ${id} no encontrada`,
          );
        }

        // Then load relations (still inside transaction, row stays locked)
        const order = await orderRepo.findOne({
          where: { id },
          relations: ['items', 'items.product', 'supplier'],
        });

        if (!order) {
          throw new NotFoundException(
            `Orden de compra con ID ${id} no encontrada`,
          );
        }

        if (order.status === 'CANCELLED') {
          throw new ConflictException('La orden ya está cancelada');
        }

        if (order.status === 'CREATED') {
          // Simple cancel — no inventory impact
          order.status = 'CANCELLED';
          await orderRepo.save(order);
          return order;
        }

        if (order.status === 'COMPLETED') {
          // Cancel with inventory reversal
          for (const item of order.items) {
            await this.inventoryService.consumeStock(
              item.productId,
              item.quantity,
              manager,
              {
                referenceType: 'PURCHASE_ORDER_CANCELLATION',
                referenceId: order.id,
              },
            );
          }

          order.status = 'CANCELLED';
          await orderRepo.save(order);
          return order;
        }

        return order;
      })
      .then(async (order) => {
        // Best-effort: destroy support documents in Factus (outside transaction)
        const supportDocs = await this.supportDocumentRepository.find({
          where: { purchaseOrderId: order.id },
        });
        for (const doc of supportDocs) {
          if (doc.referenceCode) {
            try {
              await this.factusGateway.destroySupportDocument(
                doc.referenceCode,
              );
            } catch (err: any) {
              this.logger.warn(
                `Failed to destroy support document ${doc.referenceCode}: ${err.message}`,
              );
            }
          }
        }

        // Reload with full relations for the response
        return this.findOne(order.id);
      });
  }

  async emitSupportDocument(id: string): Promise<PurchaseOrderSupportDocument> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'items.product.taxes', 'supplier'],
    });

    if (!order) {
      throw new NotFoundException(`Orden de compra con ID ${id} no encontrada`);
    }

    if (order.status !== 'COMPLETED') {
      throw new ConflictException(
        'Solo se pueden emitir documentos soporte para órdenes COMPLETED',
      );
    }

    const existingDocs = await this.supportDocumentRepository.find({
      where: { purchaseOrderId: order.id },
    });
    if (existingDocs.length > 0) {
      throw new ConflictException(
        'Ya existe un documento soporte para esta orden',
      );
    }

    // Validate supplier has all required Factus fields
    const supplier = order.supplier;
    const missingFields: string[] = [];
    if (!supplier.nit) missingFields.push('NIT');
    if (!supplier.name) missingFields.push('name');
    if (!supplier.address) missingFields.push('address');
    if (!supplier.municipalityCode) missingFields.push('municipalityCode');
    if (!supplier.legalOrganizationCode)
      missingFields.push('legalOrganizationCode');

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `El proveedor no tiene los campos requeridos para emitir documento soporte: ${missingFields.join(', ')}`,
      );
    }

    // Generate reference code: DS-{orderNumber}-{timestamp}
    const timestamp = Math.floor(Date.now() / 1000);
    const referenceCode = `DS-${order.orderNumber}-${timestamp}`;

    // Calculate total including taxes (match Factus document total)
    const total = order.items.reduce((sum, item) => {
      const subtotal = Number(item.quantity) * Number(item.price);
      const taxes = item.product.taxes || [];
      const totalTaxRate = taxes.reduce(
        (rateSum, tax: any) => rateSum + Number(tax.percentage),
        0,
      );
      const taxAmount =
        totalTaxRate > 0
          ? Math.round(subtotal * (totalTaxRate / 100) * 100) / 100
          : 0;
      return sum + subtotal + taxAmount;
    }, 0);

    // Build Factus payload
    const factusPayload: FactusSupportDocumentRequest = {
      referenceCode,
      createdTime: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      observation: order.observations || '',
      paymentDetails: [
        {
          paymentForm: '1',
          paymentMethodCode: '10',
          amount: total.toFixed(2),
        },
      ],
      provider: {
        identification_document_code: '31', // NIT
        identification: supplier.nit.split('-')[0] || supplier.nit,
        dv: supplier.dv || undefined,
        names: supplier.name,
        address: supplier.address,
        country_code: 'CO',
        municipality_code: supplier.municipalityCode!,
        legal_organization_code: supplier.legalOrganizationCode!,
      },
      items: order.items.map((item) => ({
        codeReference: item.product.sku || item.product.id,
        name: item.product.name,
        quantity: Number(item.quantity),
        discountRate: 0,
        price: Number(item.price),
        unitMeasureCode: '94',
        standardCode: '999',
        taxes: (item.product.taxes || []).map((tax: any) => ({
          code: tax.code,
          rate: Number(tax.percentage ?? 0).toFixed(2),
        })),
      })),
    };

    // Call Factus
    let factusResponse: any;
    try {
      factusResponse =
        await this.factusGateway.createSupportDocument(factusPayload);
    } catch (err: any) {
      throw new BadRequestException(
        `Error al emitir documento soporte en Factus: ${err.message}`,
      );
    }

    // Save support document
    const data = factusResponse.data || {};
    const supportDoc = this.supportDocumentRepository.create({
      referenceCode: data.referenceCode || factusResponse.referenceCode,
      number: data.number || factusResponse.number || null,
      cude: data.cude || data.cuds || null,
      qrUrl: data.qrUrl || null,
      publicUrl: data.publicUrl || null,
      validatedAt: data.validatedAt || null,
      isValidated: data.isValidated ?? false,
      errors: data.errors || null,
      totals: data.totals
        ? {
            grossAmount: String(data.totals.grossAmount ?? ''),
            taxableAmount: String(data.totals.taxableAmount ?? ''),
            taxAmount: String(data.totals.taxAmount ?? ''),
            total: String(data.totals.total ?? ''),
          }
        : null,
      purchaseOrderId: order.id,
    });

    return this.supportDocumentRepository.save(supportDoc);
  }

  async downloadSupportDocumentPdf(
    id: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }> {
    const supportDoc = await this.supportDocumentRepository.findOne({
      where: { purchaseOrderId: id },
    });

    if (!supportDoc) {
      throw new NotFoundException(
        'No se encontró documento soporte para esta orden',
      );
    }

    const number = supportDoc.number;
    if (!number) {
      throw new NotFoundException(
        'El documento soporte no tiene número asignado',
      );
    }

    try {
      return await this.factusGateway.downloadSupportDocumentPdf(number);
    } catch (err: any) {
      throw new BadRequestException(
        `Error al descargar PDF de Factus: ${err.message}`,
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdatePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const order = await this.findOne(id);

    if (order.status !== 'CREATED') {
      throw new ConflictException(
        'Solo se pueden editar órdenes en estado CREATED',
      );
    }

    if (updateDto.orderDate !== undefined) {
      order.orderDate = new Date(updateDto.orderDate);
    }
    if (updateDto.observations !== undefined) {
      order.observations = updateDto.observations;
    }

    return this.purchaseOrderRepository.save(order);
  }

  async findAll(
    queryDto: QueryPurchaseOrdersDto,
  ): Promise<PaginatedResult<PurchaseOrder>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
    } = queryDto;
    const skip = (page - 1) * limit;

    const where = buildWhere(queryDto, [], ['supplierId']);

    const [data, total] = await this.purchaseOrderRepository.findAndCount({
      where,
      order: { [sortBy]: order },
      take: limit,
      skip,
      relations: ['supplier', 'items', 'items.product'],
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

  async findOne(id: string): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id },
      relations: ['supplier', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException(`Orden de compra con ID ${id} no encontrada`);
    }

    return order;
  }

  async remove(id: string): Promise<void> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException(`Orden de compra con ID ${id} no encontrada`);
    }

    if (order.status !== 'CREATED') {
      throw new ConflictException(
        'Solo se pueden eliminar órdenes en estado CREATED',
      );
    }

    // CREATED orders have no inventory impact — just delete
    await this.purchaseOrderRepository.remove(order);
  }
}
