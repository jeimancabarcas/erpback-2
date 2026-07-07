import {
  IFactusQueryGateway,
  BillQueryFilters,
  CreditNoteQueryFilters,
  PaginatedFactusResponse,
  FactusBill,
  FactusCreditNote,
} from './factus-query-gateway.interface';

describe('IFactusQueryGateway (Task 1.1)', () => {
  const INJECTION_TOKEN = 'IFactusQueryGateway';

  it('should use "IFactusQueryGateway" as the injection token', () => {
    expect(INJECTION_TOKEN).toBe('IFactusQueryGateway');
  });

  it('should allow creating a mock implementation of IFactusQueryGateway', () => {
    const mock: IFactusQueryGateway = {
      listBills: jest.fn(),
      listCreditNotes: jest.fn(),
    };

    expect(mock.listBills).toBeDefined();
    expect(mock.listCreditNotes).toBeDefined();
  });

  it('should return PaginatedFactusResponse<FactusBill> from listBills', async () => {
    const mock: IFactusQueryGateway = {
      listBills: jest.fn().mockResolvedValue({
        data: [],
        meta: { page: 1, lastPage: 0, limit: 10, total: 0 },
      }),
      listCreditNotes: jest.fn(),
    };

    const result: PaginatedFactusResponse<FactusBill> = await mock.listBills({
      page: 1,
      perPage: 10,
    });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toHaveProperty('page', 1);
    expect(result.meta).toHaveProperty('lastPage', 0);
    expect(result.meta).toHaveProperty('limit', 10);
    expect(result.meta).toHaveProperty('total', 0);
  });

  it('should return PaginatedFactusResponse<FactusCreditNote> from listCreditNotes', async () => {
    const mock: IFactusQueryGateway = {
      listBills: jest.fn(),
      listCreditNotes: jest.fn().mockResolvedValue({
        data: [],
        meta: { page: 1, lastPage: 0, limit: 10, total: 0 },
      }),
    };

    const result: PaginatedFactusResponse<FactusCreditNote> =
      await mock.listCreditNotes({ page: 1, perPage: 10 });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toHaveProperty('total', 0);
  });

  it('should allow BillQueryFilters with all optional fields', () => {
    const filters: BillQueryFilters = {
      identification: '123',
      names: 'Test',
      number: 'FAC-001',
      status: '1',
      createdAtStart: '2024-01-01',
      createdAtEnd: '2024-12-31',
      page: 2,
      perPage: 20,
    };

    expect(filters.identification).toBe('123');
    expect(filters.names).toBe('Test');
    expect(filters.number).toBe('FAC-001');
    expect(filters.status).toBe('1');
    expect(filters.createdAtStart).toBe('2024-01-01');
    expect(filters.createdAtEnd).toBe('2024-12-31');
    expect(filters.page).toBe(2);
    expect(filters.perPage).toBe(20);
  });

  it('should allow BillQueryFilters with no properties (all optional)', () => {
    const filters: BillQueryFilters = {};
    expect(filters).toBeDefined();
    expect(filters.page).toBeUndefined();
    expect(filters.perPage).toBeUndefined();
  });
});
