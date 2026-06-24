import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { PaymentType } from '../entities/payment-type.entity';
import { QueryPaymentTypeDto } from '../dto/query-payment-type.dto';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';

@Injectable()
export class PaymentTypesService {
  constructor(
    @InjectRepository(PaymentType)
    private readonly repo: Repository<PaymentType>,
  ) {}

  async findAll(
    query: QueryPaymentTypeDto,
  ): Promise<PaginatedResult<PaymentType>> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<PaymentType> = {};
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

  async findOne(id: string): Promise<PaymentType> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Tipo de pago con ID ${id} no encontrado`);
    }
    return entity;
  }
}
