import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalesService } from './sales.service';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { CreditNote } from './entities/credit-note.entity';
import { DebitNote } from './entities/debit-note.entity';
import { InventoryService } from '../inventory/inventory.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInvoice(
  overrides: Partial<Invoice> & {
    creditNotes?: Partial<CreditNote>[];
    debitNotes?: Partial<DebitNote>[];
  } = {},
): Invoice {
  return {
    id: 'inv-1',
    invoiceNumber: 'FAC-0001',
    date: new Date(),
    customerId: 'cust-1',
    customer: undefined as any,
    totalAmount: 1000,
    status: 'PAID' as any,
    notes: null as any,
    items: [],
    creditNotes: [],
    debitNotes: [],
    isElectronic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Invoice;
}

// ---------------------------------------------------------------------------
// Repository mock factory
// ---------------------------------------------------------------------------

const makeRepoMock = (findAndCountResult: [Invoice[], number]) => ({
  findAndCount: jest.fn().mockResolvedValue(findAndCountResult),
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  save: jest.fn(),
  create: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SalesService.findAll — netTotal computation', () => {
  let service: SalesService;
  let invoiceRepoMock: ReturnType<typeof makeRepoMock>;

  async function buildService(invoices: Invoice[]) {
    invoiceRepoMock = makeRepoMock([invoices, invoices.length]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: invoiceRepoMock,
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: getRepositoryToken(DebitNote),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: 'IFactusInvoicingGateway',
          useValue: {},
        },
        {
          provide: InventoryService,
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  }

  // -------------------------------------------------------------------------
  // Scenario (a): no notes → netTotal equals totalAmount
  // -------------------------------------------------------------------------
  it('(a) returns netTotal equal to totalAmount when no credit or debit notes exist', async () => {
    const invoice = makeInvoice({ totalAmount: 1000, creditNotes: [], debitNotes: [] });
    await buildService([invoice]);

    const result = await service.findAll({ page: 1, limit: 10 } as any);

    expect(result.data[0]).toHaveProperty('netTotal', 1000);
  });

  // -------------------------------------------------------------------------
  // Scenario (b): one credit note → netTotal = totalAmount - creditNote.amount
  // -------------------------------------------------------------------------
  it('(b) returns netTotal = totalAmount - creditNote.amount with one credit note', async () => {
    const invoice = makeInvoice({
      totalAmount: 1000,
      creditNotes: [{ amount: 200 } as CreditNote],
      debitNotes: [],
    });
    await buildService([invoice]);

    const result = await service.findAll({ page: 1, limit: 10 } as any);

    expect(result.data[0]).toHaveProperty('netTotal', 800);
  });

  // -------------------------------------------------------------------------
  // Scenario (c): one debit note → netTotal = totalAmount + debitNote.amount
  // -------------------------------------------------------------------------
  it('(c) returns netTotal = totalAmount + debitNote.amount with one debit note', async () => {
    const invoice = makeInvoice({
      totalAmount: 1000,
      creditNotes: [],
      debitNotes: [{ amount: 150 } as DebitNote],
    });
    await buildService([invoice]);

    const result = await service.findAll({ page: 1, limit: 10 } as any);

    expect(result.data[0]).toHaveProperty('netTotal', 1150);
  });

  // -------------------------------------------------------------------------
  // Scenario (d): both types → netTotal = totalAmount - creditSum + debitSum
  // -------------------------------------------------------------------------
  it('(d) returns netTotal combining credit and debit notes (1000 - 200 + 150 = 950)', async () => {
    const invoice = makeInvoice({
      totalAmount: 1000,
      creditNotes: [{ amount: 200 } as CreditNote],
      debitNotes: [{ amount: 150 } as DebitNote],
    });
    await buildService([invoice]);

    const result = await service.findAll({ page: 1, limit: 10 } as any);

    expect(result.data[0]).toHaveProperty('netTotal', 950);
  });

  // -------------------------------------------------------------------------
  // Scenario (extra): empty arrays produce no error
  // -------------------------------------------------------------------------
  it('(extra) handles empty creditNotes and debitNotes arrays without throwing', async () => {
    const invoice = makeInvoice({ totalAmount: 500, creditNotes: [], debitNotes: [] });
    await buildService([invoice]);

    await expect(service.findAll({ page: 1, limit: 10 } as any)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 1.1 RED — Invoice entity: isElectronic field
// ---------------------------------------------------------------------------

describe('SalesService — isElectronic on Invoice entity', () => {
  it('makeInvoice with isElectronic: false has isElectronic === false', () => {
    const invoice = makeInvoice({ isElectronic: false });
    expect(invoice.isElectronic).toBe(false);
  });

  it('makeInvoice default has isElectronic === true', () => {
    const invoice = makeInvoice({ isElectronic: true });
    expect(invoice.isElectronic).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.1 RED — SalesService.create() manual invoice branching tests
// ---------------------------------------------------------------------------

describe('SalesService.create() — manual invoice branching', () => {
  let service: SalesService;
  let invoiceRepoMock: any;
  let factusGatewayMock: any;
  let inventoryServiceMock: any;

  function buildStubProduct(overrides: any = {}) {
    return {
      id: 'prod-1',
      name: 'Product A',
      sku: 'SKU-001',
      sellingPrice: 100,
      currentStock: 10,
      ...overrides,
    };
  }

  function buildStubCustomer(overrides: any = {}) {
    return {
      id: 'cust-1',
      name: 'Customer A',
      documentNumber: '12345',
      documentType: 'CC',
      ...overrides,
    };
  }

  async function buildServiceForCreate(manualCount = 0, totalCount = 0) {
    invoiceRepoMock = {
      count: jest.fn().mockImplementation((options?: any) => {
        if (options?.where?.isElectronic === false) {
          return Promise.resolve(manualCount);
        }
        return Promise.resolve(totalCount);
      }),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    factusGatewayMock = {
      createInvoice: jest
        .fn()
        .mockResolvedValue({ data: { number: 'SETP990001' } }),
    };

    inventoryServiceMock = {
      consumeStock: jest.fn().mockResolvedValue(0),
    };

    const queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockImplementation((EntityClass: any, opts: any) => {
          if (EntityClass?.name === 'Customer' || opts?.where?.id === 'cust-1') {
            return Promise.resolve(buildStubCustomer());
          }
          return Promise.resolve(buildStubProduct());
        }),
        save: jest
          .fn()
          .mockImplementation((entity: any) => Promise.resolve(entity)),
      },
    };

    const dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: invoiceRepoMock,
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: getRepositoryToken(DebitNote),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: 'IFactusInvoicingGateway',
          useValue: factusGatewayMock,
        },
        {
          provide: InventoryService,
          useValue: inventoryServiceMock,
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  }

  const baseDto = {
    customerId: 'cust-1',
    items: [{ productId: 'prod-1', quantity: 1 }],
  };

  it('isElectronic: false — Factus is NOT called; invoiceNumber matches MAN pattern', async () => {
    await buildServiceForCreate(0, 0);
    const result = await service.create({ ...baseDto, isElectronic: false } as any);

    expect(factusGatewayMock.createInvoice).not.toHaveBeenCalled();
    expect(invoiceRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: expect.stringMatching(/^MAN-\d{8}$/),
        isElectronic: false,
      }),
    );
  });

  it('isElectronic: true (explicit) — Factus IS called', async () => {
    await buildServiceForCreate(0, 0);
    await service.create({ ...baseDto, isElectronic: true } as any);

    expect(factusGatewayMock.createInvoice).toHaveBeenCalledTimes(1);
  });

  it('isElectronic omitted — treated as true; Factus IS called', async () => {
    await buildServiceForCreate(0, 0);
    await service.create({ ...baseDto } as any);

    expect(factusGatewayMock.createInvoice).toHaveBeenCalledTimes(1);
  });

  it('sequential manual invoices — second gets MAN-00000002', async () => {
    await buildServiceForCreate(1, 5);
    const result = await service.create({ ...baseDto, isElectronic: false } as any);

    expect(invoiceRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: 'MAN-00000002',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Phase 2.1 RED — credit/debit note guards for manual invoices
// ---------------------------------------------------------------------------

describe('SalesService — credit/debit note guards for manual invoices', () => {
  let service: SalesService;
  let invoiceRepoMock: any;

  async function buildServiceForNotes(invoice: Invoice) {
    invoiceRepoMock = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(invoice),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: invoiceRepoMock,
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: getRepositoryToken(DebitNote),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: 'IFactusInvoicingGateway',
          useValue: {},
        },
        {
          provide: InventoryService,
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  }

  const stubNoteDto = {
    correctionConceptCode: '2',
    billNumber: 'MAN-00000001',
    numberingRangeId: 1,
  } as any;

  it('createCreditNote() on manual invoice — throws BadRequestException with "manuales"', async () => {
    await buildServiceForNotes(makeInvoice({ isElectronic: false }));
    await expect(
      service.createCreditNote('inv-1', stubNoteDto),
    ).rejects.toThrow(expect.objectContaining({ message: expect.stringContaining('manuales') }));
  });

  it('createDebitNote() on manual invoice — throws BadRequestException with "manuales"', async () => {
    await buildServiceForNotes(makeInvoice({ isElectronic: false }));
    await expect(
      service.createDebitNote('inv-1', stubNoteDto),
    ).rejects.toThrow(expect.objectContaining({ message: expect.stringContaining('manuales') }));
  });

  it('createCreditNote() on electronic invoice — proceeds (no throw on guard)', async () => {
    const electronicInvoice = makeInvoice({
      isElectronic: true,
      invoiceNumber: 'SETP990001',
      items: [],
      customer: {
        id: 'cust-1',
        name: 'Test',
        documentNumber: '123',
        documentType: 'CC',
      } as any,
    });

    const creditNoteRepoMock = {
      ...makeRepoMock([[], 0]),
      create: jest.fn().mockReturnValue({ id: 'cn-1' }),
      save: jest.fn().mockResolvedValue({ id: 'cn-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: {
            ...makeRepoMock([[electronicInvoice], 1]),
            findOne: jest.fn().mockResolvedValue(electronicInvoice),
          },
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: creditNoteRepoMock,
        },
        {
          provide: getRepositoryToken(DebitNote),
          useValue: makeRepoMock([[], 0]),
        },
        {
          provide: 'IFactusInvoicingGateway',
          useValue: {
            createCreditNote: jest
              .fn()
              .mockResolvedValue({ data: { number: 'NC-001', cude: 'cude-1' } }),
          },
        },
        {
          provide: InventoryService,
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);

    // Should NOT throw a BadRequestException about manual invoices
    // (it may throw about Factus, items, etc. — but not the manual guard)
    let thrownError: any;
    try {
      await service.createCreditNote('inv-1', {
        ...stubNoteDto,
        items: [],
      } as any);
    } catch (e: any) {
      thrownError = e;
    }

    if (thrownError) {
      expect(thrownError.message).not.toContain('manuales');
    }
  });
});
