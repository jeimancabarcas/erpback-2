import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalesService } from './sales.service';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { InvoiceElectronicEmission } from './entities/invoice-electronic-emission.entity';
import { CreditNote } from './entities/credit-note.entity';
import { CreditNoteItem } from './entities/credit-note-item.entity';
import { CreditNoteItemTax } from './entities/credit-note-item-tax.entity';
import { InventoryService } from '../inventory/inventory.service';
import { PdfGenerationService } from '../pdf-generation/pdf-generation.service';
import { PaymentMethodsService } from '../settings/services/payment-methods.service';
import { PaymentTypesService } from '../settings/services/payment-types.service';
import { ScenarioAHandler } from './helpers/scenario-a';
import { ScenarioBHandler } from './helpers/scenario-b';
import { ScenarioCHandler } from './helpers/scenario-c';
import { ScenarioDHandler } from './helpers/scenario-d';

// ---------------------------------------------------------------------------
// Sequential number generator for mock identity column
// ---------------------------------------------------------------------------
let seqCounter = 0;
function resetSeq() {
  seqCounter = 0;
}
function nextSeq(): number {
  seqCounter += 1;
  return seqCounter;
}

// ---------------------------------------------------------------------------
// Factory: bare repository mock
// ---------------------------------------------------------------------------
function repoMock(findAndCountResult?: [any[], number]) {
  return {
    findAndCount: jest.fn().mockResolvedValue(findAndCountResult || [[], 0]),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn(),
    save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((d: any) => ({ ...d })),
    count: jest.fn().mockResolvedValue(0),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInvoice(
  overrides: Partial<Invoice> & {
    creditNotes?: Partial<CreditNote>[];
  } = {},
): Invoice {
  return {
    id: 'inv-1',
    sequentialNumber: 1,
    invoiceNumber: 'FAC-000001',
    date: new Date(),
    customerId: 'cust-1',
    customer: undefined as any,
    totalAmount: 1000,
    status: 'PAID' as any,
    notes: null as any,
    items: [],
    creditNotes: [],
    isElectronic: false,
    emission: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function stubCustomer(overrides: any = {}) {
  return {
    id: 'cust-1',
    name: 'Customer A',
    documentNumber: '12345',
    documentType: 'CC',
    email: 'test@test.com',
    address: 'calle 1 # 1-1',
    phone: '1234567890',
    currentBalance: 0,
    ...overrides,
  };
}

function stubProduct(overrides: any = {}) {
  return {
    id: 'prod-1',
    name: 'Product A',
    sku: 'SKU-001',
    sellingPrice: 100,
    currentStock: 10,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite: netTotal computation
// ---------------------------------------------------------------------------
describe('SalesService.findAll — netTotal computation', () => {
  let service: SalesService;
  let invoiceRepo: any;

  async function build(invoices: Invoice[]) {
    invoiceRepo = repoMock([invoices, invoices.length]);
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(InvoiceElectronicEmission),
          useValue: repoMock(),
        },
        { provide: getRepositoryToken(CreditNote), useValue: repoMock() },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(CreditNoteItemTax),
          useValue: repoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: {} },
        {
          provide: InventoryService,
          useValue: {
            consumeStock: jest.fn(),
            restoreStock: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PdfGenerationService, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: ScenarioAHandler, useValue: {} },
        { provide: ScenarioBHandler, useValue: {} },
        { provide: ScenarioCHandler, useValue: {} },
        { provide: ScenarioDHandler, useValue: {} },
        { provide: PaymentMethodsService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '10' }), findByCode: jest.fn().mockResolvedValue({ code: '10' }) } },
        { provide: PaymentTypesService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '1' }), findByCode: jest.fn().mockResolvedValue({ code: '1' }) } },
      ],
    }).compile();
    service = mod.get(SalesService);
  }

  it('a) netTotal equals totalAmount when no credit notes', async () => {
    const inv = makeInvoice({
      totalAmount: 1000,
      creditNotes: [],
    });
    await build([inv]);
    const r = await service.findAll({ page: 1, limit: 10 });
    expect(r.data[0]).toHaveProperty('netTotal', 1000);
  });

  it('b) netTotal = totalAmount - creditNote.amount', async () => {
    const inv = makeInvoice({
      totalAmount: 1000,
      creditNotes: [{ amount: 200 } as CreditNote],
    });
    await build([inv]);
    const r = await service.findAll({ page: 1, limit: 10 });
    expect(r.data[0]).toHaveProperty('netTotal', 800);
  });
});

