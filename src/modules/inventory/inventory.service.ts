import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { InventoryCategory } from './entities/inventory-category.entity';
import { Product } from './entities/product.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { UpdateInventoryCategoryDto } from './dto/update-inventory-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
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

  async create(createDto: CreateInventoryCategoryDto): Promise<InventoryCategory> {
    const existing = await this.categoryRepository.findOne({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new ConflictException('La categoría ya existe');
    }

    const category = this.categoryRepository.create(createDto);
    return this.categoryRepository.save(category);
  }

  async findAll(queryDto: QueryCategoriesDto): Promise<PaginatedResult<InventoryCategory>> {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'name', 
      order = 'ASC',
    } = queryDto;
    
    const skip = (page - 1) * limit;

    const queryBuilder = this.categoryRepository.createQueryBuilder('category')
      .loadRelationCountAndMap('category.productsCount', 'category.products');

    if (queryDto.name) {
      queryBuilder.andWhere('category.name ILIKE :name', { name: `%${queryDto.name}%` });
    }

    if (queryDto.description) {
      queryBuilder.andWhere('category.description ILIKE :description', { description: `%${queryDto.description}%` });
    }

    const [data, total] = await queryBuilder
      .orderBy(`category.${sortBy}`, order as 'ASC' | 'DESC')
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

  async update(id: string, updateDto: UpdateInventoryCategoryDto): Promise<InventoryCategory> {
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

  async createProduct(createDto: CreateProductDto): Promise<Product> {
    const { sku, name } = createDto;
    
    const existing = await this.productRepository.findOne({
      where: [{ sku }, { name }],
    });

    if (existing) {
      throw new ConflictException('Ya existe un producto con ese SKU o nombre');
    }

    const product = this.productRepository.create(createDto);
    return this.productRepository.save(product);
  }

  async findAllProducts(queryDto: QueryProductsDto): Promise<PaginatedResult<Product>> {
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

  async updateProduct(id: string, updateDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOneProduct(id);

    if (updateDto.sku && updateDto.sku !== product.sku) {
      const existing = await this.productRepository.findOne({ where: { sku: updateDto.sku } });
      if (existing) throw new ConflictException('Ya existe un producto con ese SKU');
    }

    Object.assign(product, updateDto);
    return this.productRepository.save(product);
  }

  async removeProduct(id: string): Promise<void> {
    const product = await this.findOneProduct(id);
    await this.productRepository.remove(product);
  }

  async updateStock(productId: string, quantity: number, price: number, purchaseOrderId?: string): Promise<Product> {
    const product = await this.findOneProduct(productId);
    
    const currentStock = Number(product.currentStock);
    const currentAvgPrice = Number(product.averagePurchasePrice);
    const newQuantity = Number(quantity);
    const newPrice = Number(price);

    const totalStock = currentStock + newQuantity;
    const newAvgPrice = totalStock > 0 
      ? ((currentStock * currentAvgPrice) + (newQuantity * newPrice)) / totalStock
      : newPrice;

    product.currentStock = totalStock;
    product.averagePurchasePrice = Number(newAvgPrice.toFixed(2));

    // Crear el lote de inventario
    const batch = this.batchRepository.create({
      productId,
      initialQuantity: newQuantity,
      remainingQuantity: newQuantity,
      purchasePrice: newPrice,
      purchaseOrderId,
    });

    await this.batchRepository.save(batch);
    return this.productRepository.save(product);
  }
}
