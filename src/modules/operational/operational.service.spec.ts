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
        actividadId: '550e8400-e29b-41d4-a716-446655440000',
      } as ServicioActividad;

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
      } as Servicio;

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
        cantidad: 2,
        precio: 75,
      };

      mockServicioRepository.findOne.mockResolvedValue({ id: createDto.servicioId } as Servicio);
      mockActividadRepository.findOne.mockResolvedValue({ id: createDto.actividadId } as Actividad);
      mockServicioActividadRepository.findOne.mockResolvedValue(null);

      const mockPivot = {
        id: 'pivot-uuid',
        ...createDto,
      } as ServicioActividad;

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
        servicioId: 'nonexistent',
        actividadId: '550e8400-e29b-41d4-a716-446655440000',
        cantidad: 2,
        precio: 75,
      };

      mockServicioRepository.findOne.mockResolvedValue(null);

      await expect(service.createServicioActividad(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when actividad does not exist', async () => {
      setupTransaction();

      const createDto: CreateServicioActividadDto = {
        servicioId: '550e8400-e29b-41d4-a716-446655440002',
        actividadId: 'nonexistent',
        cantidad: 2,
        precio: 75,
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
        cantidad: 2,
        precio: 75,
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
          cantidad: 2,
          precio: 75,
          servicio: { nombre: 'Plomería' },
          actividad: { nombre: 'Instalación' },
        },
      ] as ServicioActividad[];

      mockServicioActividadRepository.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.findAllServicioActividades({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].servicio).toBeDefined();
      expect(result.data[0].actividad).toBeDefined();
    });

    it('should find one servicio-actividad with relations', async () => {
      const mockPivot = {
        id: 'pivot-uuid',
        cantidad: 2,
        precio: 75,
        servicio: { id: '550e8400-e29b-41d4-a716-446655440002', nombre: 'Plomería' },
        actividad: { id: '550e8400-e29b-41d4-a716-446655440000', nombre: 'Instalación' },
      } as ServicioActividad;

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
        cantidad: 2,
        precio: 75,
      } as ServicioActividad;

      mockServicioActividadRepository.findOne.mockResolvedValue(existing);
      mockServicioActividadRepository.save.mockResolvedValue({
        ...existing,
        cantidad: 5,
      });

      const result = await service.updateServicioActividad('pivot-uuid', {
        cantidad: 5,
      });

      expect(result.cantidad).toBe(5);
    });

    it('should remove a servicio-actividad', async () => {
      const existing = {
        id: 'pivot-uuid',
        cantidad: 2,
        precio: 75,
      } as ServicioActividad;

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
      dto.cantidad = 2;
      dto.precio = 75;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail CreateServicioActividadDto validation when cantidad is zero', async () => {
      const dto = new CreateServicioActividadDto();
      dto.servicioId = '550e8400-e29b-41d4-a716-446655440002';
      dto.actividadId = '550e8400-e29b-41d4-a716-446655440000';
      dto.cantidad = 0;
      dto.precio = 75;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });
  });
});
