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
import {
  ServicioProgramado,
  ServicioProgramadoEstado,
} from './entities/servicio-programado.entity';
import { ServicioProgramadoInsumo } from './entities/servicio-programado-insumo.entity';
import { ServicioProgramadoActividad } from './entities/servicio-programado-actividad.entity';
import { Customer } from '../customers/entities/customer.entity';
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
import { CreateProgramadoDto } from './dto/create-programado.dto';
import { QueryProgramadosDto } from './dto/query-programados.dto';
import { ChangeStateDto } from './dto/change-state.dto';
import { CancelDto } from './dto/cancel.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';
import { calculateEndDate } from '../../common/helpers/date.helper';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

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

    @InjectRepository(ServicioProgramado)
    private readonly servicioProgramadoRepository: Repository<ServicioProgramado>,

    @InjectRepository(ServicioProgramadoInsumo)
    private readonly servicioProgramadoInsumoRepository: Repository<ServicioProgramadoInsumo>,

    @InjectRepository(ServicioProgramadoActividad)
    private readonly servicioProgramadoActividadRepository: Repository<ServicioProgramadoActividad>,

    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
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

  // =========================================================================
  // ServicioProgramado CRUD
  // =========================================================================

  async createProgramado(
    createDto: CreateProgramadoDto,
  ): Promise<ServicioProgramado> {
    const { customerId, servicioId, fechaInicioEstimada, insumos, notas } = createDto;

    // Validate customer exists and is active
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID ${customerId} no encontrado`,
      );
    }
    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException('El cliente no está activo');
    }

    // Look up servicio and its activities from original table
    const servicio = await this.servicioRepository.findOne({
      where: { id: servicioId },
      relations: ['actividades', 'actividades.actividad'],
    });
    if (!servicio) {
      throw new NotFoundException(
        `Servicio con ID ${servicioId} no encontrado`,
      );
    }

    // Calculate total hours from service activities
    const rawTotalHoras = (servicio.actividades || []).reduce((total, act) => {
      const horas = act.actividad?.horasEstimadas ?? 0;
      return total + Number(horas) || 0;
    }, 0);
    const totalHoras = Number.isFinite(rawTotalHoras) ? rawTotalHoras : 0;

    Logger.log(`[createProgramado] servicioId=${servicioId}, totalHoras=${totalHoras}, type=${typeof totalHoras}, actividades=${servicio.actividades?.length || 0}`);

    // Calculate end date
    const startDate = new Date(fechaInicioEstimada);
    const fechaFinEstimada = calculateEndDate(startDate, totalHoras);

    return this.servicioProgramadoRepository.manager.transaction(
      async (manager) => {
        // Create programado with snapshot data from servicio
        const newProgramado = manager.create(ServicioProgramado, {
          customer: { id: customerId },
          servicioNombre: servicio.nombre,
          servicioDescripcion: servicio.descripcion,
          servicioPrecioBase: servicio.precioBase,
          fechaInicioEstimada: startDate,
          fechaFinEstimada,
          totalHoras,
          notas,
          estado: ServicioProgramadoEstado.PENDIENTE,
        });

        const saved = await manager.save(newProgramado);

        // Create activity snapshot rows from servicio.actividades
        if (servicio.actividades && servicio.actividades.length > 0) {
          const actividadEntities = servicio.actividades.map((sa) =>
            manager.create(ServicioProgramadoActividad, {
              servicioProgramado: { id: saved.id } as ServicioProgramado,
              actividadNombre: sa.actividad?.nombre || '',
              actividadDescripcion: sa.actividad?.descripcion,
              actividadHorasEstimadas: sa.actividad?.horasEstimadas,
            }),
          );
          await manager.save(ServicioProgramadoActividad, actividadEntities);
        }

        // Create insumo snapshot rows - look up each insumo name
        if (insumos && insumos.length > 0) {
          const insumoEntities: any[] = [];
          for (const i of insumos) {
            const insumoData = await this.insumoRepository.findOne({ where: { id: i.insumoId } });
            if (!insumoData) {
              throw new NotFoundException(
                `Insumo con ID ${i.insumoId} no encontrado`,
              );
            }
            insumoEntities.push(
              this.servicioProgramadoInsumoRepository.create({
                servicioProgramado: { id: saved.id } as ServicioProgramado,
                insumoNombre: insumoData.nombre,
                cantidad: i.cantidad,
              } as any),
            );
          }
          await manager.save(ServicioProgramadoInsumo, insumoEntities);
        }

        // Return with snapshot relations - use manager's repository to ensure
        // we query within the same transaction context as the saves above
        const found = await manager
          .getRepository(ServicioProgramado)
          .findOne({
            where: { id: saved.id },
            relations: [
              'customer',
              'actividades',
              'insumos',
            ],
          });

        return found!;
      },
    );
  }

  async findAllProgramados(
    queryDto: QueryProgramadosDto,
  ): Promise<PaginatedResult<ServicioProgramado>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
      estado,
      customerId,
      dateFrom,
      dateTo,
    } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (estado) where.estado = estado;
    if (customerId) where.customer = { id: customerId };

    // Use proper TypeORM operators for date filtering
    if (dateFrom && dateTo) {
      where.fechaInicioEstimada = Between(new Date(dateFrom), new Date(dateTo));
    } else if (dateFrom) {
      where.fechaInicioEstimada = MoreThanOrEqual(new Date(dateFrom));
    } else if (dateTo) {
      where.fechaInicioEstimada = LessThanOrEqual(new Date(dateTo));
    }

    const [data, total] = await this.servicioProgramadoRepository.findAndCount({
      where,
      order: { [sortBy || 'createdAt']: order || 'DESC' },
      take: limit,
      skip,
      relations: ['customer', 'actividades', 'insumos'],
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

  async findOneProgramado(id: string): Promise<ServicioProgramado> {
    const programado = await this.servicioProgramadoRepository.findOne({
      where: { id },
      relations: ['customer', 'actividades', 'insumos'],
    });
    if (!programado) {
      throw new NotFoundException(
        `Servicio programado con ID ${id} no encontrado`,
      );
    }
    return programado;
  }

  async changeState(
    id: string,
    dto: ChangeStateDto,
  ): Promise<ServicioProgramado> {
    const programado = await this.servicioProgramadoRepository.findOne({
      where: { id },
      relations: ['actividades', 'insumos'],
    });
    if (!programado) {
      throw new NotFoundException(
        `Servicio programado con ID ${id} no encontrado`,
      );
    }

    const { estado: nuevoEstado, motivo } = dto;

    // Validate transition
    const validTransitions: Record<string, string[]> = {
      [ServicioProgramadoEstado.PENDIENTE]: [
        ServicioProgramadoEstado.INICIADO,
        ServicioProgramadoEstado.CANCELADO,
      ],
      [ServicioProgramadoEstado.INICIADO]: [
        ServicioProgramadoEstado.PAUSADO,
        ServicioProgramadoEstado.FINALIZADO,
        ServicioProgramadoEstado.CANCELADO,
      ],
      [ServicioProgramadoEstado.PAUSADO]: [
        ServicioProgramadoEstado.INICIADO,
        ServicioProgramadoEstado.FINALIZADO,
        ServicioProgramadoEstado.CANCELADO,
      ],
      [ServicioProgramadoEstado.FINALIZADO]: [],
      [ServicioProgramadoEstado.CANCELADO]: [],
    };

    const currentEstado = programado.estado;
    const allowed = validTransitions[currentEstado] || [];

    if (!allowed.includes(nuevoEstado)) {
      if (
        currentEstado === ServicioProgramadoEstado.CANCELADO ||
        currentEstado === ServicioProgramadoEstado.FINALIZADO
      ) {
        throw new BadRequestException(
          'No se puede cambiar el estado de un servicio cancelado o finalizado',
        );
      }
      throw new BadRequestException(
        `Transición de estado inválida: ${currentEstado} → ${nuevoEstado}`,
      );
    }

    // Motivo required for PAUSADO and CANCELADO
    if (
      (nuevoEstado === ServicioProgramadoEstado.PAUSADO ||
        nuevoEstado === ServicioProgramadoEstado.CANCELADO) &&
      !motivo
    ) {
      throw new BadRequestException(
        'El motivo es obligatorio para el estado ' + nuevoEstado,
      );
    }

    // Update state
    programado.estado = nuevoEstado as ServicioProgramadoEstado;
    programado.motivoEstado = motivo || programado.motivoEstado;

    // Recalculate end date when transitioning to INICIADO (using snapshot data)
    if (nuevoEstado === ServicioProgramadoEstado.INICIADO) {
      const totalHoras = (programado.actividades || []).reduce(
        (total, act) => total + (act.actividadHorasEstimadas || 0),
        0,
      );
      programado.fechaFinEstimada = calculateEndDate(
        programado.fechaInicioEstimada,
        totalHoras,
      );
    }

    return this.servicioProgramadoRepository.save(programado);
  }

  async cancelProgramado(
    id: string,
    dto: CancelDto,
  ): Promise<ServicioProgramado> {
    const programado = await this.servicioProgramadoRepository.findOne({
      where: { id },
      relations: ['insumos'],
    });
    if (!programado) {
      throw new NotFoundException(
        `Servicio programado con ID ${id} no encontrado`,
      );
    }

    if (
      programado.estado === ServicioProgramadoEstado.FINALIZADO ||
      programado.estado === ServicioProgramadoEstado.CANCELADO
    ) {
      throw new BadRequestException(
        'No se puede cancelar un servicio ya finalizado o cancelado',
      );
    }

    programado.estado = ServicioProgramadoEstado.CANCELADO;
    programado.motivoEstado = dto.motivo;

    return this.servicioProgramadoRepository.save(programado);
  }
}
