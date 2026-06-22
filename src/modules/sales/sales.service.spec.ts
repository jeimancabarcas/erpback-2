import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalesService } from './sales.service';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { CreditNote } from './entities/credit-note.entity';
import { DebitNote } from './entities/debit-note.entity';
import { CreditNoteItem } from './entities/credit-note-item.entity';
import { DebitNoteItem } from './entities/debit-note-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { PdfGenerationService } from '../pdf-generation/pdf-generation.service';

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
  };
}

// ---------------------------------------------------------------------------
// Repository mock factory
// ---------------------------------------------------------------------------

const makeRepoMock = (findAndCountResult?: [any[], number]) => ({
  findAndCount: jest.fn().mockResolvedValue(findAndCountResult || [[], 0]),
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  findOneBy: jest.fn(),
  save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  create: jest.fn().mockImplementation((data) => data || {}),
  count: jest.fn().mockResolvedValue(0),
});

const baseProviders = (overrides?: Record<string, any>) => [
  SalesService,
  {
    provide: getRepositoryToken(Invoice),
    useValue: makeRepoMock(),
  },
  {
    provide: getRepositoryToken(InvoiceItem),
    useValue: makeRepoMock(),
  },
  {
    provide: getRepositoryToken(CreditNote),
    useValue: makeRepoMock(),
  },
  {
    provide: getRepositoryToken(DebitNote),
    useValue: makeRepoMock(),
  },
  {
    provide: getRepositoryToken(CreditNoteItem),
    useValue: makeRepoMock(),
  },
  {
    provide: getRepositoryToken(DebitNoteItem),
    useValue: makeRepoMock(),
  },
  {
    provide: 'IFactusInvoicingGateway',
    useValue: overrides?.factusGateway || {
      createInvoice: jest.fn(),
      createCreditNote: jest.fn(),
      createDebitNote: jest.fn(),
      downloadInvoicePdf: jest.fn(),
      downloadAdjustmentNotePdf: jest.fn(),
    },
  },
  {
    provide: InventoryService,
    useValue: overrides?.inventoryService || {
      consumeStock: jest.fn().mockResolvedValue(0),
    },
  },
  {
    provide: PdfGenerationService,
    useValue: overrides?.pdfGenerationService || {
      generateInvoicePdf: jest.fn().mockResolvedValue('JVBERi0xLjc='),
    },
  },
  {
    provide: DataSource,
    useValue: overrides?.dataSource || {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          findOne: jest.fn().mockResolvedValue(undefined),
          save: jest
            .fn()
            .mockImplementation((entity) => Promise.resolve(entity)),
          count: jest.fn().mockResolvedValue(0),
        },
      }),
    },
  },
];

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SalesService.findAll — netTotal computation', () => {
  let service: SalesService;
  let invoiceRepoMock: any;

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
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(DebitNote),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(CreditNoteItem),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(DebitNoteItem),
          useValue: makeRepoMock(),
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
          provide: PdfGenerationService,
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

  it('(a) returns netTotal equal to totalAmount when no credit or debit notes exist', async () => {
    const invoice = makeInvoice({
      totalAmount: 1000,
      creditNotes: [],
      debitNotes: [],
    });
    await buildService([invoice]);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.data[0]).toHaveProperty('netTotal', 1000);
  });

  it('(b) returns netTotal = totalAmount - creditNote.amount with one credit note', async () => {
    const invoice = makeInvoice({
      totalAmount: 1000,
      creditNotes: [{ amount: 200 } as CreditNote],
      debitNotes: [],
    });
    await buildService([invoice]);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.data[0]).toHaveProperty('netTotal', 800);
  });

  it('(c) returns netTotal = totalAmount + debitNote.amount with one debit note', async () => {
    const invoice = makeInvoice({
      totalAmount: 1000,
      creditNotes: [],
      debitNotes: [{ amount: 150 } as DebitNote],
    });
    await buildService([invoice]);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.data[0]).toHaveProperty('netTotal', 1150);
  });

  it('(d) returns netTotal combining credit and debit notes (1000 - 200 + 150 = 950)', async () => {
    const invoice = makeInvoice({
      totalAmount: 1000,
      creditNotes: [{ amount: 200 } as CreditNote],
      debitNotes: [{ amount: 150 } as DebitNote],
    });
    await buildService([invoice]);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.data[0]).toHaveProperty('netTotal', 950);
  });

  it('(extra) handles empty creditNotes and debitNotes arrays without throwing', async () => {
    const invoice = makeInvoice({
      totalAmount: 500,
      creditNotes: [],
      debitNotes: [],
    });
    await buildService([invoice]);

    await expect(
      service.findAll({ page: 1, limit: 10 } as any),
    ).resolves.toBeDefined();
  });
});

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
          if (
            EntityClass?.name === 'Customer' ||
            opts?.where?.id === 'cust-1'
          ) {
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
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(DebitNote),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(CreditNoteItem),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(DebitNoteItem),
          useValue: makeRepoMock(),
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
          provide: PdfGenerationService,
          useValue: {},
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
    const result = await service.create({
      ...baseDto,
      isElectronic: false,
    });

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
    await service.create({ ...baseDto, isElectronic: true });

    expect(factusGatewayMock.createInvoice).toHaveBeenCalledTimes(1);
  });

  it('isElectronic omitted — treated as true; Factus IS called', async () => {
    await buildServiceForCreate(0, 0);
    await service.create({ ...baseDto });

    expect(factusGatewayMock.createInvoice).toHaveBeenCalledTimes(1);
  });

  it('sequential manual invoices — second gets MAN-00000002', async () => {
    await buildServiceForCreate(1, 5);
    const result = await service.create({
      ...baseDto,
      isElectronic: false,
    });

    expect(invoiceRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: 'MAN-00000002',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Manual invoice paths — PDF download, credit notes, debit notes
// ---------------------------------------------------------------------------

describe('SalesService — manual invoice paths', () => {
  let service: SalesService;
  let factusGatewayMock: any;
  let pdfServiceMock: any;
  let creditNoteRepoMock: any;
  let debitNoteRepoMock: any;

  const manualInvoice = makeInvoice({
    id: 'inv-manual',
    invoiceNumber: 'MAN-00000001',
    isElectronic: false,
    totalAmount: 1000,
    status: InvoiceStatus.PAID,
    customer: {
      id: 'cust-1',
      name: 'Test',
      documentNumber: '123',
      documentType: 'CC',
    } as any,
    items: [
      {
        id: 'item-1',
        product: { sku: 'SKU-001', name: 'Product A' },
        productId: 'prod-1',
        quantity: 2,
        unitPrice: 500,
        subtotal: 1000,
      } as InvoiceItem,
    ],
  });

  const electronicInvoice = makeInvoice({
    id: 'inv-electronic',
    invoiceNumber: 'SETP990001',
    isElectronic: true,
    totalAmount: 1000,
    status: InvoiceStatus.PAID,
    customer: {
      id: 'cust-1',
      name: 'Test',
      documentNumber: '123',
      documentType: 'CC',
    } as any,
    items: [
      {
        id: 'item-1',
        product: { sku: 'SKU-001', name: 'Product A' },
        productId: 'prod-1',
        quantity: 2,
        unitPrice: 500,
        subtotal: 1000,
      } as InvoiceItem,
    ],
  });

  beforeEach(async () => {
    factusGatewayMock = {
      createInvoice: jest.fn(),
      createCreditNote: jest
        .fn()
        .mockResolvedValue({ data: { number: 'NC-001', cude: 'cude-1' } }),
      createDebitNote: jest
        .fn()
        .mockResolvedValue({ data: { number: 'ND-001', cude: 'cude-1' } }),
      downloadInvoicePdf: jest.fn().mockResolvedValue({
        pdfBase64Encoded: 'JVBERi0xLjc=',
        fileName: 'SETP990001.pdf',
      }),
      downloadAdjustmentNotePdf: jest.fn(),
    };

    pdfServiceMock = {
      generateInvoicePdf: jest.fn().mockResolvedValue('JVBERi0xLjc='),
    };

    creditNoteRepoMock = {
      ...makeRepoMock(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest
        .fn()
        .mockImplementation((data) => ({ ...data, id: 'cn-new' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    debitNoteRepoMock = {
      ...makeRepoMock(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest
        .fn()
        .mockImplementation((data) => ({ ...data, id: 'dn-new' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const invoiceRepoMock = {
      ...makeRepoMock(),
      findOne: jest.fn().mockImplementation((opts: any) => {
        const id = opts?.where?.id;
        if (id === 'inv-manual') return Promise.resolve(manualInvoice);
        if (id === 'inv-electronic') return Promise.resolve(electronicInvoice);
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepoMock },
        { provide: getRepositoryToken(InvoiceItem), useValue: makeRepoMock() },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: creditNoteRepoMock,
        },
        { provide: getRepositoryToken(DebitNote), useValue: debitNoteRepoMock },
        {
          provide: getRepositoryToken(CreditNoteItem),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(DebitNoteItem),
          useValue: makeRepoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGatewayMock },
        { provide: InventoryService, useValue: { consumeStock: jest.fn() } },
        { provide: PdfGenerationService, useValue: pdfServiceMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  // ---- downloadInvoicePdf ----

  it('downloadInvoicePdf for manual invoice returns local PDF, does NOT call Factus', async () => {
    const result = await service.downloadInvoicePdf('inv-manual');

    expect(factusGatewayMock.downloadInvoicePdf).not.toHaveBeenCalled();
    expect(pdfServiceMock.generateInvoicePdf).toHaveBeenCalledTimes(1);
    expect(pdfServiceMock.generateInvoicePdf).toHaveBeenCalledWith(
      manualInvoice,
      [],
      [],
    );
    expect(result).toEqual({
      pdfBase64Encoded: 'JVBERi0xLjc=',
      fileName: 'MAN-00000001-historial.pdf',
    });
  });

  it('downloadInvoicePdf for electronic invoice generates history PDF', async () => {
    const result = await service.downloadInvoicePdf('inv-electronic');

    expect(pdfServiceMock.generateInvoicePdf).toHaveBeenCalledTimes(1);
    expect(factusGatewayMock.downloadInvoicePdf).not.toHaveBeenCalled();
    expect(result).toEqual({
      pdfBase64Encoded: 'JVBERi0xLjc=',
      fileName: 'SETP990001-historial.pdf',
    });
  });

  it('downloadDianPdf returns DIAN PDF for electronic invoice', async () => {
    const result = await service.downloadDianPdf('inv-electronic');

    expect(factusGatewayMock.downloadInvoicePdf).toHaveBeenCalledTimes(1);
    expect(factusGatewayMock.downloadInvoicePdf).toHaveBeenCalledWith(
      'SETP990001',
    );
  });

  it('downloadDianPdf throws for manual invoice', async () => {
    await expect(service.downloadDianPdf('inv-manual')).rejects.toThrow(
      'manuales no tienen PDF',
    );
  });

  it('downloadInvoicePdf throws NotFoundException for non-existent invoice', async () => {
    await expect(service.downloadInvoicePdf('non-existent')).rejects.toThrow();
  });

  // ---- createCreditNote ----

  it('createCreditNote for manual invoice creates note locally (no Factus call)', async () => {
    const dto = {
      correctionConceptCode: '1',
      items: [{ codeReference: 'SKU-001', quantity: 1, price: 500 }],
    };

    const result = await service.createCreditNote('inv-manual', dto);

    expect(factusGatewayMock.createCreditNote).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect((result as any).noteNumber).toContain('NC-MAN');
    expect((result as any).cude).toBeNull();
    expect((result as any).qrUrl).toBeNull();
    expect((result as any).publicUrl).toBeNull();
  });

  it('createCreditNote for manual invoice with concept "2" sets invoice to CANCELLED', async () => {
    const cancellingInvoice = makeInvoice({
      id: 'inv-cancel',
      invoiceNumber: 'MAN-00000002',
      isElectronic: false,
      totalAmount: 1000,
      status: InvoiceStatus.PAID,
      customer: {
        id: 'cust-1',
        name: 'Test',
        documentNumber: '123',
        documentType: 'CC',
      } as any,
      items: [
        {
          id: 'item-1',
          product: { sku: 'SKU-001', name: 'Product A' },
          productId: 'prod-1',
          quantity: 2,
          unitPrice: 500,
          subtotal: 1000,
        } as InvoiceItem,
      ],
    });

    const invoiceRepoMock = {
      ...makeRepoMock(),
      findOne: jest.fn().mockResolvedValue(cancellingInvoice),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((entity) => {
          if (entity && entity.status) {
            cancellingInvoice.status = entity.status;
          }
          return Promise.resolve(entity);
        }),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepoMock },
        { provide: getRepositoryToken(InvoiceItem), useValue: makeRepoMock() },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: creditNoteRepoMock,
        },
        { provide: getRepositoryToken(DebitNote), useValue: debitNoteRepoMock },
        {
          provide: getRepositoryToken(CreditNoteItem),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(DebitNoteItem),
          useValue: makeRepoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGatewayMock },
        { provide: InventoryService, useValue: { consumeStock: jest.fn() } },
        { provide: PdfGenerationService, useValue: pdfServiceMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    const svc = module.get<SalesService>(SalesService);
    const result = await svc.createCreditNote('inv-cancel', {
      correctionConceptCode: '2',
    });

    expect(result).toBeDefined();
    expect(cancellingInvoice.status).toBe(InvoiceStatus.CANCELLED);
  });

  it('createCreditNote for electronic invoice still calls Factus', async () => {
    const dto = { correctionConceptCode: '1' };

    await service.createCreditNote('inv-electronic', dto);

    expect(factusGatewayMock.createCreditNote).toHaveBeenCalledTimes(1);
  });

  it('createCreditNote for manual invoice returns error for non-existent item', async () => {
    const dto = {
      correctionConceptCode: '1',
      items: [{ codeReference: 'SKU-999', quantity: 1, price: 500 }],
    };

    await expect(
      service.createCreditNote('inv-manual', dto as any),
    ).rejects.toThrow('no pertenece');
  });

  it('createCreditNote for manual invoice rejects quantity exceeding invoice item', async () => {
    const dto = {
      correctionConceptCode: '1',
      items: [{ codeReference: 'SKU-001', quantity: 10, price: 500 }],
    };

    await expect(
      service.createCreditNote('inv-manual', dto as any),
    ).rejects.toThrow('supera');
  });

  it('createCreditNote for cancelled manual invoice is rejected', async () => {
    const cancelledInvoice = makeInvoice({
      id: 'inv-cancelled',
      invoiceNumber: 'MAN-00000002',
      isElectronic: false,
      status: InvoiceStatus.CANCELLED,
      customer: {
        id: 'cust-1',
        name: 'Test',
        documentNumber: '123',
        documentType: 'CC',
      } as any,
      items: [],
    });

    const invoiceRepoMock = {
      ...makeRepoMock(),
      findOne: jest.fn().mockResolvedValue(cancelledInvoice),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepoMock },
        { provide: getRepositoryToken(InvoiceItem), useValue: makeRepoMock() },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: creditNoteRepoMock,
        },
        { provide: getRepositoryToken(DebitNote), useValue: debitNoteRepoMock },
        {
          provide: getRepositoryToken(CreditNoteItem),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(DebitNoteItem),
          useValue: makeRepoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGatewayMock },
        { provide: InventoryService, useValue: { consumeStock: jest.fn() } },
        { provide: PdfGenerationService, useValue: pdfServiceMock },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn(),
              manager: {
                findOne: jest.fn(),
                save: jest.fn(),
                count: jest.fn(),
              },
            }),
          },
        },
      ],
    }).compile();

    const svc = module.get<SalesService>(SalesService);

    await expect(
      svc.createCreditNote('inv-cancelled', {
        correctionConceptCode: '1',
      } as any),
    ).rejects.toThrow('anuladas');
  });

  // ---- createDebitNote ----

  it('createDebitNote for manual invoice creates note locally (no Factus call)', async () => {
    const dto = {
      correctionConceptCode: '3',
      items: [{ codeReference: 'SKU-001', quantity: 1, price: 200 }],
    };

    const result = await service.createDebitNote('inv-manual', dto);

    expect(factusGatewayMock.createDebitNote).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect((result as any).noteNumber).toContain('ND-MAN');
    expect((result as any).cude).toBeNull();
    expect((result as any).qrUrl).toBeNull();
    expect((result as any).publicUrl).toBeNull();
  });

  it('createDebitNote for manual invoice does NOT change invoice status', async () => {
    const originalStatus = manualInvoice.status;
    const dto = { correctionConceptCode: '2' };

    await service.createDebitNote('inv-manual', dto);

    expect(manualInvoice.status).toBe(originalStatus);
  });

  it('createDebitNote for electronic invoice still calls Factus', async () => {
    const dto = { correctionConceptCode: '1' };

    await service.createDebitNote('inv-electronic', dto);

    expect(factusGatewayMock.createDebitNote).toHaveBeenCalledTimes(1);
  });

  // ---- isElectronic filter ----

  it('findAll with isElectronic=true returns only electronic invoices', async () => {
    const invoiceRepoMock = {
      ...makeRepoMock(),
      findAndCount: jest.fn().mockResolvedValue([[electronicInvoice], 1]),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepoMock },
        { provide: getRepositoryToken(InvoiceItem), useValue: makeRepoMock() },
        { provide: getRepositoryToken(CreditNote), useValue: makeRepoMock() },
        { provide: getRepositoryToken(DebitNote), useValue: makeRepoMock() },
        {
          provide: getRepositoryToken(CreditNoteItem),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(DebitNoteItem),
          useValue: makeRepoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGatewayMock },
        { provide: InventoryService, useValue: { consumeStock: jest.fn() } },
        { provide: PdfGenerationService, useValue: pdfServiceMock },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn(),
              manager: {
                findOne: jest.fn(),
                save: jest.fn(),
                count: jest.fn(),
              },
            }),
          },
        },
      ],
    }).compile();

    const svc = module.get<SalesService>(SalesService);
    const result = await svc.findAll({ isElectronic: true });

    expect(invoiceRepoMock.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isElectronic: true }),
      }),
    );
    expect(result.data).toHaveLength(1);
  });

  it('findAll with isElectronic=false returns only manual invoices', async () => {
    const invoiceRepoMock = {
      ...makeRepoMock(),
      findAndCount: jest.fn().mockResolvedValue([[manualInvoice], 1]),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepoMock },
        { provide: getRepositoryToken(InvoiceItem), useValue: makeRepoMock() },
        { provide: getRepositoryToken(CreditNote), useValue: makeRepoMock() },
        { provide: getRepositoryToken(DebitNote), useValue: makeRepoMock() },
        {
          provide: getRepositoryToken(CreditNoteItem),
          useValue: makeRepoMock(),
        },
        {
          provide: getRepositoryToken(DebitNoteItem),
          useValue: makeRepoMock(),
        },
        { provide: 'IFactusInvoicingGateway', useValue: factusGatewayMock },
        { provide: InventoryService, useValue: { consumeStock: jest.fn() } },
        { provide: PdfGenerationService, useValue: pdfServiceMock },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn(),
              manager: {
                findOne: jest.fn(),
                save: jest.fn(),
                count: jest.fn(),
              },
            }),
          },
        },
      ],
    }).compile();

    const svc = module.get<SalesService>(SalesService);
    const result = await svc.findAll({ isElectronic: false });

    expect(invoiceRepoMock.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isElectronic: false }),
      }),
    );
  });
});
