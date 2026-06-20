import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { UpdatePurchaseOrderStatusDto } from './dto/update-purchase-order-status.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(createDto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException(
        'La orden de compra debe tener al menos un producto',
      );
    }

    // Generar número de orden (OC-0001, etc)
    const count = await this.purchaseOrderRepository.count();
    const orderNumber = `OC-${(count + 1).toString().padStart(4, '0')}`;

    const purchaseOrder = this.purchaseOrderRepository.create({
      ...createDto,
      orderNumber,
      status: PurchaseOrderStatus.DRAFT,
    });

    return this.purchaseOrderRepository.save(purchaseOrder);
  }

  async update(
    id: string,
    updateDto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const order = await this.findOne(id);

    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Solo se pueden editar órdenes en estado BORRADOR',
      );
    }

    // Actualizar campos básicos
    order.supplierId = updateDto.supplierId;
    order.orderDate = new Date(updateDto.orderDate);
    order.observations = updateDto.observations ?? null;

    // Limpiar items anteriores mediante delete directo para evitar errores de orphanRemoval
    await this.purchaseOrderItemRepository.delete({ purchaseOrderId: id });

    // Asignamos los nuevos items
    order.items = updateDto.items.map((item) => ({
      ...item,
      purchaseOrderId: id,
    })) as any;

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

    const where = buildWhere(queryDto, [], ['status', 'supplierId']);

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

  async updateStatus(
    id: string,
    updateStatusDto: UpdatePurchaseOrderStatusDto,
  ): Promise<PurchaseOrder> {
    const order = await this.findOne(id);
    const previousStatus = order.status;

    order.status = updateStatusDto.status;
    if (updateStatusDto.receiptUrl) {
      order.receiptUrl = updateStatusDto.receiptUrl;
    }

    const savedOrder = await this.purchaseOrderRepository.save(order);

    // If changing to COMPLETED for the first time, update stock
    if (
      updateStatusDto.status === PurchaseOrderStatus.COMPLETED &&
      previousStatus !== PurchaseOrderStatus.COMPLETED
    ) {
      for (const item of order.items) {
        await this.inventoryService.updateStock(
          item.productId,
          item.quantity,
          item.price,
          order.id,
        );
      }
    }

    return savedOrder;
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);

    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Solo se pueden eliminar órdenes en estado BORRADOR',
      );
    }

    await this.purchaseOrderRepository.remove(order);
  }
}
