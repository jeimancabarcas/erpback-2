import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        {
          provide: getRepositoryToken(Supplier),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  describe('create', () => {
    it('should create a supplier with municipalityCode', async () => {
      const dto: CreateSupplierDto = {
        nit: '900123456-7',
        name: 'Proveedor Test',
        address: 'Calle 123',
        phone: '3001234567',
        municipalityCode: '11001',
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(dto);
      mockRepo.save.mockResolvedValue({ id: 'uuid', ...dto });

      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          municipalityCode: '11001',
        }),
      );
      expect(result).toMatchObject({
        municipalityCode: '11001',
      });
    });

    it('should reject duplicate NIT even with valid municipalityCode', async () => {
      const dto: CreateSupplierDto = {
        nit: '900123456-7',
        name: 'Proveedor Test',
        address: 'Calle 123',
        phone: '3001234567',
        municipalityCode: '11001',
      };

      mockRepo.findOne.mockResolvedValue({
        id: 'existing',
        nit: '900123456-7',
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should find suppliers with all fields including municipalityCode', async () => {
      const suppliers = [
        {
          id: 'uuid-1',
          nit: '900123456-7',
          name: 'Proveedor Uno',
          address: 'Calle 1',
          phone: '3001111111',
          municipalityCode: '11001',
        },
        {
          id: 'uuid-2',
          nit: '800123456-7',
          name: 'Proveedor Dos',
          address: 'Calle 2',
          phone: '3002222222',
          municipalityCode: '05001',
        },
      ];

      mockRepo.findAndCount.mockResolvedValue([suppliers, 2]);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(2);
      expect(result.data[0].municipalityCode).toBe('11001');
      expect(result.data[1].municipalityCode).toBe('05001');
    });
  });
});
