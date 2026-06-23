import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Tax } from '../entities/tax.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentType } from '../entities/payment-type.entity';

describe('SeedService', () => {
  let service: SeedService;
  let mockTransactionalEm: { query: jest.Mock; insert: jest.Mock };
  let mockEm: { transaction: jest.Mock };

  beforeEach(async () => {
    mockTransactionalEm = {
      query: jest.fn().mockResolvedValue(undefined),
      insert: jest
        .fn()
        .mockImplementation((_entity: unknown, data: unknown[]) => ({
          identifiers: data.map(() => ({ id: 'uuid' })),
          raw: [],
        })),
    };

    mockEm = {
      transaction: jest
        .fn()
        .mockImplementation(
          (cb: (em: typeof mockTransactionalEm) => Promise<unknown>) =>
            cb(mockTransactionalEm),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        {
          provide: getEntityManagerToken(),
          useValue: mockEm,
        },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
    jest.clearAllMocks();
  });

  describe('seed', () => {
    it('should call entityManager.transaction()', async () => {
      await service.seed();
      expect(mockEm.transaction).toHaveBeenCalled();
    });

    it('should truncate all three tables inside the transaction', async () => {
      await service.seed();
      expect(mockTransactionalEm.query).toHaveBeenCalledWith(
        `TRUNCATE TABLE "taxes" CASCADE`,
      );
      expect(mockTransactionalEm.query).toHaveBeenCalledWith(
        `TRUNCATE TABLE "payment_methods" CASCADE`,
      );
      expect(mockTransactionalEm.query).toHaveBeenCalledWith(
        `TRUNCATE TABLE "payment_types" CASCADE`,
      );
    });

    it('should insert seed data for all three entities', async () => {
      await service.seed();
      expect(mockTransactionalEm.insert).toHaveBeenCalledWith(
        Tax,
        expect.arrayContaining([
          expect.objectContaining({ name: 'IVA 19%' }),
          expect.objectContaining({ name: 'ICA' }),
        ]),
      );
      expect(mockTransactionalEm.insert).toHaveBeenCalledWith(
        PaymentMethod,
        expect.arrayContaining([
          expect.objectContaining({ name: 'Efectivo' }),
          expect.objectContaining({ name: 'Cheque' }),
        ]),
      );
      expect(mockTransactionalEm.insert).toHaveBeenCalledWith(
        PaymentType,
        expect.arrayContaining([
          expect.objectContaining({ name: 'Contado' }),
          expect.objectContaining({ name: 'Crédito' }),
        ]),
      );
    });

    it('should return correct record counts (5 taxes, 6 payment methods, 2 payment types)', async () => {
      const result = await service.seed();
      expect(result).toEqual({
        taxes: 5,
        paymentMethods: 6,
        paymentTypes: 2,
      });
    });

    it('should propagate transaction rollback on error', async () => {
      mockTransactionalEm.query.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.seed()).rejects.toThrow('DB error');
      expect(mockEm.transaction).toHaveBeenCalled();
    });
  });
});
