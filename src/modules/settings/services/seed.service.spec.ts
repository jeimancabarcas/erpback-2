import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Tax } from '../entities/tax.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentType } from '../entities/payment-type.entity';
import { Municipality } from '../entities/municipality.entity';
import { InventoryCategory } from '../../inventory/entities/inventory-category.entity';
import { Product } from '../../inventory/entities/product.entity';

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

    it('should truncate all tables inside the transaction', async () => {
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
      expect(mockTransactionalEm.query).toHaveBeenCalledWith(
        `TRUNCATE TABLE "products_taxes" CASCADE`,
      );
      expect(mockTransactionalEm.query).toHaveBeenCalledWith(
        `TRUNCATE TABLE "products" CASCADE`,
      );
      expect(mockTransactionalEm.query).toHaveBeenCalledWith(
        `TRUNCATE TABLE "inventory_categories" CASCADE`,
      );
      expect(mockTransactionalEm.query).toHaveBeenCalledWith(
        `TRUNCATE TABLE "municipalities" CASCADE`,
      );
    });

    it('should insert seed data for all entities', async () => {
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
      expect(mockTransactionalEm.insert).toHaveBeenCalledWith(
        InventoryCategory,
        expect.arrayContaining([
          expect.objectContaining({ name: 'Analgésicos' }),
          expect.objectContaining({ name: 'Cardiovascular' }),
        ]),
      );
      expect(mockTransactionalEm.insert).toHaveBeenCalledWith(
        Product,
        expect.arrayContaining([
          expect.objectContaining({ sku: 'ANA-001' }),
          expect.objectContaining({ sku: 'CAR-003' }),
        ]),
      );
    });

    it('should insert seed data for municipalities', async () => {
      await service.seed();
      expect(mockTransactionalEm.insert).toHaveBeenCalledWith(
        Municipality,
        expect.arrayContaining([
          expect.objectContaining({
            code: '11001',
            name: 'Bogotá D.C.',
            department: 'Bogotá D.C.',
          }),
          expect.objectContaining({
            code: '05001',
            name: 'Medellín',
            department: 'Antioquia',
          }),
          expect.objectContaining({
            code: '52001',
            name: 'Pasto',
            department: 'Nariño',
          }),
        ]),
      );
    });

    it('should return correct record counts', async () => {
      const result = await service.seed();
      expect(result).toEqual({
        taxes: 5,
        paymentMethods: 6,
        paymentTypes: 2,
        categories: 10,
        products: 30,
        municipalities: 10,
      });
    });

    it('should propagate transaction rollback on error', async () => {
      mockTransactionalEm.query.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.seed()).rejects.toThrow('DB error');
      expect(mockEm.transaction).toHaveBeenCalled();
    });
  });
});
