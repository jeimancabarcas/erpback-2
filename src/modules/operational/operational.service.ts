import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actividad } from './entities/actividad.entity';
import { Insumo } from './entities/insumo.entity';
import { Servicio } from './entities/servicio.entity';
import { ServicioActividad } from './entities/servicio-actividad.entity';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { QueryActividadDto } from './dto/query-actividad.dto';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { QueryInsumoDto } from './dto/query-insumo.dto';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { QueryServicioDto } from './dto/query-servicio.dto';
import { CreateServicioActividadDto } from './dto/create-servicio-actividad.dto';
import { UpdateServicioActividadDto } from './dto/update-servicio-actividad.dto';
import { QueryServicioActividadDto } from './dto/query-servicio-actividad.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';

@Injectable()
export class OperationalService {
  private readonly logger = new Logger(OperationalService.name);

  constructor(
    @InjectRepository(Actividad)
    private readonly actividadRepository: Repository<Actividad>,

    @InjectRepository(Insumo)
    private readonly insumoRepository: Repository<Insumo>,

    @InjectRepository(Servicio)
    private readonly servicioRepository: Repository<Servicio>,

    @InjectRepository(ServicioActividad)
    private readonly servicioActividadRepository: Repository<ServicioActividad>,
  ) {}

  // =========================================================================
  // Actividad CRUD
  // =========================================================================

  async createActividad(
    createDto: CreateActividadDto,
  ): Promise<Actividad> {
    const existing = await this.actividadRepository.findOne({
      where: { nombre: createDto.nombre },
    });

    if (existing) {
      throw new ConflictException('Ya existe una actividad con ese nombre');
    }

    const actividad = this.actividadRepository.create(createDto);
    return this.actividadRepository.save(actividad);
  }

