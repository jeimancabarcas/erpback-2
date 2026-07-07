import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PurchaseOrderAdjustmentScenarioDHandler } from './purchase-order-adjustment-scenario-d';
import { InventoryService } from '../../inventory/inventory.service';
import type { PurchaseOrderAdjustmentScenarioParams } from './purchase-order-adjustment-scenario-handler.interface';

describe('PurchaseOrderAdjustmentScenarioDHandler (T6)', () => {
  let handler: PurchaseOrderAdjustmentScenarioDHandler;
  let mockInventoryService: any;

  beforeEach(async () => {
    mockInventoryService = {
      consumeStock: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderAdjustmentScenarioDHandler,
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    handler = module.get<PurchaseOrderAdjustmentScenarioDHandler>(
      PurchaseOrderAdjustmentScenarioDHandler,
    );
  });

  const createMockParams = (
    overrides: any = {},
  ): PurchaseOrderAdjustmentScenarioParams => ({
    purchaseOrder: {
      id: 'order-uuid',
      orderNumber: 'OC-0001',
      status: 'COMPLETED',
      items: [
        {
          productId: 'product-1',
          quantity: 10,
          price: 5000,
          product: {
            id: 'product-1',
            sku: 'PROD-001',
            name: 'Producto Test',
            taxes: [{ id: 'tax-1', code: '01', name: 'IVA', percentage: 19 }],
          },
        },
      ],
      ...(overrides.purchaseOrder || {}),
    },
    dto: {
      correctionConceptCode: '2',
      observation: 'Anulación total',
      ...(overrides.dto || {}),
    },
    queryRunner: {} as EntityManager,
    factusGateway: {
      createSupportDocumentAdjustmentNote: jest.fn(),
      destroySupportDocumentAdjustmentNote: jest.fn(),
      downloadSupportDocumentAdjustmentNotePdf: jest.fn(),
    },
    ...overrides,
  });

  describe('consumeStock for all items', () => {
    it('should call consumeStock for each item', async () => {
      const params = createMockParams();

      await handler.execute(params);

      expect(mockInventoryService.consumeStock).toHaveBeenCalledTimes(1);
      expect(mockInventoryService.consumeStock).toHaveBeenCalledWith(
        'product-1',
        10,
        params.queryRunner,
        {
          referenceType: 'PURCHASE_ORDER_ADJUSTMENT',
          referenceId: 'order-uuid',
        },
      );
    });

    it('should call consumeStock for each item when multiple items exist', async () => {
      const params = createMockParams({
        purchaseOrder: {
          id: 'order-uuid',
          items: [
            {
              productId: 'product-1',
              quantity: 5,
              price: 10000,
              product: {
                id: 'product-1',
                sku: 'PROD-001',
                name: 'Producto A',
                taxes: [
                  { id: 'tax-1', code: '01', name: 'IVA', percentage: 19 },
                ],
              },
            },
            {
              productId: 'product-2',
              quantity: 3,
              price: 20000,
              product: {
                id: 'product-2',
                sku: 'PROD-002',
                name: 'Producto B',
                taxes: [
                  { id: 'tax-1', code: '01', name: 'IVA', percentage: 19 },
                ],
              },
            },
          ],
        },
      });

      await handler.execute(params);

      expect(mockInventoryService.consumeStock).toHaveBeenCalledTimes(2);
      // Verify first call args
      expect(mockInventoryService.consumeStock).toHaveBeenCalledWith(
        'product-1',
        5,
        params.queryRunner,
        expect.objectContaining({
          referenceType: 'PURCHASE_ORDER_ADJUSTMENT',
        }),
      );
      // Verify second call args
      expect(mockInventoryService.consumeStock).toHaveBeenCalledWith(
        'product-2',
        3,
        params.queryRunner,
        expect.objectContaining({
          referenceType: 'PURCHASE_ORDER_ADJUSTMENT',
        }),
      );
    });

    it('should use PURCHASE_ORDER_ADJUSTMENT reference type', async () => {
      const params = createMockParams();

      await handler.execute(params);

      expect(mockInventoryService.consumeStock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(Object),
        {
          referenceType: 'PURCHASE_ORDER_ADJUSTMENT',
          referenceId: 'order-uuid',
        },
      );
    });
  });

  describe('CANCELLED guard', () => {
    it('should throw BadRequestException when PO is already CANCELLED', async () => {
      const params = createMockParams({
        purchaseOrder: { status: 'CANCELLED' },
      });

      await expect(handler.execute(params)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw with appropriate message for cancelled order', async () => {
      const params = createMockParams({
        purchaseOrder: { status: 'CANCELLED' },
      });

      await expect(handler.execute(params)).rejects.toThrow(
        'No se puede emitir una nota de ajuste para una orden ya cancelada',
      );
    });

    it('should NOT throw for COMPLETED orders', async () => {
      const params = createMockParams();

      const result = await handler.execute(params);
      expect(result).toBeDefined();
      expect(result.updatedOrderStatus).toBe('CANCELLED');
    });
  });

  describe('priceBeforeTax computation', () => {
    it('should compute correct priceBeforeTax for 19% tax', async () => {
      const params = createMockParams({
        purchaseOrder: {
          items: [
            {
              productId: 'product-1',
              quantity: 10,
              price: 5000, // tax-inclusive
              product: {
                id: 'product-1',
                sku: 'PROD-001',
                name: 'Producto Test',
                taxes: [
                  {
                    id: 'tax-1',
                    code: '01',
                    name: 'IVA',
                    percentage: 19,
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await handler.execute(params);

      // priceBeforeTax = 5000 / 1.19 ≈ 4201.68
      expect(result.factusItems[0].price).toBe(4201.68);
    });

    it('should compute correct priceBeforeTax for 0% tax', async () => {
      const params = createMockParams({
        purchaseOrder: {
          items: [
            {
              productId: 'product-1',
              quantity: 5,
              price: 10000,
              product: {
                id: 'product-1',
                sku: 'PROD-002',
                name: 'Producto Exento',
                taxes: [
                  {
                    id: 'tax-2',
                    code: '03',
                    name: 'Exento',
                    percentage: 0,
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await handler.execute(params);

      // priceBeforeTax = 10000 (no taxes)
      expect(result.factusItems[0].price).toBe(10000);
    });

    it('should compute correct priceBeforeTax for multiple tax rates', async () => {
      const params = createMockParams({
        purchaseOrder: {
          items: [
            {
              productId: 'product-1',
              quantity: 2,
              price: 15000, // tax-inclusive
              product: {
                id: 'product-1',
                sku: 'PROD-003',
                name: 'Producto Multi Tax',
                taxes: [
                  {
                    id: 'tax-1',
                    code: '01',
                    name: 'IVA',
                    percentage: 16,
                  },
                  {
                    id: 'tax-2',
                    code: '03',
                    name: 'Impuesto Consumo',
                    percentage: 8,
                  },
                ],
              },
            },
          ],
        },
      });

      const result = await handler.execute(params);

      // priceBeforeTax = 15000 / 1.24 ≈ 12096.77
      // totalTaxRate = 16 + 8 = 24
      expect(result.factusItems[0].price).toBeCloseTo(12096.77, 1);
    });
  });

  describe('result shape', () => {
    it('should return items, totalAmount, factusItems, and updatedOrderStatus', async () => {
      const params = createMockParams();

      const result = await handler.execute(params);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('totalAmount');
      expect(result).toHaveProperty('factusItems');
      expect(result).toHaveProperty('updatedOrderStatus');
      expect(result.updatedOrderStatus).toBe('CANCELLED');
    });

    it('should include tax breakdown in PreparedAdjustmentNoteItem', async () => {
      const params = createMockParams();

      const result = await handler.execute(params);

      expect(result.items[0].noteItemTaxes).toBeDefined();
      expect(result.items[0].noteItemTaxes.length).toBe(1);
      expect(result.items[0].noteItemTaxes[0].taxCode).toBe('01');
      expect(result.items[0].noteItemTaxes[0].taxRate).toBe(19);
    });
  });
});
