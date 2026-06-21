import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Customer, CustomerStatus } from './entities/customer.entity';
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
});
