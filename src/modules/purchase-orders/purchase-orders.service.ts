import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
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

    return this.purchaseOrderRepository.manager.transaction(async (manager) => {
      const orderRepo = manager.getRepository(PurchaseOrder);

      // Generate order number (OC-0001, etc)
      const count = await orderRepo.count();
      const orderNumber = `OC-${(count + 1).toString().padStart(4, '0')}`;

      const purchaseOrder = orderRepo.create({
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

      const savedOrder = await orderRepo.save(purchaseOrder);

      // Update stock for each item within the same transaction
      for (const item of savedOrder.items) {
        await this.inventoryService.updateStock(
          item.productId,
          item.quantity,
          item.price,
          savedOrder.id,
          undefined,
          manager,
        );
      }

      // Reload with relations for the response
      return orderRepo.findOne({
        where: { id: savedOrder.id },
        relations: ['supplier', 'items', 'items.product'],
      }) as Promise<PurchaseOrder>;
    });
  }

  async update(
    id: string,
    updateDto: UpdatePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const order = await this.findOne(id);

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
    await this.purchaseOrderRepository.manager.transaction(async (manager) => {
      const orderRepo = manager.getRepository(PurchaseOrder);

      const order = await orderRepo.findOne({
        where: { id },
        relations: ['items'],
      });

      if (!order) {
        throw new NotFoundException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      // Reverse stock for each item using consumeStock
      for (const item of order.items) {
        await this.inventoryService.consumeStock(
          item.productId,
          item.quantity,
          manager,
          {
            referenceType: 'PURCHASE_ORDER_REVERSAL',
            referenceId: order.id,
          },
        );
      }

      // Delete the purchase order (items cascade)
      await orderRepo.remove(order);
    });
  }
}
