import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FactusHttpInvoicingAdapter } from './factus-http-invoicing.adapter';
import type { FactusSupportDocumentAdjustmentNoteRequest } from '../interfaces/factus-invoicing-gateway.interface';

describe('FactusHttpInvoicingAdapter — Support Document Adjustment Note (T2)', () => {
  let adapter: FactusHttpInvoicingAdapter;
  let mockAuthGateway: { getAccessToken: jest.Mock };
  let mockConfigService: { get: jest.Mock };
  let capturedUrls: string[];
  let capturedPayloads: any[];

  function setupFetchMock(responseBody?: any, ok = true) {
    capturedUrls = [];
    capturedPayloads = [];

    const defaultBody = {
      status: 'OK',
      message: 'Nota de ajuste creada exitosamente',
      data: {
        reference_code: 'NA-OC-0001-12345',
        number: 'NA100',
        cude: 'cude123456',
        is_validated: true,
        validated_at: '2024-06-15T10:30:00Z',
        created_at: '2024-06-15T10:30:00Z',
        numbering_range: null,
        items: [],
        taxes: [],
        totals: null,
        links: {},
      },
    };

    (global.fetch as jest.Mock) = jest
      .fn()
      .mockImplementation((url: string, options?: any) => {
        capturedUrls.push(url);
        if (options?.body) {
          capturedPayloads.push(JSON.parse(options.body));
        }
        if (!ok) {
          return {
            ok: false,
            status: 400,
            statusText: 'Error',
            text: () => JSON.stringify(responseBody || defaultBody),
          };
        }
        return {
          ok: true,
          json: () => responseBody || defaultBody,
        };
      });
  }

  async function createAdapter(): Promise<void> {
    mockAuthGateway = {
      getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue('https://api.factus.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FactusHttpInvoicingAdapter,
        {
          provide: 'IFactusAuthGateway',
          useValue: mockAuthGateway,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    adapter = module.get<FactusHttpInvoicingAdapter>(
      FactusHttpInvoicingAdapter,
    );
  }

  beforeEach(async () => {
    jest.restoreAllMocks();
    await createAdapter();
  });

  describe('createSupportDocumentAdjustmentNote', () => {
    const minimalRequest: FactusSupportDocumentAdjustmentNoteRequest = {
      referenceCode: 'NA-OC-0001-12345',
      correctionConceptCode: '2',
      supportDocumentNumber: 'SETP100',
      observation: 'Anulación total',
      paymentDetails: [
        {
          paymentForm: '1',
          paymentMethodCode: '10',
          amount: '100000.00',
        },
      ],
      items: [
        {
          codeReference: 'PROD-001',
          name: 'Producto Test',
          quantity: 10,
          discountRate: 0,
          price: 4201.68,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes: [{ code: '01', rate: '19.00' }],
        },
      ],
    };

    it('should POST to /v1/adjustment-notes/support-documents/validate', async () => {
      setupFetchMock();
      await adapter.createSupportDocumentAdjustmentNote(minimalRequest);

      // First URL is numbering-ranges lookup, second is the adjust
      const validateUrl = capturedUrls.find((u) =>
        u.includes('/v1/adjustment-notes/support-documents/validate'),
      );
      expect(validateUrl).toBeDefined();
      expect(validateUrl).toContain(
        'https://api.factus.com/v1/adjustment-notes/support-documents/validate',
      );
    });

    it('should map camelCase request to snake_case payload', async () => {
      setupFetchMock();
      await adapter.createSupportDocumentAdjustmentNote(minimalRequest);

      const payload = capturedPayloads[0];
      expect(payload.reference_code).toBe('NA-OC-0001-12345');
      expect(payload.correction_concept_code).toBe('2');
      expect(payload.support_document_number).toBe('SETP100');
      expect(payload.payment_details[0].payment_form).toBe('1');
      expect(payload.items[0].code_reference).toBe('PROD-001');
      expect(payload.items[0].taxes[0].code).toBe('01');
    });

    it('should include provider when provided', async () => {
      setupFetchMock();
      const requestWithProvider: FactusSupportDocumentAdjustmentNoteRequest = {
        ...minimalRequest,
        provider: {
          identification_document_code: '31',
          identification: '900123456',
          names: 'Proveedor Test',
          address: 'Calle 123',
          country_code: 'CO',
          municipality_code: '11001',
          legal_organization_code: '123456789',
        },
      };

      await adapter.createSupportDocumentAdjustmentNote(requestWithProvider);

      const payload = capturedPayloads[0];
      expect(payload.provider).toBeDefined();
      expect(payload.provider.identification).toBe('900123456');
    });

    it('should omit provider when not provided', async () => {
      setupFetchMock();
      const request: FactusSupportDocumentAdjustmentNoteRequest = {
        referenceCode: 'NA-001',
        correctionConceptCode: '2',
        supportDocumentNumber: 'SETP100',
        observation: 'Test',
        paymentDetails: [],
        items: [],
      };

      await adapter.createSupportDocumentAdjustmentNote(request);

      const payload = capturedPayloads[0];
      expect(payload.provider).toBeUndefined();
    });

    it('should return mapped response with cude', async () => {
      setupFetchMock();
      const result =
        await adapter.createSupportDocumentAdjustmentNote(minimalRequest);

      expect(result.status).toBe('OK');
      expect(result.data.referenceCode).toBe('NA-OC-0001-12345');
      expect(result.data.number).toBe('NA100');
      expect(result.data.cude).toBe('cude123456');
    });

    it('should error when Factus API fails', async () => {
      setupFetchMock({ message: 'Validation error' }, false);

      await expect(
        adapter.createSupportDocumentAdjustmentNote(minimalRequest),
      ).rejects.toThrow();
    });
  });

  describe('destroySupportDocumentAdjustmentNote', () => {
    it('should DELETE to /v1/adjustment-notes/support-documents/reference/{code}', async () => {
      setupFetchMock({
        status: 'ok',
        message: 'Eliminada',
      });

      await adapter.destroySupportDocumentAdjustmentNote('NA-001');

      expect(capturedUrls[0]).toContain(
        'https://api.factus.com/v1/adjustment-notes/support-documents/reference/NA-001',
      );
    });

    it('should URL-encode special characters in reference code', async () => {
      setupFetchMock({
        status: 'ok',
        message: 'Eliminada',
      });

      await adapter.destroySupportDocumentAdjustmentNote('NA-001/ABC');

      expect(capturedUrls[0]).toContain(
        'https://api.factus.com/v1/adjustment-notes/support-documents/reference/NA-001%2FABC',
      );
    });

    it('should return status and message from response', async () => {
      setupFetchMock({
        status: 'ok',
        message: 'Nota de ajuste eliminada correctamente',
      });

      const result =
        await adapter.destroySupportDocumentAdjustmentNote('NA-001');

      expect(result.status).toBe('ok');
      expect(result.message).toBe('Nota de ajuste eliminada correctamente');
    });
  });

  describe('downloadSupportDocumentAdjustmentNotePdf', () => {
    it('should GET /v2/adjustment-notes/{number}/download-pdf', async () => {
      setupFetchMock({
        data: {
          pdf_base_64_encoded: 'JVBERi0x',
          file_name: 'nota-ajuste.pdf',
        },
      });

      await adapter.downloadSupportDocumentAdjustmentNotePdf('NA100');

      expect(capturedUrls[0]).toContain(
        'https://api.factus.com/v2/adjustment-notes/NA100/download-pdf',
      );
    });

    it('should extract pdfBase64Encoded and fileName from nested data', async () => {
      setupFetchMock({
        data: {
          pdf_base_64_encoded: 'JVBERi0xLjcK',
          file_name: 'nota-ajuste.pdf',
        },
      });

      const result =
        await adapter.downloadSupportDocumentAdjustmentNotePdf('NA100');

      expect(result.pdfBase64Encoded).toBe('JVBERi0xLjcK');
      expect(result.fileName).toBe('nota-ajuste.pdf');
    });

    it('should handle response without nested data wrapper', async () => {
      setupFetchMock({
        pdf_base_64_encoded: 'JVBERi0x',
        file_name: 'nota.pdf',
      });

      const result =
        await adapter.downloadSupportDocumentAdjustmentNotePdf('NA100');

      expect(result.pdfBase64Encoded).toBe('JVBERi0x');
      expect(result.fileName).toBe('nota.pdf');
    });
  });
});
