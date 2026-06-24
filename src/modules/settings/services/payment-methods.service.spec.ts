import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethod } from '../entities/payment-method.entity';
import { QueryPaymentMethodDto } from '../dto/query-payment-method.dto';

describe('PaymentMethodsService', () => {
  let service: PaymentMethodsService;

  const mockRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodsService,
        {
          provide: getRepositoryToken(PaymentMethod),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PaymentMethodsService>(PaymentMethodsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated results sorted by sortOrder ASC then name ASC', async () => {
      const queryDto: QueryPaymentMethodDto = { page: 1, limit: 10 };
      const methods = [{ id: '1', name: 'Efectivo' }];

      mockRepository.findAndCount.mockResolvedValue([methods, 1]);

      const result = await service.findAll(queryDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { sortOrder: 'ASC', name: 'ASC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        data: methods,
        meta: { total: 1, page: 1, lastPage: 1, limit: 10 },
      });
    });
  });

  describe('findOne', () => {
    it('should return a payment method if found', async () => {
      const method = { id: 'uuid-1', name: 'Efectivo' };
      mockRepository.findOne.mockResolvedValue(method);

      const result = await service.findOne('uuid-1');

      expect(result).toEqual(method);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