  async findAllActividades(
    queryDto: QueryActividadDto,
  ): Promise<PaginatedResult<Actividad>> {
    const { page = 1, limit = 10, sortBy = 'nombre', order = 'ASC' } = queryDto;
    const skip = (page - 1) * limit;

    const where = buildWhere(queryDto, ['nombre', 'horasEstimadas']);

    const [data, total] = await this.actividadRepository.findAndCount({
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

  async findOneActividad(id: string): Promise<Actividad> {
    const actividad = await this.actividadRepository.findOne({ where: { id } });
    if (!actividad) {
      throw new NotFoundException(`Actividad con ID ${id} no encontrada`);
    }
    return actividad;
  }

  async updateActividad(
    id: string,
    updateDto: UpdateActividadDto,
  ): Promise<Actividad> {
    const actividad = await this.findOneActividad(id);

    if (updateDto.nombre && updateDto.nombre !== actividad.nombre) {
      const existing = await this.actividadRepository.findOne({
        where: { nombre: updateDto.nombre },
      });
      if (existing) {
        throw new ConflictException('Ya existe una actividad con ese nombre');
      }
    }

    Object.assign(actividad, updateDto);
    return this.actividadRepository.save(actividad);
  }

  async removeActividad(id: string): Promise<void> {
    const actividad = await this.findOneActividad(id);

    // RESTRICT: check if referenced by ServicioActividad
    const reference = await this.servicioActividadRepository.findOne({
      where: { actividad: { id } },
    });

    if (reference) {
      throw new BadRequestException(
        'No se puede eliminar la actividad porque está asociada a un servicio',
      );
    }

    await this.actividadRepository.remove(actividad);
  }

  // =========================================================================
  // Insumo CRUD
  // =========================================================================

  async createInsumo(createDto: CreateInsumoDto): Promise<Insumo> {
    const existing = await this.insumoRepository.findOne({
      where: { nombre: createDto.nombre },
    });

    if (existing) {
      throw new ConflictException('Ya existe un insumo con ese nombre');
    }

    const insumo = this.insumoRepository.create(createDto);
    return this.insumoRepository.save(insumo);
  }

  async findAllInsumos(
    queryDto: QueryInsumoDto,
  ): Promise<PaginatedResult<Insumo>> {
    const { page = 1, limit = 10, sortBy = 'nombre', order = 'ASC' } = queryDto;
    const skip = (page - 1) * limit;

    const where = buildWhere(queryDto, ['nombre']);

    const [data, total] = await this.insumoRepository.findAndCount({
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

  async findOneInsumo(id: string): Promise<Insumo> {
    const insumo = await this.insumoRepository.findOne({ where: { id } });
    if (!insumo) {
      throw new NotFoundException(`Insumo con ID ${id} no encontrado`);
    }
    return insumo;
  }

  async updateInsumo(
    id: string,
    updateDto: UpdateInsumoDto,
  ): Promise<Insumo> {
    const insumo = await this.findOneInsumo(id);

    if (updateDto.nombre && updateDto.nombre !== insumo.nombre) {
      const existing = await this.insumoRepository.findOne({
        where: { nombre: updateDto.nombre },
      });
      if (existing) {
        throw new ConflictException('Ya existe un insumo con ese nombre');
      }
    }

    Object.assign(insumo, updateDto);
    return this.insumoRepository.save(insumo);
  }

  async removeInsumo(id: string): Promise<void> {
    const insumo = await this.findOneInsumo(id);
    await this.insumoRepository.remove(insumo);
  }

  // =========================================================================
  // Servicio CRUD
  // =========================================================================

  async createServicio(createDto: CreateServicioDto): Promise<Servicio> {
    const existing = await this.servicioRepository.findOne({
      where: { nombre: createDto.nombre },
    });

    if (existing) {
      throw new ConflictException('Ya existe un servicio con ese nombre');
    }

    const servicio = await this.servicioRepository.manager.transaction(async (manager) => {
      const { actividades, ...serviceData } = createDto;
      const newServicio = manager.create(Servicio, serviceData);
      const saved = await manager.save(newServicio);

      if (createDto.actividades && createDto.actividades.length > 0) {
        const activityEntities = createDto.actividades.map((a) =>
          manager.create(ServicioActividad, {
            servicio: { id: saved.id },
            actividad: { id: a.actividadId },
          })
        );
        await manager.save(ServicioActividad, activityEntities);
      }

      return saved;
    });

    const found = await this.servicioRepository.findOne({
      where: { id: servicio.id },
      relations: ['actividades', 'actividades.actividad'],
    });

    return found!;
  }

  async findAllServicios(
    queryDto: QueryServicioDto,
  ): Promise<PaginatedResult<Servicio>> {
    const { page = 1, limit = 10, sortBy = 'nombre', order = 'ASC' } = queryDto;
    const skip = (page - 1) * limit;

    const where = buildWhere(queryDto, ['nombre']);

    const [data, total] = await this.servicioRepository.findAndCount({
      where,
      order: { [sortBy]: order },
      take: limit,
      skip,
      relations: ['actividades', 'actividades.actividad'],
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

  async findOneServicio(id: string): Promise<Servicio> {
    const servicio = await this.servicioRepository.findOne({
      where: { id },
      relations: ['actividades', 'actividades.actividad'],
    });
    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    return servicio;
  }

  async updateServicio(
    id: string,
    updateDto: UpdateServicioDto,
  ): Promise<Servicio> {
    const servicio = await this.servicioRepository.findOne({
      where: { id },
      relations: ['actividades'],
    });
    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }

    return this.servicioRepository.manager.transaction(async (manager) => {
      const { actividades, ...serviceData } = updateDto;
      Object.assign(servicio, serviceData);
      await manager.save(servicio);

      if (actividades !== undefined) {
        await manager.delete(ServicioActividad, { servicio: { id } });

        if (actividades.length > 0) {
          const activityEntities = actividades.map((a) =>
            manager.create(ServicioActividad, {
              servicio: { id },
              actividad: { id: a.actividadId },
            })
          );
          await manager.save(ServicioActividad, activityEntities);
        }
      }

      const updated = await manager.findOne(Servicio, {
        where: { id },
        relations: ['actividades', 'actividades.actividad'],
      });

      return updated!;
    });
  }

  async removeServicio(id: string): Promise<void> {
    const servicio = await this.findOneServicio(id);

    // CASCADE: TypeORM onDelete: CASCADE on ServicioActividad.servicio handles FK cleanup
    await this.servicioRepository.remove(servicio);
  }

  // =========================================================================
  // ServicioActividad CRUD
  // =========================================================================

  async createServicioActividad(
    createDto: CreateServicioActividadDto,
  ): Promise<ServicioActividad> {
    const servicio = await this.servicioRepository.findOne({ where: { id: createDto.servicioId } });
    if (!servicio) {
      throw new NotFoundException(
        `Servicio con ID ${createDto.servicioId} no encontrado`,
      );
    }

    const actividad = await this.actividadRepository.findOne({ where: { id: createDto.actividadId } });
    if (!actividad) {
      throw new NotFoundException(
        `Actividad con ID ${createDto.actividadId} no encontrada`,
      );
    }

    const existing = await this.servicioActividadRepository.findOne({
      where: { servicio: { id: createDto.servicioId }, actividad: { id: createDto.actividadId } },
    });

    if (existing) {
      throw new ConflictException(
        'La actividad ya está asociada a este servicio',
      );
    }

    const pivot = this.servicioActividadRepository.create({
      servicio: { id: createDto.servicioId },
      actividad: { id: createDto.actividadId },
    });

    return this.servicioActividadRepository.save(pivot);
  }

  async findAllServicioActividades(
    queryDto: QueryServicioActividadDto,
  ): Promise<PaginatedResult<ServicioActividad>> {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'DESC' } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (queryDto.servicioId) {
      where.servicioId = queryDto.servicioId;
    }

    const [data, total] = await this.servicioActividadRepository.findAndCount({
      where,
      order: { [sortBy]: order },
      take: limit,
      skip,
      relations: ['servicio', 'actividad'],
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

  async findOneServicioActividad(id: string): Promise<ServicioActividad> {
    const pivot = await this.servicioActividadRepository.findOne({
      where: { id },
      relations: ['servicio', 'actividad'],
    });
    if (!pivot) {
      throw new NotFoundException(
        `Relación servicio-actividad con ID ${id} no encontrada`,
      );
    }
    return pivot;
  }

  async updateServicioActividad(
    id: string,
    updateDto: UpdateServicioActividadDto,
  ): Promise<ServicioActividad> {
    const pivot = await this.findOneServicioActividad(id);
    Object.assign(pivot, updateDto);
    return this.servicioActividadRepository.save(pivot);
  }

  async removeServicioActividad(id: string): Promise<void> {
    const pivot = await this.findOneServicioActividad(id);
    await this.servicioActividadRepository.remove(pivot);
  }

  async removeServicioActividadByRefs(servicioId: string, actividadId: string): Promise<void> {
    const pivot = await this.servicioActividadRepository.findOne({
      where: { servicio: { id: servicioId }, actividad: { id: actividadId } },
    });

    if (!pivot) {
      throw new NotFoundException(
        `Relación servicio ${servicioId} → actividad ${actividadId} no encontrada`,
      );
    }

    await this.servicioActividadRepository.delete(pivot.id);
  }
}
