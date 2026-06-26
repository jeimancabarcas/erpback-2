import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PaymentTypesService } from './payment-types.service';
import { PaymentType } from '../entities/payment-type.entity';
import { QueryPaymentTypeDto } from '../dto/query-payment-type.dto';

describe('PaymentTypesService', () => {
  let service: PaymentTypesService;

  const mockRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentTypesService,
        {
          provide: getRepositoryToken(PaymentType),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PaymentTypesService>(PaymentTypesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated results sorted by sortOrder ASC then name ASC', async () => {
      const queryDto: QueryPaymentTypeDto = { page: 1, limit: 10 };
      const types = [{ id: '1', name: 'Contado' }];

      mockRepository.findAndCount.mockResolvedValue([types, 1]);

      const result = await service.findAll(queryDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { sortOrder: 'ASC', name: 'ASC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        data: types,
        meta: { total: 1, page: 1, lastPage: 1, limit: 10 },
      });
    });
  });

  describe('findOne', () => {
    it('should return a payment type if found', async () => {
      const type = { id: 'uuid-1', name: 'Contado' };
      mockRepository.findOne.mockResolvedValue(type);

      const result = await service.findOne('uuid-1');

      expect(result).toEqual(type);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByCode', () => {
    it('should return a payment type when found by code', async () => {
      const type = { id: 'uuid-1', name: 'Contado', code: '1' };
      mockRepository.findOne.mockResolvedValue(type);

      const result = await service.findByCode('1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { code: '1' },
      });
      expect(result).toEqual(type);
    });

    it('should throw NotFoundException when code does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findByCode('99')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
