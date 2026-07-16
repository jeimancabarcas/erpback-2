import { Test, TestingModule } from '@nestjs/testing';
import { OperationalController } from './operational.controller';
import { OperationalService } from './operational.service';
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

describe('OperationalController', () => {
  let controller: OperationalController;
  let service: OperationalService;

  const mockOperationalService = {
    createActividad: jest.fn(),
    findAllActividades: jest.fn(),
    findOneActividad: jest.fn(),
    updateActividad: jest.fn(),
    removeActividad: jest.fn(),
    createInsumo: jest.fn(),
    findAllInsumos: jest.fn(),
    findOneInsumo: jest.fn(),
    updateInsumo: jest.fn(),
    removeInsumo: jest.fn(),
    createServicio: jest.fn(),
    findAllServicios: jest.fn(),
    findOneServicio: jest.fn(),
    updateServicio: jest.fn(),
    removeServicio: jest.fn(),
    createServicioActividad: jest.fn(),
    findAllServicioActividades: jest.fn(),
    findOneServicioActividad: jest.fn(),
    updateServicioActividad: jest.fn(),
    removeServicioActividad: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationalController],
      providers: [
        {
          provide: OperationalService,
          useValue: mockOperationalService,
        },
      ],
    }).compile();

    controller = module.get<OperationalController>(OperationalController);
    service = module.get<OperationalService>(OperationalService);
  });

  // =========================================================================
  // Actividad endpoints
  // =========================================================================

  describe('Actividad endpoints', () => {
    it('should POST create an actividad', async () => {
      const createDto: CreateActividadDto = { nombre: 'Plomería' };
      const mockResult = { id: 'uuid-1', ...createDto };

      mockOperationalService.createActividad.mockResolvedValue(mockResult);

      const result = await controller.createActividad(createDto);

      expect(service.createActividad).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockResult);
    });

    it('should GET all actividades', async () => {
      const queryDto: QueryActividadDto = { page: 1, limit: 10 };
      const mockResult = { data: [], meta: { total: 0, page: 1, lastPage: 0, limit: 10 } };

      mockOperationalService.findAllActividades.mockResolvedValue(mockResult);

      const result = await controller.findAllActividades(queryDto);

      expect(service.findAllActividades).toHaveBeenCalledWith(queryDto);
      expect(result).toEqual(mockResult);
    });

    it('should GET one actividad by id', async () => {
      const mockResult = { id: 'uuid-1', nombre: 'Plomería' };

      mockOperationalService.findOneActividad.mockResolvedValue(mockResult);

      const result = await controller.findOneActividad('uuid-1');

      expect(service.findOneActividad).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual(mockResult);
    });

    it('should PATCH update an actividad', async () => {
      const updateDto: UpdateActividadDto = { nombre: 'Plomería Pro' };
      const mockResult = { id: 'uuid-1', ...updateDto };

      mockOperationalService.updateActividad.mockResolvedValue(mockResult);

      const result = await controller.updateActividad('uuid-1', updateDto);

      expect(service.updateActividad).toHaveBeenCalledWith('uuid-1', updateDto);
      expect(result).toEqual(mockResult);
    });

    it('should DELETE an actividad', async () => {
      mockOperationalService.removeActividad.mockResolvedValue(undefined);

      await controller.removeActividad('uuid-1');

      expect(service.removeActividad).toHaveBeenCalledWith('uuid-1');
    });
  });

  // =========================================================================
  // Insumo endpoints
  // =========================================================================

  describe('Insumo endpoints', () => {
    it('should POST create an insumo', async () => {
      const createDto: CreateInsumoDto = {
        nombre: 'Cemento',
      };
      const mockResult = { id: 'uuid-2', ...createDto };

      mockOperationalService.createInsumo.mockResolvedValue(mockResult);

      const result = await controller.createInsumo(createDto);

      expect(service.createInsumo).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockResult);
    });

    it('should GET all insumos', async () => {
      const mockResult = { data: [], meta: { total: 0, page: 1, lastPage: 0, limit: 10 } };
      mockOperationalService.findAllInsumos.mockResolvedValue(mockResult);

      const result = await controller.findAllInsumos({});

      expect(service.findAllInsumos).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should GET one insumo by id', async () => {
      const mockResult = { id: 'uuid-2', nombre: 'Cemento' };
      mockOperationalService.findOneInsumo.mockResolvedValue(mockResult);

      const result = await controller.findOneInsumo('uuid-2');

      expect(service.findOneInsumo).toHaveBeenCalledWith('uuid-2');
      expect(result).toEqual(mockResult);
    });

    it('should PATCH update an insumo', async () => {
      const updateDto: UpdateInsumoDto = { nombre: 'Cemento Pro' };
      const mockResult = { id: 'uuid-2', nombre: 'Cemento Pro' };

      mockOperationalService.updateInsumo.mockResolvedValue(mockResult);

      const result = await controller.updateInsumo('uuid-2', updateDto);

      expect(service.updateInsumo).toHaveBeenCalledWith('uuid-2', updateDto);
      expect(result).toEqual(mockResult);
    });

    it('should DELETE an insumo', async () => {
      mockOperationalService.removeInsumo.mockResolvedValue(undefined);

      await controller.removeInsumo('uuid-2');

      expect(service.removeInsumo).toHaveBeenCalledWith('uuid-2');
    });
  });

  // =========================================================================
  // Servicio endpoints
  // =========================================================================

  describe('Servicio endpoints', () => {
    it('should POST create a servicio', async () => {
      const createDto: CreateServicioDto = { nombre: 'Plomería', precioBase: 150 };
      const mockResult = { id: 'uuid-3', ...createDto };

      mockOperationalService.createServicio.mockResolvedValue(mockResult);

      const result = await controller.createServicio(createDto);

      expect(service.createServicio).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockResult);
    });

    it('should GET all servicios', async () => {
      const mockResult = { data: [], meta: { total: 0, page: 1, lastPage: 0, limit: 10 } };
      mockOperationalService.findAllServicios.mockResolvedValue(mockResult);

      const result = await controller.findAllServicios({});

      expect(service.findAllServicios).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should GET one servicio by id', async () => {
      const mockResult = { id: 'uuid-3', nombre: 'Plomería' };
      mockOperationalService.findOneServicio.mockResolvedValue(mockResult);

      const result = await controller.findOneServicio('uuid-3');

      expect(service.findOneServicio).toHaveBeenCalledWith('uuid-3');
      expect(result).toEqual(mockResult);
    });

    it('should PATCH update a servicio', async () => {
      const updateDto: UpdateServicioDto = { precioBase: 200 };
      const mockResult = { id: 'uuid-3', precioBase: 200 };

      mockOperationalService.updateServicio.mockResolvedValue(mockResult);

      const result = await controller.updateServicio('uuid-3', updateDto);

      expect(service.updateServicio).toHaveBeenCalledWith('uuid-3', updateDto);
      expect(result).toEqual(mockResult);
    });

    it('should DELETE a servicio', async () => {
      mockOperationalService.removeServicio.mockResolvedValue(undefined);

      await controller.removeServicio('uuid-3');

      expect(service.removeServicio).toHaveBeenCalledWith('uuid-3');
    });
  });

  // =========================================================================
  // ServicioActividad endpoints
  // =========================================================================

  describe('ServicioActividad endpoints', () => {
    it('should POST create a servicio-actividad', async () => {
      const createDto: CreateServicioActividadDto = {
        servicioId: 'uuid-3',
        actividadId: 'uuid-1',
        cantidad: 2,
        precio: 75,
      };
      const mockResult = { id: 'pivot-uuid', ...createDto };

      mockOperationalService.createServicioActividad.mockResolvedValue(mockResult);

      const result = await controller.createServicioActividad(createDto);

      expect(service.createServicioActividad).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockResult);
    });

    it('should GET all servicio-actividades', async () => {
      const mockResult = { data: [], meta: { total: 0, page: 1, lastPage: 0, limit: 10 } };
      mockOperationalService.findAllServicioActividades.mockResolvedValue(mockResult);

      const result = await controller.findAllServicioActividades({});

      expect(service.findAllServicioActividades).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should GET one servicio-actividad by id', async () => {
      const mockResult = { id: 'pivot-uuid', cantidad: 2 };
      mockOperationalService.findOneServicioActividad.mockResolvedValue(mockResult);

      const result = await controller.findOneServicioActividad('pivot-uuid');

      expect(service.findOneServicioActividad).toHaveBeenCalledWith('pivot-uuid');
      expect(result).toEqual(mockResult);
    });

    it('should PATCH update a servicio-actividad', async () => {
      const updateDto: UpdateServicioActividadDto = { cantidad: 5 };
      const mockResult = { id: 'pivot-uuid', cantidad: 5 };

      mockOperationalService.updateServicioActividad.mockResolvedValue(mockResult);

      const result = await controller.updateServicioActividad('pivot-uuid', updateDto);

      expect(service.updateServicioActividad).toHaveBeenCalledWith('pivot-uuid', updateDto);
      expect(result).toEqual(mockResult);
    });

    it('should DELETE a servicio-actividad', async () => {
      mockOperationalService.removeServicioActividad.mockResolvedValue(undefined);

      await controller.removeServicioActividad('pivot-uuid');

      expect(service.removeServicioActividad).toHaveBeenCalledWith('pivot-uuid');
    });
  });
});
