import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CustomersCreditService } from './customers-credit.service';
import { Customer, CreditStatus } from './entities/customer.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { Invoice, InvoiceStatus } from '../sales/entities/invoice.entity';
import {
  PaymentReceiptDto,
  PaymentReceiptItemDto,
  PaymentReceiptPaymentDto,
} from './dto/payment-receipt.dto';

describe('CustomersCreditService', () => {
  let service: CustomersCreditService;

  const mockCustomerRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockPaymentRecordRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  const mockInvoiceRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.manager.save.mockResolvedValue({});
    mockQueryRunner.manager.create.mockImplementation((entity, data) => data);
    mockQueryRunner.manager.findOne.mockResolvedValue(null);
    mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersCreditService,
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepository,
        },
        {
          provide: getRepositoryToken(PaymentRecord),
          useValue: mockPaymentRecordRepository,
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: mockInvoiceRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CustomersCreditService>(CustomersCreditService);
  });

  const makeCustomer = (overrides: Partial<Customer> = {}): Customer => ({
    id: 'cust-1',
    name: 'Test Customer',
    email: 'test@test.com',
    documentType: 'CC' as any,
    documentNumber: '12345',
    status: 'ACTIVE' as any,
    phone: null,
    address: null,
    creditLimit: 5000000,
    currentBalance: 1000000,
    paymentTermsDays: 30,
    creditStatus: CreditStatus.GOOD,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('getCreditPortfolio', () => {
    it('should return portfolio with limit, balance, available credit and utilization', async () => {
      const customer = makeCustomer({
        creditLimit: 5000000,
        currentBalance: 1000000,
      });
      mockCustomerRepository.findOne.mockResolvedValue(customer);

      const result = await service.getCreditPortfolio('cust-1');

      expect(result).toEqual({
        creditLimit: 5000000,
        currentBalance: 1000000,
        availableCredit: 4000000,
        utilizationPercent: 20,
        creditStatus: 'GOOD',
        paymentTermsDays: 30,
      });
    });

    it('should return BLOCKED creditStatus when customer has BLOCKED status', async () => {
      const customer = makeCustomer({ creditStatus: CreditStatus.BLOCKED });
      mockCustomerRepository.findOne.mockResolvedValue(customer);

      const result = await service.getCreditPortfolio('cust-1');

      expect(result.creditStatus).toBe('BLOCKED');
    });

    it('should return null availableCredit and utilizationPercent when no credit limit assigned', async () => {
      const customer = makeCustomer({ creditLimit: null, currentBalance: 0 });
      mockCustomerRepository.findOne.mockResolvedValue(customer);

      const result = await service.getCreditPortfolio('cust-1');

      expect(result.creditLimit).toBeNull();
      expect(result.availableCredit).toBeNull();
      expect(result.utilizationPercent).toBeNull();
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(null);

      await expect(service.getCreditPortfolio('non-existent')).rejects.toThrow(
        'Cliente con ID non-existent no encontrado',
      );
    });
  });

  describe('setCreditLimit', () => {
    it('should update creditLimit and return updated customer', async () => {
      const customer = makeCustomer({ creditLimit: 3000000 });
      mockCustomerRepository.findOne.mockResolvedValue(customer);
      mockCustomerRepository.save.mockResolvedValue({
        ...customer,
        creditLimit: 5000000,
      });

      const result = await service.setCreditLimit('cust-1', {
        creditLimit: 5000000,
      });

      expect(mockCustomerRepository.save).toHaveBeenCalled();
      expect(result.creditLimit).toBe(5000000);
    });

    it('should clear creditLimit when null is sent', async () => {
      const customer = makeCustomer({ creditLimit: 5000000 });
      mockCustomerRepository.findOne.mockResolvedValue(customer);
      mockCustomerRepository.save.mockResolvedValue({
        ...customer,
        creditLimit: null,
      });

      const result = await service.setCreditLimit('cust-1', {
        creditLimit: null,
      });

      expect(result.creditLimit).toBeNull();
    });
  });

  describe('recordPayment', () => {
    it('should create a payment record and reduce customer balance', async () => {
      const customer = makeCustomer({ currentBalance: 2000000 });
      const invoice = {
        id: 'inv-1',
        sequentialNumber: 1,

        status: InvoiceStatus.ON_CREDIT,
        items: [{ quantity: 10, product: { sellingPrice: 100000 } }],
        creditNotes: [],
      } as any;

      mockCustomerRepository.findOne.mockResolvedValue(customer);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(customer);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(invoice);
      mockQueryRunner.manager.createQueryBuilder().getRawOne.mockResolvedValue({
        total: '0',
      });

      const result = await service.recordPayment('cust-1', {
        invoiceId: 'inv-1',
        amount: 500000,
      });

      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(result.newBalance).toBe(1500000);
    });

    it('should reject overpayment exceeding currentBalance', async () => {
      const customer = makeCustomer({ currentBalance: 500000 });
      mockCustomerRepository.findOne.mockResolvedValue(customer);

      await expect(
        service.recordPayment('cust-1', {
          invoiceId: 'inv-1',
          amount: 1000000,
        }),
      ).rejects.toThrow('El pago excede el saldo pendiente');
    });

    it('should transition invoice to PAID when sum of payments >= totalAmount', async () => {
      const customer = makeCustomer({ currentBalance: 1200000 });
      const invoice = {
        id: 'inv-1',
        sequentialNumber: 1,

        status: InvoiceStatus.ON_CREDIT,
        items: [{ quantity: 1, product: { sellingPrice: 1000000 } }],
        creditNotes: [],
      } as any;

      mockCustomerRepository.findOne.mockResolvedValue(customer);
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(customer)
        .mockResolvedValueOnce(invoice);
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '1000000' }),
      });

      const result = await service.recordPayment('cust-1', {
        invoiceId: 'inv-1',
        amount: 1000000,
      });

      expect(result.invoiceStatus).toBe('PAID');
    });

    it('should keep invoice ON_CREDIT for partial payments', async () => {
      const customer = makeCustomer({ currentBalance: 1200000 });
      const invoice = {
        id: 'inv-1',
        sequentialNumber: 1,

        status: InvoiceStatus.ON_CREDIT,
        items: [{ quantity: 10, product: { sellingPrice: 120000 } }],
        creditNotes: [],
      } as any;

      mockCustomerRepository.findOne.mockResolvedValue(customer);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(customer);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(invoice);

      const result = await service.recordPayment('cust-1', {
        invoiceId: 'inv-1',
        amount: 500000,
      });

      expect(result.invoiceStatus).toBe('ON_CREDIT');
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment records for a customer', async () => {
      const records = [
        {
          id: 'rec-1',
          invoiceId: 'inv-1',
          amount: 500000,
          paymentDate: new Date(),
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockPaymentRecordRepository.findAndCount.mockResolvedValue([
        records,
        records.length,
      ]);

      const result = await service.getPaymentHistory('cust-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].amount).toBe(500000);
      expect(mockPaymentRecordRepository.findAndCount).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
        relations: ['invoice'],
        order: { paymentDate: 'DESC' },
        take: 10,
        skip: 0,
      });
    });
  });

  describe('getPaymentReceipt', () => {
    const baseCustomer = {
      id: 'cust-1',
      name: 'Juan Pérez',
      documentType: 'CC',
      documentNumber: '123456789',
      email: 'juan@test.com',
      status: 'ACTIVE',
      phone: null,
      address: null,
      creditLimit: null,
      currentBalance: 0,
      paymentTermsDays: 30,
      creditStatus: 'GOOD',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    const baseInvoice = {
      id: 'inv-1',
      sequentialNumber: 1,
      date: new Date('2026-06-01'),
      status: InvoiceStatus.ON_CREDIT,
      totalAmount: 1000000,
      subtotal: 850000,
      notes: null,
      customerId: 'cust-1',
      customer: baseCustomer,
      items: [
        {
          id: 'item-1',
          product: { name: 'Producto A', sellingPrice: 500 },
          quantity: 2,
          unitPrice: 500,
          subtotal: 1000,
        },
      ],
      creditNotes: [],
      createdAt: new Date('2026-06-01'),
      updatedAt: new Date('2026-06-01'),
    };

    const basePaymentRecord = {
      id: 'pay-1',
      invoiceId: 'inv-1',
      customerId: 'cust-1',
      amount: 400000,
      paymentDate: new Date('2026-06-15'),
      notes: 'Pago parcial',
      createdAt: new Date('2026-06-15'),
      updatedAt: new Date('2026-06-15'),
      invoice: baseInvoice,
    };

    it('should return PaymentReceiptDto for a valid customer and payment (BR-1)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: {
          ...baseInvoice,
          items: [
            {
              id: 'item-1',
              product: { name: 'Producto A', sellingPrice: 500 },
              quantity: 2,
              unitPrice: 500,
              subtotal: 1000,
            },
          ],
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        {
          ...basePaymentRecord,
          id: 'pay-1',
          amount: 400000,
          paymentDate: new Date('2026-06-15'),
        },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');

      expect(result).toBeInstanceOf(Object);
      expect(result.paymentId).toBe('pay-1');
      expect(result.invoiceId).toBe('inv-1');
      expect(result.invoiceNumber).toBe('MAN-000001');
      expect(result.remainingBalance).toBe(600000); // 1,000,000 - 400,000
      expect(result.allInvoicePayments).toHaveLength(1);
      expect(result.allInvoicePayments[0].isCurrentPayment).toBe(true);
      expect(result.customerName).toBe('Juan Pérez');
      expect(result.invoiceItems).toHaveLength(1);
      expect(result.invoiceItems[0].productName).toBe('Producto A');
    });

    it('should throw NotFoundException when customer does not exist (BR-3)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPaymentReceipt('non-existent', 'pay-1'),
      ).rejects.toThrow('Cliente con ID non-existent no encontrado');
    });

    it('should throw NotFoundException when payment does not exist (BR-2)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPaymentReceipt('cust-1', 'non-existent'),
      ).rejects.toThrow('Pago con ID non-existent no encontrado');
    });

    it('should compute remainingBalance = totalAmount - payments for ON_CREDIT invoice (BR-5)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: {
          ...baseInvoice,
          status: InvoiceStatus.ON_CREDIT,
          totalAmount: 1000000,
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 400000 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.remainingBalance).toBe(600000);
    });

    it('should account for credit notes in remainingBalance (BR-5)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      const invoiceWithCredits = {
        ...baseInvoice,
        status: InvoiceStatus.ON_CREDIT,
        totalAmount: 1000000,
        creditNotes: [
          { id: 'cn-1', amount: 100000 },
          { id: 'cn-2', amount: 50000 },
        ],
      };
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: invoiceWithCredits,
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 400000 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      // 1,000,000 - 400,000 - 150,000 = 450,000
      expect(result.remainingBalance).toBe(450000);
    });

    it('should floor remainingBalance at 0 for overpayment (BR-5)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: {
          ...baseInvoice,
          status: InvoiceStatus.ON_CREDIT,
          totalAmount: 1000000,
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 1200000 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.remainingBalance).toBe(0);
    });

    it('should return remainingBalance = 0 for CANCELLED invoices (BR-6)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: { ...baseInvoice, status: InvoiceStatus.CANCELLED },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 0 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.invoiceStatus).toBe(InvoiceStatus.CANCELLED);
      expect(result.remainingBalance).toBe(0);
    });

    it('should return all invoice payments ordered by paymentDate DESC with correct isCurrentPayment flags (BR-7, BR-8)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        id: 'pay-2',
        invoice: {
          ...baseInvoice,
          status: InvoiceStatus.ON_CREDIT,
          totalAmount: 1000000,
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        {
          ...basePaymentRecord,
          id: 'pay-3',
          amount: 200000,
          paymentDate: new Date('2026-07-01'),
        },
        {
          ...basePaymentRecord,
          id: 'pay-2',
          amount: 300000,
          paymentDate: new Date('2026-06-20'),
        },
        {
          ...basePaymentRecord,
          id: 'pay-1',
          amount: 500000,
          paymentDate: new Date('2026-06-01'),
        },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-2');

      expect(result.allInvoicePayments).toHaveLength(3);
      expect(result.allInvoicePayments[0].id).toBe('pay-3');
      expect(result.allInvoicePayments[1].id).toBe('pay-2');
      expect(result.allInvoicePayments[1].isCurrentPayment).toBe(true);
      expect(result.allInvoicePayments[2].id).toBe('pay-1');
      expect(result.allInvoicePayments[2].isCurrentPayment).toBe(false);
    });

    it('should work with PAID invoices showing remainingBalance = 0 (BR-13)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: {
          ...baseInvoice,
          status: InvoiceStatus.PAID,
          totalAmount: 1000000,
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 1000000 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.invoiceStatus).toBe(InvoiceStatus.PAID);
      expect(result.remainingBalance).toBe(0);
    });

    it('should populate installments from invoice (CR-1)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: {
          ...baseInvoice,
          installments: 3,
          paymentFrequency: 'MONTHLY',
          dueDate: new Date('2026-09-01'),
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 400000 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.installments).toBe(3);
    });

    it('should populate paymentFrequency from invoice (CR-1)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: {
          ...baseInvoice,
          installments: 3,
          paymentFrequency: 'MONTHLY',
          dueDate: new Date('2026-09-01'),
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 400000 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.paymentFrequency).toBe('MONTHLY');
    });

    it('should populate dueDate from invoice (CR-1)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: {
          ...baseInvoice,
          installments: 3,
          paymentFrequency: 'MONTHLY',
          dueDate: new Date('2026-09-01'),
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 400000 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.dueDate).toEqual(new Date('2026-09-01'));
    });

    it('should handle null installments when invoice has no payment terms (CR-2)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: {
          ...baseInvoice,
          installments: null,
          paymentFrequency: null,
          dueDate: null,
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 400000 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.installments).toBeNull();
      expect(result.paymentFrequency).toBeNull();
      expect(result.dueDate).toBeNull();
    });

    it('should handle invoice with only 1 payment (BR-15)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        id: 'pay-1',
        invoice: {
          ...baseInvoice,
          status: InvoiceStatus.PAID,
          totalAmount: 500000,
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 500000 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.allInvoicePayments).toHaveLength(1);
      expect(result.allInvoicePayments[0].isCurrentPayment).toBe(true);
      expect(result.allInvoicePayments[0].id).toBe('pay-1');
    });

    it('should handle invoice with many payments (BR-16)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        id: 'pay-4',
        invoice: {
          ...baseInvoice,
          status: InvoiceStatus.ON_CREDIT,
          totalAmount: 2000000,
        },
      });
      const manyPayments = [
        {
          ...basePaymentRecord,
          id: 'pay-5',
          amount: 50000,
          paymentDate: new Date('2026-08-01'),
        },
        {
          ...basePaymentRecord,
          id: 'pay-4',
          amount: 100000,
          paymentDate: new Date('2026-07-15'),
        },
        {
          ...basePaymentRecord,
          id: 'pay-3',
          amount: 150000,
          paymentDate: new Date('2026-07-01'),
        },
        {
          ...basePaymentRecord,
          id: 'pay-2',
          amount: 200000,
          paymentDate: new Date('2026-06-15'),
        },
        {
          ...basePaymentRecord,
          id: 'pay-1',
          amount: 300000,
          paymentDate: new Date('2026-06-01'),
        },
      ];
      mockPaymentRecordRepository.find.mockResolvedValue(manyPayments);

      const result = await service.getPaymentReceipt('cust-1', 'pay-4');
      expect(result.allInvoicePayments).toHaveLength(5);
      expect(
        result.allInvoicePayments.filter((p) => p.isCurrentPayment),
      ).toHaveLength(1);
      expect(result.allInvoicePayments[0].id).toBe('pay-5');
      expect(result.remainingBalance).toBeGreaterThan(0);
    });

    it('should map invoice items correctly (BR-1 items DTO)', async () => {
      mockCustomerRepository.findOne.mockResolvedValue(baseCustomer);
      mockPaymentRecordRepository.findOne.mockResolvedValue({
        ...basePaymentRecord,
        invoice: {
          ...baseInvoice,
          items: [
            {
              id: 'item-1',
              product: { name: 'Producto A', sellingPrice: 500 },
              quantity: 2,
              unitPrice: 500,
              subtotal: 1000,
            },
            {
              id: 'item-2',
              product: { name: 'Producto B', sellingPrice: 100 },
              quantity: 3,
              unitPrice: 100,
              subtotal: 300,
            },
          ],
        },
      });
      mockPaymentRecordRepository.find.mockResolvedValue([
        { ...basePaymentRecord, id: 'pay-1', amount: 1300 },
      ]);

      const result = await service.getPaymentReceipt('cust-1', 'pay-1');
      expect(result.invoiceItems).toHaveLength(2);
      expect(result.invoiceItems[0]).toEqual({
        productName: 'Producto A',
        quantity: 2,
        unitPrice: 500,
        subtotal: 1000,
      });
      expect(result.invoiceItems[1]).toEqual({
        productName: 'Producto B',
        quantity: 3,
        unitPrice: 100,
        subtotal: 300,
      });
    });
  });
});
