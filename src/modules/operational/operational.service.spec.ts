import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationalService } from './operational.service';
import { Actividad } from './entities/actividad.entity';
import { Insumo } from './entities/insumo.entity';
import { Servicio } from './entities/servicio.entity';
import { ServicioActividad } from './entities/servicio-actividad.entity';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { CreateServicioActividadDto } from './dto/create-servicio-actividad.dto';
import { UpdateServicioActividadDto } from './dto/update-servicio-actividad.dto';
import { validate } from 'class-validator';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ServicioProgramado, ServicioProgramadoEstado } from './entities/servicio-programado.entity';
import { ServicioProgramadoInsumo } from './entities/servicio-programado-insumo.entity';
import { ServicioProgramadoActividad } from './entities/servicio-programado-actividad.entity';
import { Customer, CustomerStatus } from '../customers/entities/customer.entity';
import { CreateProgramadoDto, CreateProgramadoInsumoDto } from './dto/create-programado.dto';
import { ChangeStateDto } from './dto/change-state.dto';
import { CancelDto } from './dto/cancel.dto';
import { QueryProgramadosDto } from './dto/query-programados.dto';

describe('OperationalService', () => {
  let service: OperationalService;
  let actividadRepo: Repository<Actividad>;
  let insumoRepo: Repository<Insumo>;
  let servicioRepo: Repository<Servicio>;
  let servicioActividadRepo: Repository<ServicioActividad>;

  const mockActividadRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    findAndCount: jest.fn(),
    manager: {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    },
  };

  const mockInsumoRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockServicioRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockServicioActividadRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    findAndCount: jest.fn(),
    manager: {
      getRepository: jest.fn(),
      transaction: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationalService,
        {
          provide: getRepositoryToken(Actividad),
          useValue: mockActividadRepository,
        },
        {
          provide: getRepositoryToken(Insumo),
          useValue: mockInsumoRepository,
        },
        {
          provide: getRepositoryToken(Servicio),
          useValue: mockServicioRepository,
        },
        {
          provide: getRepositoryToken(ServicioActividad),
          useValue: mockServicioActividadRepository,
        },
      ],
    }).compile();

    service = module.get<OperationalService>(OperationalService);
    actividadRepo = module.get<Repository<Actividad>>(
      getRepositoryToken(Actividad),
    );
    insumoRepo = module.get<Repository<Insumo>>(getRepositoryToken(Insumo));
    servicioRepo = module.get<Repository<Servicio>>(
      getRepositoryToken(Servicio),
    );
    servicioActividadRepo = module.get<Repository<ServicioActividad>>(
      getRepositoryToken(ServicioActividad),
    );

    jest.resetAllMocks();
  });

  // =========================================================================
  // Actividad CRUD Tests
  // =========================================================================

  describe('Actividad CRUD', () => {
    it('should create an actividad', async () => {
      const createDto: CreateActividadDto = {
        nombre: 'Plomería',
        descripcion: 'Servicio de plomería',
      };

      const mockActividad = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        ...createDto,
      } as Actividad;

      mockActividadRepository.findOne.mockResolvedValue(null);
      mockActividadRepository.create.mockReturnValue(mockActividad);
      mockActividadRepository.save.mockResolvedValue(mockActividad);

      const result = await service.createActividad(createDto);

      expect(actividadRepo.findOne).toHaveBeenCalledWith({
        where: { nombre: createDto.nombre },
      });
      expect(actividadRepo.create).toHaveBeenCalledWith(createDto);
      expect(actividadRepo.save).toHaveBeenCalledWith(mockActividad);
      expect(result).toEqual(mockActividad);
    });

    it('should throw ConflictException when actividad name already exists', async () => {
      const createDto: CreateActividadDto = {
        nombre: 'Plomería',
      };

      const existing = {
        id: 'existing-id',
        nombre: 'Plomería',
      } as Actividad;

      mockActividadRepository.findOne.mockResolvedValue(existing);

      await expect(service.createActividad(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should find all actividades with pagination', async () => {
      const mockData = [
        { id: '1', nombre: 'Actividad 1' },
        { id: '2', nombre: 'Actividad 2' },
      ] as Actividad[];

      mockActividadRepository.findAndCount.mockResolvedValue([mockData, 2]);

      const result = await service.findAllActividades({});

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
    });

    it('should find one actividad', async () => {
      const mockActividad = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        nombre: 'Plomería',
      } as Actividad;

      mockActividadRepository.findOne.mockResolvedValue(mockActividad);

      const result = await service.findOneActividad('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(mockActividad);
    });

    it('should throw NotFoundException when actividad not found', async () => {
      mockActividadRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOneActividad('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update an actividad', async () => {
      const existing = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        nombre: 'Plomería',
        descripcion: 'Old description',
      } as Actividad;

      const updateDto: UpdateActividadDto = {
        nombre: 'Plomería Profesional',
      };

      mockActividadRepository.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValue(null);

      mockActividadRepository.save.mockResolvedValue({
        ...existing,
        ...updateDto,
      });

      const result = await service.updateActividad(
        '550e8400-e29b-41d4-a716-446655440000',
        updateDto,
      );

      expect(result.nombre).toBe('Plomería Profesional');
    });

    it('should remove an actividad', async () => {
      const existing = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        nombre: 'Plomería',
      } as Actividad;

      mockActividadRepository.findOne.mockResolvedValue(existing);
      mockServicioActividadRepository.findOne.mockResolvedValue(null);
      mockActividadRepository.remove.mockResolvedValue(existing);

      await service.removeActividad('550e8400-e29b-41d4-a716-446655440000');

      expect(actividadRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('should throw BadRequestException when removing actividad referenced by ServicioActividad', async () => {
      const existing = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        nombre: 'Plomería',
      } as Actividad;

      const reference = {
        id: 'pivot-id',
        actividad: { id: '550e8400-e29b-41d4-a716-446655440000' },
      } as unknown as ServicioActividad;

      mockActividadRepository.findOne.mockResolvedValue(existing);
      mockServicioActividadRepository.findOne.mockResolvedValue(reference);

      await expect(
        service.removeActividad('550e8400-e29b-41d4-a716-446655440000'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // Insumo CRUD Tests
  // =========================================================================

  describe('Insumo CRUD', () => {
    it('should create an insumo', async () => {
      const createDto: CreateInsumoDto = {
        nombre: 'Cemento',
      };

      const mockInsumo = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        ...createDto,
      } as Insumo;

      mockInsumoRepository.findOne.mockResolvedValue(null);
      mockInsumoRepository.create.mockReturnValue(mockInsumo);
      mockInsumoRepository.save.mockResolvedValue(mockInsumo);

      const result = await service.createInsumo(createDto);

      expect(insumoRepo.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockInsumo);
    });

    it('should throw ConflictException when insumo name already exists', async () => {
      const createDto: CreateInsumoDto = {
        nombre: 'Cemento',
      };

      mockInsumoRepository.findOne.mockResolvedValue({
        id: 'existing-id',
        nombre: 'Cemento',
      } as Insumo);

      await expect(service.createInsumo(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should find all insumos with pagination', async () => {
      const mockData = [{ id: '1', nombre: 'Cemento' }] as Insumo[];
      mockInsumoRepository.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.findAllInsumos({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should find one insumo', async () => {
      const mockInsumo = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        nombre: 'Cemento',
      } as Insumo;

      mockInsumoRepository.findOne.mockResolvedValue(mockInsumo);

      const result = await service.findOneInsumo('550e8400-e29b-41d4-a716-446655440001');
      expect(result).toEqual(mockInsumo);
    });

    it('should throw NotFoundException when insumo not found', async () => {
      mockInsumoRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneInsumo('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update an insumo', async () => {
      const existing = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        nombre: 'Cemento',
      } as Insumo;

      mockInsumoRepository.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValue(null);

      mockInsumoRepository.save.mockResolvedValue({
        ...existing,
        nombre: 'Cemento actualizado',
      });

      const result = await service.updateInsumo('550e8400-e29b-41d4-a716-446655440001', {
        nombre: 'Cemento actualizado',
      });

      expect(result.nombre).toBe('Cemento actualizado');
    });

    it('should remove an insumo', async () => {
      const existing = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        nombre: 'Cemento',
      } as Insumo;

      mockInsumoRepository.findOne.mockResolvedValue(existing);
      mockInsumoRepository.remove.mockResolvedValue(existing);

      await service.removeInsumo('550e8400-e29b-41d4-a716-446655440001');

      expect(insumoRepo.remove).toHaveBeenCalledWith(existing);
    });
  });

  // =========================================================================
  // Servicio CRUD Tests
  // =========================================================================

  describe('Servicio CRUD', () => {
    it('should create a servicio', async () => {
      const createDto: CreateServicioDto = {
        nombre: 'Plomería',
        precioBase: 150,
      };

      const mockServicio = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Servicio;

      mockServicioRepository.findOne.mockResolvedValue(null);
      mockServicioRepository.create.mockReturnValue(mockServicio);
      mockServicioRepository.save.mockResolvedValue(mockServicio);

      const result = await service.createServicio(createDto);

      expect(servicioRepo.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockServicio);
    });

    it('should throw ConflictException when servicio name already exists', async () => {
      const createDto: CreateServicioDto = {
        nombre: 'Plomería',
        precioBase: 150,
      };

      mockServicioRepository.findOne.mockResolvedValue({
        id: 'existing-id',
        nombre: 'Plomería',
      } as Servicio);

      await expect(service.createServicio(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should find all servicios with pagination', async () => {
      const mockData = [{ id: '1', nombre: 'Plomería' }] as Servicio[];
      mockServicioRepository.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.findAllServicios({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should find one servicio', async () => {
      const mockServicio = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        nombre: 'Plomería',
      } as Servicio;

      mockServicioRepository.findOne.mockResolvedValue(mockServicio);

      const result = await service.findOneServicio('550e8400-e29b-41d4-a716-446655440002');
      expect(result).toEqual(mockServicio);
    });

    it('should throw NotFoundException when servicio not found', async () => {
      mockServicioRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneServicio('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update a servicio', async () => {
      const existing = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        nombre: 'Plomería',
        precioBase: 150,
      } as Servicio;

      mockServicioRepository.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValue(null);

      mockServicioRepository.save.mockResolvedValue({
        ...existing,
        precioBase: 200,
      });

      const result = await service.updateServicio('550e8400-e29b-41d4-a716-446655440002', {
        precioBase: 200,
      });

      expect(result.precioBase).toBe(200);
    });

    it('should remove a servicio (cascade)', async () => {
      const existing = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        nombre: 'Plomería',
      } as Servicio;

      mockServicioRepository.findOne.mockResolvedValue(existing);
      mockServicioRepository.remove.mockResolvedValue(existing);

      await service.removeServicio('550e8400-e29b-41d4-a716-446655440002');

      expect(servicioRepo.remove).toHaveBeenCalledWith(existing);
    });
  });

  // =========================================================================
  // ServicioActividad CRUD Tests
  // =========================================================================

  describe('ServicioActividad CRUD', () => {
    const createMockManager = () => ({
      getRepository: jest.fn((entity) => {
        if (entity === Servicio) return mockServicioRepository;
        if (entity === Actividad) return mockActividadRepository;
        if (entity === ServicioActividad) return mockServicioActividadRepository;
        return null;
      }),
    });

    const setupTransaction = () => {
      const mockManager = createMockManager();
      mockServicioActividadRepository.manager.transaction.mockImplementation(
        (cb) => cb(mockManager),
      );
    };

    it('should create a servicio-actividad pivot in transaction', async () => {
      setupTransaction();

      const createDto: CreateServicioActividadDto = {
        servicioId: '550e8400-e29b-41d4-a716-446655440002',
        actividadId: '550e8400-e29b-41d4-a716-446655440000',
      };

      mockServicioRepository.findOne.mockResolvedValue({ id: createDto.servicioId } as Servicio);
      mockActividadRepository.findOne.mockResolvedValue({ id: createDto.actividadId } as Actividad);
      mockServicioActividadRepository.findOne.mockResolvedValue(null);

      const mockPivot = {
        id: 'pivot-uuid',
        ...createDto,
        servicio: { id: createDto.servicioId },
        actividad: { id: createDto.actividadId },
      } as unknown as ServicioActividad;

      mockServicioActividadRepository.create.mockReturnValue(mockPivot);
      mockServicioActividadRepository.save.mockResolvedValue(mockPivot);

      const result = await service.createServicioActividad(createDto);

      expect(result).toEqual(mockPivot);
      expect(servicioRepo.findOne).toHaveBeenCalledWith({
        where: { id: createDto.servicioId },
      });
      expect(actividadRepo.findOne).toHaveBeenCalledWith({
        where: { id: createDto.actividadId },
      });
    });

    it('should throw NotFoundException when servicio does not exist', async () => {
      setupTransaction();

      const createDto: CreateServicioActividadDto = {
        servicioId: '550e8400-e29b-41d4-a716-446655440002',
        actividadId: '550e8400-e29b-41d4-a716-446655440000',
      };

      mockServicioRepository.findOne.mockResolvedValue(null);

      await expect(service.createServicioActividad(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when actividad does not exist', async () => {
      setupTransaction();

      const createDto: CreateServicioActividadDto = {
        servicioId: 'nonexistent',
        actividadId: '550e8400-e29b-41d4-a716-446655440000',
      };

      mockServicioRepository.findOne.mockResolvedValue({ id: createDto.servicioId } as Servicio);
      mockActividadRepository.findOne.mockResolvedValue(null);

      await expect(service.createServicioActividad(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException for duplicate servicio-actividad pair', async () => {
      setupTransaction();

      const createDto: CreateServicioActividadDto = {
        servicioId: '550e8400-e29b-41d4-a716-446655440002',
        actividadId: '550e8400-e29b-41d4-a716-446655440000',
      };

      mockServicioRepository.findOne.mockResolvedValue({ id: createDto.servicioId } as Servicio);
      mockActividadRepository.findOne.mockResolvedValue({ id: createDto.actividadId } as Actividad);
      mockServicioActividadRepository.findOne.mockResolvedValue({
        id: 'existing-pivot',
      } as ServicioActividad);

      await expect(service.createServicioActividad(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should find all servicio-actividades with pagination and relations', async () => {
      const mockData = [
        {
          id: 'pivot-uuid',
          servicio: { id: 'serv-1', nombre: 'Plomería' } as unknown as Servicio,
          actividad: { id: 'act-1', nombre: 'Instalación' } as unknown as Actividad,
        },
      ] as unknown as ServicioActividad[];

      mockServicioActividadRepository.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.findAllServicioActividades({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].servicio).toBeDefined();
      expect(result.data[0].actividad).toBeDefined();
    });

    it('should find one servicio-actividad with relations', async () => {
      const mockPivot = {
        id: 'pivot-uuid',
        servicio: { id: '550e8400-e29b-41d4-a716-446655440002', nombre: 'Plomería', descripcion: '', precioBase: 0, createdAt: new Date(), updatedAt: new Date() } as unknown as Servicio,
        actividad: { id: '550e8400-e29b-41d4-a716-446655440000', nombre: 'Instalación' } as unknown as Actividad,
      } as unknown as ServicioActividad;

      mockServicioActividadRepository.findOne.mockResolvedValue(mockPivot);

      const result = await service.findOneServicioActividad('pivot-uuid');

      expect(result).toEqual(mockPivot);
      expect(result.servicio).toBeDefined();
      expect(result.actividad).toBeDefined();
    });

    it('should throw NotFoundException when servicio-actividad not found', async () => {
      mockServicioActividadRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneServicioActividad('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update a servicio-actividad', async () => {
      const existing = {
        id: 'pivot-uuid',
        servicio: { id: 'serv-1' } as unknown as Servicio,
        actividad: { id: 'act-1' } as unknown as Actividad,
      } as unknown as ServicioActividad;

      mockServicioActividadRepository.findOne.mockResolvedValue(existing);
      mockServicioActividadRepository.save.mockResolvedValue({
        ...existing,
      });

      const result = await service.updateServicioActividad('pivot-uuid', {});

      expect(result.id).toBe('pivot-uuid');
    });

    it('should remove a servicio-actividad', async () => {
      const existing = {
        id: 'pivot-uuid',
        servicio: { id: 'serv-1' } as unknown as Servicio,
        actividad: { id: 'act-1' } as unknown as Actividad,
      } as unknown as ServicioActividad;

      mockServicioActividadRepository.findOne.mockResolvedValue(existing);
      mockServicioActividadRepository.remove.mockResolvedValue(existing);

      await service.removeServicioActividad('pivot-uuid');

      expect(servicioActividadRepo.remove).toHaveBeenCalledWith(existing);
    });
  });

  // =========================================================================
  // DTO Validation Tests
  // =========================================================================

  describe('DTO Validation', () => {
    it('should validate CreateActividadDto successfully', async () => {
      const dto = new CreateActividadDto();
      dto.nombre = 'Plomería';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail CreateActividadDto validation when nombre is missing', async () => {
      const dto = new CreateActividadDto();
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should validate CreateInsumoDto successfully', async () => {
      const dto = new CreateInsumoDto();
      dto.nombre = 'Cemento';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail CreateInsumoDto validation when nombre is missing', async () => {
      const dto = new CreateInsumoDto();
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should validate CreateServicioDto successfully', async () => {
      const dto = new CreateServicioDto();
      dto.nombre = 'Plomería';
      dto.precioBase = 150;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate CreateServicioActividadDto successfully', async () => {
      const dto = new CreateServicioActividadDto();
      dto.servicioId = '550e8400-e29b-41d4-a716-446655440000';
      dto.actividadId = '550e8400-e29b-41d4-a716-446655440001';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail CreateServicioActividadDto validation when cantidad is zero', async () => {
      const dto = new CreateServicioActividadDto();
      dto.servicioId = '550e8400-e29b-41d4-a716-446655440002';
      dto.actividadId = '550e8400-e29b-41d4-a716-446655440000';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should validate ChangeStateDto successfully', async () => {
      const dto = new ChangeStateDto();
      dto.estado = 'INICIADO';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail ChangeStateDto validation with invalid estado', async () => {
      const dto = new ChangeStateDto();
      dto.estado = 'INVALIDO';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should validate CancelDto successfully', async () => {
      const dto = new CancelDto();
      dto.motivo = 'Cliente solicitó cancelación';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail CancelDto validation when motivo is missing', async () => {
      const dto = new CancelDto();
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });

  // =========================================================================
  // ServicioProgramado Tests
  // =========================================================================

  describe('ServicioProgramado', () => {
    let mockCustomerRepository: any;
    let mockServicioProgramadoRepository: any;
    let mockServicioProgramadoInsumoRepository: any;
    let mockServicioProgramadoActividadRepository: any;
    let testService: OperationalService;

    beforeEach(async () => {
      jest.resetAllMocks();

      mockCustomerRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
      };

      mockServicioProgramadoRepository = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        findAndCount: jest.fn(),
        delete: jest.fn(),
        manager: {
          transaction: jest.fn(),
          getRepository: jest.fn(),
        },
      };

      mockServicioProgramadoInsumoRepository = {
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      };

      mockServicioProgramadoActividadRepository = {
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OperationalService,
          {
            provide: getRepositoryToken(Actividad),
            useValue: mockActividadRepository,
          },
          {
            provide: getRepositoryToken(Insumo),
            useValue: mockInsumoRepository,
          },
          {
            provide: getRepositoryToken(Servicio),
            useValue: mockServicioRepository,
          },
          {
            provide: getRepositoryToken(ServicioActividad),
            useValue: mockServicioActividadRepository,
          },
          {
            provide: getRepositoryToken(ServicioProgramado),
            useValue: mockServicioProgramadoRepository,
          },
          {
            provide: getRepositoryToken(ServicioProgramadoInsumo),
            useValue: mockServicioProgramadoInsumoRepository,
          },
          {
            provide: getRepositoryToken(ServicioProgramadoActividad),
            useValue: mockServicioProgramadoActividadRepository,
          },
          {
            provide: getRepositoryToken(Customer),
            useValue: mockCustomerRepository,
          },
        ],
      }).compile();

      testService = module.get<OperationalService>(OperationalService);
    });

    it('should create a programado service with snapshot data from originals', async () => {
      const createDto: CreateProgramadoDto = {
        customerId: '550e8400-e29b-41d4-a716-446655440200',
        servicioId: '550e8400-e29b-41d4-a716-446655440201',
        fechaInicioEstimada: '2026-01-12T08:00:00Z',
        insumos: [{ insumoId: '550e8400-e29b-41d4-a716-446655440202', cantidad: 5 }],
        notas: 'Notas de prueba',
      };

      const mockCustomer = {
        id: createDto.customerId,
        name: 'Cliente Test',
        status: CustomerStatus.ACTIVE,
      } as Customer;

      const mockServicio = {
        id: createDto.servicioId,
        nombre: 'Servicio Test',
        descripcion: 'Descripción de prueba',
        precioBase: 150000,
        actividades: [
          {
            id: 'sa-1',
            actividad: {
              id: 'act-1',
              nombre: 'Actividad 1',
              descripcion: 'Desc actividad 1',
              horasEstimadas: 8,
            },
          },
          {
            id: 'sa-2',
            actividad: {
              id: 'act-2',
              nombre: 'Actividad 2',
              descripcion: null,
              horasEstimadas: 8,
            },
          },
        ],
      } as any;

      const mockInsumo = {
        id: createDto.insumos![0].insumoId,
        nombre: 'Insumo Test',
        descripcion: null,
      } as any;

      const savedProgramado = {
        id: 'prog-uuid-001',
        customer: mockCustomer,
        servicioNombre: 'Servicio Test',
        servicioDescripcion: 'Descripción de prueba',
        servicioPrecioBase: 150000,
        estado: ServicioProgramadoEstado.PENDIENTE,
        fechaInicioEstimada: new Date('2026-01-12T08:00:00Z'),
        fechaFinEstimada: new Date('2026-01-13T17:00:00Z'),
        totalHoras: 16,
        notas: 'Notas de prueba',
        actividades: [],
        insumos: [],
      };

      const foundProgramado = {
        ...savedProgramado,
        actividades: [
          {
            id: 'spa-001',
            servicioProgramado: { id: savedProgramado.id },
            actividadNombre: 'Actividad 1',
            actividadDescripcion: 'Desc actividad 1',
            actividadHorasEstimadas: 8,
          },
          {
            id: 'spa-002',
            servicioProgramado: { id: savedProgramado.id },
            actividadNombre: 'Actividad 2',
            actividadDescripcion: null,
            actividadHorasEstimadas: 8,
          },
        ],
        insumos: [
          {
            id: 'pin-001',
            servicioProgramado: { id: savedProgramado.id },
            insumoNombre: 'Insumo Test',
            cantidad: 5,
          },
        ],
      } as unknown as ServicioProgramado;

      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      mockServicioRepository.findOne.mockResolvedValue(mockServicio);

      const txManager = {
        create: jest.fn((entity, data) => ({ ...data })),
        save: jest.fn(async (entity, data) => {
          if (entity === ServicioProgramado) {
            return { id: 'prog-uuid-001' };
          }
          if (entity === ServicioProgramadoActividad) {
            return { id: 'spa-001' };
          }
          return { id: 'pin-001' };
        }),
        delete: jest.fn(),
        getRepository: jest.fn((entity) => ({
          findOne: jest.fn().mockResolvedValue(foundProgramado),
        })),
        findOne: jest.fn(),
      };

      mockServicioProgramadoRepository.manager.transaction
        .mockImplementationOnce(async (cb) => {
          const result = await cb(txManager);
          return result;
        })
        .mockImplementationOnce(async (cb) => {
          const result = await cb({ ...txManager, findOne: jest.fn().mockResolvedValue(foundProgramado) });
          return result;
        });

      mockServicioProgramadoRepository.findOne.mockResolvedValue(foundProgramado);

      const result = await testService.createProgramado(createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('prog-uuid-001');
      expect(result.estado).toBe(ServicioProgramadoEstado.PENDIENTE);
      expect(result.totalHoras).toBe(16);
      expect(result.fechaFinEstimada).toBeInstanceOf(Date);
      expect(result.servicioNombre).toBe('Servicio Test');
      expect(txManager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ estado: ServicioProgramadoEstado.PENDIENTE })
      );
      expect(mockServicioProgramadoActividadRepository.save).toHaveBeenCalled();
      expect(mockServicioProgramadoInsumoRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(null);

      await expect(
        testService.createProgramado({
          customerId: 'nonexistent',
          servicioId: 'serv-uuid',
          fechaInicioEstimada: '2026-01-12T08:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive customer', async () => {
      const inactiveCustomer = {
        id: 'cust-123',
        name: 'Cliente Inactivo',
        status: CustomerStatus.INACTIVE,
      } as Customer;

      mockCustomerRepository.findOne.mockResolvedValue(inactiveCustomer);
      mockServicioRepository.findOne.mockResolvedValue({
        id: 'serv-uuid',
        actividades: [],
      } as any);

      await expect(
        testService.createProgramado({
          customerId: 'cust-123',
          servicioId: 'serv-uuid',
          fechaInicioEstimada: '2026-01-12T08:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should find all programados with pagination', async () => {
      const mockData = [
        {
          id: 'prog-1',
          customer: { id: 'cust-1', name: 'Cliente 1' } as Customer,
          servicioNombre: 'Servicio 1',
          estado: 'PENDIENTE',
          fechaInicioEstimada: new Date(),
          fechaFinEstimada: new Date(),
          totalHoras: 8,
          notas: '',
          motivoEstado: '',
          actividades: [],
          insumos: [],
        },
      ] as unknown as ServicioProgramado[];

      mockServicioProgramadoRepository.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await testService.findAllProgramados({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should filter programados by date range', async () => {
      const mockData = [
        {
          id: 'prog-1',
          customer: { id: 'cust-1', name: 'Cliente 1' } as Customer,
          servicioNombre: 'Servicio 1',
          fechaInicioEstimada: new Date('2026-01-15T10:00:00Z'),
          fechaFinEstimada: new Date('2026-01-15T18:00:00Z'),
          totalHoras: 8,
          notas: '',
          motivoEstado: '',
          estado: 'PENDIENTE',
          insumos: [],
        },
        {
          id: 'prog-2',
          customer: { id: 'cust-2', name: 'Cliente 2' } as Customer,
          servicioNombre: 'Servicio 2',
          fechaInicioEstimada: new Date('2026-02-20T10:00:00Z'),
          fechaFinEstimada: new Date('2026-02-20T18:00:00Z'),
          totalHoras: 8,
          notas: '',
          motivoEstado: '',
          estado: 'INICIADO',
          insumos: [],
        },
      ] as unknown as ServicioProgramado[];

      mockServicioProgramadoRepository.findAndCount.mockResolvedValue([mockData, 2]);

      const result = await testService.findAllProgramados({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      // Only prog-1 should be in the date range
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('prog-1');
    });

    it('should filter programados by dateFrom only', async () => {
      const mockData = [
        {
          id: 'prog-1',
          customer: { id: 'cust-1', name: 'Cliente 1' } as Customer,
          servicioNombre: 'Servicio 1',
          fechaInicioEstimada: new Date('2026-02-15T10:00:00Z'),
          fechaFinEstimada: new Date('2026-02-15T18:00:00Z'),
          totalHoras: 8,
          notas: '',
          motivoEstado: '',
          estado: 'PENDIENTE',
          insumos: [],
        },
      ] as unknown as ServicioProgramado[];

      mockServicioProgramadoRepository.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await testService.findAllProgramados({
        dateFrom: '2026-01-01',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('prog-1');
    });

    it('should filter programados by dateTo only', async () => {
      const mockData = [
        {
          id: 'prog-1',
          customer: { id: 'cust-1', name: 'Cliente 1' } as Customer,
          servicioNombre: 'Servicio 1',
          fechaInicioEstimada: new Date('2026-01-15T10:00:00Z'),
          fechaFinEstimada: new Date('2026-01-15T18:00:00Z'),
          totalHoras: 8,
          notas: '',
          motivoEstado: '',
          estado: 'PENDIENTE',
          insumos: [],
        },
      ] as unknown as ServicioProgramado[];

      mockServicioProgramadoRepository.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await testService.findAllProgramados({
        dateTo: '2026-12-31',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('prog-1');
    });

    it('should find one programado with relations', async () => {
      const mockProgramado = {
        id: 'prog-uuid',
        customer: { id: 'cust-1', name: 'Cliente 1' } as Customer,
        servicio: { id: 'serv-1', nombre: 'Servicio 1' } as Servicio,
        estado: 'PENDIENTE',
        fechaInicioEstimada: new Date(),
        fechaFinEstimada: new Date(),
        totalHoras: 8,
        notas: '',
        motivoEstado: '',
        insumos: [
          { id: 'pin-1', insumo: { id: 'ins-1', nombre: 'Insumo 1' } } as any,
        ],
      } as unknown as ServicioProgramado;

      mockServicioProgramadoRepository.findOne.mockResolvedValue(mockProgramado);

      const result = await testService.findOneProgramado('prog-uuid');

      expect(result).toEqual(mockProgramado);
      expect(result.insumos).toHaveLength(1);
    });

    it('should throw NotFoundException when programado not found', async () => {
      mockServicioProgramadoRepository.findOne.mockResolvedValue(null);

      await expect(testService.findOneProgramado('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid state transition', async () => {
      const mockProgramado = {
        id: 'prog-uuid',
        estado: ServicioProgramadoEstado.FINALIZADO,
        customer: { id: 'cust-1' } as Customer,
        servicio: { actividades: [] } as unknown as Servicio,
        fechaInicioEstimada: new Date(),
        fechaFinEstimada: new Date(),
        totalHoras: 0,
        notas: '',
        motivoEstado: '',
        insumos: [],
      } as unknown as ServicioProgramado;

      mockServicioProgramadoRepository.findOne.mockResolvedValue(mockProgramado);

      await expect(
        testService.changeState('prog-uuid', { estado: 'INICIADO' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when motivo required for PAUSADO', async () => {
      const mockProgramado = {
        id: 'prog-uuid',
        estado: ServicioProgramadoEstado.INICIADO,
        customer: { id: 'cust-1' } as Customer,
        servicio: { actividades: [] } as unknown as Servicio,
        fechaInicioEstimada: new Date(),
        fechaFinEstimada: new Date(),
        totalHoras: 0,
        notas: '',
        motivoEstado: '',
        insumos: [],
      } as unknown as ServicioProgramado;

      mockServicioProgramadoRepository.findOne.mockResolvedValue(mockProgramado);

      await expect(
        testService.changeState('prog-uuid', { estado: 'PAUSADO' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require motivo for CANCELADO transition', async () => {
      const mockProgramado = {
        id: 'prog-uuid',
        estado: ServicioProgramadoEstado.PENDIENTE,
        customer: { id: 'cust-1' } as Customer,
        servicio: { actividades: [] } as unknown as Servicio,
        fechaInicioEstimada: new Date(),
        fechaFinEstimada: new Date(),
        totalHoras: 0,
        notas: '',
        motivoEstado: '',
        insumos: [],
      } as unknown as ServicioProgramado;

      mockServicioProgramadoRepository.findOne.mockResolvedValue(mockProgramado);

      await expect(
        testService.changeState('prog-uuid', { estado: 'CANCELADO' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when canceling already cancelled service', async () => {
      const mockProgramado = {
        id: 'prog-uuid',
        estado: ServicioProgramadoEstado.CANCELADO,
        customer: { id: 'cust-1' } as Customer,
        servicio: { id: 'serv-1' } as Servicio,
        fechaInicioEstimada: new Date(),
        fechaFinEstimada: new Date(),
        totalHoras: 0,
        notas: '',
        motivoEstado: '',
        insumos: [],
      } as unknown as ServicioProgramado;

      mockServicioProgramadoRepository.findOne.mockResolvedValue(mockProgramado);

      await expect(
        testService.cancelProgramado('prog-uuid', { motivo: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when canceling non-existent programado', async () => {
      mockServicioProgramadoRepository.findOne.mockResolvedValue(null);

      await expect(
        testService.cancelProgramado('nonexistent', { motivo: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate CreateProgramadoDto successfully', async () => {
      const dto = new CreateProgramadoDto();
      dto.customerId = '550e8400-e29b-41d4-a716-446655440000';
      dto.servicioId = '550e8400-e29b-41d4-a716-446655440001';
      dto.fechaInicioEstimada = '2026-01-12T08:00:00Z';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail CreateProgramadoDto validation when customerId is missing', async () => {
      const dto = new CreateProgramadoDto();
      dto.servicioId = '550e8400-e29b-41d4-a716-446655440001';
      dto.fechaInicioEstimada = '2026-01-12T08:00:00Z';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail CreateProgramadoInsumoDto validation when cantidad is zero', async () => {
      const dto = new CreateProgramadoInsumoDto();
      dto.insumoId = '550e8400-e29b-41d4-a716-446655440000';
      dto.cantidad = 0;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail CreateProgramadoInsumoDto validation when cantidad is negative', async () => {
      const dto = new CreateProgramadoInsumoDto();
      dto.insumoId = '550e8400-e29b-41d4-a716-446655440000';
      dto.cantidad = -5;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should validate CreateProgramadoInsumoDto successfully with valid cantidad', async () => {
      const dto = new CreateProgramadoInsumoDto();
      dto.insumoId = '550e8400-e29b-41d4-a716-446655440000';
      dto.cantidad = 5;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
