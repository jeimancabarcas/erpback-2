import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CustomersCreditService } from './customers-credit.service';
import { Customer, CreditStatus } from './entities/customer.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { Invoice, InvoiceStatus } from '../sales/entities/invoice.entity';

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
      const customer = makeCustomer({ creditLimit: 5000000, currentBalance: 1000000 });
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
      mockCustomerRepository.save.mockResolvedValue({ ...customer, creditLimit: 5000000 });

      const result = await service.setCreditLimit('cust-1', { creditLimit: 5000000 });

      expect(mockCustomerRepository.save).toHaveBeenCalled();
      expect(result.creditLimit).toBe(5000000);
    });

    it('should clear creditLimit when null is sent', async () => {
      const customer = makeCustomer({ creditLimit: 5000000 });
      mockCustomerRepository.findOne.mockResolvedValue(customer);
      mockCustomerRepository.save.mockResolvedValue({ ...customer, creditLimit: null });

      const result = await service.setCreditLimit('cust-1', { creditLimit: null });

      expect(result.creditLimit).toBeNull();
    });
  });

  describe('recordPayment', () => {
    it('should create a payment record and reduce customer balance', async () => {
      const customer = makeCustomer({ currentBalance: 2000000 });
      const invoice = {
        id: 'inv-1',
        totalAmount: 1000000,
        status: InvoiceStatus.ON_CREDIT,
      } as Invoice;

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
        totalAmount: 1000000,
        status: InvoiceStatus.ON_CREDIT,
      } as Invoice;

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
        totalAmount: 1200000,
        status: InvoiceStatus.ON_CREDIT,
      } as Invoice;

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
      mockPaymentRecordRepository.find.mockResolvedValue(records);

      const result = await service.getPaymentHistory('cust-1');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(500000);
      expect(mockPaymentRecordRepository.find).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
        relations: ['invoice'],
        order: { paymentDate: 'DESC' },
      });
    });
  });
});
