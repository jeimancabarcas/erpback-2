import { PdfGenerationService } from './pdf-generation.service';

function makeInvoice(overrides: any = {}): any {
  return {
    id: 'inv-1',
    invoiceNumber: 'MAN-00000001',
    date: new Date('2026-06-01'),
    customerId: 'cust-1',
    customer: {
      id: 'cust-1',
      name: 'Cliente Prueba',
      documentNumber: '123456789',
      documentType: 'CC',
    },
    totalAmount: 1000,
    status: 'PAID',
    isElectronic: false,
    notes: null,
    items: [
      {
        id: 'item-1',
        product: { sku: 'SKU-001', name: 'Producto A' },
        quantity: 2,
        unitPrice: 500,
        subtotal: 1000,
      },
    ],
    creditNotes: [],
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
    ...overrides,
  };
}

function textToHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex');
}

describe('PdfGenerationService', () => {
  let service: PdfGenerationService;

  beforeEach(() => {
    service = new PdfGenerationService();
  });

  it('generates a valid base64 PDF with PDF header and EOF marker', async () => {
    const invoice = makeInvoice();
    const result = await service.generateInvoicePdf(invoice, []);

    expect(typeof result).toBe('string');

    const decoded = Buffer.from(result, 'base64').toString('latin1');
    expect(decoded.startsWith('%PDF-')).toBe(true);
    expect(decoded.includes('%%EOF')).toBe(true);
  });

  it('contains invoice number as hex-encoded text', async () => {
    const invoice = makeInvoice({ invoiceNumber: 'MAN-00000001' });
    const result = await service.generateInvoicePdf(invoice, [], false);

    const decoded = Buffer.from(result, 'base64').toString('latin1');
    expect(decoded.includes(textToHex('MAN-00000001'))).toBe(true);
  });

  it('contains customer info as hex-encoded text', async () => {
    const invoice = makeInvoice();
    const result = await service.generateInvoicePdf(invoice, [], false);

    const decoded = Buffer.from(result, 'base64').toString('latin1');
    expect(decoded.includes(textToHex('Cliente'))).toBe(true);
  });

  it('includes credit note data when notes are provided', async () => {
    const invoice = makeInvoice();
    // Use NC-MAN-inv (the actual noteNumber from makeCreditNote default)
    const creditNotes = [
      {
        id: 'cn-1',
        referenceCode: 'NC-REF-1',
        noteNumber: 'NC-MAN-001',
        cude: null,
        correctionConceptCode: '1',
        amount: 200,
        observation: null,
        qrUrl: null,
        publicUrl: null,
        invoiceId: 'inv-1',
        invoice: invoice,
        items: [],
        createdAt: new Date('2026-06-02'),
        updatedAt: new Date('2026-06-02'),
      },
    ];
    const result = await service.generateInvoicePdf(
      invoice,
      creditNotes,
      false,
    );

    const decoded = Buffer.from(result, 'base64').toString('latin1');
    expect(decoded.includes(textToHex('NC-MAN-001'))).toBe(true);
    expect(decoded.includes(textToHex('Notas de Ajuste'))).toBe(true);
  });

  it('shows empty notes message when no notes are applied', async () => {
    const invoice = makeInvoice();
    const result = await service.generateInvoicePdf(invoice, [], false);

    const decoded = Buffer.from(result, 'base64').toString('latin1');
    expect(decoded.includes(textToHex('No se han aplicado'))).toBe(true);
  });

  it('includes correct balance formula values with credit notes only', async () => {
    const invoice = makeInvoice({ totalAmount: 1000 });
    const creditNotes = [
      {
        id: 'cn-1',
        noteNumber: 'NC-1',
        cude: null,
        correctionConceptCode: '1',
        amount: 200,
        observation: null,
        qrUrl: null,
        publicUrl: null,
        invoiceId: 'inv-1',
        invoice: invoice,
        items: [],
        referenceCode: 'NC-R',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const result = await service.generateInvoicePdf(
      invoice,
      creditNotes,
      false,
    );

    const decoded = Buffer.from(result, 'base64').toString('latin1');
    expect(decoded.includes(textToHex('$1,000.00'))).toBe(true);
    expect(decoded.includes(textToHex('$200.00'))).toBe(true);
    expect(decoded.includes(textToHex('$800.00'))).toBe(true);
  });

  it('includes product names for all items', async () => {
    const invoice = makeInvoice({
      items: [
        {
          product: { name: 'Producto A' },
          quantity: 2,
          unitPrice: 500,
          subtotal: 1000,
        },
        {
          product: { name: 'Producto B' },
          quantity: 3,
          unitPrice: 100,
          subtotal: 300,
        },
      ],
    });
    const result = await service.generateInvoicePdf(invoice, [], false);

    const decoded = Buffer.from(result, 'base64').toString('latin1');
    expect(decoded.includes(textToHex('Producto A'))).toBe(true);
    expect(decoded.includes(textToHex('Producto B'))).toBe(true);
  });

  it('includes section headers as hex in uncompressed stream', async () => {
    const invoice = makeInvoice();
    const result = await service.generateInvoicePdf(invoice, [], false);

    const decoded = Buffer.from(result, 'base64').toString('latin1');
    // Search for parts that appear as single hex chunks (pdfkit may split words with kerning)
    expect(decoded.includes(textToHex('oductos'))).toBe(true);
    expect(decoded.includes(textToHex('otal'))).toBe(true);
  });
});
