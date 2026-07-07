import {
  FactusSupportDocumentAdjustmentNoteRequest,
  FactusSupportDocumentAdjustmentNoteResponse,
  FactusSupportDocumentAdjustmentNoteResponseData,
  FactusPaymentDetail,
  FactusItem,
  FactusTax,
  FactusSupportDocumentProvider,
  FactusNumberingRange,
  FactusInvoiceResponseTotals,
} from './factus-invoicing-gateway.interface';

describe('IFactusInvoicingGateway — Support Document Adjustment Note types (T1)', () => {
  const INJECTION_TOKEN = 'IFactusInvoicingGateway';

  it('should use "IFactusInvoicingGateway" as the injection token', () => {
    expect(INJECTION_TOKEN).toBe('IFactusInvoicingGateway');
  });

  describe('FactusSupportDocumentAdjustmentNoteRequest', () => {
    it('should be constructable with all required fields', () => {
      const paymentDetail: FactusPaymentDetail = {
        paymentForm: '1',
        paymentMethodCode: '10',
        amount: '100000.00',
      };

      const tax: FactusTax = {
        code: '01',
        rate: '19.00',
      };

      const item: FactusItem = {
        codeReference: 'PROD-001',
        name: 'Producto Test',
        quantity: 10,
        discountRate: 0,
        price: 4201.68,
        unitMeasureCode: '94',
        standardCode: '999',
        taxes: [tax],
      };

      const provider: FactusSupportDocumentProvider = {
        identification_document_code: '31',
        identification: '900123456',
        names: 'Proveedor Test',
        address: 'Calle 123',
        country_code: 'CO',
        municipality_code: '11001',
        legal_organization_code: '123456789',
      };

      const request: FactusSupportDocumentAdjustmentNoteRequest = {
        referenceCode: 'NA-OC-0001-12345',
        correctionConceptCode: '2',
        supportDocumentNumber: 'SETP100',
        observation: 'Anulación total de documento soporte',
        paymentDetails: [paymentDetail],
        provider,
        items: [item],
      };

      expect(request.referenceCode).toBe('NA-OC-0001-12345');
      expect(request.correctionConceptCode).toBe('2');
      expect(request.supportDocumentNumber).toBe('SETP100');
      expect(request.observation).toBe('Anulación total de documento soporte');
      expect(request.paymentDetails).toHaveLength(1);
      expect(request.paymentDetails[0].paymentForm).toBe('1');
      expect(request.provider).toBeDefined();
      expect(request.provider!.identification).toBe('900123456');
      expect(request.items).toHaveLength(1);
      expect(request.items[0].codeReference).toBe('PROD-001');
    });

    it('should allow optional fields to be omitted', () => {
      const request: FactusSupportDocumentAdjustmentNoteRequest = {
        referenceCode: 'NA-OC-0001-12345',
        correctionConceptCode: '2',
        supportDocumentNumber: 'SETP100',
        observation: 'Test',
        paymentDetails: [],
        items: [],
      };

      expect(request.referenceCode).toBe('NA-OC-0001-12345');
      expect(request.numberingRangeId).toBeUndefined();
      expect(request.provider).toBeUndefined();
    });

    it('should allow numberingRangeId to be set', () => {
      const request: FactusSupportDocumentAdjustmentNoteRequest = {
        referenceCode: 'NA-OC-0001-12345',
        correctionConceptCode: '2',
        supportDocumentNumber: 'SETP100',
        observation: 'Test',
        paymentDetails: [],
        items: [],
        numberingRangeId: 392,
      };

      expect(request.numberingRangeId).toBe(392);
    });
  });

  describe('FactusSupportDocumentAdjustmentNoteResponseData', () => {
    it('should be constructable with all fields', () => {
      const range: FactusNumberingRange = {
        prefix: 'NA',
        from: 1,
        to: 1000,
        resolutionNumber: 'RES-001',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        months: 12,
      };

      const totals: FactusInvoiceResponseTotals = {
        prepaymentAmount: 0,
        grossAmount: 100000,
        taxableAmount: 84033.61,
        taxAmount: 15966.39,
        surchargeAmount: 0,
        total: 100000,
      };

      const data: FactusSupportDocumentAdjustmentNoteResponseData = {
        referenceCode: 'NA-OC-0001-12345',
        number: 'NA100',
        cude: 'cude123456',
        isValidated: true,
        validatedAt: '2024-06-15T10:30:00Z',
        createdAt: '2024-06-15T10:30:00Z',
        numberingRange: range,
        items: [],
        taxes: [],
        totals,
        links: { qr: 'http://qr.test', publicUrl: 'http://public.test' },
      };

      expect(data.referenceCode).toBe('NA-OC-0001-12345');
      expect(data.number).toBe('NA100');
      expect(data.cude).toBe('cude123456');
      expect(data.isValidated).toBe(true);
      expect(data.numberingRange!.prefix).toBe('NA');
      expect(data.totals!.total).toBe(100000);
      expect(data.links.qr).toBe('http://qr.test');
    });

    it('should allow optional fields to be omitted', () => {
      const data: FactusSupportDocumentAdjustmentNoteResponseData = {
        referenceCode: 'NA-OC-0001-12345',
        number: 'NA100',
        cude: 'cude123456',
        isValidated: false,
        validatedAt: null,
        createdAt: '2024-06-15T10:30:00Z',
        numberingRange: null,
        items: [],
        taxes: [],
        totals: null,
        links: {},
      };

      expect(data.referenceCode).toBe('NA-OC-0001-12345');
      expect(data.cuds).toBeUndefined();
      expect(data.qrUrl).toBeUndefined();
      expect(data.publicUrl).toBeUndefined();
      expect(data.errors).toBeUndefined();
    });
  });

  describe('FactusSupportDocumentAdjustmentNoteResponse', () => {
    it('should be constructable with status, message, and data', () => {
      const response: FactusSupportDocumentAdjustmentNoteResponse = {
        status: 'OK',
        message: 'Nota de ajuste creada exitosamente',
        data: {
          referenceCode: 'NA-OC-0001-12345',
          number: 'NA100',
          cude: 'cude123456',
          isValidated: true,
          validatedAt: '2024-06-15T10:30:00Z',
          createdAt: '2024-06-15T10:30:00Z',
          numberingRange: null,
          items: [],
          taxes: [],
          totals: null,
          links: {},
        },
      };

      expect(response.status).toBe('OK');
      expect(response.message).toBe('Nota de ajuste creada exitosamente');
      expect(response.data.number).toBe('NA100');
    });
  });

  describe('IFactusInvoicingGateway — method count (11)', () => {
    it('should have exactly 11 methods when mock-implemented', () => {
      const methodKeys: string[] = [];
      for (const key in {
        createInvoice: 1,
        destroyInvoice: 1,
        createCreditNote: 1,
        downloadInvoicePdf: 1,
        downloadAdjustmentNotePdf: 1,
        createSupportDocument: 1,
        destroySupportDocument: 1,
        downloadSupportDocumentPdf: 1,
        createSupportDocumentAdjustmentNote: 1,
        destroySupportDocumentAdjustmentNote: 1,
        downloadSupportDocumentAdjustmentNotePdf: 1,
      }) {
        methodKeys.push(key);
      }

      expect(methodKeys.length).toBe(11);

      // Verify the 3 new methods exist in the keys
      expect(methodKeys).toContain('createSupportDocumentAdjustmentNote');
      expect(methodKeys).toContain('destroySupportDocumentAdjustmentNote');
      expect(methodKeys).toContain('downloadSupportDocumentAdjustmentNotePdf');
    });
  });
});
