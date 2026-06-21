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
