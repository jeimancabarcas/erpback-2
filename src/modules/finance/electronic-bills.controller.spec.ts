import { Test, TestingModule } from '@nestjs/testing';
import { ElectronicBillsController } from './electronic-bills.controller';
import { ElectronicBillsService } from './electronic-bills.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateElectronicBillDto } from './dto/create-electronic-bill.dto';
import { QueryElectronicBillsDto } from './dto/query-electronic-bills.dto';

describe('ElectronicBillsController', () => {
  let controller: ElectronicBillsController;
  let mockService: {
    create: jest.Mock;
    findAll: jest.Mock;
  };

  beforeEach(async () => {
    mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ElectronicBillsController],
      providers: [
        {
          provide: ElectronicBillsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ElectronicBillsController>(ElectronicBillsController);
  });

  describe('POST /finance/electronic-bills', () => {
    it('should call service.create and return 201', async () => {
      const dto: CreateElectronicBillDto = {
        customer: {
          identification: '123456789',
          names: 'Test Customer',
        },
        items: [
          {
            codeReference: 'SKU-001',
            name: 'Product A',
            quantity: 2,
            price: 50000,
          },
        ],
      };

      mockService.create.mockResolvedValue({
        id: 'em-1',
        number: 'SETP990001',
        status: 'emitted',
      });

      const result = await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(dto);
      expect(result.status).toBe('emitted');
      expect(result.number).toBe('SETP990001');
    });

    it('should propagate service errors', async () => {
      const dto: CreateElectronicBillDto = {
        customer: { identification: '123', names: 'Test' },
        items: [{ codeReference: 'SKU', name: 'P', quantity: 1, price: 100 }],
      };

      mockService.create.mockRejectedValue(new Error('Factus error'));

      await expect(controller.create(dto)).rejects.toThrow('Factus error');
    });
  });

  describe('GET /finance/electronic-bills', () => {
    it('should call service.findAll with query params', async () => {
      const query: QueryElectronicBillsDto = { page: 2, perPage: 5 };

      mockService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 2, lastPage: 0, limit: 5, total: 0 },
      });

      const result = await controller.findAll(query);

      expect(mockService.findAll).toHaveBeenCalledWith(query);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
    });

    it('should return paginated data from service', async () => {
      const query: QueryElectronicBillsDto = { page: 1, perPage: 10 };

      mockService.findAll.mockResolvedValue({
        data: [
          {
            id: 'em-1',
            number: 'SETP990001',
            status: 'emitted',
            cufe: 'cufe-abc',
            invoiceId: null,
            createdAt: new Date(),
          },
        ],
        meta: { total: 1, page: 1, lastPage: 1, limit: 10 },
      });

      const result = await controller.findAll(query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('emitted');
    });

    it('should have JwtAuthGuard applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', ElectronicBillsController);
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);
    });
  });
});
