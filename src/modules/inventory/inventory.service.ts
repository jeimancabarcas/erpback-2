import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, MoreThan, EntityManager } from 'typeorm';
import { InventoryCategory } from './entities/inventory-category.entity';
import { Product } from './entities/product.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { InvoiceItem } from '../sales/entities/invoice-item.entity';
import { User } from '../users/entities/user.entity';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { UpdateInventoryCategoryDto } from './dto/update-inventory-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryCategory)
    private readonly categoryRepository: Repository<InventoryCategory>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(InventoryBatch)
    private readonly batchRepository: Repository<InventoryBatch>,
  ) {}

  async create(
    createDto: CreateInventoryCategoryDto,
  ): Promise<InventoryCategory> {
    const existing = await this.categoryRepository.findOne({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new ConflictException('La categoría ya existe');
    }

    const category = this.categoryRepository.create(createDto);
    return this.categoryRepository.save(category);
  }

  async findAll(
    queryDto: QueryCategoriesDto,
  ): Promise<PaginatedResult<InventoryCategory>> {
    const { page = 1, limit = 10, sortBy = 'name', order = 'ASC' } = queryDto;

    const skip = (page - 1) * limit;

    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .loadRelationCountAndMap('category.productsCount', 'category.products');

    if (queryDto.name) {
      queryBuilder.andWhere('category.name ILIKE :name', {
        name: `%${queryDto.name}%`,
      });
    }

    if (queryDto.description) {
      queryBuilder.andWhere('category.description ILIKE :description', {
        description: `%${queryDto.description}%`,
      });
    }

    const [data, total] = await queryBuilder
      .orderBy(`category.${sortBy}`, order)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

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

  async findOne(id: string): Promise<InventoryCategory> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }
    return category;
  }

  async update(
    id: string,
    updateDto: UpdateInventoryCategoryDto,
  ): Promise<InventoryCategory> {
    const category = await this.findOne(id);

    if (updateDto.name && updateDto.name !== category.name) {
      const existing = await this.categoryRepository.findOne({
        where: { name: updateDto.name },
      });
      if (existing) {
        throw new ConflictException('Ya existe una categoría con ese nombre');
      }
    }

    Object.assign(category, updateDto);
    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
  }

  // --- Product Methods ---

  async createProduct(
    createDto: CreateProductDto,
    user?: User,
  ): Promise<Product> {
    const { sku, name } = createDto;

    const existing = await this.productRepository.findOne({
      where: [{ sku }, { name }],
    });

    if (existing) {
      throw new ConflictException('Ya existe un producto con ese SKU o nombre');
    }

    const product = this.productRepository.create(createDto);
    const savedProduct = await this.productRepository.save(product);

    if (savedProduct.currentStock > 0) {
      const initialBatch = this.batchRepository.create({
        productId: savedProduct.id,
        initialQuantity: savedProduct.currentStock,
        remainingQuantity: savedProduct.currentStock,
        purchasePrice: 0,
        adjustmentReason: 'Stock Inicial',
        user,
      });
      await this.batchRepository.save(initialBatch);
    }

    return savedProduct;
  }

  async findAllProducts(
    queryDto: QueryProductsDto,
  ): Promise<PaginatedResult<Product>> {
    const { page = 1, limit = 10, sortBy = 'name', order = 'ASC' } = queryDto;
    const skip = (page - 1) * limit;

    const where = buildWhere(queryDto, ['name', 'sku', 'categoryId']);

    const [data, total] = await this.productRepository.findAndCount({
      where,
      order: { [sortBy]: order },
      take: limit,
      skip,
      relations: ['category'],
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

  async findOneProduct(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    return product;
  }

  async findProductBatches(productId: string): Promise<InventoryBatch[]> {
    return this.batchRepository.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateProduct(
    id: string,
    updateDto: UpdateProductDto,
    user?: User,
  ): Promise<Product> {
    return this.productRepository.manager.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const batchRepo = manager.getRepository(InventoryBatch);

      const product = await productRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      }

      if (updateDto.sku && updateDto.sku !== product.sku) {
        const existing = await productRepo.findOne({
          where: { sku: updateDto.sku },
        });
        if (existing) {
          throw new ConflictException('Ya existe un producto con ese SKU');
        }
      }

      const { adjustmentReason, ...otherUpdates } = updateDto;

      if (updateDto.currentStock !== undefined) {
        const oldStock = Number(product.currentStock) || 0;
        const newStock = Number(updateDto.currentStock) || 0;
        const diff = newStock - oldStock;

        if (diff > 0) {
          const avgPrice = Number(product.averagePurchasePrice) || 0;
          const newBatch = batchRepo.create({
            productId: product.id,
            initialQuantity: diff,
            remainingQuantity: diff,
            purchasePrice: avgPrice,
            adjustmentReason: adjustmentReason,
            user,
          });
          await batchRepo.save(newBatch);

          product.currentStock = newStock;
          Object.assign(product, otherUpdates);
          await productRepo.save(product);

          await this.recalculateAveragePrice(product.id, manager);
        } else if (diff < 0) {
          const absDiff = Math.abs(diff);
          if (oldStock < absDiff) {
            throw new BadRequestException(
              `Stock insuficiente para realizar el ajuste. Disponible: ${oldStock}, Requerido: ${absDiff}`,
            );
          }

          await this.consumeStock(product.id, absDiff, manager);

          const avgPrice = Number(product.averagePurchasePrice) || 0;
          const trackingBatch = batchRepo.create({
            productId: product.id,
            initialQuantity: diff,
            remainingQuantity: 0,
            purchasePrice: avgPrice,
            adjustmentReason: adjustmentReason,
            user,
          });
          await batchRepo.save(trackingBatch);

          const updatedProduct = await productRepo.findOne({ where: { id } });
          if (!updatedProduct) {
            throw new NotFoundException(`Producto con ID ${id} no encontrado`);
          }
          Object.assign(updatedProduct, otherUpdates);
          await productRepo.save(updatedProduct);
        } else {
          Object.assign(product, otherUpdates);
          await productRepo.save(product);
        }
      } else {
        Object.assign(product, otherUpdates);
        await productRepo.save(product);
      }

      const finalProduct = await productRepo.findOne({
        where: { id },
        relations: ['category'],
      });
      if (!finalProduct) {
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      }
      return finalProduct;
    });
  }

  async removeProduct(id: string): Promise<void> {
    const product = await this.findOneProduct(id);
    await this.productRepository.remove(product);
  }

  async updateStock(
    productId: string,
    quantity: number,
    price: number,
    purchaseOrderId?: string,
  ): Promise<Product> {
    const product = await this.findOneProduct(productId);

    // Crear el lote de inventario
    const batch = this.batchRepository.create({
      productId,
      initialQuantity: quantity,
      remainingQuantity: quantity,
      purchasePrice: price,
      purchaseOrderId,
    });

    await this.batchRepository.save(batch);

    // Actualizar stock total
    product.currentStock = Number(product.currentStock) + Number(quantity);
    await this.productRepository.save(product);

    // Recalcular precio promedio basado en lotes con stock
    await this.recalculateAveragePrice(productId);

    return this.findOneProduct(productId);
  }

  async consumeStock(
    productId: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<number> {
    const productRepo = manager
      ? manager.getRepository(Product)
      : this.productRepository;
    const batchRepo = manager
      ? manager.getRepository(InventoryBatch)
      : this.batchRepository;

    const product = await productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Producto no encontrado`);

    if (product.currentStock < quantity) {
      throw new Error(
        `Stock insuficiente para el producto ${product.name}. Disponible: ${product.currentStock}`,
      );
    }

    product.currentStock = Number(product.currentStock) - Number(quantity);
    await productRepo.save(product);

    let remainingToConsume = quantity;
    let totalCost = 0;

    const batches = await batchRepo.find({
      where: { productId, remainingQuantity: MoreThan(0) },
      order: { createdAt: 'ASC' },
    });

    for (const batch of batches) {
      if (remainingToConsume <= 0) break;

      const toConsumeFromBatch = Math.min(
        batch.remainingQuantity,
        remainingToConsume,
      );
      totalCost += toConsumeFromBatch * Number(batch.purchasePrice);

      batch.remainingQuantity -= toConsumeFromBatch;
      remainingToConsume -= toConsumeFromBatch;
      await batchRepo.save(batch);
    }

    // Recalcular precio promedio después de consumir lotes
    await this.recalculateAveragePrice(productId, manager);

    return totalCost;
  }

  private async recalculateAveragePrice(
    productId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const productRepo = manager
      ? manager.getRepository(Product)
      : this.productRepository;
    const batchRepo = manager
      ? manager.getRepository(InventoryBatch)
      : this.batchRepository;

    const batches = await batchRepo.find({
      where: { productId, remainingQuantity: MoreThan(0) },
    });

    if (batches.length === 0) return;

    let totalRemaining = 0;
    let totalValue = 0;

    for (const batch of batches) {
      const remaining = Number(batch.remainingQuantity);
      const price = Number(batch.purchasePrice);
      totalRemaining += remaining;
      totalValue += remaining * price;
    }

    const avgPrice = totalRemaining > 0 ? totalValue / totalRemaining : 0;

    await productRepo.update(productId, {
      averagePurchasePrice: Number(avgPrice.toFixed(2)),
    });
  }

  async getMovements(
    queryDto: QueryMovementsDto,
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'date',
      order = 'DESC',
      type,
      userId,
    } = queryDto;

    // 1. Obtener entradas/salidas desde los lotes creados
    const batches = await this.batchRepository.find({
      relations: ['product', 'user'],
    });

    const batchMovements = batches.map((batch) => {
      const isNegative = Number(batch.initialQuantity) < 0;
      const isManual = !batch.purchaseOrderId;

      const movementType = isNegative ? 'Out' : 'In';
      const idPrefix = isNegative ? 'OUT' : 'IN';

      let origin = 'Proveedor (Compra)';
      let destination = 'Almacén Principal';

      if (isManual) {
        origin = 'Ajuste de inventario';
        destination = 'Ajuste de inventario';
      }

      return {
        id: `${idPrefix}-${batch.id.substring(0, 8).toUpperCase()}`,
        date: batch.createdAt,
        type: movementType,
        product: batch.product ? batch.product.name : 'Producto Eliminado',
        quantity: Math.abs(Number(batch.initialQuantity)),
        origin,
        destination,
        operator: batch.user ? batch.user.email : 'Sistema',
        operatorId: batch.userId,
      };
    });

    // 2. Obtener salidas (Out) desde los ítems facturados de ventas
    const invoiceItemRepo =
      this.productRepository.manager.getRepository(InvoiceItem);
    const invoiceItems = await invoiceItemRepo.find({
      relations: ['product', 'invoice'],
    });

    const outMovements = invoiceItems.map((item) => ({
      id: `OUT-${item.id.substring(0, 8).toUpperCase()}`,
      date: item.invoice?.date
        ? new Date(item.invoice.date)
        : new Date(),
      type: 'Out' as const,
      product: item.product ? item.product.name : 'Producto Eliminado',
      quantity: item.quantity,
      origin: 'Almacén Principal',
      destination: 'Cliente Final',
      operator: 'Sistema',
      operatorId: null,
    }));

    // 3. Unificar
    let movements = [...batchMovements, ...outMovements];

    // 4. Filtrar
    if (type) {
      movements = movements.filter((m) => m.type === type);
    }
    if (userId) {
      movements = movements.filter((m) => m.operatorId === userId);
    }

    // 5. Ordenar
    movements.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const cmp =
        aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return order === 'DESC' ? -cmp : cmp;
    });

    // 6. Paginar
    const total = movements.length;
    const skip = (page - 1) * limit;
    const data = movements.slice(skip, skip + limit);

    // Formatear fecha para respuesta
    const formatted = data.map((m) => ({
      ...m,
      date:
        m.date instanceof Date
          ? m.date.toISOString().split('T')[0]
          : m.date,
    }));

    return {
      data: formatted,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
        limit,
      },
    };
  }

  async getValuation(): Promise<{
    totalValue: number;
    totalStock: number;
    productCount: number;
    averageCostPerUnit: number;
  }> {
    const batches = await this.batchRepository.find({
      where: { remainingQuantity: MoreThan(0) },
      relations: ['product'],
    });

    let totalValue = 0;
    let totalStock = 0;
    const productIds = new Set<string>();

    for (const batch of batches) {
      const qty = Number(batch.remainingQuantity);
      const price = Number(batch.purchasePrice);
      totalStock += qty;
      totalValue += qty * price;
      productIds.add(batch.productId);
    }

    return {
      totalValue: Number(totalValue.toFixed(2)),
      totalStock,
      productCount: productIds.size,
      averageCostPerUnit:
        totalStock > 0
          ? Number((totalValue / totalStock).toFixed(2))
          : 0,
    };
  }
}
