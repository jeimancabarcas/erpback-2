import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderSupportDocument } from './entities/purchase-order-support-document.entity';
import { PurchaseOrderAdjustmentNote } from './entities/purchase-order-adjustment-note.entity';
import { PurchaseOrderAdjustmentScenarioDHandler } from './helpers/purchase-order-adjustment-scenario-d';
import { InventoryService } from '../inventory/inventory.service';
describe('PurchaseOrdersService — emitSupportDocument', () => {
  let service: PurchaseOrdersService;
  let mockPurchaseOrderRepo: any;
  let mockSupportDocRepo: any;
  let mockAdjustmentNoteRepo: any;
  let mockScenarioDHandler: any;
  let mockInventoryService: any;
  let mockFactusGateway: any;

  const createMockOrder = (overrides: any = {}) => ({
    id: 'order-uuid',
    orderNumber: 'OC-0001',
    status: 'COMPLETED',
    observations: 'Test order',
    createdAt: new Date(),
    supplier: {
      id: 'supplier-uuid',
      nit: '900123456-7',
      dv: '7',
      name: 'Proveedor Test',
      address: 'Calle 123',
      phone: '3001234567',
      municipalityCode: '11001',
      legalOrganizationCode: '123456789',
      ...(overrides.supplier || {}),
    },
    items: [
      {
        id: 'item-uuid',
        quantity: 10,
        price: 5000,
        product: {
          id: 'product-uuid',
          sku: 'PROD-001',
          name: 'Producto Test',
          taxes: [
            {
              code: '01',
              percentage: 19.0,
            },
          ],
        },
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    mockPurchaseOrderRepo = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    };

    mockSupportDocRepo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockInventoryService = {
      updateStock: jest.fn(),
      consumeStock: jest.fn(),
    };

    mockFactusGateway = {
      createSupportDocument: jest.fn(),
      destroySupportDocument: jest.fn(),
      downloadSupportDocumentPdf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: mockPurchaseOrderRepo,
        },
        {
          provide: getRepositoryToken(PurchaseOrderSupportDocument),
          useValue: mockSupportDocRepo,
        },
        {
          provide: getRepositoryToken(PurchaseOrderAdjustmentNote),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: PurchaseOrderAdjustmentScenarioDHandler,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
        {
          provide: 'IFactusInvoicingGateway',
          useValue: mockFactusGateway,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('fix (a): throw BadRequestException when supplier is missing required fields', () => {
    it('should throw BadRequestException when supplier has missing fields', async () => {
      const order = createMockOrder({
        supplier: {
          nit: '900123456-7',
          dv: '7',
          name: 'Proveedor Test',
          address: 'Calle 123',
          phone: '3001234567',
          // municipalityCode missing
          municipalityCode: null,
          // legalOrganizationCode missing
          legalOrganizationCode: null,
        },
      });
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);

      await expect(service.emitSupportDocument('order-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException with field names in message (dv not required)', async () => {
      const order = createMockOrder({
        supplier: {
          nit: null,
          dv: null,
          name: null,
          address: null,
          phone: '3001234567',
          municipalityCode: null,
          legalOrganizationCode: null,
        },
      });
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);

      let thrownError: any;
      try {
        await service.emitSupportDocument('order-uuid');
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(BadRequestException);
      expect(thrownError.message).toContain('NIT');
      expect(thrownError.message).not.toContain('dv');
      expect(thrownError.message).toContain('name');
      expect(thrownError.message).toContain('municipalityCode');
      expect(thrownError.message).toContain('legalOrganizationCode');
    });
  });

  describe('fix (b): municipality_code without ?? ""', () => {
    it('should pass supplier.municipalityCode directly without fallback', async () => {
      const order = createMockOrder();
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);
      mockFactusGateway.createSupportDocument.mockResolvedValue({
        data: {
          referenceCode: 'DS-OC-0001-12345',
          number: 'SETP100',
          cude: 'cude123',
          qrUrl: 'http://qr.test',
          publicUrl: 'http://public.test',
        },
      });
      mockSupportDocRepo.create.mockReturnValue({
        referenceCode: 'DS-OC-0001-12345',
        number: 'SETP100',
        cude: 'cude123',
        qrUrl: 'http://qr.test',
        publicUrl: 'http://public.test',
        purchaseOrderId: 'order-uuid',
      });
      mockSupportDocRepo.save.mockResolvedValue({});

      await service.emitSupportDocument('order-uuid');

      const payload = mockFactusGateway.createSupportDocument.mock.calls[0][0];
      expect(payload.provider.municipality_code).toBe('11001');
      // Should not be empty string fallback when value is present
      expect(payload.provider.municipality_code).not.toBe('');
    });

    it('should use actual municipalityCode value from supplier', async () => {
      const order = createMockOrder({
        supplier: {
          nit: '900123456-7',
          dv: '7',
          name: 'Proveedor Test',
          address: 'Calle 123',
          phone: '3001234567',
          municipalityCode: '76001',
          legalOrganizationCode: '123456789',
        },
      });
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);
      mockFactusGateway.createSupportDocument.mockResolvedValue({
        data: {
          referenceCode: 'DS-OC-0001-12345',
          number: 'SETP100',
          cude: 'cude123',
          qrUrl: 'http://qr.test',
          publicUrl: 'http://public.test',
        },
      });
      mockSupportDocRepo.create.mockReturnValue({});
      mockSupportDocRepo.save.mockResolvedValue({});

      await service.emitSupportDocument('order-uuid');

      const payload = mockFactusGateway.createSupportDocument.mock.calls[0][0];
      expect(payload.provider.municipality_code).toBe('76001');
    });
  });

  describe('fix (c): tax.rate → (tax.percentage ?? 0).toFixed(2)', () => {
    it('should use tax.percentage formatted to 2 decimals instead of tax.rate', async () => {
      const order = createMockOrder();
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);
      mockFactusGateway.createSupportDocument.mockResolvedValue({
        data: {
          referenceCode: 'DS-OC-0001-12345',
          number: 'SETP100',
          cude: 'cude123',
          qrUrl: 'http://qr.test',
          publicUrl: 'http://public.test',
        },
      });
      mockSupportDocRepo.create.mockReturnValue({});
      mockSupportDocRepo.save.mockResolvedValue({});

      await service.emitSupportDocument('order-uuid');

      const payload = mockFactusGateway.createSupportDocument.mock.calls[0][0];
      expect(payload.items[0].taxes[0].rate).toBe('19.00');
    });

    it('should handle zero percentage correctly', async () => {
      const order = createMockOrder({
        items: [
          {
            id: 'item-uuid',
            quantity: 5,
            price: 10000,
            product: {
              id: 'product-uuid',
              sku: 'PROD-002',
              name: 'Producto Exento',
              taxes: [
                {
                  code: '03',
                  percentage: 0,
                },
              ],
            },
          },
        ],
      });
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);
      mockFactusGateway.createSupportDocument.mockResolvedValue({
        data: {
          referenceCode: 'DS-OC-0001-12345',
          number: 'SETP100',
          cude: 'cude123',
          qrUrl: 'http://qr.test',
          publicUrl: 'http://public.test',
        },
      });
      mockSupportDocRepo.create.mockReturnValue({});
      mockSupportDocRepo.save.mockResolvedValue({});

      await service.emitSupportDocument('order-uuid');

      const payload = mockFactusGateway.createSupportDocument.mock.calls[0][0];
      expect(payload.items[0].taxes[0].rate).toBe('0.00');
    });

    it('should handle undefined percentage with fallback to 0', async () => {
      const order = createMockOrder({
        items: [
          {
            id: 'item-uuid',
            quantity: 3,
            price: 20000,
            product: {
              id: 'product-uuid',
              sku: 'PROD-003',
              name: 'Producto Sin Porcentaje',
              taxes: [
                {
                  code: '05',
                  // no percentage field
                },
              ],
            },
          },
        ],
      });
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);
      mockFactusGateway.createSupportDocument.mockResolvedValue({
        data: {
          referenceCode: 'DS-OC-0001-12345',
          number: 'SETP100',
          cude: 'cude123',
          qrUrl: 'http://qr.test',
          publicUrl: 'http://public.test',
        },
      });
      mockSupportDocRepo.create.mockReturnValue({});
      mockSupportDocRepo.save.mockResolvedValue({});

      await service.emitSupportDocument('order-uuid');

      const payload = mockFactusGateway.createSupportDocument.mock.calls[0][0];
      expect(payload.items[0].taxes[0].rate).toBe('0.00');
    });
  });

  describe('existing behavior preserved', () => {
    it('should throw NotFoundException when order not found', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue(null);
      await expect(service.emitSupportDocument('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when order is not COMPLETED', async () => {
      const order = createMockOrder({ status: 'CREATED' });
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);

      await expect(service.emitSupportDocument('order-uuid')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when support document already exists', async () => {
      const order = createMockOrder();
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([{ id: 'existing-doc' }]);

      await expect(service.emitSupportDocument('order-uuid')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

describe('PurchaseOrdersService — pre-tax fix and computeFactusTotal (T7)', () => {
  let service: PurchaseOrdersService;
  let mockPurchaseOrderRepo: any;
  let mockSupportDocRepo: any;
  let mockAdjustmentNoteRepo: any;
  let mockScenarioDHandler: any;
  let mockInventoryService: any;
  let mockFactusGateway: any;

  const createMockOrder = (overrides: any = {}) => ({
    id: 'order-uuid',
    orderNumber: 'OC-0001',
    status: 'COMPLETED',
    observations: 'Test order',
    createdAt: new Date(),
    supplier: {
      id: 'supplier-uuid',
      nit: '900123456-7',
      dv: '7',
      name: 'Proveedor Test',
      address: 'Calle 123',
      phone: '3001234567',
      municipalityCode: '11001',
      legalOrganizationCode: '123456789',
      ...(overrides.supplier || {}),
    },
    items: overrides.items || [
      {
        id: 'item-uuid',
        quantity: 10,
        price: 5000,
        product: {
          id: 'product-uuid',
          sku: 'PROD-001',
          name: 'Producto Test',
          taxes: [
            {
              code: '01',
              percentage: 19.0,
            },
          ],
        },
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    mockPurchaseOrderRepo = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    };

    mockSupportDocRepo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockAdjustmentNoteRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockScenarioDHandler = {
      execute: jest.fn().mockResolvedValue({
        items: [],
        totalAmount: 0,
        factusItems: [],
        updatedOrderStatus: 'CANCELLED',
      }),
    };

    mockInventoryService = {
      updateStock: jest.fn(),
      consumeStock: jest.fn(),
    };

    mockFactusGateway = {
      createSupportDocument: jest.fn(),
      destroySupportDocument: jest.fn(),
      downloadSupportDocumentPdf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: mockPurchaseOrderRepo,
        },
        {
          provide: getRepositoryToken(PurchaseOrderSupportDocument),
          useValue: mockSupportDocRepo,
        },
        {
          provide: getRepositoryToken(PurchaseOrderAdjustmentNote),
          useValue: mockAdjustmentNoteRepo,
        },
        {
          provide: PurchaseOrderAdjustmentScenarioDHandler,
          useValue: mockScenarioDHandler,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
        {
          provide: 'IFactusInvoicingGateway',
          useValue: mockFactusGateway,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('computeFactusTotal', () => {
    it('should compute total using integer-cents arithmetic for single item', () => {
      const factusItems = [
        {
          price: 4201.68,
          quantity: 10,
          taxes: [{ rate: '19.00' }],
        },
      ];

      // Access private method via bracket notation
      const total = (service as any).computeFactusTotal(factusItems);

      // priceCents = 420168, qtyHundredths = 1000
      // netCents = round(420168 * 1000 / 100) = 4201680
      // itemCents = 4201680 + floor(4201680 * 19 / 100) = 4201680 + 798319 = 4999999
      // total = 49999.99
      expect(total).toBe(49999.99);
    });

    it('should compute total for multiple items with different tax rates', () => {
      const factusItems = [
        {
          price: 4201.68,
          quantity: 5,
          taxes: [{ rate: '19.00' }],
        },
        {
          price: 10000,
          quantity: 2,
          taxes: [{ rate: '5.00' }],
        },
      ];

      const total = (service as any).computeFactusTotal(factusItems);
      expect(total).toBeGreaterThan(0);
      expect(typeof total).toBe('number');
    });

    it('should handle items with no taxes', () => {
      const factusItems = [
        {
          price: 10000,
          quantity: 1,
          taxes: [],
        },
      ];

      const total = (service as any).computeFactusTotal(factusItems);
      // priceCents = 1000000, qtyHundredths = 100
      // netCents = round(1000000 * 100 / 100) = 1000000
      // itemCents = 1000000 (no taxes)
      // total = 10000.00
      expect(total).toBe(10000);
    });
  });

  describe('emitSupportDocument — pre-tax fix', () => {
    it('should send priceBeforeTax in Factus items instead of tax-inclusive price', async () => {
      const order = createMockOrder();
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);
      mockFactusGateway.createSupportDocument.mockResolvedValue({
        data: {
          referenceCode: 'DS-OC-0001-12345',
          number: 'SETP100',
          cude: 'cude123',
        },
      });
      mockSupportDocRepo.create.mockReturnValue({});
      mockSupportDocRepo.save.mockResolvedValue({});

      await service.emitSupportDocument('order-uuid');

      const payload = mockFactusGateway.createSupportDocument.mock.calls[0][0];

      // priceBeforeTax = 5000 / 1.19 ≈ 4201.68
      expect(Number(payload.items[0].price)).toBeCloseTo(4201.68, 1);
      // Should NOT be the raw tax-inclusive value
      expect(Number(payload.items[0].price)).not.toBe(5000);
    });

    it('should use computeFactusTotal for payment amount', async () => {
      const order = createMockOrder();
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);
      mockFactusGateway.createSupportDocument.mockResolvedValue({
        data: {
          referenceCode: 'DS-OC-0001-12345',
          number: 'SETP100',
          cude: 'cude123',
        },
      });
      mockSupportDocRepo.create.mockReturnValue({});
      mockSupportDocRepo.save.mockResolvedValue({});

      await service.emitSupportDocument('order-uuid');

      const payload = mockFactusGateway.createSupportDocument.mock.calls[0][0];

      // Payment amount should be a number string from computeFactusTotal
      expect(payload.paymentDetails[0].amount).toBeDefined();
      const amount = Number(payload.paymentDetails[0].amount);
      expect(amount).toBeGreaterThan(0);
      // Should be a reasonable total for 10 items at 5000 each with 19% tax
      expect(amount).toBeCloseTo(49999.99, 1);
    });

    it('should compute priceBeforeTax correctly for items with 0% tax', async () => {
      const order = createMockOrder({
        items: [
          {
            id: 'item-uuid',
            quantity: 5,
            price: 10000,
            product: {
              id: 'product-uuid',
              sku: 'PROD-002',
              name: 'Producto Exento',
              taxes: [
                {
                  code: '03',
                  percentage: 0,
                },
              ],
            },
          },
        ],
      });
      mockPurchaseOrderRepo.findOne.mockResolvedValue(order);
      mockSupportDocRepo.find.mockResolvedValue([]);
      mockFactusGateway.createSupportDocument.mockResolvedValue({
        data: {
          referenceCode: 'DS-OC-0001-12345',
          number: 'SETP100',
          cude: 'cude123',
        },
      });
      mockSupportDocRepo.create.mockReturnValue({});
      mockSupportDocRepo.save.mockResolvedValue({});

      await service.emitSupportDocument('order-uuid');

      const payload = mockFactusGateway.createSupportDocument.mock.calls[0][0];

      // priceBeforeTax = 10000 (no tax)
      expect(Number(payload.items[0].price)).toBe(10000);
    });
  });
});

describe('PurchaseOrdersService — emitAdjustmentNote (T8)', () => {
  let service: PurchaseOrdersService;
  let mockPurchaseOrderRepo: any;
  let mockSupportDocRepo: any;
  let mockAdjustmentNoteRepo: any;
  let mockScenarioDHandler: any;
  let mockInventoryService: any;
  let mockFactusGateway: any;

  const createMockOrder = (overrides: any = {}) => ({
    id: 'order-uuid',
    orderNumber: 'OC-0001',
    status: 'COMPLETED',
    observations: 'Test order',
    createdAt: new Date(),
    supplier: {
      id: 'supplier-uuid',
      nit: '900123456-7',
      dv: '7',
      name: 'Proveedor Test',
      address: 'Calle 123',
      phone: '3001234567',
      municipalityCode: '11001',
      legalOrganizationCode: '123456789',
      ...(overrides.supplier || {}),
    },
    items: overrides.items || [
      {
        id: 'item-uuid',
        productId: 'product-uuid',
        quantity: 10,
        price: 5000,
        product: {
          id: 'product-uuid',
          sku: 'PROD-001',
          name: 'Producto Test',
          taxes: [
            {
              id: 'tax-1',
              code: '01',
              name: 'IVA',
              percentage: 19.0,
            },
          ],
        },
      },
    ],
    supportDocuments: overrides.supportDocuments || [
      {
        id: 'support-doc-uuid',
        number: 'SETP100',
        referenceCode: 'DS-OC-0001-12345',
      },
    ],
    adjustmentNotes: overrides.adjustmentNotes || [],
    ...overrides,
  });

  let mockTransactionManager: any;
  let mockAdjNoteItemRepo: any;
  let mockTxOrderRepo: any;
  let mockTxAdjNoteRepo: any;

  beforeEach(async () => {
    mockTxOrderRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    mockTxAdjNoteRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'saved-note-id', items: [] }),
      save: jest.fn().mockResolvedValue({ id: 'saved-note-id' }),
      create: jest.fn().mockReturnValue({}),
    };

    mockAdjNoteItemRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    mockTransactionManager = {
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === PurchaseOrder) {
          return mockTxOrderRepo;
        }
        if (entity === PurchaseOrderAdjustmentNote) {
          return mockTxAdjNoteRepo;
        }
        if (entity.name === 'PurchaseOrderAdjustmentNoteItem') {
          return mockAdjNoteItemRepo;
        }
        return {
          findOne: jest.fn(),
          save: jest.fn(),
          create: jest.fn(),
        };
      }),
    };

    mockPurchaseOrderRepo = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb: any) => {
          return cb(mockTransactionManager);
        }),
      },
    };

    mockSupportDocRepo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockAdjustmentNoteRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockScenarioDHandler = {
      execute: jest.fn().mockResolvedValue({
        items: [],
        totalAmount: 0,
        factusItems: [],
        updatedOrderStatus: 'CANCELLED',
      }),
    };

    mockInventoryService = {
      updateStock: jest.fn(),
      consumeStock: jest.fn(),
    };

    mockFactusGateway = {
      createSupportDocument: jest.fn(),
      destroySupportDocument: jest.fn(),
      downloadSupportDocumentPdf: jest.fn(),
      createSupportDocumentAdjustmentNote: jest.fn(),
      destroySupportDocumentAdjustmentNote: jest.fn(),
      downloadSupportDocumentAdjustmentNotePdf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: mockPurchaseOrderRepo,
        },
        {
          provide: getRepositoryToken(PurchaseOrderSupportDocument),
          useValue: mockSupportDocRepo,
        },
        {
          provide: getRepositoryToken(PurchaseOrderAdjustmentNote),
          useValue: mockAdjustmentNoteRepo,
        },
        {
          provide: PurchaseOrderAdjustmentScenarioDHandler,
          useValue: mockScenarioDHandler,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
        {
          provide: 'IFactusInvoicingGateway',
          useValue: mockFactusGateway,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  describe('guards', () => {
    const txFindOne = (orderVal: any) => {
      mockTxOrderRepo.findOne.mockResolvedValue(orderVal);
    };
    it('should throw NotFoundException when order not found', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.emitAdjustmentNote('nonexistent', {
          correctionConceptCode: '2',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when order is not COMPLETED', async () => {
      const order = createMockOrder({ status: 'CREATED' });
      txFindOne(order);

      await expect(
        service.emitAdjustmentNote('order-uuid', {
          correctionConceptCode: '2',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when no support document exists', async () => {
      const order = createMockOrder({ supportDocuments: [] });
      txFindOne(order);

      await expect(
        service.emitAdjustmentNote('order-uuid', {
          correctionConceptCode: '2',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when support document has no number', async () => {
      const order = createMockOrder({
        supportDocuments: [
          { id: 'doc-uuid', number: null, referenceCode: 'DS-001' },
        ],
      });
      txFindOne(order);

      await expect(
        service.emitAdjustmentNote('order-uuid', {
          correctionConceptCode: '2',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when adjustment note already exists', async () => {
      const order = createMockOrder({
        adjustmentNotes: [{ id: 'existing-note' }],
      });
      txFindOne(order);

      await expect(
        service.emitAdjustmentNote('order-uuid', {
          correctionConceptCode: '2',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when supplier missing fields', async () => {
      const order = createMockOrder({
        supplier: {
          nit: null,
          name: null,
          address: null,
          phone: '3001234567',
          municipalityCode: null,
          legalOrganizationCode: null,
        },
      });
      txFindOne(order);

      await expect(
        service.emitAdjustmentNote('order-uuid', {
          correctionConceptCode: '2',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('successful emission', () => {
    it('should call createSupportDocumentAdjustmentNote via Factus', async () => {
      const order = createMockOrder();
      mockTxOrderRepo.findOne.mockResolvedValue(order);
      mockFactusGateway.createSupportDocumentAdjustmentNote.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: {
          referenceCode: 'NA-OC-0001-12345',
          number: 'NA100',
          cude: 'cude123',
          isValidated: true,
          validatedAt: '2024-06-15T10:30:00Z',
          createdAt: '2024-06-15T10:30:00Z',
          numberingRange: null,
          items: [],
          taxes: [],
          totals: null,
          links: {},
        },
      });

      const result = await service.emitAdjustmentNote('order-uuid', {
        correctionConceptCode: '2',
        observation: 'Anulación total',
      });

      expect(
        mockFactusGateway.createSupportDocumentAdjustmentNote,
      ).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when Factus call fails', async () => {
      const order = createMockOrder();
      mockTxOrderRepo.findOne.mockResolvedValue(order);
      mockFactusGateway.createSupportDocumentAdjustmentNote.mockRejectedValue(
        new Error('Factus error'),
      );

      await expect(
        service.emitAdjustmentNote('order-uuid', {
          correctionConceptCode: '2',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

describe('PurchaseOrdersService — findOne relations (trazability)', () => {
  let service: PurchaseOrdersService;
  let mockPurchaseOrderRepo: any;

  beforeEach(async () => {
    mockPurchaseOrderRepo = {
      findOne: jest.fn(),
      manager: { transaction: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockPurchaseOrderRepo },
        { provide: getRepositoryToken(PurchaseOrderSupportDocument), useValue: { find: jest.fn(), create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(PurchaseOrderAdjustmentNote), useValue: { findOne: jest.fn(), find: jest.fn() } },
        { provide: PurchaseOrderAdjustmentScenarioDHandler, useValue: { execute: jest.fn() } },
        { provide: InventoryService, useValue: { updateStock: jest.fn(), consumeStock: jest.fn() } },
        { provide: 'IFactusInvoicingGateway', useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  it('should include supportDocuments in findOne relations', async () => {
    const mockOrder = { id: 'order-uuid', supportDocuments: [{ id: 'doc-1' }] };
    mockPurchaseOrderRepo.findOne.mockResolvedValue(mockOrder);

    const result = await service.findOne('order-uuid');

    expect(mockPurchaseOrderRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'order-uuid' },
      relations: expect.arrayContaining(['supportDocuments']),
    });
    expect(result.supportDocuments).toHaveLength(1);
    expect(result.supportDocuments[0].id).toBe('doc-1');
  });

  it('should include adjustmentNotes in findOne relations', async () => {
    const mockOrder = { id: 'order-uuid', adjustmentNotes: [{ id: 'note-1' }] };
    mockPurchaseOrderRepo.findOne.mockResolvedValue(mockOrder);

    const result = await service.findOne('order-uuid');

    expect(mockPurchaseOrderRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'order-uuid' },
      relations: expect.arrayContaining(['adjustmentNotes']),
    });
    expect(result.adjustmentNotes).toHaveLength(1);
    expect(result.adjustmentNotes[0].id).toBe('note-1');
  });

  it('should return empty arrays when no supportDocuments or adjustmentNotes exist', async () => {
    const mockOrder = { id: 'order-uuid', supportDocuments: [], adjustmentNotes: [] };
    mockPurchaseOrderRepo.findOne.mockResolvedValue(mockOrder);

    const result = await service.findOne('order-uuid');

    expect(result.supportDocuments).toEqual([]);
    expect(result.adjustmentNotes).toEqual([]);
  });
});
