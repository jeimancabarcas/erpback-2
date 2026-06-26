import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { ElectronicBillsService } from './electronic-bills.service';
import { InvoiceElectronicEmission } from '../sales/entities/invoice-electronic-emission.entity';
import { Invoice } from '../sales/entities/invoice.entity';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { CreateElectronicBillDto } from './dto/create-electronic-bill.dto';
import { ElectronicBillListDto } from './dto/electronic-bill-list.dto';
import { Product } from '../inventory/entities/product.entity';

describe('ElectronicBillsService', () => {
  let service: ElectronicBillsService;
  let emissionRepo: any;
  let invoiceRepo: any;
  let productRepo: any;
  let factusGateway: any;

  function repoMock() {
    return {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
      create: jest.fn().mockImplementation((d: any) => ({ ...d })),
      count: jest.fn().mockResolvedValue(0),
    };
  }

  beforeEach(async () => {
    emissionRepo = repoMock();
    invoiceRepo = repoMock();
    productRepo = repoMock();
    factusGateway = {
      createInvoice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElectronicBillsService,
        {
          provide: getRepositoryToken(InvoiceElectronicEmission),
          useValue: emissionRepo,
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: invoiceRepo,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: productRepo,
        },
        {
          provide: 'IFactusInvoicingGateway',
          useValue: factusGateway,
        },
      ],
    }).compile();

    service = module.get<ElectronicBillsService>(ElectronicBillsService);
  });

  // -----------------------------------------------------------------------
  // findAll
  // -----------------------------------------------------------------------
  describe('findAll', () => {
    it('returns paginated emissions with correct meta', async () => {
      const mockEmissions = [
        {
          id: 'em-1',
          number: 'SETP990001',
          status: 'emitted' as const,
          cude: 'cude-abc',
          invoiceId: null,
          createdAt: new Date('2026-06-25'),
        },
      ];
      emissionRepo.findAndCount.mockResolvedValue([mockEmissions, 1]);

      const result: PaginatedResult<ElectronicBillListDto> =
        await service.findAll({ page: 1, perPage: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('em-1');
      expect(result.data[0].status).toBe('emitted');
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        lastPage: 1,
        limit: 10,
      });
    });

    it('passes pagination params to repository', async () => {
      emissionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 2, perPage: 5 });

      expect(emissionRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      );
    });

    it('defaults to page=1, perPage=10', async () => {
      emissionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(emissionRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('returns empty array when no emissions exist', async () => {
      emissionRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, perPage: 10 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // create — standalone emission (no manualInvoiceId)
  // -----------------------------------------------------------------------
  describe('create — standalone', () => {
    const standaloneDto: CreateElectronicBillDto = {
      customer: {
        identification: '123456789',
        names: 'Test Customer',
        address: 'calle 1 # 1-1',
        email: 'test@test.com',
        phone: '1234567890',
      },
      items: [
        {
          codeReference: 'SKU-001',
          name: 'Product A',
          quantity: 2,
          price: 50000,
        },
      ],
    };

    it('creates emission with status pending, then emitted on Factus success', async () => {
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: {
          number: 'SETP990003678',
          cude: 'cude-abc-123',
          qrUrl: 'https://qr',
          publicUrl: 'https://pdf',
          isValidated: true,
          validatedAt: '2026-06-25T00:00:00Z',
          numberingRange: null,
          items: [],
          taxes: [],
          totals: { total: 100000 },
          links: { qr: 'https://qr', publicUrl: 'https://pdf' },
        },
      });

      // Capture the sequence of saves (only one save after Factus success)
      const savedEmissions: any[] = [];
      emissionRepo.save.mockImplementation((e: any) => {
        savedEmissions.push(e);
        return Promise.resolve({ ...e, id: 'em-new' });
      });

      const result = await service.create(standaloneDto);

      // Only ONE save — after Factus confirms success
      expect(savedEmissions).toHaveLength(1);
      expect(savedEmissions[0].status).toBe('emitted');
      // Factus called
      expect(factusGateway.createInvoice).toHaveBeenCalledTimes(1);
      // Result has emitted status
      expect(result.status).toBe('emitted');
      expect(result.number).toBe('SETP990003678');
    });

    it('throws BadRequestException when Factus API fails (no DB record saved)', async () => {
      factusGateway.createInvoice.mockRejectedValue(
        new Error('Factus API error'),
      );

      // Verify save is NOT called (no record persisted on Factus failure)
      await expect(service.create(standaloneDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(emissionRepo.save).not.toHaveBeenCalled();
      expect(factusGateway.createInvoice).toHaveBeenCalledTimes(1);
    });

    it('does not set invoice_id for standalone emission', async () => {
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: {
          number: 'SETP990001',
          cude: 'cude-abc',
          isValidated: true,
        },
      });

      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-new' }),
      );

      const result = await service.create(standaloneDto);

      expect(emissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: null,
        }),
      );
    });

    it('builds Factus payload with customer and items', async () => {
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });

      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-new' }),
      );

      await service.create(standaloneDto);

      expect(factusGateway.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceCode: expect.any(String),
          customer: expect.objectContaining({
            identification: '123456789',
            names: 'Test Customer',
          }),
          items: expect.arrayContaining([
            expect.objectContaining({
              codeReference: 'SKU-001',
              quantity: 2,
              price: 50000,
            }),
          ]),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // create — with manual bill linkage
  // -----------------------------------------------------------------------
  describe('create — with manual bill linkage', () => {
    const manualInvoice = {
      id: 'inv-manual-1',
      invoiceNumber: 'MAN-000042',
      totalAmount: 100000,
      customer: {
        documentNumber: '123456789',
        name: 'Test Customer',
      },
      items: [
        {
          product: { sku: 'SKU-001', name: 'Product A' },
          quantity: 2,
          unitPrice: 50000,
        },
      ],
    };

    const dtoWithLink: CreateElectronicBillDto = {
      manualInvoiceId: 'inv-manual-1',
      customer: {
        identification: '123456789',
        names: 'Test Customer',
      },
      items: [
        {
          codeReference: 'SKU-001',
          name: 'Product A',
          quantity: 2,
          price: 50000,
        },
      ],
    };

    it('links emission to manual invoice when values match', async () => {
      invoiceRepo.findOne.mockResolvedValue(manualInvoice);
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });

      emissionRepo.create.mockReturnValue({});
      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-linked' }),
      );

      const result = await service.create(dtoWithLink);

      expect(invoiceRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-manual-1' },
        }),
      );
      expect(emissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: 'inv-manual-1',
        }),
      );
    });

    it('warns and does NOT link when values diverge beyond tolerance', async () => {
      invoiceRepo.findOne.mockResolvedValue({
        ...manualInvoice,
        totalAmount: 99999, // different from items total
      });
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });

      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-warn' }),
      );

      const result = await service.create({
        ...dtoWithLink,
        manualInvoiceId: 'inv-manual-1',
      });

      // invoice_id should be null in create call
      expect(emissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: null,
        }),
      );
      // Response should include warning
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('MAN-000042');
    });

    it('creates standalone emission when linked invoice not found', async () => {
      invoiceRepo.findOne.mockResolvedValue(null);
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });

      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-no-inv' }),
      );

      const result = await service.create({
        ...dtoWithLink,
        manualInvoiceId: 'inv-nonexistent',
      });

      expect(emissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: null,
        }),
      );
      expect(result.number).toBe('SETP990001');
    });
  });

  // -----------------------------------------------------------------------
  // create — standalone with productId (Path B — tax computation)
  // -----------------------------------------------------------------------
  describe('create — standalone with productId (Path B)', () => {
    const dtoWithProductId: CreateElectronicBillDto = {
      customer: { identification: '123', names: 'Test' },
      items: [
        {
          codeReference: 'SKU-001',
          name: 'Product A',
          quantity: 2,
          price: 119000,
          productId: 'prod-1',
        },
      ],
    };

    it('loads product taxes and computes priceBeforeTax and taxes in Factus payload', async () => {
      productRepo.findOne.mockResolvedValue({
        id: 'prod-1',
        sku: 'SKU-001',
        name: 'Product A',
        taxes: [
          { id: 'tax-1', code: '01', percentage: 19.0, isSell: true },
        ],
      });
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });
      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-prod' }),
      );

      await service.create(dtoWithProductId);

      expect(productRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1' },
          relations: ['taxes'],
        }),
      );
      expect(factusGateway.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              codeReference: 'SKU-001',
              price: 100000, // 119000 / 1.19
              taxes: [
                { code: '01', rate: '19.00', isExcluded: false },
              ],
            }),
          ]),
        }),
      );
    });

    it('falls back to taxes:[] when product not found', async () => {
      productRepo.findOne.mockResolvedValue(null);
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });
      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-nf' }),
      );

      await service.create(dtoWithProductId);

      expect(factusGateway.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              price: 119000, // fallback: no product → raw price
              taxes: [],
            }),
          ]),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // create — standalone without productId (backward-compatible)
  // -----------------------------------------------------------------------
  describe('create — standalone without productId (backward-compatible)', () => {
    it('sends taxes:[] when no productId in DTO items', async () => {
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });
      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-bc' }),
      );

      await service.create({
        customer: { identification: '123', names: 'Test' },
        items: [
          { codeReference: 'SKU', name: 'P', quantity: 1, price: 50000 },
        ],
      });

      expect(factusGateway.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              price: 50000,
              taxes: [],
            }),
          ]),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // create — manual invoice linkage with taxes (Path A)
  // -----------------------------------------------------------------------
  describe('create — manual invoice linkage with taxes (Path A)', () => {
    const manualInvoiceWithTaxes = {
      id: 'inv-manual-tax',
      invoiceNumber: 'MAN-000050',
      totalAmount: 238000,
      customer: { documentNumber: '123456789', name: 'Test' },
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          unitPrice: 119000,
          product: {
            id: 'prod-1',
            sku: 'SKU-001',
            name: 'Product A',
            taxes: [
              { id: 'tax-1', code: '01', percentage: 19.0, isSell: true },
            ],
          },
        },
      ],
    };

    const dtoLinkWithTaxes: CreateElectronicBillDto = {
      manualInvoiceId: 'inv-manual-tax',
      customer: { identification: '123456789', names: 'Test' },
      items: [
        { codeReference: 'SKU-001', name: 'Product A', quantity: 2, price: 119000 },
      ],
    };

    it('computes taxes from invoice item product.taxes for linked invoice', async () => {
      invoiceRepo.findOne.mockResolvedValue(manualInvoiceWithTaxes);
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });
      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-tax' }),
      );

      await service.create(dtoLinkWithTaxes);

      expect(factusGateway.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              codeReference: 'SKU-001',
              price: 100000, // 119000 / 1.19
              taxes: [
                { code: '01', rate: '19.00', isExcluded: false },
              ],
            }),
          ]),
        }),
      );
    });

    it('includes all taxes for multi-tax product from linked invoice', async () => {
      invoiceRepo.findOne.mockResolvedValue({
        ...manualInvoiceWithTaxes,
        items: [{
          ...manualInvoiceWithTaxes.items[0],
          product: {
            ...manualInvoiceWithTaxes.items[0].product,
            taxes: [
              { id: 'tax-1', code: '01', percentage: 19.0, isSell: true },
              { id: 'tax-2', code: '04', percentage: 8.0, isSell: true },
            ],
          },
        }],
      });
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });
      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-mtax' }),
      );

      await service.create(dtoLinkWithTaxes);

      expect(factusGateway.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              price: 93700.79, // 119000 / 1.27
              taxes: [
                { code: '01', rate: '19.00', isExcluded: false },
                { code: '04', rate: '8.00', isExcluded: false },
              ],
            }),
          ]),
        }),
      );
    });

    it('sends taxes:[] for exempt products from linked invoice', async () => {
      invoiceRepo.findOne.mockResolvedValue({
        ...manualInvoiceWithTaxes,
        items: [{
          ...manualInvoiceWithTaxes.items[0],
          product: {
            ...manualInvoiceWithTaxes.items[0].product,
            taxes: [],
          },
        }],
      });
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });
      emissionRepo.save.mockImplementation((e: any) =>
        Promise.resolve({ ...e, id: 'em-exempt' }),
      );

      await service.create(dtoLinkWithTaxes);

      expect(factusGateway.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              price: 119000,
              taxes: [],
            }),
          ]),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Status lifecycle
  // -----------------------------------------------------------------------
  describe('status lifecycle', () => {
    it('defaults to pending before Factus call', async () => {
      factusGateway.createInvoice.mockResolvedValue({
        status: 'OK',
        message: 'Created',
        data: { number: 'SETP990001', cude: 'cude-abc', isValidated: true },
      });

      const captured: any[] = [];
      emissionRepo.save.mockImplementation((e: any) => {
        // Deep clone to avoid reference sharing (service mutates savedEmission)
        captured.push(JSON.parse(JSON.stringify(e)));
        return Promise.resolve(e);
      });

      await service.create({
        customer: { identification: '123', names: 'Test' },
        items: [{ codeReference: 'SKU', name: 'P', quantity: 1, price: 100 }],
      });

      // Single save after Factus success starts with emitted
      expect(captured[0].status).toBe('emitted');
    });

    it('throws on Factus error (no DB record saved)', async () => {
      factusGateway.createInvoice.mockRejectedValue(
        new Error('Gateway timeout'),
      );

      await expect(
        service.create({
          customer: { identification: '123', names: 'Test' },
          items: [{ codeReference: 'SKU', name: 'P', quantity: 1, price: 100 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(emissionRepo.save).not.toHaveBeenCalled();
    });
  });
});
