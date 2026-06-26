import { Test, TestingModule } from '@nestjs/testing';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryBillsDto } from './dto/query-bills.dto';
import { QueryCreditNotesDto } from './dto/query-credit-notes.dto';

describe('FinanceController (Tasks 3.5-3.6)', () => {
  let controller: FinanceController;
  let mockFinanceService: {
    getBills: jest.Mock;
    getCreditNotes: jest.Mock;
  };

  beforeEach(async () => {
    mockFinanceService = {
      getBills: jest.fn(),
      getCreditNotes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        {
          provide: FinanceService,
          useValue: mockFinanceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FinanceController>(FinanceController);
  });

  describe('GET /finance/bills', () => {
    it('should call service.getBills with query params', async () => {
      const dto: QueryBillsDto = {
        page: 1,
        perPage: 10,
        identification: '123',
        status: '1',
      };
      mockFinanceService.getBills.mockResolvedValue({
        data: [],
        meta: { page: 1, lastPage: 0, limit: 10, total: 0 },
      });

      const result = await controller.getBills(dto);

      expect(mockFinanceService.getBills).toHaveBeenCalledWith(dto);
      expect(result.meta.page).toBe(1);
    });

    it('should propagate gateway errors as 5xx', async () => {
      const dto: QueryBillsDto = {};
      mockFinanceService.getBills.mockRejectedValue(
        new Error('HTTP 502: Bad Gateway'),
      );

      await expect(controller.getBills(dto)).rejects.toThrow('HTTP 502');
    });

    it('should return data and meta in response', async () => {
      const dto: QueryBillsDto = {};
      mockFinanceService.getBills.mockResolvedValue({
        data: [
          {
            id: 'REF-001',
            number: 'FAC-001',
            clientName: 'Test',
            clientIdentification: '123',
            total: 500,
            status: '1',
            createdAt: '2024-01-01T00:00:00Z',
            type: 'bill',
          },
        ],
        meta: { total: 1, page: 1, lastPage: 1, limit: 10 },
      });

      const result = await controller.getBills(dto);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('bill');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('GET /finance/credit-notes', () => {
    it('should call service.getCreditNotes with query params', async () => {
      const dto: QueryCreditNotesDto = { page: 1, perPage: 10 };
      mockFinanceService.getCreditNotes.mockResolvedValue({
        data: [],
        meta: { page: 1, lastPage: 0, limit: 10, total: 0 },
      });

      const result = await controller.getCreditNotes(dto);

      expect(mockFinanceService.getCreditNotes).toHaveBeenCalledWith(dto);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('JwtAuthGuard', () => {
    it('should have JwtAuthGuard applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', FinanceController);
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);
    });
  });
});