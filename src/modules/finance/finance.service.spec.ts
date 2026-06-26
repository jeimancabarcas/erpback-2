import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';

describe('FinanceService (Tasks 3.1-3.4)', () => {
  let service: FinanceService;
  let mockQueryGateway: {
    listBills: jest.Mock;
    listCreditNotes: jest.Mock;
  };

  beforeEach(async () => {
    mockQueryGateway = {
      listBills: jest.fn(),
      listCreditNotes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: 'IFactusQueryGateway',
          useValue: mockQueryGateway,
        },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  // -----------------------------------------------------------------------
  // Task 3.1 — FinanceService: DTO mapping, response transformation
  // -----------------------------------------------------------------------

  describe('getBills', () => {
    it('should map QueryBillsDto fields to BillQueryFilters', async () => {
      mockQueryGateway.listBills.mockResolvedValue({
        data: [],
        meta: { page: 1, lastPage: 0, limit: 10, total: 0 },
      });

      await service.getBills({
        identification: '123',
        names: 'Juan',
        number: 'FAC-001',
        status: '1',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        page: 2,
        perPage: 20,
      });

      expect(mockQueryGateway.listBills).toHaveBeenCalledWith({
        identification: '123',
        names: 'Juan',
        number: 'FAC-001',
        status: '1',
        createdAtStart: '2024-01-01',
        createdAtEnd: '2024-12-31',
        page: 2,
        perPage: 20,
      });
    });

    it('should map FactusBill to FinanceDocumentDto with type "bill"', async () => {
      mockQueryGateway.listBills.mockResolvedValue({
        data: [
          {
            id: 1,
            number: 'FAC-001',
            reference_code: 'REF-001',
            created_at: '2024-06-01T00:00:00Z',
            status: '1',
            total: 500000,
            customer: { identification: '123456789', names: 'Juan Perez' },
          },
        ],
        meta: { page: 1, lastPage: 1, limit: 10, total: 1 },
      });

      const result = await service.getBills({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'REF-001',
        number: 'FAC-001',
        clientName: 'Juan Perez',
        clientIdentification: '123456789',
        total: 500000,
        status: '1',
        createdAt: '2024-06-01T00:00:00Z',
        type: 'bill',
      });
    });

    it('should preserve pagination metadata in result', async () => {
      mockQueryGateway.listBills.mockResolvedValue({
        data: [],
        meta: { page: 2, lastPage: 5, limit: 10, total: 50 },
      });

      const result = await service.getBills({ page: 2, perPage: 10 });

      expect(result.meta).toEqual({
        page: 2,
        lastPage: 5,
        limit: 10,
        total: 50,
      });
    });

    it('should propagate gateway errors', async () => {
      mockQueryGateway.listBills.mockRejectedValue(
        new Error('HTTP 401: Token expirado'),
      );

      await expect(service.getBills({})).rejects.toThrow(
        'HTTP 401: Token expirado',
      );
    });
  });

  describe('getCreditNotes', () => {
    it('should map FactusCreditNote to FinanceDocumentDto with type "credit-note"', async () => {
      mockQueryGateway.listCreditNotes.mockResolvedValue({
        data: [
          {
            id: 1,
            number: 'NC-001',
            reference_code: 'REF-NC-001',
            created_at: '2024-07-01T00:00:00Z',
            status: '0',
            total: 100000,
            customer: { identification: '987654321', names: 'Maria Lopez' },
          },
        ],
        meta: { page: 1, lastPage: 1, limit: 10, total: 1 },
      });

      const result = await service.getCreditNotes({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'REF-NC-001',
        number: 'NC-001',
        clientName: 'Maria Lopez',
        clientIdentification: '987654321',
        total: 100000,
        status: '0',
        createdAt: '2024-07-01T00:00:00Z',
        type: 'credit-note',
      });
    });

    it('should preserve status values "0" and "1" as-is from Factus API', async () => {
      mockQueryGateway.listCreditNotes.mockResolvedValue({
        data: [
          {
            id: 1,
            number: 'NC-001',
            reference_code: 'REF-1',
            created_at: '2024-01-01T00:00:00Z',
            status: '0',
            total: 100,
            customer: { identification: '123', names: 'A' },
          },
          {
            id: 2,
            number: 'NC-002',
            reference_code: 'REF-2',
            created_at: '2024-01-02T00:00:00Z',
            status: '1',
            total: 200,
            customer: { identification: '456', names: 'B' },
          },
        ],
        meta: { page: 1, lastPage: 1, limit: 10, total: 2 },
      });

      const result = await service.getCreditNotes({});

      expect(result.data[0].status).toBe('0');
      expect(result.data[1].status).toBe('1');
    });

    it('should map QueryCreditNotesDto fields to CreditNoteQueryFilters', async () => {
      mockQueryGateway.listCreditNotes.mockResolvedValue({
        data: [],
        meta: { page: 1, lastPage: 0, limit: 10, total: 0 },
      });

      await service.getCreditNotes({
        identification: '987',
        status: '0',
        page: 3,
        perPage: 5,
      });

      expect(mockQueryGateway.listCreditNotes).toHaveBeenCalledWith({
        identification: '987',
        status: '0',
        page: 3,
        perPage: 5,
      });
    });
  });

  describe('param defaults', () => {
    it('should default page to 1 and perPage to 10 when omitted', async () => {
      mockQueryGateway.listBills.mockResolvedValue({
        data: [],
        meta: { page: 1, lastPage: 0, limit: 10, total: 0 },
      });

      await service.getBills({});

      expect(mockQueryGateway.listBills).toHaveBeenCalledWith({
        page: 1,
        perPage: 10,
      });
    });
  });
});