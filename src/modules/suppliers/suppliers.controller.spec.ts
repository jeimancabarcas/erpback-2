import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ConflictException } from '@nestjs/common';

describe('SuppliersController', () => {
  let controller: SuppliersController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [
        {
          provide: SuppliersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<SuppliersController>(SuppliersController);
  });

  describe('create', () => {
    it('should call service.create with all fields including optional ones', async () => {
      const dto: CreateSupplierDto = {
        nit: '900123456-7',
        name: 'Proveedor Test',
        address: 'Calle 123',
        phone: '3001234567',
        dv: '7',
        municipalityCode: '11001',
        legalOrganizationCode: '01',
      };

      mockService.create.mockResolvedValue({ id: 'uuid', ...dto });

      await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          municipalityCode: '11001',
          dv: '7',
          legalOrganizationCode: '01',
        }),
      );
    });

    it('should call service.create without optional fields', async () => {
      const dto: CreateSupplierDto = {
        nit: '900123456-7',
        name: 'Proveedor Test',
        address: 'Calle 123',
        phone: '3001234567',
      };

      mockService.create.mockResolvedValue({ id: 'uuid', ...dto });

      await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(dto);
    });

    it('should pass through service errors', async () => {
      const dto: CreateSupplierDto = {
        nit: '900123456-7',
        name: 'Proveedor Test',
        address: 'Calle 123',
        phone: '3001234567',
      };

      mockService.create.mockRejectedValue(
        new ConflictException('Ya existe un proveedor con ese NIT'),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should return the created supplier with optional fields', async () => {
      const dto: CreateSupplierDto = {
        nit: '900123456-7',
        name: 'Proveedor Test',
        address: 'Calle 123',
        phone: '3001234567',
        dv: '7',
        municipalityCode: '11001',
        legalOrganizationCode: '01',
      };

      const createdSupplier = {
        id: 'uuid',
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockService.create.mockResolvedValue(createdSupplier);

      const result = await controller.create(dto);

      expect(result).toMatchObject({
        municipalityCode: '11001',
        dv: '7',
        legalOrganizationCode: '01',
      });
    });
  });
});
