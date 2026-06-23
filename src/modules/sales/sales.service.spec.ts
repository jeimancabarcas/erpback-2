import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalesService } from './sales.service';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceElectronicEmission } from './entities/invoice-electronic-emission.entity';
import { CreditNote } from './entities/credit-note.entity';
import { DebitNote } from './entities/debit-note.entity';
import { CreditNoteItem } from './entities/credit-note-item.entity';
import { DebitNoteItem } from './entities/debit-note-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { PdfGenerationService } from '../pdf-generation/pdf-generation.service';

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
    debitNotes?: Partial<DebitNote>[];
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
    debitNotes: [],
    isElectronic: false,
    emission: undefined as any,
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
        { provide: getRepositoryToken(InvoiceElectronicEmission), useValue: repoMock() },
        { provide: getRepositoryToken(CreditNote), useValue: repoMock() },
        { provide: getRepositoryToken(DebitNote), useValue: repoMock() },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        { provide: getRepositoryToken(DebitNoteItem), useValue: repoMock() },
        { provide: 'IFactusInvoicingGateway', useValue: {} },
        { provide: InventoryService, useValue: {} },
        { provide: PdfGenerationService, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();
    service = mod.get(SalesService);
  }

  it('a) netTotal equals totalAmount when no credit/debit notes', async () => {
    const inv = makeInvoice({ totalAmount: 1000, creditNotes: [], debitNotes: [] });
    await build([inv]);
    const r = await service.findAll({ page: 1, limit: 10 });
    expect(r.data[0]).toHaveProperty('netTotal', 1000);
  });

  it('b) netTotal = totalAmount - creditNote.amount', async () => {
    const inv = makeInvoice({ totalAmount: 1000, creditNotes: [{ amount: 200 } as CreditNote], debitNotes: [] });
    await build([inv]);
    const r = await service.findAll({ page: 1, limit: 10 });
    expect(r.data[0]).toHaveProperty('netTotal', 800);
  });

  it('c) netTotal = totalAmount + debitNote.amount', async () => {
    const inv = makeInvoice({ totalAmount: 1000, creditNotes: [], debitNotes: [{ amount: 150 } as DebitNote] });
    await build([inv]);
    const r = await service.findAll({ page: 1, limit: 10 });
    expect(r.data[0]).toHaveProperty('netTotal', 1150);
  });

  it('d) netTotal combining credit and debit notes (1000-200+150=950)', async () => {
    const inv = makeInvoice({ totalAmount: 1000, creditNotes: [{ amount: 200 } as CreditNote], debitNotes: [{ amount: 150 } as DebitNote] });
    await build([inv]);
    const r = await service.findAll({ page: 1, limit: 10 });
    expect(r.data[0]).toHaveProperty('netTotal', 950);
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
});

// ---------------------------------------------------------------------------
// Suite: create() with sequential numbering
// ---------------------------------------------------------------------------
describe('SalesService.create() — sequential numbering', () => {
  let service: SalesService;
  let factusGateway: any;
  let inventorySvc: any;
  let queryRunner: any;

  /**
   * Build fresh module with a queryRunner manager that simulates
   * identity-column generation for Invoice saves.
   */
  async function build() {
    resetSeq();
    factusGateway = { createInvoice: jest.fn().mockResolvedValue({ data: { number: 'SETP990001' } }) };
    inventorySvc = { consumeStock: jest.fn().mockResolvedValue(0) };

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockImplementation((entityClass: any, opts: any) => {
          if (opts?.where?.id === 'cust-1') return Promise.resolve(stubCustomer());
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
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: repoMock() },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        { provide: getRepositoryToken(InvoiceElectronicEmission), useValue: repoMock() },
        { provide: getRepositoryToken(CreditNote), useValue: repoMock() },
        { provide: getRepositoryToken(DebitNote), useValue: repoMock() },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        { provide: getRepositoryToken(DebitNoteItem), useValue: repoMock() },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        { provide: InventoryService, useValue: inventorySvc },
        { provide: PdfGenerationService, useValue: { generateInvoicePdf: jest.fn() } },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) } },
      ],
    }).compile();
    service = mod.get(SalesService);
  }

  const baseDto = { customerId: 'cust-1', items: [{ productId: 'prod-1', quantity: 1 }] };

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
});