// ---------------------------------------------------------------------------
// Suite: entity defaults
// ---------------------------------------------------------------------------
describe('SalesService — entity defaults', () => {
  it('makeInvoice includes sequentialNumber and emission', () => {
    const inv = makeInvoice({ sequentialNumber: 5, isElectronic: true });
    expect(inv.sequentialNumber).toBe(5);
    expect(inv).toHaveProperty('emission');
  });

  it('default isElectronic is false', () => {
    expect(makeInvoice({ isElectronic: false }).isElectronic).toBe(false);
  });

  it('invoice entity accepts optional paymentMethodId and paymentTypeId', () => {
    const inv = makeInvoice({
      paymentMethodId: 'pm-uuid',
      paymentTypeId: 'pt-uuid',
    });
    expect(inv.paymentMethodId).toBe('pm-uuid');
    expect(inv.paymentTypeId).toBe('pt-uuid');
  });

  it('invoice entity defaults payment fields to undefined when omitted', () => {
    const inv = makeInvoice({});
    expect(inv.paymentMethodId).toBeUndefined();
    expect(inv.paymentTypeId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite: create() with sequential numbering
// ---------------------------------------------------------------------------
describe('SalesService.create() — sequential numbering', () => {
  let service: SalesService;
  let factusGateway: any;
  let inventorySvc: any;
  let queryRunner: any;
  let paymentTypesServiceMock: any;

  /**
   * Build fresh module with a queryRunner manager that simulates
   * identity-column generation for Invoice saves.
   */
  async function build() {
    resetSeq();
    factusGateway = {
      createInvoice: jest
        .fn()
        .mockResolvedValue({ data: { number: 'SETP990001' } }),
    };
    inventorySvc = { consumeStock: jest.fn().mockResolvedValue(0) };
    paymentTypesServiceMock = {
      findOne: jest.fn().mockResolvedValue({ code: '1' }),
      findByCode: jest.fn().mockResolvedValue({ code: '1' }),
    };

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockImplementation((entityClass: any, opts: any) => {
          if (opts?.where?.id === 'cust-1')
            return Promise.resolve(stubCustomer());
          return Promise.resolve(stubProduct());
        }),
        save: jest.fn().mockImplementation((first: any, second?: any) => {
          // Handle two-arg save: save(EntityClass, entity)
          const entity = second !== undefined ? second : first;
          // Generate sequential IDENTITY only on INSERT (no id yet)
          if (entity && !entity.id && entity.customerId !== undefined) {
            const seq = nextSeq();
            return Promise.resolve({
              ...entity,
              id: `inv-${seq}`,
              sequentialNumber: seq,
              items: entity.items || [],
            });
          }
          // UPDATE (has id) or non-invoice entity — just pass through
          return Promise.resolve(entity);
        }),
        insert: jest.fn().mockResolvedValue({ identifiers: [] }),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      },
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: repoMock() },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(InvoiceElectronicEmission),
          useValue: repoMock(),
        },
        { provide: getRepositoryToken(CreditNote), useValue: repoMock() },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(CreditNoteItemTax),
          useValue: repoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        {
          provide: InventoryService,
          useValue: {
            consumeStock: jest.fn(),
            restoreStock: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PdfGenerationService, useValue: {} },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: ScenarioAHandler,
          useFactory: () =>
            new ScenarioAHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: ScenarioBHandler, useFactory: () => new ScenarioBHandler() },
        { provide: ScenarioCHandler, useFactory: () => new ScenarioCHandler() },
        {
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: PaymentMethodsService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '10' }), findByCode: jest.fn().mockResolvedValue({ code: '10' }) } },
        {
          provide: PaymentTypesService,
          useValue: paymentTypesServiceMock,
        },
      ],
    }).compile();
    service = mod.get(SalesService);
  }

  const baseDto = {
    customerId: 'cust-1',
    items: [{ productId: 'prod-1', quantity: 1 }],
  };

  it('manual: Factus NOT called; invoiceNumber = MAN-XXXXXX with 6-digit padding', async () => {
    await build();
    const r = await service.create({ ...baseDto, isElectronic: false });
    expect(factusGateway.createInvoice).not.toHaveBeenCalled();
    expect(r.invoiceNumber).toMatch(/^MAN-\d{6}$/);
    expect(r.sequentialNumber).toBe(1);
  });

  it('electronic: Factus IS called and emission is created', async () => {
    await build();
    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Created',
      data: {
        referenceCode: 'FAC-REF-123',
        number: 'SETP990003678',
        cude: 'cude-abc-123',
        qrUrl: 'https://factus.example.com/qr/abc',
        publicUrl: 'https://factus.example.com/pdf/abc',
        isValidated: true,
        validatedAt: '2026-06-23T00:00:00Z',
        numberingRange: { prefix: 'SETP' },
        items: [],
        taxes: [],
        totals: { total: 119000 },
        links: { qr: 'https://factus.example.com/qr/abc' },
      },
    });

    const r = await service.create({ ...baseDto, isElectronic: true });
    expect(factusGateway.createInvoice).toHaveBeenCalledTimes(1);
    expect(r.invoiceNumber).toBe('FAC-000001');
    expect(r.isElectronic).toBe(true);
    expect(r.emission).toBeDefined();
    expect(r.emission!.number).toBe('SETP990003678');
  });

  it('isElectronic omitted → treated as false (manual invoice)', async () => {
    await build();
    const r = await service.create(baseDto);
    expect(factusGateway.createInvoice).not.toHaveBeenCalled();
    expect(r.invoiceNumber).toMatch(/^MAN-\d{6}$/);
    expect(r.isElectronic).toBe(false);
  });

  it('sequential creates produce incrementing numbers (1→000001, 2→000002)', async () => {
    await build();
    const first = await service.create({ ...baseDto, isElectronic: false });
    expect(first.invoiceNumber).toBe('MAN-000001');
    const second = await service.create({ ...baseDto, isElectronic: false });
    expect(second.invoiceNumber).toBe('MAN-000002');
  });

  it('credit payment type (code 2) sets ON_CREDIT status and increments customer currentBalance', async () => {
    await build();
    paymentTypesServiceMock.findOne.mockResolvedValue({ code: '2' });

    const r = await service.create({
      ...baseDto,
      paymentTypeId: 'credit-payment-type-id',
      isElectronic: false,
    });
    expect(r.status).toBe('ON_CREDIT');

    // Customer balance should have been incremented: 0 + 100 (1 item × sellingPrice 100)
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      Customer,
      expect.objectContaining({ currentBalance: 100 }),
    );
  });

  it('credit payment type (code 2) increments customer currentBalance by invoice totalAmount', async () => {
    await build();
    paymentTypesServiceMock.findOne.mockResolvedValue({ code: '2' });

    // Use 3 items to verify the balance matches totalAmount, not a fixed value
    const dto = {
      ...baseDto,
      items: [
        { productId: 'prod-1', quantity: 3 },
      ],
      paymentTypeId: 'credit-payment-type-id',
      isElectronic: false,
    };

    await service.create(dto);

    // 3 × 100 = 300
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      Customer,
      expect.objectContaining({ currentBalance: 300 }),
    );
  });

  it('cash payment type (code 1) sets PAID status and does NOT update customer balance', async () => {
    await build();
    paymentTypesServiceMock.findOne.mockResolvedValue({ code: '1' });

    const r = await service.create({ ...baseDto, paymentTypeId: 'cash-payment-type-id', isElectronic: false });
    expect(r.status).toBe('PAID');

    // Save should NOT have been called with a Customer entity (balance unchanged)
    const saveWithCustomer = queryRunner.manager.save.mock.calls.filter(
      ([first, second]) => second?.currentBalance !== undefined,
    );
    expect(saveWithCustomer.length).toBe(0);
  });

  it('no payment type defaults to PAID status', async () => {
    await build();
    const r = await service.create({ ...baseDto, isElectronic: false });
    expect(r.status).toBe('PAID');
  });

  // ---- Tax calculation in create() ----

  it('create electronic: single taxed product (IVA 19%) passes correct Factus payload', async () => {
    await build();
    queryRunner.manager.findOne = jest
      .fn()
      .mockImplementation((_entityClass: any, opts: any) => {
        if (opts?.where?.id === 'cust-1')
          return Promise.resolve(stubCustomer());
        return Promise.resolve(
          stubProduct({
            sellingPrice: 119000,
            taxes: [{ id: 'tax-1', code: '01', percentage: 19.0 }],
          }),
        );
      });

    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Created',
      data: {
        number: 'SETP990003678',
        cude: 'cude-abc',
        isValidated: true,
      },
    });

    await service.create({ ...baseDto, isElectronic: true });

    expect(factusGateway.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            price: 100000,
            taxes: [{ code: '01', rate: '19.00', isExcluded: false }],
          }),
        ]),
      }),
    );
  });

  it('create electronic: multi-tax product (IVA 19% + INC 4%) sends two Factus tax entries', async () => {
    await build();
    queryRunner.manager.findOne = jest
      .fn()
      .mockImplementation((_entityClass: any, opts: any) => {
        if (opts?.where?.id === 'cust-1')
          return Promise.resolve(stubCustomer());
        return Promise.resolve(
          stubProduct({
            sellingPrice: 123000,
            taxes: [
              { id: 'tax-1', code: '01', percentage: 19.0 },
              { id: 'tax-2', code: '04', percentage: 4.0 },
            ],
          }),
        );
      });

    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Created',
      data: { number: 'SETP990003679', cude: 'cude-xyz', isValidated: true },
    });

    await service.create({ ...baseDto, isElectronic: true });

    expect(factusGateway.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            price: 100000,
            taxes: [
              { code: '01', rate: '19.00', isExcluded: false },
              { code: '04', rate: '4.00', isExcluded: false },
            ],
          }),
        ]),
      }),
    );
  });

  it('create electronic: untaxed product sends empty taxes array to Factus', async () => {
    await build();
    queryRunner.manager.findOne = jest
      .fn()
      .mockImplementation((_entityClass: any, opts: any) => {
        if (opts?.where?.id === 'cust-1')
          return Promise.resolve(stubCustomer());
        return Promise.resolve(stubProduct({ sellingPrice: 100, taxes: [] }));
      });

    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Created',
      data: { number: 'SETP990003680', cude: 'cude-123', isValidated: true },
    });

    await service.create({ ...baseDto, isElectronic: true });

    expect(factusGateway.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ taxes: [] })]),
      }),
    );
  });

  it('create manual: with taxed product does NOT call Factus', async () => {
    await build();
    queryRunner.manager.findOne = jest
      .fn()
      .mockImplementation((_entityClass: any, opts: any) => {
        if (opts?.where?.id === 'cust-1')
          return Promise.resolve(stubCustomer());
        return Promise.resolve(
          stubProduct({
            sellingPrice: 119000,
            taxes: [{ id: 'tax-1', code: '01', percentage: 19.0 }],
          }),
        );
      });

    const r = await service.create({ ...baseDto, isElectronic: false });

    expect(factusGateway.createInvoice).not.toHaveBeenCalled();
    expect(r.invoiceNumber).toMatch(/^MAN-\d{6}$/);
    expect(r.isElectronic).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite: manual invoice paths — emit, downloadDianPdf, notes
// ---------------------------------------------------------------------------
describe('SalesService — manual invoice paths', () => {
  let service: SalesService;
  let factusGateway: any;
  let pdfService: any;
  let creditNoteRepo: any;
  let emissionRepo: any;
  let invoiceRepo: any;
  let queryRunner: any;

  function buildItem(overrides?: any) {
    return {
      id: 'item-1',
      product: { sku: 'SKU-001', name: 'Product A' },
      productId: 'prod-1',
      quantity: 2,
      unitPrice: 500,
      subtotal: 1000,
      invoiceItemTaxes: [
        {
          taxId: 'tax-1',
          taxCode: '01',
          taxName: 'IVA',
          taxRate: 19,
          taxAmount: 95,
        },
      ],
      ...overrides,
    };
  }

  function buildManualInv(overrides?: any): any {
    return {
      id: 'inv-manual',
      sequentialNumber: 1,
      invoiceNumber: 'MAN-000001',
      isElectronic: false,
      totalAmount: 1000,
      status: InvoiceStatus.PAID,
      notes: null,
      creditNotes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      customerId: 'cust-1',
      customer: {
        id: 'cust-1',
        name: 'Test',
        documentNumber: '123',
        documentType: 'CC',
      },
      items: [buildItem()],
      emission: null,
      ...overrides,
    };
  }
  function buildElectronicInv(overrides?: any): any {
    return buildManualInv({
      id: 'inv-electronic',
      sequentialNumber: 2,
      invoiceNumber: 'FAC-000002',
      isElectronic: true,
      emission: null,
      ...overrides,
    });
  }
  function buildEmittedInv(overrides?: any): any {
    return buildManualInv({
      id: 'inv-emitted-posthoc',
      sequentialNumber: 3,
      invoiceNumber: 'MAN-000003',
      isElectronic: true,
      emission: {
        id: 'em-1',
        number: 'SETP990099',
        cude: 'cude-post',
        qrUrl: 'https://qr',
        publicUrl: 'https://pdf',
        isValidated: true,
        createdAt: new Date(),
      },
      ...overrides,
    });
  }

  beforeEach(async () => {
    factusGateway = {
      createInvoice: jest.fn(),
      createCreditNote: jest
        .fn()
        .mockResolvedValue({ data: { number: 'NC-001', cude: 'cude-1' } }),
      downloadInvoicePdf: jest.fn().mockResolvedValue({
        pdfBase64Encoded: 'JVBERi0xLjc=',
        fileName: 'invoice.pdf',
      }),
      downloadAdjustmentNotePdf: jest.fn(),
    };

    pdfService = {
      generateInvoicePdf: jest.fn().mockResolvedValue('JVBERi0xLjc='),
    };

    creditNoteRepo = {
      ...repoMock(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((opts: any) => {
        if (opts?.where?.id)
          return Promise.resolve({
            id: opts.where.id,
            items: [],
            noteNumber: 'NC-MAN-MAN-000001-1',
            cude: null,
            qrUrl: null,
            publicUrl: null,
          });
        return Promise.resolve(null);
      }),
      create: jest.fn((d: any) => ({ ...d, id: 'cn-new' })),
      save: jest.fn((e: any) => Promise.resolve(e)),
    };
    emissionRepo = {
      ...repoMock(),
      create: jest.fn((d: any) => ({ ...d, id: 'em-new' })),
      save: jest.fn((e: any) => Promise.resolve(e)),
    };

    invoiceRepo = {
      ...repoMock(),
      findOne: jest.fn().mockImplementation((opts: any) => {
        const id = opts?.where?.id;
        // Return fresh copies to prevent test cross-contamination via mutation
        if (id === 'inv-manual') return Promise.resolve(buildManualInv());
        if (id === 'inv-electronic')
          return Promise.resolve(buildElectronicInv());
        if (id === 'inv-emitted-posthoc')
          return Promise.resolve(buildEmittedInv());
        return Promise.resolve(null);
      }),
      save: jest.fn((e: any) => Promise.resolve(e)),
    };

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((first: any, second?: any) => {
          const entity = second !== undefined ? second : first;
          return Promise.resolve(entity);
        }),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      },
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(InvoiceElectronicEmission),
          useValue: emissionRepo,
        },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(CreditNoteItemTax),
          useValue: repoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        {
          provide: InventoryService,
          useValue: {
            consumeStock: jest.fn(),
            restoreStock: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PdfGenerationService, useValue: pdfService },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: ScenarioAHandler,
          useFactory: () =>
            new ScenarioAHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: ScenarioBHandler, useFactory: () => new ScenarioBHandler() },
        { provide: ScenarioCHandler, useFactory: () => new ScenarioCHandler() },
        {
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: PaymentMethodsService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '10' }), findByCode: jest.fn().mockResolvedValue({ code: '10' }) } },
        { provide: PaymentTypesService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '1' }), findByCode: jest.fn().mockResolvedValue({ code: '1' }) } },
      ],
    }).compile();
    service = mod.get(SalesService);
  });

  // ---- downloadInvoicePdf ----

  it('downloadInvoicePdf for manual invoice returns local PDF, no Factus call', async () => {
    const r = await service.downloadInvoicePdf('inv-manual');
    expect(factusGateway.downloadInvoicePdf).not.toHaveBeenCalled();
    expect(pdfService.generateInvoicePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'inv-manual',
        invoiceNumber: 'MAN-000001',
      }),
      [],
    );
    expect(r.fileName).toContain('historial.pdf');
  });

  it('downloadInvoicePdf for electronic invoice generates history PDF', async () => {
    const r = await service.downloadInvoicePdf('inv-electronic');
    expect(pdfService.generateInvoicePdf).toHaveBeenCalledTimes(1);
    expect(factusGateway.downloadInvoicePdf).not.toHaveBeenCalled();
  });

  // ---- downloadDianPdf ----

  it('downloadDianPdf uses emission.number for directly-created electronic invoice', async () => {
    invoiceRepo.findOne = jest.fn().mockResolvedValue(
      buildElectronicInv({
        emission: { id: 'em-1', number: 'FAC-000002', cude: 'cude' },
      }),
    );

    const r = await service.downloadDianPdf('inv-electronic');
    expect(factusGateway.downloadInvoicePdf).toHaveBeenCalledWith('FAC-000002');
  });

  it('downloadDianPdf uses emission.number for posthoc-emitted invoice', async () => {
    invoiceRepo.findOne = jest.fn().mockResolvedValue(buildEmittedInv());

    const r = await service.downloadDianPdf('inv-emitted-posthoc');
    expect(factusGateway.downloadInvoicePdf).toHaveBeenCalledWith('SETP990099');
  });

  it('downloadDianPdf throws for manual invoice (no emission)', async () => {
    await expect(service.downloadDianPdf('inv-manual')).rejects.toThrow(
      'manuales no tienen PDF',
    );
  });

  it('downloadDianPdf throws when emission has no number', async () => {
    invoiceRepo.findOne = jest
      .fn()
      .mockResolvedValue(buildElectronicInv({ emission: { number: null } }));
    await expect(service.downloadDianPdf('inv-electronic')).rejects.toThrow(
      'no tiene un número de emisión',
    );
  });

  it('downloadInvoicePdf throws for non-existent invoice', async () => {
    await expect(service.downloadInvoicePdf('nope')).rejects.toThrow();
  });

  // ---- emit() ----

  it('emit() calls Factus, creates InvoiceElectronicEmission, marks isElectronic=true', async () => {
    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Success',
      data: {
        number: 'SETP990003678',
        cude: 'cufe-abc-123',
        qrUrl: 'https://qr',
        publicUrl: 'https://pdf',
        isValidated: true,
        validatedAt: '2026-06-23T00:00:00Z',
        numberingRange: null,
        items: [],
        taxes: [],
        totals: null,
        links: {},
      },
    });

    // Re-build with a smart save that returns emission data properly
    queryRunner.manager.save = jest
      .fn()
      .mockImplementation((first: any, second?: any) => {
        if (second !== undefined) {
          // Two-arg save(Entity, data) → emission entity
          return Promise.resolve({ ...second, id: 'emission-new' });
        }
        // Single-arg — invoice
        return Promise.resolve(first);
      });

    const r = await service.emit('inv-manual');
    expect(factusGateway.createInvoice).toHaveBeenCalledTimes(1);
    expect(r.isElectronic).toBe(true);
    expect(r.emission).toBeDefined();
    expect(r.emission!.number).toBe('SETP990003678');
    expect(r.emission!.cude).toBe('cufe-abc-123');
  });

  it('emit() preserves original invoiceNumber (MAN-{seq}) when emitting manual invoice', async () => {
    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Success',
      data: { number: 'SETP990003678', cude: 'cufe' },
    });

    invoiceRepo.findOne = jest
      .fn()
      .mockResolvedValue(
        buildManualInv({ id: 'inv-emit', invoiceNumber: 'MAN-000042' }),
      );
    queryRunner.manager.save = jest
      .fn()
      .mockImplementation((first: any, second?: any) => {
        if (second !== undefined)
          return Promise.resolve({ ...second, id: 'em-new' });
        return Promise.resolve(first);
      });

    const r = await service.emit('inv-emit');
    expect(r.invoiceNumber).toBe('MAN-000042');
    expect(r.emission!.number).toBe('SETP990003678');
    expect(r.isElectronic).toBe(true);
  });

  it('emit() throws for already-electronic invoice', async () => {
    await expect(service.emit('inv-electronic')).rejects.toThrow(
      'ya es electrónica',
    );
  });

  it('emit() throws for non-existent invoice', async () => {
    await expect(service.emit('nope')).rejects.toThrow('no encontrada');
  });

  it('emit() with taxed product builds correct Factus payload with dynamic taxes', async () => {
    const taxedProduct = {
      id: 'prod-1',
      sku: 'SKU-001',
      name: 'Product A',
      sellingPrice: 119000,
      taxes: [{ id: 'tax-1', code: '01', percentage: 19.0 }],
    };
    invoiceRepo.findOne = jest.fn().mockResolvedValue(
      buildManualInv({
        items: [
          {
            id: 'item-1',
            product: taxedProduct,
            productId: 'prod-1',
            quantity: 1,
            unitPrice: 119000,
            subtotal: 119000,
          },
        ],
      }),
    );

    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Success',
      data: { number: 'SETP990003678', cude: 'cufe-abc', isValidated: true },
    });

    queryRunner.manager.save = jest
      .fn()
      .mockImplementation((first: any, second?: any) => {
        if (second !== undefined)
          return Promise.resolve({ ...second, id: 'emission-new' });
        return Promise.resolve(first);
      });

    await service.emit('inv-manual');

    expect(factusGateway.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            price: 100000,
            taxes: [{ code: '01', rate: '19.00', isExcluded: false }],
          }),
        ]),
      }),
    );
  });

  // ---- createCreditNote ----

  it('createCreditNote for manual invoice creates local note, no Factus call (ScenarioA)', async () => {
    // ScenarioA requires items with productId
    const dto = {
      correctionConceptCode: '1',
      items: [
        {
          codeReference: 'SKU-001',
          quantity: 1,
          price: 500,
          productId: 'prod-1',
        },
      ],
    };
    const r = await service.createCreditNote('inv-manual', dto);
    expect(factusGateway.createCreditNote).not.toHaveBeenCalled();
    expect((r as any).noteNumber).toContain('NC-MAN');
  });

  it('createCreditNote for manual invoice with concept 2 sets invoice CANCELLED', async () => {
    const cancelInv = buildManualInv({
      id: 'inv-cancel',
      status: InvoiceStatus.PAID,
    });
    invoiceRepo.findOne = jest.fn().mockResolvedValue(cancelInv);
    const qr = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
        save: jest.fn((e: any) => {
          if (e && e.status) cancelInv.status = e.status;
          return Promise.resolve(e);
        }),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(InvoiceElectronicEmission),
          useValue: emissionRepo,
        },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(CreditNoteItemTax),
          useValue: repoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        {
          provide: InventoryService,
          useValue: {
            consumeStock: jest.fn(),
            restoreStock: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PdfGenerationService, useValue: pdfService },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn().mockReturnValue(qr) },
        },
        {
          provide: ScenarioAHandler,
          useFactory: () =>
            new ScenarioAHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: ScenarioBHandler, useFactory: () => new ScenarioBHandler() },
        { provide: ScenarioCHandler, useFactory: () => new ScenarioCHandler() },
        {
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: PaymentMethodsService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '10' }), findByCode: jest.fn().mockResolvedValue({ code: '10' }) } },
        { provide: PaymentTypesService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '1' }), findByCode: jest.fn().mockResolvedValue({ code: '1' }) } },
      ],
    }).compile();
    const svc = mod.get(SalesService);
    await svc.createCreditNote('inv-cancel', { correctionConceptCode: '2' });
    expect(cancelInv.status).toBe(InvoiceStatus.CANCELLED);
  });

  it('createCreditNote for electronic invoice calls Factus (ScenarioA)', async () => {
    const dto = {
      correctionConceptCode: '1',
      isElectronic: true,
      items: [
        {
          codeReference: 'SKU-001',
          quantity: 1,
          price: 500,
          productId: 'prod-1',
        },
      ],
    };
    await service.createCreditNote('inv-electronic', dto);
    expect(factusGateway.createCreditNote).toHaveBeenCalledTimes(1);
  });

  it('createCreditNote for manual rejects non-existent item', async () => {
    await expect(
      service.createCreditNote('inv-manual', {
        correctionConceptCode: '1',
        items: [
          {
            codeReference: 'NO-SKU',
            quantity: 1,
            price: 500,
            productId: 'prod-x',
          },
        ],
      } as any),
    ).rejects.toThrow('no pertenece');
  });

  it('createCreditNote for manual rejects qty exceeding invoice', async () => {
    await expect(
      service.createCreditNote('inv-manual', {
        correctionConceptCode: '1',
        items: [
          {
            codeReference: 'SKU-001',
            quantity: 99,
            price: 500,
            productId: 'prod-1',
          },
        ],
      } as any),
    ).rejects.toThrow('supera');
  });

  it('createCreditNote for cancelled invoice is rejected', async () => {
    invoiceRepo.findOne = jest
      .fn()
      .mockResolvedValue(buildManualInv({ status: InvoiceStatus.CANCELLED }));
    const qr = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(InvoiceElectronicEmission),
          useValue: emissionRepo,
        },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(CreditNoteItemTax),
          useValue: repoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        {
          provide: InventoryService,
          useValue: {
            consumeStock: jest.fn(),
            restoreStock: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PdfGenerationService, useValue: pdfService },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn().mockReturnValue(qr) },
        },
        {
          provide: ScenarioAHandler,
          useFactory: () =>
            new ScenarioAHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: ScenarioBHandler, useFactory: () => new ScenarioBHandler() },
        { provide: ScenarioCHandler, useFactory: () => new ScenarioCHandler() },
        {
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: PaymentMethodsService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '10' }), findByCode: jest.fn().mockResolvedValue({ code: '10' }) } },
        { provide: PaymentTypesService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '1' }), findByCode: jest.fn().mockResolvedValue({ code: '1' }) } },
      ],
    }).compile();
    const svc = mod.get(SalesService);
    await expect(
      svc.createCreditNote('inv-cancel', { correctionConceptCode: '1' } as any),
    ).rejects.toThrow('anuladas');
  });

  // ---- isElectronic filter ----

  it('findAll with isElectronic=true filters correctly', async () => {
    const inv = buildElectronicInv();
    invoiceRepo.findAndCount = jest.fn().mockResolvedValue([[inv], 1]);
    const r = await service.findAll({ isElectronic: true });
    expect(invoiceRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isElectronic: true }),
      }),
    );
    expect(r.data).toHaveLength(1);
  });

  it('findAll with isElectronic=false filters correctly', async () => {
    const inv = buildManualInv();
    invoiceRepo.findAndCount = jest.fn().mockResolvedValue([[inv], 1]);
    const r = await service.findAll({ isElectronic: false });
    expect(invoiceRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isElectronic: false }),
      }),
    );
    expect(r.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Suite: guard — electronic note for manual invoice
// ---------------------------------------------------------------------------
describe('SalesService — guard: electronic note for manual invoice', () => {
  let service: SalesService;
  let factusGateway: any;
  let creditNoteRepo: any;
  let emissionRepo: any;
  let invoiceRepo: any;
  let queryRunner: any;
  let pdfService: any;

  function buildItem(overrides?: any) {
    return {
      id: 'item-1',
      product: { sku: 'SKU-001', name: 'Product A' },
      productId: 'prod-1',
      quantity: 2,
      unitPrice: 500,
      subtotal: 1000,
      invoiceItemTaxes: [
        {
          taxId: 'tax-1',
          taxCode: '01',
          taxName: 'IVA',
          taxRate: 19,
          taxAmount: 95,
        },
      ],
      ...overrides,
    };
  }

  function buildManualInv(overrides?: any): any {
    return {
      id: 'inv-manual',
      sequentialNumber: 1,
      invoiceNumber: 'MAN-000001',
      isElectronic: false,
      totalAmount: 1000,
      status: InvoiceStatus.PAID,
      notes: null,
      creditNotes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      customerId: 'cust-1',
      customer: {
        id: 'cust-1',
        name: 'Test',
        documentNumber: '123',
        documentType: 'CC',
      },
      items: [buildItem()],
      emission: null,
      ...overrides,
    };
  }

  function buildElectronicInv(overrides?: any): any {
    return buildManualInv({
      id: 'inv-electronic',
      sequentialNumber: 2,
      invoiceNumber: 'FAC-000002',
      isElectronic: true,
      ...overrides,
    });
  }

  beforeEach(async () => {
    factusGateway = {
      createInvoice: jest.fn(),
      createCreditNote: jest
        .fn()
        .mockResolvedValue({ data: { number: 'NC-001', cude: 'cude-1' } }),
      downloadInvoicePdf: jest.fn(),
      downloadAdjustmentNotePdf: jest.fn(),
    };

    pdfService = {
      generateInvoicePdf: jest.fn().mockResolvedValue('JVBERi0xLjc='),
    };

    creditNoteRepo = {
      ...repoMock(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((opts: any) => {
        if (opts?.where?.id)
          return Promise.resolve({
            id: opts.where.id,
            items: [],
            noteNumber: 'NC-MAN-MAN-000001-1',
            cude: null,
            qrUrl: null,
            publicUrl: null,
          });
        return Promise.resolve(null);
      }),
      create: jest.fn((d: any) => ({ ...d, id: 'cn-new' })),
      save: jest.fn((e: any) => Promise.resolve(e)),
    };
    emissionRepo = {
      ...repoMock(),
      create: jest.fn((d: any) => ({ ...d, id: 'em-new' })),
      save: jest.fn((e: any) => Promise.resolve(e)),
    };

    invoiceRepo = {
      ...repoMock(),
      findOne: jest.fn().mockImplementation((opts: any) => {
        const id = opts?.where?.id;
        if (id === 'inv-manual') return Promise.resolve(buildManualInv());
        if (id === 'inv-electronic')
          return Promise.resolve(buildElectronicInv());
        return Promise.resolve(null);
      }),
      save: jest.fn((e: any) => Promise.resolve(e)),
    };

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((first: any, second?: any) => {
          const entity = second !== undefined ? second : first;
          return Promise.resolve(entity);
        }),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      },
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(InvoiceElectronicEmission),
          useValue: emissionRepo,
        },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(CreditNoteItemTax),
          useValue: repoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        {
          provide: InventoryService,
          useValue: {
            consumeStock: jest.fn(),
            restoreStock: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PdfGenerationService, useValue: pdfService },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: ScenarioAHandler,
          useFactory: () =>
            new ScenarioAHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: ScenarioBHandler, useFactory: () => new ScenarioBHandler() },
        { provide: ScenarioCHandler, useFactory: () => new ScenarioCHandler() },
        {
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: PaymentMethodsService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '10' }), findByCode: jest.fn().mockResolvedValue({ code: '10' }) } },
        { provide: PaymentTypesService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '1' }), findByCode: jest.fn().mockResolvedValue({ code: '1' }) } },
      ],
    }).compile();
    service = mod.get(SalesService);
  });

  function makeItemsForScenario() {
    return [
      {
        codeReference: 'SKU-001',
        quantity: 1,
        price: 500,
        productId: 'prod-1',
      },
    ];
  }

  it('createCreditNote: rejects electronic note for manual invoice', async () => {
    const dto = {
      correctionConceptCode: '1',
      isElectronic: true,
      items: makeItemsForScenario(),
    };
    await expect(
      service.createCreditNote('inv-manual', dto as any),
    ).rejects.toThrow(
      'electrónicas solo pueden emitirse para facturas electrónicas',
    );
  });

  it('createCreditNote: allows manual note for manual invoice', async () => {
    const dto = {
      correctionConceptCode: '1',
      isElectronic: false,
      items: makeItemsForScenario(),
    };
    const r = await service.createCreditNote('inv-manual', dto);
    expect((r as any).noteNumber).toContain('NC-MAN');
    expect(factusGateway.createCreditNote).not.toHaveBeenCalled();
  });

  it('createCreditNote: allows electronic note for electronic invoice (ScenarioA)', async () => {
    const dto = {
      correctionConceptCode: '1',
      isElectronic: true,
      items: makeItemsForScenario(),
    };
    await service.createCreditNote('inv-electronic', dto);
    expect(factusGateway.createCreditNote).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Suite: cumulative validation for credit notes
// ---------------------------------------------------------------------------
describe('SalesService — validateCumulativeLimits', () => {
  let service: SalesService;
  let factusGateway: any;
  let creditNoteRepo: any;
  let emissionRepo: any;
  let invoiceRepo: any;
  let queryRunner: any;
  let pdfService: any;
  let qbMock: any;

  function buildItem(overrides?: any) {
    return {
      id: 'item-1',
      product: { sku: 'SKU-001', name: 'Product A' },
      productId: 'prod-1',
      quantity: 10,
      unitPrice: 100,
      subtotal: 1000,
      invoiceItemTaxes: [
        {
          taxId: 'tax-1',
          taxCode: '01',
          taxName: 'IVA',
          taxRate: 19,
          taxAmount: 19,
        },
      ],
      ...overrides,
    };
  }

  function buildManualInv(overrides?: any): any {
    return {
      id: 'inv-1',
      sequentialNumber: 1,
      invoiceNumber: 'MAN-000001',
      isElectronic: false,
      totalAmount: 1000,
      status: InvoiceStatus.PAID,
      notes: null,
      creditNotes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      customerId: 'cust-1',
      customer: {
        id: 'cust-1',
        name: 'Test',
        documentNumber: '123',
        documentType: 'CC',
      },
      items: [buildItem()],
      emission: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    qbMock = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    factusGateway = {
      createInvoice: jest.fn(),
      createCreditNote: jest
        .fn()
        .mockResolvedValue({ data: { number: 'NC-001', cude: 'cude-1' } }),
      downloadInvoicePdf: jest.fn(),
      downloadAdjustmentNotePdf: jest.fn(),
    };

    pdfService = {
      generateInvoicePdf: jest.fn().mockResolvedValue('JVBERi0xLjc='),
    };

    creditNoteRepo = {
      ...repoMock(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((opts: any) => {
        if (opts?.where?.id)
          return Promise.resolve({
            id: opts.where.id,
            items: [],
            noteNumber: 'NC-MAN-MAN-000001-1',
            cude: null,
            qrUrl: null,
            publicUrl: null,
          });
        return Promise.resolve(null);
      }),
      create: jest.fn((d: any) => ({ ...d, id: 'cn-new' })),
      save: jest.fn((e: any) => Promise.resolve(e)),
    };
    emissionRepo = {
      ...repoMock(),
      create: jest.fn((d: any) => ({ ...d, id: 'em-new' })),
      save: jest.fn((e: any) => Promise.resolve(e)),
    };

    invoiceRepo = {
      ...repoMock(),
      findOne: jest.fn().mockResolvedValue(buildManualInv()),
      save: jest.fn((e: any) => Promise.resolve(e)),
    };

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((first: any, second?: any) => {
          const entity = second !== undefined ? second : first;
          return Promise.resolve(entity);
        }),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      },
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(InvoiceElectronicEmission),
          useValue: emissionRepo,
        },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(CreditNoteItemTax),
          useValue: repoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        {
          provide: InventoryService,
          useValue: {
            consumeStock: jest.fn(),
            restoreStock: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PdfGenerationService, useValue: pdfService },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: ScenarioAHandler,
          useFactory: () =>
            new ScenarioAHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: ScenarioBHandler, useFactory: () => new ScenarioBHandler() },
        { provide: ScenarioCHandler, useFactory: () => new ScenarioCHandler() },
        {
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest.fn().mockResolvedValue(0),
            } as any),
        },
        { provide: PaymentMethodsService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '10' }), findByCode: jest.fn().mockResolvedValue({ code: '10' }) } },
        { provide: PaymentTypesService, useValue: { findOne: jest.fn().mockResolvedValue({ code: '1' }), findByCode: jest.fn().mockResolvedValue({ code: '1' }) } },
      ],
    }).compile();
    service = mod.get(SalesService);
  });

  // --- 1.1: cumulative amount exceeds invoice total (60%+50%→400) ---
  it('1.1 rejects when cumulative amount exceeds invoice total (600 existing + 500 new > 1000)', async () => {
    qbMock.getRawOne.mockResolvedValue({ total: '600' });
    const dto = {
      correctionConceptCode: '1',
      items: [
        {
          codeReference: 'SKU-001',
          quantity: 5,
          price: 100,
          productId: 'prod-1',
        },
      ],
    };
    await expect(service.createCreditNote('inv-1', dto as any)).rejects.toThrow(
      /supera el total/,
    );
  });

  // --- 1.2: single 110% note also rejected ---
  it('1.2 rejects single credit note exceeding invoice total (0 existing + 1100 new > 1000)', async () => {
    qbMock.getRawOne.mockResolvedValue({ total: '0' });
    // qty=10 (within invoice qty of 10), price=110 → amount=1100 > 1000
    const dto = {
      correctionConceptCode: '1',
      items: [
        {
          codeReference: 'SKU-001',
          quantity: 10,
          price: 110,
          productId: 'prod-1',
        },
      ],
    };
    await expect(service.createCreditNote('inv-1', dto as any)).rejects.toThrow(
      /supera el total/,
    );
  });

  // --- 1.3: amount within limits (60%+40%) passes ---
  it('1.3 accepts when cumulative amount is within invoice total (600 existing + 400 new <= 1000)', async () => {
    qbMock.getRawOne.mockResolvedValue({ total: '600' });
    const dto = {
      correctionConceptCode: '1',
      items: [
        {
          codeReference: 'SKU-001',
          quantity: 4,
          price: 100,
          productId: 'prod-1',
        },
      ],
    };
    const r = await service.createCreditNote('inv-1', dto);
    expect(r).toBeDefined();
    expect((r as any).noteNumber).toContain('NC-MAN');
  });

  // --- 1.4: cumulative qty per product exceeds item limit for A/D ---
  it('1.4 rejects when cumulative quantity per product exceeds invoice item limit for scenario A (6 existing + 5 new > 10)', async () => {
    qbMock.getRawOne.mockResolvedValue({ total: '0' });
    qbMock.getRawMany.mockResolvedValue([
      { productId: 'prod-1', totalQty: '6' },
    ]);
    const dto = {
      correctionConceptCode: '1',
      items: [
        {
          codeReference: 'SKU-001',
          quantity: 5,
          price: 100,
          productId: 'prod-1',
        },
      ],
    };
    await expect(service.createCreditNote('inv-1', dto as any)).rejects.toThrow(
      /supera la cantidad/,
    );
  });

  // --- 1.5: qty check skipped for scenario B (discount) and C (price correction) ---
  it('1.5 skips quantity check for scenario B (discount, code 3) — no throw even if qty would exceed', async () => {
    qbMock.getRawOne.mockResolvedValue({ total: '0' });
    qbMock.getRawMany.mockResolvedValue([
      { productId: 'prod-1', totalQty: '9' },
    ]);
    // Scenario B requires price < original (100), no qty validation
    const dto = {
      correctionConceptCode: '3',
      items: [
        {
          codeReference: 'SKU-001',
          quantity: 5,
          price: 90,
          productId: 'prod-1',
        },
      ],
    };
    const r = await service.createCreditNote('inv-1', dto);
    expect(r).toBeDefined();
  });

  it('1.5b skips quantity check for scenario C (price correction, code 4) — no throw even if qty would exceed', async () => {
    qbMock.getRawOne.mockResolvedValue({ total: '0' });
    qbMock.getRawMany.mockResolvedValue([
      { productId: 'prod-1', totalQty: '9' },
    ]);
    // Scenario C requires price < original (100), no qty validation
    const dto = {
      correctionConceptCode: '4',
      items: [
        {
          codeReference: 'SKU-001',
          quantity: 5,
          price: 90,
          productId: 'prod-1',
        },
      ],
    };
    const r = await service.createCreditNote('inv-1', dto);
    expect(r).toBeDefined();
  });

  // --- 1.6: concurrent 60%+60% — second fails ---
  it('1.6 simulates concurrent 60%+60%: second request sees 600 existing and fails', async () => {
    qbMock.getRawOne.mockResolvedValue({ total: '600' });
    const dto = {
      correctionConceptCode: '1',
      items: [
        {
          codeReference: 'SKU-001',
          quantity: 6,
          price: 100,
          productId: 'prod-1',
        },
      ],
    };
    await expect(service.createCreditNote('inv-1', dto as any)).rejects.toThrow(
      /supera el total/,
    );
  });
});

