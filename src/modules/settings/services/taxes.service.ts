import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Tax } from '../entities/tax.entity';
import { QueryTaxDto } from '../dto/query-tax.dto';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';

@Injectable()
export class TaxesService {
  constructor(
    @InjectRepository(Tax)
    private readonly repo: Repository<Tax>,
  ) {}

  async findAll(query: QueryTaxDto): Promise<PaginatedResult<Tax>> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Tax> = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
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

  async findOne(id: string): Promise<Tax> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Impuesto con ID ${id} no encontrado`);
    }
    return entity;
  }
}
