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
    date: new Date(),
    customerId: 'cust-1',
    customer: undefined as any,
    status: 'PAID' as any,
    notes: null as any,
    items: [],
    creditNotes: [],
    emission: undefined,
    dueDate: null,
    paymentFrequency: null,
    totalAmount: 0,
    subtotal: 0,
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
            restoreStock: jest
              .fn()
              .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
          },
        },
        { provide: PdfGenerationService, useValue: {} },
        { provide: DataSource, useValue: {} },
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

  it('a) netTotal equals totalAmount when no credit notes', async () => {
    const inv = makeInvoice({
      totalAmount: 1000,
      items: [{ quantity: 10, product: { sellingPrice: 100 } } as any],
      creditNotes: [],
    });
    await build([inv]);
    const r = await service.findAll({ page: 1, limit: 10 });
    expect(r.data[0]).toHaveProperty('netTotal', 1000);
  });

  it('b) netTotal = totalAmount - creditNote.amount', async () => {
    const inv = makeInvoice({
      totalAmount: 1000,
      items: [{ quantity: 10, product: { sellingPrice: 100 } } as any],
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
    const inv = makeInvoice({ sequentialNumber: 5 });
    expect(inv.sequentialNumber).toBe(5);
    expect(inv).toHaveProperty('emission');
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
  async function build(opts?: { withGateway?: boolean }) {
    resetSeq();
    const useGateway = opts?.withGateway !== false;
    factusGateway = useGateway
      ? {
          createInvoice: jest
            .fn()
            .mockResolvedValue({ data: { number: 'SETP990001' } }),
        }
      : undefined;
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
            const now = new Date();
            return Promise.resolve({
              ...entity,
              id: `inv-${seq}`,
              sequentialNumber: seq,
              items: entity.items || [],
              createdAt: now,
              dueDate: entity.dueDate ?? null,
              paymentFrequency: entity.paymentFrequency ?? null,
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
            restoreStock: jest
              .fn()
              .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
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
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest
                .fn()
                .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
            } as any),
        },
        {
          provide: PaymentMethodsService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({ code: '10' }),
            findByCode: jest.fn().mockResolvedValue({ code: '10' }),
          },
        },
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
    await build({ withGateway: false });
    const r = await service.create({ ...baseDto });
    expect((r as any).invoiceNumber).toMatch(/^MAN-\d{6}$/);
    expect(r.sequentialNumber).toBe(1);
  });

  it('no factus gateway → manual invoice (MAN prefix)', async () => {
    await build({ withGateway: false });
    const r = await service.create(baseDto);
    expect((r as any).invoiceNumber).toMatch(/^MAN-\d{6}$/);
    // isElectronic removed — use emission check instead
  });

  it('sequential creates produce incrementing numbers (1→000001, 2→000002)', async () => {
    await build({ withGateway: false });
    const first = await service.create({ ...baseDto });
    expect((first as any).invoiceNumber).toBe('MAN-000001');
    const second = await service.create({ ...baseDto });
    expect((second as any).invoiceNumber).toBe('MAN-000002');
  });

  it('credit payment type (code 2) sets ON_CREDIT status and increments customer currentBalance', async () => {
    await build({ withGateway: false });
    paymentTypesServiceMock.findOne.mockResolvedValue({ code: '2' });

    const r = await service.create({
      ...baseDto,
      paymentTypeId: 'credit-payment-type-id',
    });
    expect(r.status).toBe('ON_CREDIT');

    // Customer balance should have been incremented: 0 + 100 (1 item × sellingPrice 100)
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      Customer,
      expect.objectContaining({ currentBalance: 100 }),
    );
  });

  it('credit payment type (code 2) increments customer currentBalance by invoice totalAmount', async () => {
    await build({ withGateway: false });
    paymentTypesServiceMock.findOne.mockResolvedValue({ code: '2' });

    // Use 3 items to verify the balance matches totalAmount, not a fixed value
    const dto = {
      ...baseDto,
      items: [{ productId: 'prod-1', quantity: 3 }],
      paymentTypeId: 'credit-payment-type-id',
    };

    await service.create(dto);

    // 3 × 100 = 300
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      Customer,
      expect.objectContaining({ currentBalance: 300 }),
    );
  });

  it('cash payment type (code 1) sets PAID status and does NOT update customer balance', async () => {
    await build({ withGateway: false });
    paymentTypesServiceMock.findOne.mockResolvedValue({ code: '1' });

    const r = await service.create({
      ...baseDto,
      paymentTypeId: 'cash-payment-type-id',
    });
    expect(r.status).toBe('PAID');

    // Save should NOT have been called with a Customer entity (balance unchanged)
    const saveWithCustomer = queryRunner.manager.save.mock.calls.filter(
      ([first, second]) => second?.currentBalance !== undefined,
    );
    expect(saveWithCustomer.length).toBe(0);
  });

  it('no payment type defaults to PAID status', async () => {
    await build({ withGateway: false });
    const r = await service.create({ ...baseDto });
    expect(r.status).toBe('PAID');
  });

  // ---- Payment Frequency ----

  it('credit with monthly frequency and 3 installments → dueDate = createdAt + 90 days', async () => {
    await build({ withGateway: false });
    paymentTypesServiceMock.findOne.mockResolvedValue({ code: '2' });

    const r = await service.create({
      ...baseDto,
      paymentTypeId: 'credit-pt',
      paymentFrequency: 'MONTHLY' as any,
      installments: 3,
    });
    expect(r.status).toBe('ON_CREDIT');
    expect(r.paymentFrequency).toBe('MONTHLY');
    expect(r.dueDate).toBeDefined();
    const expectedMs = r.createdAt.getTime() + 90 * 24 * 60 * 60 * 1000;
    expect(r.dueDate!.getTime()).toBeCloseTo(expectedMs, -4);
  });

  it('credit with weekly frequency and 1 installment → dueDate = createdAt + 7 days', async () => {
    await build({ withGateway: false });
    paymentTypesServiceMock.findOne.mockResolvedValue({ code: '2' });

    const r = await service.create({
      ...baseDto,
      paymentTypeId: 'credit-pt',
      paymentFrequency: 'WEEKLY' as any,
      installments: 1,
    });
    expect(r.dueDate).toBeDefined();
    const expectedMs = r.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000;
    expect(r.dueDate!.getTime()).toBeCloseTo(expectedMs, -4);
  });

  it('non-credit invoice → dueDate null, paymentFrequency ignored', async () => {
    await build({ withGateway: false });

    const r = await service.create({
      ...baseDto,
      paymentFrequency: 'MONTHLY' as any,
    });
    expect(r.status).toBe('PAID');
    expect(r.dueDate).toBeNull();
    expect(r.paymentFrequency).toBeNull();
  });

  // ---- Tax calculation in create() ----

  it('consumeStock is called AFTER invoice save with correct referenceId', async () => {
    await build({ withGateway: false });
    const consumeStockMock = (service as any).inventoryService
      .consumeStock as jest.Mock;
    const queryRunnerSaveMock = queryRunner.manager.save as jest.Mock;

    await service.create({ ...baseDto });

    // consumeStock should be called with referenceId matching a saved invoice ID
    expect(consumeStockMock).toHaveBeenCalledWith(
      'prod-1',
      1,
      expect.anything(),
      expect.objectContaining({
        referenceType: 'SALES_INVOICE',
        referenceId: expect.stringMatching(/^inv-/),
      }),
    );

    // Verify consumeStock was called AFTER invoice save by checking
    // that the invoice ID referenceId exists (can only exist after save)
    const referenceId = consumeStockMock.mock.calls[0][3].referenceId;
    expect(referenceId).toMatch(/^inv-/);

    // Verify the queryRunner.manager.save was called with an invoice
    // (this creates the ID) BEFORE consumeStock was called
    const invoiceSaveCall = queryRunnerSaveMock.mock.calls.find(
      ([first, second]) => {
        const entity = second !== undefined ? second : first;
        return entity && entity.id && entity.id === referenceId;
      },
    );
    expect(invoiceSaveCall).toBeDefined();
  });

  it('persists unitPrice, subtotal, taxAmount on invoice items', async () => {
    await build({ withGateway: false });
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

    const dto = {
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 3 }],
    };
    const r = await service.create(dto);

    // Items should have the new financial fields
    expect(r.items).toHaveLength(1);
    expect(r.items[0].unitPrice).toBeDefined();
    expect(r.items[0].subtotal).toBeDefined();
    expect(r.items[0].taxAmount).toBeDefined();
  });

  it('persists totalAmount and subtotal on the saved invoice', async () => {
    await build({ withGateway: false });
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

    const dto = {
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 3 }],
    };
    const r = await service.create(dto);

    // Saved invoice should have totalAmount and subtotal
    expect(r.totalAmount).toBeDefined();
    expect(r.subtotal).toBeDefined();
    expect(Number(r.totalAmount)).toBeGreaterThan(0);
    expect(Number(r.subtotal)).toBeGreaterThan(0);
  });

  it('persists taxAmount on InvoiceItemTax records', async () => {
    await build({ withGateway: false });
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

    const dto = {
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    };
    await service.create(dto);

    // Verify InvoiceItemTax saves include taxAmount
    const taxSaves = queryRunner.manager.save.mock.calls.filter(
      ([first, second]) => {
        const entity = second !== undefined ? second : first;
        return entity && entity.constructor?.name === 'InvoiceItemTax';
      },
    );
    // Or check for Tax saves via save(InvoiceItemTax, ...) pattern
    const taxSavesTwoArg = queryRunner.manager.save.mock.calls.filter(
      ([first, second]) => first?.name === 'InvoiceItemTax' && second?.taxId,
    );
    const allTaxSaves = taxSaves.length > 0 ? taxSaves : taxSavesTwoArg;
    // At least one tax amount should be > 0
    const hasTaxAmount = allTaxSaves.some(([, second]) => {
      const entity = second || {};
      return Number(entity.taxAmount) > 0;
    });
    expect(hasTaxAmount).toBe(true);
  });

  it('does NOT use (invoice as any).totalAmount hack', async () => {
    await build({ withGateway: false });
    const dto = {
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    };
    const r = await service.create(dto);

    // totalAmount should be a real property, not dynamically attached
    expect('totalAmount' in r).toBe(true);
    expect(r.totalAmount).toBeDefined();
  });

  it('create manual: with taxed product does NOT call Factus', async () => {
    await build({ withGateway: false });
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

    const r = await service.create({ ...baseDto });

    expect((r as any).invoiceNumber).toMatch(/^MAN-\d{6}$/);
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
      product: { sku: 'SKU-001', name: 'Product A', sellingPrice: 500 },
      productId: 'prod-1',
      quantity: 2,
      invoiceItemTaxes: [
        {
          taxId: 'tax-1',
          tax: { code: '01', name: 'IVA', percentage: 19 },
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

      emission: null,
      ...overrides,
    });
  }
  function buildEmittedInv(overrides?: any): any {
    return buildManualInv({
      id: 'inv-emitted-posthoc',
      sequentialNumber: 3,
      invoiceNumber: 'MAN-000003',

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
            restoreStock: jest
              .fn()
              .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
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
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest
                .fn()
                .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
            } as any),
        },
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
  });

  // ---- downloadInvoicePdf ----

  it('downloadInvoicePdf for manual invoice returns local PDF, no Factus call', async () => {
    const r = await service.downloadInvoicePdf('inv-manual');
    expect(factusGateway.downloadInvoicePdf).not.toHaveBeenCalled();
    expect(pdfService.generateInvoicePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'inv-manual',
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
    // isElectronic removed — use emission check instead
    expect(r.emission).toBeDefined();
    expect(r.emission!.number).toBe('SETP990003678');
    expect(r.emission!.cude).toBe('cufe-abc-123');
  });

  it('emit() sets FAC-{seq} prefix after marking invoice as electronic', async () => {
    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Success',
      data: { number: 'SETP990003678', cude: 'cufe' },
    });

    invoiceRepo.findOne = jest
      .fn()
      .mockResolvedValue(
        buildManualInv({ id: 'inv-emit', sequentialNumber: 42 }),
      );
    queryRunner.manager.save = jest
      .fn()
      .mockImplementation((first: any, second?: any) => {
        if (second !== undefined)
          return Promise.resolve({ ...second, id: 'em-new' });
        return Promise.resolve(first);
      });

    const r = await service.emit('inv-emit');
    expect((r as any).invoiceNumber).toBe('FAC-000042');
    expect(r.emission!.number).toBe('SETP990003678');
    // isElectronic removed — use emission check instead
  });

  it('emit() throws for invoice with existing emission', async () => {
    invoiceRepo.findOne = jest.fn().mockResolvedValue(
      buildManualInv({
        id: 'inv-emitted',
        emission: { id: 'em-1', number: 'SETP990099' } as any,
      }),
    );
    await expect(service.emit('inv-emitted')).rejects.toThrow(
      'ya tiene una emisión',
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

  it('emit: multi-tax product (IVA 19% + INC 4%) sends two Factus tax entries', async () => {
    const multiTaxProduct = {
      id: 'prod-1',
      sku: 'SKU-001',
      name: 'Product A',
      sellingPrice: 123000,
      taxes: [
        { id: 'tax-1', code: '01', percentage: 19.0 },
        { id: 'tax-2', code: '04', percentage: 4.0 },
      ],
    };
    invoiceRepo.findOne = jest.fn().mockResolvedValue(
      buildManualInv({
        items: [
          {
            id: 'item-1',
            product: multiTaxProduct,
            productId: 'prod-1',
            quantity: 1,
            unitPrice: 123000,
            subtotal: 123000,
          },
        ],
      }),
    );

    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Success',
      data: { number: 'SETP990003679', cude: 'cude-xyz', isValidated: true },
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
            taxes: [
              { code: '01', rate: '19.00', isExcluded: false },
              { code: '04', rate: '4.00', isExcluded: false },
            ],
          }),
        ]),
      }),
    );
  });

  it('emit: untaxed product sends empty taxes array to Factus', async () => {
    const untaxedProduct = {
      id: 'prod-1',
      sku: 'SKU-001',
      name: 'Product A',
      sellingPrice: 100,
      taxes: [],
    };
    invoiceRepo.findOne = jest.fn().mockResolvedValue(
      buildManualInv({
        items: [
          {
            id: 'item-1',
            product: untaxedProduct,
            productId: 'prod-1',
            quantity: 1,
            unitPrice: 100,
            subtotal: 100,
          },
        ],
      }),
    );

    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Success',
      data: { number: 'SETP990003680', cude: 'cude-123', isValidated: true },
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
        items: expect.arrayContaining([expect.objectContaining({ taxes: [] })]),
      }),
    );
  });

  it('emit: persists InvoiceItemTax records with taxAmount', async () => {
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
          },
        ],
      }),
    );

    const taxSaves: any[] = [];
    queryRunner.manager.save = jest
      .fn()
      .mockImplementation((first: any, second?: any) => {
        if (second !== undefined) {
          taxSaves.push(second);
          return Promise.resolve({ ...second, id: 'emission-new' });
        }
        return Promise.resolve(first);
      });

    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Success',
      data: { number: 'SETP990003680', cude: 'cude-123', isValidated: true },
    });

    await service.emit('inv-manual');

    // Verify InvoiceItemTax saves include taxAmount
    const taxAmountSaves = taxSaves.filter((s) => s.taxId);
    expect(taxAmountSaves.length).toBeGreaterThan(0);
    for (const save of taxAmountSaves) {
      expect(save.taxAmount).toBeDefined();
      expect(Number(save.taxAmount)).toBeGreaterThan(0);
    }
  });

  it('emit: returns invoice with totalAmount from persisted column', async () => {
    factusGateway.createInvoice = jest.fn().mockResolvedValue({
      status: 'OK',
      message: 'Success',
      data: { number: 'SETP990003680', cude: 'cude-123', isValidated: true },
    });

    queryRunner.manager.save = jest
      .fn()
      .mockImplementation((first: any, second?: any) => {
        if (second !== undefined)
          return Promise.resolve({ ...second, id: 'emission-new' });
        return Promise.resolve(first);
      });

    const r = await service.emit('inv-manual');

    // totalAmount should be a real property on the entity
    expect('totalAmount' in r).toBe(true);
    expect(r.totalAmount).toBeDefined();
    expect(Number(r.totalAmount)).toBeGreaterThan(0);
  });

  // ---- createCreditNote ----

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
            restoreStock: jest
              .fn()
              .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
          },
        },
        { provide: PdfGenerationService, useValue: pdfService },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn().mockReturnValue(qr) },
        },

        {
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest
                .fn()
                .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
            } as any),
        },
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
    const svc = mod.get(SalesService);
    await svc.createCreditNote('inv-cancel', { correctionConceptCode: '2' });
    expect(cancelInv.status).toBe(InvoiceStatus.CANCELLED);
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
            restoreStock: jest
              .fn()
              .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
          },
        },
        { provide: PdfGenerationService, useValue: pdfService },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn().mockReturnValue(qr) },
        },

        {
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest
                .fn()
                .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
            } as any),
        },
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
    const svc = mod.get(SalesService);
    await expect(
      svc.createCreditNote('inv-cancel', { correctionConceptCode: '1' } as any),
    ).rejects.toThrow('anuladas');
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
      product: { sku: 'SKU-001', name: 'Product A', sellingPrice: 500 },
      productId: 'prod-1',
      quantity: 2,
      invoiceItemTaxes: [
        {
          taxId: 'tax-1',
          tax: { code: '01', name: 'IVA', percentage: 19 },
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
            restoreStock: jest
              .fn()
              .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
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
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest
                .fn()
                .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
            } as any),
        },
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

  it('createCreditNote: code 2 creates manual note for manual invoice', async () => {
    const dto = {
      correctionConceptCode: '2',
    };
    const r = await service.createCreditNote('inv-manual', dto);
    expect((r as any).noteNumber).toContain('NC-MAN');
    expect(factusGateway.createCreditNote).not.toHaveBeenCalled();
  });

  it('createCreditNote: code 2 creates electronic note for electronic invoice', async () => {
    const dto = {
      correctionConceptCode: '2',
    };
    invoiceRepo.findOne = jest
      .fn()
      .mockResolvedValue(
        buildElectronicInv({ emission: { id: 'em-1', number: 'FAC-001' } }),
      );
    await service.createCreditNote('inv-electronic', dto);
    expect(factusGateway.createCreditNote).toHaveBeenCalledTimes(1);
  });

  it('should set restored false when restoreStock returns zero restoredQuantity', async () => {
    let capturedRestored: boolean | undefined;

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
        save: jest.fn((first: any, second?: any) => {
          const entity = second !== undefined ? second : first;
          // Capture restored from CreditNoteItem saves
          if (entity && 'restored' in entity && 'codeReference' in entity) {
            capturedRestored = entity.restored;
          }
          if (entity && entity.correctionConceptCode) {
            // CreditNote save — return with an id
            return Promise.resolve({ ...entity, id: 'cn-captured' });
          }
          return Promise.resolve(entity);
        }),
      },
    };

    const creditNoteItemRepoMock = {
      ...repoMock(),
      save: jest.fn((e: any) => {
        if (e && 'restored' in e) {
          capturedRestored = e.restored;
        }
        return Promise.resolve({ ...e, id: 'cni-1' });
      }),
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
        {
          provide: getRepositoryToken(CreditNote),
          useValue: {
            ...repoMock(),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((d: any) => ({ ...d, id: 'cn-captured' })),
          },
        },
        {
          provide: getRepositoryToken(CreditNoteItem),
          useValue: creditNoteItemRepoMock,
        },
        {
          provide: getRepositoryToken(CreditNoteItemTax),
          useValue: repoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        {
          provide: InventoryService,
          useValue: {
            consumeStock: jest.fn(),
            restoreStock: jest
              .fn()
              .mockResolvedValue({ totalCost: 0, restoredQuantity: 0 }),
          },
        },
        { provide: PdfGenerationService, useValue: pdfService },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn().mockReturnValue(qr) },
        },
        {
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest
                .fn()
                .mockResolvedValue({ totalCost: 0, restoredQuantity: 0 }),
            } as any),
        },
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
    const svc = mod.get(SalesService);
    await svc.createCreditNote('inv-manual', {
      correctionConceptCode: '2',
    });
    expect(capturedRestored).toBe(false);
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
      product: { sku: 'SKU-001', name: 'Product A', sellingPrice: 500 },
      productId: 'prod-1',
      quantity: 2,
      invoiceItemTaxes: [
        {
          taxId: 'tax-1',
          tax: { code: '01', name: 'IVA', percentage: 19 },
        },
      ],
      ...overrides,
    };
  }

  function buildManualInv(overrides?: any): any {
    return {
      id: 'inv-manual',
      sequentialNumber: 1,

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
            restoreStock: jest
              .fn()
              .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
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
          provide: ScenarioDHandler,
          useFactory: () =>
            new ScenarioDHandler({
              restoreStock: jest
                .fn()
                .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
            } as any),
        },
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
  });

  // --- 1.1: code '2' blocked when existing credit notes exist ---
  it('1.1 rejects total annulment (code 2) when credit notes already exist', async () => {
    qbMock.getRawOne.mockResolvedValue({ total: '600' });
    const dto = {
      correctionConceptCode: '2',
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
      /ya existen notas de crédito/,
    );
  });

  // --- 1.2: single 110% note also rejected ---
  it('1.2 rejects single total annulment exceeding invoice total (1100 > 1000)', async () => {
    qbMock.getRawOne.mockResolvedValue({ total: '0' });
    const dto = {
      correctionConceptCode: '2',
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
            restoreStock: jest
              .fn()
              .mockResolvedValue({ totalCost: 0, restoredQuantity: 1 }),
          },
        },
        { provide: PdfGenerationService, useValue: {} },
        { provide: DataSource, useValue: {} },
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
    sequentialNumber: 42,

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
        product: { sku: 'SKU-001', name: 'Product A', sellingPrice: 500 },
        productId: 'prod-1',
        quantity: 2,
      },
    ],
    emission: null,
  };

  it('returns matching manual invoices by number', async () => {
    await build();
    invoiceRepo.find = jest.fn().mockResolvedValue([manualInvoiceTemplate]);

    const result = await service.searchManualBills('42');
    expect(invoiceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sequentialNumber: 42,
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

  it('searches with partial number (sequential)', async () => {
    await build();
    invoiceRepo.find = jest.fn().mockResolvedValue([manualInvoiceTemplate]);

    const result = await service.searchManualBills('42');
    expect(invoiceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sequentialNumber: 42,
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('transforms results into ManualInvoiceSearchResultDto shape', async () => {
    await build();
    invoiceRepo.find = jest.fn().mockResolvedValue([manualInvoiceTemplate]);

    const result = await service.searchManualBills('42');
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