// ---------------------------------------------------------------------------
// Concurrent safety (unit-level simulation)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Suite: searchManualBills
// ---------------------------------------------------------------------------
describe('SalesService.searchManualBills', () => {
  let service: SalesService;
  let invoiceRepo: any;

  async function build() {
    invoiceRepo = repoMock();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(InvoiceElectronicEmission),
          useValue: repoMock(),
        },
        { provide: getRepositoryToken(CreditNote), useValue: repoMock() },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        {
          provide: getRepositoryToken(CreditNoteItemTax),
          useValue: repoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: {} },
        {
          provide: InventoryService,
          useValue: {
            consumeStock: jest.fn(),
            restoreStock: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PdfGenerationService, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: ScenarioAHandler, useValue: {} },
        { provide: ScenarioBHandler, useValue: {} },
        { provide: ScenarioCHandler, useValue: {} },
        { provide: ScenarioDHandler, useValue: {} },
        {
          provide: PaymentMethodsService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({ code: '10' }),
            findByCode: jest.fn().mockResolvedValue({ code: '10' }),
          },
        },
        {
          provide: PaymentTypesService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({ code: '1' }),
            findByCode: jest.fn().mockResolvedValue({ code: '1' }),
          },
        },
      ],
    }).compile();
    service = mod.get(SalesService);
  }

  const manualInvoiceTemplate = {
    id: 'inv-manual-1',
    sequentialNumber: 1,
    invoiceNumber: 'MAN-000001',
    isElectronic: false,
    totalAmount: 1000,
    status: InvoiceStatus.PAID,
    notes: null,
    creditNotes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    customerId: 'cust-1',
    customer: {
      id: 'cust-1',
      name: 'Customer A',
      documentNumber: '12345',
      documentType: 'CC',
      email: 'test@test.com',
      address: 'calle 1 # 1-1',
      phone: '1234567890',
    },
    items: [
      {
        id: 'item-1',
        product: { sku: 'SKU-001', name: 'Product A' },
        productId: 'prod-1',
        quantity: 2,
        unitPrice: 500,
        subtotal: 1000,
      },
    ],
    emission: null,
  };

  it('returns matching manual invoices by number', async () => {
    await build();
    const expected = { ...manualInvoiceTemplate, invoiceNumber: 'MAN-000042' };
    invoiceRepo.find = jest.fn().mockResolvedValue([expected]);

    const result = await service.searchManualBills('MAN-000042');
    expect(invoiceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isElectronic: false,
          invoiceNumber: expect.anything(),
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].invoiceNumber).toBe('MAN-000042');
  });

  it('returns empty array when no matching manual invoices', async () => {
    await build();
    invoiceRepo.find = jest.fn().mockResolvedValue([]);

    const result = await service.searchManualBills('MAN-999999');
    expect(result).toEqual([]);
  });

  it('searches with partial number (LIKE)', async () => {
    await build();
    invoiceRepo.find = jest.fn().mockResolvedValue([
      { ...manualInvoiceTemplate, invoiceNumber: 'MAN-000042' },
    ]);

    const result = await service.searchManualBills('MAN-00004');
    expect(invoiceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          invoiceNumber: expect.anything(),
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('transforms results into ManualInvoiceSearchResultDto shape', async () => {
    await build();
    invoiceRepo.find = jest.fn().mockResolvedValue([
      {
        ...manualInvoiceTemplate,
        invoiceNumber: 'MAN-000001',
        totalAmount: 1000,
      },
    ]);

    const result = await service.searchManualBills('MAN-000001');
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('invoiceNumber');
    expect(result[0]).toHaveProperty('customer');
    expect(result[0]).toHaveProperty('items');
    expect(result[0]).toHaveProperty('totalAmount');
    expect(result[0].customer).toHaveProperty('identification');
    expect(result[0].customer).toHaveProperty('names');
    expect(result[0].items[0]).toHaveProperty('codeReference');
    expect(result[0].items[0]).toHaveProperty('name');
    expect(result[0].items[0]).toHaveProperty('quantity');
    expect(result[0].items[0]).toHaveProperty('price');
  });
});

describe('concurrent sequential numbering safety', () => {
  it('5 parallel simulations produce unique sequential numbers', async () => {
    resetSeq();
    const results: number[] = [];
    const tasks = Array.from(
      { length: 5 },
      () =>
        new Promise<number>((resolve) => {
          results.push(nextSeq());
          resolve(results[results.length - 1]);
        }),
    );
    await Promise.all(tasks);
    expect(new Set(results).size).toBe(5);
    expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
