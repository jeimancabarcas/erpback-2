import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FactusHttpQueryAdapter } from './factus-http-query.adapter';

describe('FactusHttpQueryAdapter (Tasks 2.1-2.5)', () => {
  let adapter: FactusHttpQueryAdapter;
  let mockAuthGateway: { getAccessToken: jest.Mock };
  let mockConfigService: { get: jest.Mock };

  // Track URLs that fetch would have called
  let capturedUrls: string[];

  // Default fetch mock that can be overridden per test
  function setupFetchMock(overrides?: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    responseBody?: any;
  }) {
    const opts = overrides || {};
    const ok = opts.ok !== undefined ? opts.ok : true;
    const status = opts.status || 200;
    const responseBody = opts.responseBody || {
      status: 'OK',
      data: {
        data: [],
        pagination: { total: 0, current_page: 1, last_page: 0, per_page: 10 },
      },
    };

    (global.fetch as jest.Mock) = jest
      .fn()
      .mockImplementation(async (url: string) => {
        capturedUrls.push(url);
        if (!ok) {
          return {
            ok: false,
            status,
            statusText: opts.statusText || 'Error',
            text: async () => JSON.stringify(responseBody),
          };
        }
        return {
          ok: true,
          json: async () => responseBody,
        };
      });
  }

  async function createAdapter(): Promise<FactusHttpQueryAdapter> {
    mockAuthGateway = {
      getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue('https://api.factus.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FactusHttpQueryAdapter,
        { provide: 'IFactusAuthGateway', useValue: mockAuthGateway },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    return module.get<FactusHttpQueryAdapter>(FactusHttpQueryAdapter);
  }

  beforeEach(async () => {
    capturedUrls = [];
    setupFetchMock();
    adapter = await createAdapter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Task 2.1 — Query string builder
  // -----------------------------------------------------------------------

  describe('Task 2.1: Query string builder', () => {
    it('should send only page=1&filter[per_page]=10 when no filters provided', async () => {
      await adapter.listBills({});

      expect(capturedUrls.length).toBe(1);
      const url = capturedUrls[0];
      const queryString = url.split('?')[1];
      expect(queryString).toContain('page=1');
      expect(queryString).toContain('filter[per_page]=10');
    });

    it('should include all filter params when all are populated', async () => {
      await adapter.listBills({
        identification: '123456',
        names: 'Juan Perez',
        number: 'FAC-001',
        status: '1',
        createdAtStart: '2024-01-01',
        createdAtEnd: '2024-12-31',
        page: 2,
        perPage: 20,
      });

      expect(capturedUrls.length).toBe(1);
      const queryString = capturedUrls[0].split('?')[1];

      expect(queryString).toContain('filter[identification]=123456');
      expect(queryString).toContain('filter[names]=Juan%20Perez');
      expect(queryString).toContain('filter[number]=FAC-001');
      expect(queryString).toContain('filter[status]=1');
      expect(queryString).toContain(
        'filter[created_at][start_date]=2024-01-01',
      );
      expect(queryString).toContain('filter[created_at][end_date]=2024-12-31');
      expect(queryString).toContain('filter[per_page]=20');
      expect(queryString).toContain('page=2');
    });

    it('should omit filter params that are not provided', async () => {
      await adapter.listBills({
        identification: '123456',
        names: 'Juan Perez',
        // number, status, dates omitted on purpose
      });

      expect(capturedUrls.length).toBe(1);
      const queryString = capturedUrls[0].split('?')[1];

      expect(queryString).toContain('filter[identification]=123456');
      expect(queryString).toContain('filter[names]=Juan%20Perez');
      expect(queryString).not.toContain('filter[number]');
      expect(queryString).not.toContain('filter[status]');
      expect(queryString).not.toContain('filter[created_at]');
    });

    it('should apply defaults (page=1, perPage=10) for missing pagination params', async () => {
      await adapter.listBills({ identification: '123' });

      const queryString = capturedUrls[0].split('?')[1];
      expect(queryString).toContain('page=1');
      expect(queryString).toContain('filter[per_page]=10');
    });

    it('should build query string for credit notes endpoint', async () => {
      await adapter.listCreditNotes({ status: '0' });

      expect(capturedUrls.length).toBe(1);
      const url = capturedUrls[0];
      expect(url).toContain('/v2/credit-notes');
      expect(url).toContain('filter[status]=0');
    });
  });

  // -----------------------------------------------------------------------
  // Task 2.3 — Pagination mapping, empty data, error throwing
  // -----------------------------------------------------------------------

  describe('Task 2.3: Pagination and error handling', () => {
    it('should map Factus snake_case pagination to PaginatedFactusResponse camelCase meta', async () => {
      const factusResponse = {
        status: 'OK',
        data: {
          data: [
            {
              id: 1,
              number: 'FAC-001',
              reference_code: 'REF-001',
              created_at: '2024-06-01T00:00:00Z',
              status: '1',
              total: 1000,
              customer: { identification: '123', names: 'Test' },
            },
          ],
          pagination: {
            current_page: 2,
            last_page: 5,
            per_page: 10,
            total: 50,
          },
        },
      };

      setupFetchMock({ responseBody: factusResponse });
      adapter = await createAdapter();

      const result = await adapter.listBills({ page: 2, perPage: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].number).toBe('FAC-001');
      expect(result.meta).toEqual({
        page: 2,
        lastPage: 5,
        limit: 10,
        total: 50,
      });
    });

    it('should return empty data array when Factus returns no results', async () => {
      const factusResponse = {
        status: 'OK',
        data: {
          data: [],
          pagination: { total: 0, current_page: 1, last_page: 0, per_page: 10 },
        },
      };

      setupFetchMock({ responseBody: factusResponse });
      adapter = await createAdapter();

      const result = await adapter.listBills({});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
    });

    it('should throw typed error with format "HTTP {status}: {body}" on non-2xx response', async () => {
      const errorBody = { error: 'Token expirado' };

      setupFetchMock({
        ok: false,
        status: 401,
        responseBody: errorBody,
      });
      adapter = await createAdapter();

      await expect(adapter.listBills({})).rejects.toThrow(
        'HTTP 401: {"error":"Token expirado"}',
      );
    });

    it('should fetch access token before each HTTP call', async () => {
      await adapter.listBills({});
      expect(mockAuthGateway.getAccessToken).toHaveBeenCalledTimes(1);
    });

    it('should throw error when Factus API returns 500', async () => {
      setupFetchMock({
        ok: false,
        status: 500,
        responseBody: { message: 'Internal server error' },
      });
      adapter = await createAdapter();

      await expect(adapter.listCreditNotes({})).rejects.toThrow('HTTP 500');
    });
  });
});
