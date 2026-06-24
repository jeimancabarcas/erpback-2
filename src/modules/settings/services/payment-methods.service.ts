import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';
import { QueryPaymentMethodDto } from '../dto/query-payment-method.dto';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly repo: Repository<PaymentMethod>,
  ) {}

  async findAll(
    query: QueryPaymentMethodDto,
  ): Promise<PaginatedResult<PaymentMethod>> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<PaymentMethod> = {};
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

  async findOne(id: string): Promise<PaymentMethod> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Método de pago con ID ${id} no encontrado`);
    }
    return entity;
  }
}
