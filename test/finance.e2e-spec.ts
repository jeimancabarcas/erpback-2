import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { JwtAuthGuard } from './../src/modules/auth/guards/jwt-auth.guard';

describe('Finance Endpoints (e2e)', () => {
  let app: INestApplication;

  const mockFactusData = {
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
      {
        id: 2,
        number: 'FAC-002',
        reference_code: 'REF-002',
        created_at: '2024-06-02T00:00:00Z',
        status: '0',
        total: 300000,
        customer: { identification: '987654321', names: 'Maria Lopez' },
      },
    ],
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 2,
  };

  const mockCreditNoteData = {
    data: [
      {
        id: 1,
        number: 'NC-001',
        reference_code: 'REF-NC-001',
        created_at: '2024-07-01T00:00:00Z',
        status: '1',
        total: 100000,
        customer: { identification: '123456789', names: 'Juan Perez' },
      },
    ],
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 1,
  };

  let fetchMock: jest.Mock;

  beforeAll(async () => {
    // Mock global fetch
    fetchMock = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/v2/bills')) {
        return {
          ok: true,
          json: async () => mockFactusData,
        };
      }
      if (url.includes('/v2/credit-notes')) {
        return {
          ok: true,
          json: async () => mockCreditNoteData,
        };
      }
      // For auth token endpoint, return a mock token
      return {
        ok: true,
        json: async () => ({ access_token: 'mock-token' }),
      };
    });

    global.fetch = fetchMock;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Task 4.1 — GET /finance/bills returns 200 with paginated data
  // -----------------------------------------------------------------------

  describe('Task 4.1: GET /finance/bills', () => {
    it('should return 200 with data and meta envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/finance/bills')
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('lastPage');
      expect(response.body.meta).toHaveProperty('limit', 10);
    });

    it('should return mapped FinanceDocumentDto fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/finance/bills')
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        const item = response.body.data[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('number');
        expect(item).toHaveProperty('clientName');
        expect(item).toHaveProperty('clientIdentification');
        expect(item).toHaveProperty('total');
        expect(item).toHaveProperty('status');
        expect(item).toHaveProperty('createdAt');
        expect(item).toHaveProperty('type', 'bill');
      }
    });

    it('should pass filter query params to Factus API', async () => {
      await request(app.getHttpServer())
        .get('/finance/bills')
        .query({ identification: '123', status: '1', page: 1, perPage: 10 })
        .expect(200);

      // Verify the fetch was called with filter params
      const calls = fetchMock.mock.calls.filter((call: any) =>
        String(call[0]).includes('/v2/bills'),
      );
      expect(calls.length).toBeGreaterThan(0);
      const url = String(calls[calls.length - 1][0]);
      expect(url).toContain('filter[identification]=123');
      expect(url).toContain('filter[status]=1');
    });
  });

  // -----------------------------------------------------------------------
  // Task 4.2 — GET /finance/credit-notes returns 200
  // -----------------------------------------------------------------------

  describe('Task 4.2: GET /finance/credit-notes', () => {
    it('should return 200 with paginated credit notes', async () => {
      const response = await request(app.getHttpServer())
        .get('/finance/credit-notes')
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return credit notes with type "credit-note"', async () => {
      const response = await request(app.getHttpServer())
        .get('/finance/credit-notes')
        .query({ page: 1, perPage: 10 })
        .expect(200);

      if (response.body.data.length > 0) {
        expect(response.body.data[0].type).toBe('credit-note');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Task 4.3 — Unauthenticated returns 401
  // -----------------------------------------------------------------------

  describe('Task 4.3: Unauthenticated requests', () => {
    it('should return 401 for GET /finance/bills without valid JWT', async () => {
      // Re-create app WITHOUT JwtAuthGuard override
      const unauthFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      const unauthApp = unauthFixture.createNestApplication();
      await unauthApp.init();

      try {
        await request(unauthApp.getHttpServer())
          .get('/finance/bills')
          .query({ page: 1, perPage: 10 })
          .expect(401);
      } finally {
        await unauthApp.close();
      }
    });

    it('should return 401 for GET /finance/credit-notes without valid JWT', async () => {
      const unauthFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      const unauthApp = unauthFixture.createNestApplication();
      await unauthApp.init();

      try {
        await request(unauthApp.getHttpServer())
          .get('/finance/credit-notes')
          .query({ page: 1, perPage: 10 })
          .expect(401);
      } finally {
        await unauthApp.close();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Task 4.4 — Factus API unreachable returns 5xx
  // -----------------------------------------------------------------------

  describe('Task 4.4: Factus API unreachable', () => {
    it('should return 5xx error when Factus API returns error', async () => {
      // Temporarily make fetch return error for bills
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v2/bills')) {
          return {
            ok: false,
            status: 502,
            text: async () => '{"error":"Bad Gateway"}',
          };
        }
        return originalFetch(url);
      });

      const errorModule: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

      const errorApp = errorModule.createNestApplication();
      await errorApp.init();

      try {
        const response = await request(errorApp.getHttpServer())
          .get('/finance/bills')
          .query({ page: 1, perPage: 10 })
          .expect(500);

        expect(response.body).toHaveProperty('message');
      } finally {
        global.fetch = originalFetch;
        await errorApp.close();
      }
    });
  });
});
