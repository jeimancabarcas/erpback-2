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
import { InventoryService } from '../inventory/inventory.service';
describe('PurchaseOrdersService — emitSupportDocument', () => {
  let service: PurchaseOrdersService;
  let mockPurchaseOrderRepo: any;
  let mockSupportDocRepo: any;
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
