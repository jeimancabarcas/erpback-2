import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Customer, CustomerStatus, CreditStatus } from './entities/customer.entity';
import { Invoice } from '../sales/entities/invoice.entity';
import { ILike } from 'typeorm';
import { QueryCustomersDto } from './dto/query-customers.dto';

describe('CustomersService', () => {
  let service: CustomersService;

  const mockCustomerRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockInvoiceRepository = {
    createQueryBuilder: jest.fn(),
  };

  function makeCustomer(overrides: Partial<Customer> = {}): Customer {
    return {
      id: 'cust-1',
      name: 'Test',
      email: 'test@test.com',
      documentType: 'CC' as any,
      documentNumber: '12345',
      status: CustomerStatus.ACTIVE,
      phone: null,
      address: null,
      creditLimit: 5000000,
      currentBalance: 1000000,
      paymentTermsDays: 30,
      creditStatus: CreditStatus.GOOD,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepository,
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: mockInvoiceRepository,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
  });

  describe('findAll with search parameter (TDD)', () => {
    it('should query customer repository with ILike OR conditions on name and documentNumber, and filter by ACTIVE status', async () => {
      const queryDto: QueryCustomersDto = {
        search: 'Juan',
        page: 1,
        limit: 10,
      };

      mockCustomerRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(queryDto);

      expect(mockCustomerRepository.findAndCount).toHaveBeenCalledWith({
        where: [
          { name: ILike('%Juan%'), status: CustomerStatus.ACTIVE },
          { documentNumber: ILike('%Juan%'), status: CustomerStatus.ACTIVE },
        ],
        order: { name: 'ASC' },
        take: 10,
        skip: 0,
      });
    });

    it('should respect custom status if provided alongside search', async () => {
      const queryDto: QueryCustomersDto = {
        search: '12345',
        status: CustomerStatus.INACTIVE,
        page: 1,
        limit: 10,
      };

      mockCustomerRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(queryDto);

      expect(mockCustomerRepository.findAndCount).toHaveBeenCalledWith({
        where: [
          { name: ILike('%12345%'), status: CustomerStatus.INACTIVE },
          { documentNumber: ILike('%12345%'), status: CustomerStatus.INACTIVE },
        ],
        order: { name: 'ASC' },
        take: 10,
        skip: 0,
      });
    });
  });

  describe('getStats with credit fields', () => {
    it('should include creditLimit, currentBalance, and creditStatus in stats response', async () => {
      const customer = makeCustomer({ creditLimit: 5000000, currentBalance: 1000000 });
      mockCustomerRepository.findOne.mockResolvedValue(customer);
      mockInvoiceRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ invoiceCount: '2', totalInvoiced: '1500000' }),
      });

      const result = await service.getStats('cust-1');

      expect(result).toMatchObject({
        creditLimit: 5000000,
        currentBalance: 1000000,
        creditStatus: 'GOOD',
        paymentTermsDays: 30,
        totalInvoiced: 1500000,
        invoiceCount: 2,
      });
    });

    it('should return null creditLimit when customer has no credit limit', async () => {
      const customer = makeCustomer({ creditLimit: null, currentBalance: 0 });
      mockCustomerRepository.findOne.mockResolvedValue(customer);
      mockInvoiceRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ invoiceCount: '0', totalInvoiced: '0' }),
      });

      const result = await service.getStats('cust-1');

      expect(result.creditLimit).toBeNull();
      expect(result.currentBalance).toBe(0);
    });
  });
});