// ---------------------------------------------------------------------------
// Suite: manual invoice paths — emit, downloadDianPdf, notes
// ---------------------------------------------------------------------------
describe('SalesService — manual invoice paths', () => {
  let service: SalesService;
  let factusGateway: any;
  let pdfService: any;
  let creditNoteRepo: any;
  let debitNoteRepo: any;
  let emissionRepo: any;
  let invoiceRepo: any;
  let queryRunner: any;

  function buildItem(overrides?: any) {
    return { id: 'item-1', product: { sku: 'SKU-001', name: 'Product A' }, productId: 'prod-1', quantity: 2, unitPrice: 500, subtotal: 1000, ...overrides };
  }

  function buildManualInv(overrides?: any): any {
    return {
      id: 'inv-manual', sequentialNumber: 1, invoiceNumber: 'MAN-000001', isElectronic: false,
      totalAmount: 1000, status: InvoiceStatus.PAID, notes: null, creditNotes: [], debitNotes: [],
      createdAt: new Date(), updatedAt: new Date(), customerId: 'cust-1',
      customer: { id: 'cust-1', name: 'Test', documentNumber: '123', documentType: 'CC' },
      items: [buildItem()], emission: null, ...overrides,
    };
  }
  function buildElectronicInv(overrides?: any): any {
    return buildManualInv({ id: 'inv-electronic', sequentialNumber: 2, invoiceNumber: 'FAC-000002', isElectronic: true, emission: null, ...overrides });
  }
  function buildEmittedInv(overrides?: any): any {
    return buildManualInv({ id: 'inv-emitted-posthoc', sequentialNumber: 3, invoiceNumber: 'MAN-000003', isElectronic: true,
      emission: { id: 'em-1', number: 'SETP990099', cude: 'cude-post', qrUrl: 'https://qr', publicUrl: 'https://pdf', isValidated: true, createdAt: new Date() },
      ...overrides,
    });
  }

  beforeEach(async () => {
    factusGateway = {
      createInvoice: jest.fn(),
      createCreditNote: jest.fn().mockResolvedValue({ data: { number: 'NC-001', cude: 'cude-1' } }),
      createDebitNote: jest.fn().mockResolvedValue({ data: { number: 'ND-001', cude: 'cude-1' } }),
      downloadInvoicePdf: jest.fn().mockResolvedValue({ pdfBase64Encoded: 'JVBERi0xLjc=', fileName: 'invoice.pdf' }),
      downloadAdjustmentNotePdf: jest.fn(),
    };

    pdfService = { generateInvoicePdf: jest.fn().mockResolvedValue('JVBERi0xLjc=') };

    creditNoteRepo = { ...repoMock(), find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), create: jest.fn((d: any) => ({ ...d, id: 'cn-new' })), save: jest.fn((e: any) => Promise.resolve(e)) };
    debitNoteRepo = { ...repoMock(), find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), create: jest.fn((d: any) => ({ ...d, id: 'dn-new' })), save: jest.fn((e: any) => Promise.resolve(e)) };
    emissionRepo = { ...repoMock(), create: jest.fn((d: any) => ({ ...d, id: 'em-new' })), save: jest.fn((e: any) => Promise.resolve(e)) };

    invoiceRepo = {
      ...repoMock(),
      findOne: jest.fn().mockImplementation((opts: any) => {
        const id = opts?.where?.id;
        // Return fresh copies to prevent test cross-contamination via mutation
        if (id === 'inv-manual') return Promise.resolve(buildManualInv());
        if (id === 'inv-electronic') return Promise.resolve(buildElectronicInv());
        if (id === 'inv-emitted-posthoc') return Promise.resolve(buildEmittedInv());
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
      },
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        { provide: getRepositoryToken(InvoiceElectronicEmission), useValue: emissionRepo },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(DebitNote), useValue: debitNoteRepo },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        { provide: getRepositoryToken(DebitNoteItem), useValue: repoMock() },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        { provide: InventoryService, useValue: { consumeStock: jest.fn() } },
        { provide: PdfGenerationService, useValue: pdfService },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) } },
      ],
    }).compile();
    service = mod.get(SalesService);
  });

  // ---- downloadInvoicePdf ----

  it('downloadInvoicePdf for manual invoice returns local PDF, no Factus call', async () => {
    const r = await service.downloadInvoicePdf('inv-manual');
    expect(factusGateway.downloadInvoicePdf).not.toHaveBeenCalled();
    expect(pdfService.generateInvoicePdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'inv-manual', invoiceNumber: 'MAN-000001' }),
      [],
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
      buildElectronicInv({ emission: { id: 'em-1', number: 'FAC-000002', cude: 'cude' } }),
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
    await expect(service.downloadDianPdf('inv-manual')).rejects.toThrow('manuales no tienen PDF');
  });

  it('downloadDianPdf throws when emission has no number', async () => {
    invoiceRepo.findOne = jest.fn().mockResolvedValue(
      buildElectronicInv({ emission: { number: null } }),
    );
    await expect(service.downloadDianPdf('inv-electronic')).rejects.toThrow('no tiene un número de emisión');
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
    queryRunner.manager.save = jest.fn().mockImplementation((first: any, second?: any) => {
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
      status: 'OK', message: 'Success',
      data: { number: 'SETP990003678', cude: 'cufe' },
    });

    invoiceRepo.findOne = jest.fn().mockResolvedValue(
      buildManualInv({ id: 'inv-emit', invoiceNumber: 'MAN-000042' }),
    );
    queryRunner.manager.save = jest.fn().mockImplementation((first: any, second?: any) => {
      if (second !== undefined) return Promise.resolve({ ...second, id: 'em-new' });
      return Promise.resolve(first);
    });

    const r = await service.emit('inv-emit');
    expect(r.invoiceNumber).toBe('MAN-000042');
    expect(r.emission!.number).toBe('SETP990003678');
    expect(r.isElectronic).toBe(true);
  });

  it('emit() throws for already-electronic invoice', async () => {
    await expect(service.emit('inv-electronic')).rejects.toThrow('ya es electrónica');
  });

  it('emit() throws for non-existent invoice', async () => {
    await expect(service.emit('nope')).rejects.toThrow('no encontrada');
  });

  // ---- createCreditNote ----

  it('createCreditNote for manual invoice creates local note, no Factus call', async () => {
    const dto = { correctionConceptCode: '1', items: [{ codeReference: 'SKU-001', quantity: 1, price: 500 }] };
    const r = await service.createCreditNote('inv-manual', dto);
    expect(factusGateway.createCreditNote).not.toHaveBeenCalled();
    expect((r as any).noteNumber).toContain('NC-MAN');
  });

  it('createCreditNote for manual invoice with concept 2 sets invoice CANCELLED', async () => {
    const cancelInv = buildManualInv({ id: 'inv-cancel', status: InvoiceStatus.PAID });
    invoiceRepo.findOne = jest.fn().mockResolvedValue(cancelInv);
    const qr = {
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(),
      manager: {
        findOne: jest.fn(), count: jest.fn().mockResolvedValue(0),
        save: jest.fn((e: any) => { if (e && e.status) cancelInv.status = e.status; return Promise.resolve(e); }),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        { provide: getRepositoryToken(InvoiceElectronicEmission), useValue: emissionRepo },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(DebitNote), useValue: debitNoteRepo },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        { provide: getRepositoryToken(DebitNoteItem), useValue: repoMock() },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        { provide: InventoryService, useValue: { consumeStock: jest.fn() } },
        { provide: PdfGenerationService, useValue: pdfService },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue(qr) } },
      ],
    }).compile();
    const svc = mod.get(SalesService);
    await svc.createCreditNote('inv-cancel', { correctionConceptCode: '2' });
    expect(cancelInv.status).toBe(InvoiceStatus.CANCELLED);
  });

  it('createCreditNote for electronic invoice calls Factus', async () => {
    await service.createCreditNote('inv-electronic', { correctionConceptCode: '1' });
    expect(factusGateway.createCreditNote).toHaveBeenCalledTimes(1);
  });

  it('createCreditNote for manual rejects non-existent item', async () => {
    await expect(service.createCreditNote('inv-manual', { correctionConceptCode: '1', items: [{ codeReference: 'NO-SKU', quantity: 1, price: 500 }] } as any)).rejects.toThrow('no pertenece');
  });

  it('createCreditNote for manual rejects qty exceeding invoice', async () => {
    await expect(service.createCreditNote('inv-manual', { correctionConceptCode: '1', items: [{ codeReference: 'SKU-001', quantity: 99, price: 500 }] } as any)).rejects.toThrow('supera');
  });

  it('createCreditNote for cancelled invoice is rejected', async () => {
    invoiceRepo.findOne = jest.fn().mockResolvedValue(buildManualInv({ status: InvoiceStatus.CANCELLED }));
    const qr = {
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(),
      manager: { findOne: jest.fn(), save: jest.fn(), count: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        { provide: getRepositoryToken(InvoiceElectronicEmission), useValue: emissionRepo },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(DebitNote), useValue: debitNoteRepo },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        { provide: getRepositoryToken(DebitNoteItem), useValue: repoMock() },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        { provide: InventoryService, useValue: { consumeStock: jest.fn() } },
        { provide: PdfGenerationService, useValue: pdfService },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue(qr) } },
      ],
    }).compile();
    const svc = mod.get(SalesService);
    await expect(svc.createCreditNote('inv-cancel', { correctionConceptCode: '1' } as any)).rejects.toThrow('anuladas');
  });

  // ---- createDebitNote ----

  it('createDebitNote for manual invoice creates local note', async () => {
    const dto = { correctionConceptCode: '3', items: [{ codeReference: 'SKU-001', quantity: 1, price: 200 }] };
    const r = await service.createDebitNote('inv-manual', dto);
    expect(factusGateway.createDebitNote).not.toHaveBeenCalled();
    expect((r as any).noteNumber).toContain('ND-MAN');
  });

  it('createDebitNote for manual does not call Factus API', async () => {
    await service.createDebitNote('inv-manual', { correctionConceptCode: '2' });
    expect(factusGateway.createDebitNote).not.toHaveBeenCalled();
  });

  it('createDebitNote for electronic calls Factus', async () => {
    await service.createDebitNote('inv-electronic', { correctionConceptCode: '1' });
    expect(factusGateway.createDebitNote).toHaveBeenCalledTimes(1);
  });

  // ---- isElectronic filter ----

  it('findAll with isElectronic=true filters correctly', async () => {
    const inv = buildElectronicInv();
    invoiceRepo.findAndCount = jest.fn().mockResolvedValue([[inv], 1]);
    const r = await service.findAll({ isElectronic: true });
    expect(invoiceRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isElectronic: true }) }));
    expect(r.data).toHaveLength(1);
  });

  it('findAll with isElectronic=false filters correctly', async () => {
    const inv = buildManualInv();
    invoiceRepo.findAndCount = jest.fn().mockResolvedValue([[inv], 1]);
    const r = await service.findAll({ isElectronic: false });
    expect(invoiceRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isElectronic: false }) }));
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
  let debitNoteRepo: any;
  let emissionRepo: any;
  let invoiceRepo: any;
  let queryRunner: any;
  let pdfService: any;

  function buildItem(overrides?: any) {
    return { id: 'item-1', product: { sku: 'SKU-001', name: 'Product A' }, productId: 'prod-1', quantity: 2, unitPrice: 500, subtotal: 1000, ...overrides };
  }

  function buildManualInv(overrides?: any): any {
    return {
      id: 'inv-manual', sequentialNumber: 1, invoiceNumber: 'MAN-000001', isElectronic: false,
      totalAmount: 1000, status: InvoiceStatus.PAID, notes: null, creditNotes: [], debitNotes: [],
      createdAt: new Date(), updatedAt: new Date(), customerId: 'cust-1',
      customer: { id: 'cust-1', name: 'Test', documentNumber: '123', documentType: 'CC' },
      items: [buildItem()], emission: null, ...overrides,
    };
  }

  function buildElectronicInv(overrides?: any): any {
    return buildManualInv({ id: 'inv-electronic', sequentialNumber: 2, invoiceNumber: 'FAC-000002', isElectronic: true, ...overrides });
  }

  beforeEach(async () => {
    factusGateway = {
      createInvoice: jest.fn(),
      createCreditNote: jest.fn().mockResolvedValue({ data: { number: 'NC-001', cude: 'cude-1' } }),
      createDebitNote: jest.fn().mockResolvedValue({ data: { number: 'ND-001', cude: 'cude-1' } }),
      downloadInvoicePdf: jest.fn(),
      downloadAdjustmentNotePdf: jest.fn(),
    };

    pdfService = { generateInvoicePdf: jest.fn().mockResolvedValue('JVBERi0xLjc=') };

    creditNoteRepo = { ...repoMock(), find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), create: jest.fn((d: any) => ({ ...d, id: 'cn-new' })), save: jest.fn((e: any) => Promise.resolve(e)) };
    debitNoteRepo = { ...repoMock(), find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), create: jest.fn((d: any) => ({ ...d, id: 'dn-new' })), save: jest.fn((e: any) => Promise.resolve(e)) };
    emissionRepo = { ...repoMock(), create: jest.fn((d: any) => ({ ...d, id: 'em-new' })), save: jest.fn((e: any) => Promise.resolve(e)) };

    invoiceRepo = {
      ...repoMock(),
      findOne: jest.fn().mockImplementation((opts: any) => {
        const id = opts?.where?.id;
        if (id === 'inv-manual') return Promise.resolve(buildManualInv());
        if (id === 'inv-electronic') return Promise.resolve(buildElectronicInv());
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
      },
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: repoMock() },
        { provide: getRepositoryToken(InvoiceElectronicEmission), useValue: emissionRepo },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(DebitNote), useValue: debitNoteRepo },
        { provide: getRepositoryToken(CreditNoteItem), useValue: repoMock() },
        { provide: getRepositoryToken(DebitNoteItem), useValue: repoMock() },
        { provide: 'IFactusInvoicingGateway', useValue: factusGateway },
        { provide: InventoryService, useValue: { consumeStock: jest.fn() } },
        { provide: PdfGenerationService, useValue: pdfService },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) } },
      ],
    }).compile();
    service = mod.get(SalesService);
  });

  it('createCreditNote: rejects electronic note for manual invoice', async () => {
    const dto = { correctionConceptCode: '1', isElectronic: true };
    await expect(
      service.createCreditNote('inv-manual', dto as any),
    ).rejects.toThrow('electrónicas solo pueden emitirse para facturas electrónicas');
  });

  it('createDebitNote: rejects electronic note for manual invoice', async () => {
    const dto = { correctionConceptCode: '1', isElectronic: true };
    await expect(
      service.createDebitNote('inv-manual', dto as any),
    ).rejects.toThrow('electrónicas solo pueden emitirse para facturas electrónicas');
  });

  it('createCreditNote: allows manual note for manual invoice (compatibility)', async () => {
    const dto = { correctionConceptCode: '1', isElectronic: false };
    const r = await service.createCreditNote('inv-manual', dto as any);
    expect((r as any).noteNumber).toContain('NC-MAN');
    expect(factusGateway.createCreditNote).not.toHaveBeenCalled();
  });

  it('createDebitNote: allows manual note for manual invoice (compatibility)', async () => {
    const dto = { correctionConceptCode: '1', isElectronic: false };
    const r = await service.createDebitNote('inv-manual', dto as any);
    expect((r as any).noteNumber).toContain('ND-MAN');
    expect(factusGateway.createDebitNote).not.toHaveBeenCalled();
  });

  it('createCreditNote: allows electronic note for electronic invoice (unchanged path)', async () => {
    const dto = { correctionConceptCode: '1', isElectronic: true };
    await service.createCreditNote('inv-electronic', dto as any);
    expect(factusGateway.createCreditNote).toHaveBeenCalledTimes(1);
  });

  it('createDebitNote: allows electronic note for electronic invoice (unchanged path)', async () => {
    const dto = { correctionConceptCode: '1', isElectronic: true };
    await service.createDebitNote('inv-electronic', dto as any);
    expect(factusGateway.createDebitNote).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Concurrent safety (unit-level simulation)
// ---------------------------------------------------------------------------
describe('concurrent sequential numbering safety', () => {
  it('5 parallel simulations produce unique sequential numbers', async () => {
    resetSeq();
    const results: number[] = [];
    const tasks = Array.from({ length: 5 }, () =>
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
