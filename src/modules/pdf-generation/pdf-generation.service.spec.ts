import { PdfGenerationService } from './pdf-generation.service';
import { PaymentReceiptDto } from '../customers/dto/payment-receipt.dto';

function makeInvoice(overrides: any = {}): any {
  return {
    id: 'inv-1',
    sequentialNumber: 1,

    date: new Date('2026-06-01'),
    customerId: 'cust-1',
    customer: {
      id: 'cust-1',
      name: 'Cliente Prueba',
      documentNumber: '123456789',
      documentType: 'CC',
    },
    status: 'PAID',
    notes: null,
    items: [
      {
        id: 'item-1',
        product: { sku: 'SKU-001', name: 'Producto A', sellingPrice: 500 },
        quantity: 2,
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
    const invoice = makeInvoice({ sequentialNumber: 1 });
    const result = await service.generateInvoicePdf(invoice, [], false);

    const decoded = Buffer.from(result, 'base64').toString('latin1');
    expect(decoded.includes(textToHex('MAN-000001'))).toBe(true);
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
    const invoice = makeInvoice({
      items: [{ product: { sellingPrice: 500 }, quantity: 2, id: 'item-1' }],
    });
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
    // totalAmount = 2 * 500 = 1000
    expect(decoded.includes(textToHex('$1,000.00'))).toBe(true);
    expect(decoded.includes(textToHex('$200.00'))).toBe(true);
    expect(decoded.includes(textToHex('$800.00'))).toBe(true);
  });

  it('includes product names for all items', async () => {
    const invoice = makeInvoice({
      items: [
        {
          product: { name: 'Producto A', sellingPrice: 500 },
          quantity: 2,
        },
        {
          product: { name: 'Producto B', sellingPrice: 100 },
          quantity: 3,
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

  describe('generatePaymentReceiptPdf', () => {
    function makeReceiptDto(
      overrides: Partial<PaymentReceiptDto> = {},
    ): PaymentReceiptDto {
      return {
        paymentId: 'pay-1',
        paymentAmount: 400000,
        paymentDate: new Date('2026-06-15'),
        paymentNotes: 'Pago parcial quincena 1',
        invoiceId: 'inv-1',
        invoiceNumber: 'MAN-000001',
        invoiceStatus: 'ON_CREDIT',
        invoiceTotal: 1000000,
        invoiceSubtotal: 850000,
        invoiceDate: new Date('2026-06-01'),
        installments: null,
        paymentFrequency: null,
        dueDate: null,
        invoiceItems: [
          {
            productName: 'Producto A',
            quantity: 2,
            unitPrice: 500,
            subtotal: 1000,
          },
          {
            productName: 'Producto B',
            quantity: 3,
            unitPrice: 100,
            subtotal: 300,
          },
        ],
        allInvoicePayments: [
          {
            id: 'pay-2',
            amount: 300000,
            paymentDate: new Date('2026-07-01'),
            notes: null,
            isCurrentPayment: false,
          },
          {
            id: 'pay-1',
            amount: 400000,
            paymentDate: new Date('2026-06-15'),
            notes: 'Pago parcial quincena 1',
            isCurrentPayment: true,
          },
          {
            id: 'pay-3',
            amount: 300000,
            paymentDate: new Date('2026-06-01'),
            notes: null,
            isCurrentPayment: false,
          },
        ],
        remainingBalance: 600000,
        customerId: 'cust-1',
        customerName: 'Juan Pérez',
        customerDocument: '123456789',
        ...overrides,
      };
    }

    it('should generate a valid base64 PDF string (BR-9)', async () => {
      const receipt = makeReceiptDto();
      const result = await service.generatePaymentReceiptPdf(receipt);

      expect(typeof result).toBe('string');
      const decoded = Buffer.from(result, 'base64').toString('latin1');
      expect(decoded.startsWith('%PDF-')).toBe(true);
      expect(decoded.includes('%%EOF')).toBe(true);
    });

    it('should contain "Recibo de Pago" header text', async () => {
      const receipt = makeReceiptDto();
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      // pdfkit splits "Recibo de Pago" into hex chunks with kerning; search for partial
      expect(decoded.includes(textToHex('Recibo'))).toBe(true);
    });

    it('should contain invoice number and customer info', async () => {
      const receipt = makeReceiptDto();
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      expect(decoded.includes(textToHex('MAN-000001'))).toBe(true);
      // "uan" appears as a contiguous hex chunk from "Juan"
      expect(decoded.includes(textToHex('uan'))).toBe(true);
      expect(decoded.includes(textToHex('123456789'))).toBe(true);
    });

    it('should contain invoice items table with product names and amounts', async () => {
      const receipt = makeReceiptDto();
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      expect(decoded.includes(textToHex('Producto'))).toBe(true);
      expect(decoded.includes(textToHex('1,000'))).toBe(true);
      expect(decoded.includes(textToHex('300'))).toBe(true);
    });

    it('should contain payment history with current payment highlighted', async () => {
      const receipt = makeReceiptDto();
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      expect(decoded.includes(textToHex('Historial'))).toBe(true);
      expect(decoded.includes(textToHex('recibo'))).toBe(true);
    });

    it('should contain remaining balance summary', async () => {
      const receipt = makeReceiptDto({ remainingBalance: 600000 });
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      expect(decoded.includes(textToHex('Saldo'))).toBe(true);
      expect(decoded.includes(textToHex('600,000.00'))).toBe(true);
    });

    it('should contain payment notes section', async () => {
      const receipt = makeReceiptDto({
        paymentNotes: 'Pago parcial quincena 1',
      });
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      expect(decoded.includes(textToHex('Notas'))).toBe(true);
      expect(decoded.includes(textToHex('parcial'))).toBe(true);
    });

    it('should handle large amounts in summary', async () => {
      const receipt = makeReceiptDto({
        remainingBalance: 450000,
        invoiceTotal: 1000000,
      });
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      expect(decoded.includes(textToHex('1,000,000.00'))).toBe(true);
      expect(decoded.includes(textToHex('450,000.00'))).toBe(true);
    });

    it('should show payment terms section with installments and frequency', async () => {
      const receipt = makeReceiptDto({
        installments: 3,
        paymentFrequency: 'MONTHLY',
        dueDate: new Date('2026-09-01'),
      });
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      expect(decoded.includes(textToHex('Plazo'))).toBe(true);
      expect(decoded.includes(textToHex('Mensual'))).toBe(true);
      expect(decoded.includes(textToHex('3 cuota'))).toBe(true);
    });

    it('should show due date in payment terms section', async () => {
      const receipt = makeReceiptDto({
        installments: 1,
        paymentFrequency: 'WEEKLY',
        dueDate: new Date('2026-10-15T12:00:00.000Z'),
      });
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      // pdfkit splits "V" from "encimiento:" with kerning offset, so we search for the contiguous part
      expect(decoded.includes(textToHex('encimien'))).toBe(true);
      expect(decoded.includes(textToHex('octubre'))).toBe(true);
    });

    it('should handle null installments and frequency gracefully', async () => {
      const receipt = makeReceiptDto({
        installments: null,
        paymentFrequency: null,
        dueDate: null,
      });
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      expect(decoded.includes(textToHex('Plazo'))).toBe(true);
    });

    it('should show "Pagada" for fully paid invoices', async () => {
      const receipt = makeReceiptDto({
        invoiceStatus: 'PAID',
        remainingBalance: 0,
        allInvoicePayments: [
          {
            id: 'pay-1',
            amount: 1000000,
            paymentDate: new Date('2026-06-15'),
            notes: null,
            isCurrentPayment: true,
          },
        ],
      });
      const result = await service.generatePaymentReceiptPdf(receipt, false);

      const decoded = Buffer.from(result, 'base64').toString('latin1');
      // pdfkit splits "Pagada" as <50> + <61> + <67616461> (P/a/gada)
      expect(decoded.includes(textToHex('gada'))).toBe(true);
    });
  });
});
