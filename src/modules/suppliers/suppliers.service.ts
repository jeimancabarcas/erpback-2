import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async create(createDto: CreateSupplierDto): Promise<Supplier> {
    const existing = await this.supplierRepository.findOne({
      where: { nit: createDto.nit },
    });

    if (existing) {
      throw new ConflictException('Ya existe un proveedor con ese NIT');
    }

    const supplier = this.supplierRepository.create(createDto);
    return this.supplierRepository.save(supplier);
  }

  async findAll(
    queryDto: QuerySuppliersDto,
  ): Promise<PaginatedResult<Supplier>> {
    const { page = 1, limit = 10, sortBy = 'name', order = 'ASC' } = queryDto;
    const skip = (page - 1) * limit;

    let where: FindOptionsWhere<Supplier> | FindOptionsWhere<Supplier>[];
    if (queryDto.search) {
      const searchVal = `%${queryDto.search}%`;
      where = [
        { name: ILike(searchVal) },
        { nit: ILike(searchVal) },
        { email: ILike(searchVal) },
      ];
    } else {
      where = buildWhere(queryDto, ['name', 'nit', 'email']) as FindOptionsWhere<Supplier>;
    }

    const [data, total] = await this.supplierRepository.findAndCount({
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

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
    }
    return supplier;
  }

  async update(id: string, updateDto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);

    if (updateDto.nit && updateDto.nit !== supplier.nit) {
      const existing = await this.supplierRepository.findOne({
        where: { nit: updateDto.nit },
      });
      if (existing)
        throw new ConflictException('Ya existe un proveedor con ese NIT');
    }

    Object.assign(supplier, updateDto);
    return this.supplierRepository.save(supplier);
  }

  async remove(id: string): Promise<void> {
    const supplier = await this.findOne(id);
    await this.supplierRepository.remove(supplier);
  }
}
