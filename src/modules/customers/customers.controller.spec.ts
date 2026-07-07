import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomersCreditService } from './customers-credit.service';
import { PdfGenerationService } from '../pdf-generation/pdf-generation.service';
import { PaymentReceiptDto } from './dto/payment-receipt.dto';

describe('CustomersController — Receipt Endpoints', () => {
  let controller: CustomersController;

  const mockCustomersService = {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getStats: jest.fn(),
  };

  const mockCreditService = {
    getCreditPortfolio: jest.fn(),
    setCreditLimit: jest.fn(),
    recordPayment: jest.fn(),
    getPaymentHistory: jest.fn(),
    getPaymentReceipt: jest.fn(),
  };

  const mockPdfGenerationService = {
    generateInvoicePdf: jest.fn(),
    generatePaymentReceiptPdf: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: CustomersService, useValue: mockCustomersService },
        { provide: CustomersCreditService, useValue: mockCreditService },
        { provide: PdfGenerationService, useValue: mockPdfGenerationService },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
  });

  describe('GET :id/payments/:paymentId/receipt', () => {
    it('should call getPaymentReceipt and return the DTO', async () => {
      const mockDto: PaymentReceiptDto = {
        paymentId: 'pay-1',
        paymentAmount: 400000,
        paymentDate: new Date('2026-06-15'),
        paymentNotes: 'Test',
        invoiceId: 'inv-1',
        invoiceNumber: 'MAN-000001',
        invoiceStatus: 'ON_CREDIT',
        invoiceTotal: 1000000,
        invoiceSubtotal: 850000,
        invoiceDate: new Date('2026-06-01'),
        invoiceItems: [],
        allInvoicePayments: [],
        remainingBalance: 600000,
        customerId: 'cust-1',
        customerName: 'Test',
        customerDocument: '123',
      };
      mockCreditService.getPaymentReceipt.mockResolvedValue(mockDto);

      const result = await controller.getPaymentReceipt('cust-1', 'pay-1');

      expect(mockCreditService.getPaymentReceipt).toHaveBeenCalledWith(
        'cust-1',
        'pay-1',
      );
      expect(result).toEqual(mockDto);
    });
  });

  describe('GET :id/payments/:paymentId/receipt/pdf', () => {
    it('should call PdfGenerationService and return base64 PDF', async () => {
      const mockDto: PaymentReceiptDto = {
        paymentId: 'pay-1',
        paymentAmount: 400000,
        paymentDate: new Date('2026-06-15'),
        paymentNotes: 'Test',
        invoiceId: 'inv-1',
        invoiceNumber: 'MAN-000001',
        invoiceStatus: 'ON_CREDIT',
        invoiceTotal: 1000000,
        invoiceSubtotal: 850000,
        invoiceDate: new Date('2026-06-01'),
        invoiceItems: [],
        allInvoicePayments: [],
        remainingBalance: 600000,
        customerId: 'cust-1',
        customerName: 'Test',
        customerDocument: '123',
      };
      mockCreditService.getPaymentReceipt.mockResolvedValue(mockDto);
      mockPdfGenerationService.generatePaymentReceiptPdf.mockResolvedValue(
        'base64pdfstring',
      );

      const result = await controller.getPaymentReceiptPdf('cust-1', 'pay-1');

      expect(mockCreditService.getPaymentReceipt).toHaveBeenCalledWith(
        'cust-1',
        'pay-1',
      );
      expect(
        mockPdfGenerationService.generatePaymentReceiptPdf,
      ).toHaveBeenCalledWith(mockDto);
      expect(result).toEqual({ pdf: 'base64pdfstring' });
    });
  });
});
