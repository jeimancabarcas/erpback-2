import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { InventoryCategory } from './entities/inventory-category.entity';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { UpdateInventoryCategoryDto } from './dto/update-inventory-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryCategory)
    private readonly categoryRepository: Repository<InventoryCategory>,
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
      name, 
      description 
    } = queryDto;
    
    const skip = (page - 1) * limit;

    const where = buildWhere(queryDto, ['name', 'description']);

    const [data, total] = await this.categoryRepository.findAndCount({
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
}
