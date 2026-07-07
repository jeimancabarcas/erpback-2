import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFactusAuthGateway } from '../interfaces/factus-auth-gateway.interface';
import {
  IFactusInvoicingGateway,
  FactusInvoiceRequest,
  FactusInvoiceResponse,
  FactusCreditNoteRequest,
  FactusCreditNoteResponse,
  FactusSupportDocumentRequest,
  FactusSupportDocumentResponse,
  FactusSupportDocumentAdjustmentNoteRequest,
  FactusSupportDocumentAdjustmentNoteResponse,
} from '../interfaces/factus-invoicing-gateway.interface';

@Injectable()
export class FactusHttpInvoicingAdapter implements IFactusInvoicingGateway {
  private readonly logger = new Logger(FactusHttpInvoicingAdapter.name);

  constructor(
    @Inject('IFactusAuthGateway')
    private readonly authGateway: any,
    private readonly configService: ConfigService,
  ) {}

  private async makeGetRequest(endpoint: string): Promise<any> {
    const baseUrl = this.configService.get<string>('FACTUS_API_URL');
    const token = await this.authGateway.getAccessToken();

    try {
      this.logger.log(`Sending GET request to ${endpoint}...`);
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Error response from Factus API [${response.status}]: ${errorText}`,
        );
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed request to ${endpoint}: ${error.message}`);
      throw error;
    }
  }

  private async getActiveNumberingRangeId(
    documentType: string,
  ): Promise<number> {
    try {
      const response = await this.makeGetRequest('/v2/numbering-ranges');
      const ranges = response.data?.data || response.data || [];
      const range = ranges.find(
        (r: any) =>
          r.document &&
          r.document.toLowerCase() === documentType.toLowerCase() &&
          r.is_active,
      );
      if (!range) {
        throw new Error(
          `No active numbering range found for document type: ${documentType}`,
        );
      }
      return range.id;
    } catch (error) {
      this.logger.error(
        `Failed to get active numbering range id for ${documentType}: ${error.message}`,
      );
      // Fallback defaults for Sandbox V2
      if (documentType.toLowerCase() === 'nota crédito') return 390;
      if (documentType.toLowerCase() === 'factura de venta') return 389;
      if (documentType.toLowerCase() === 'documento soporte') return 391;
      if (documentType.toLowerCase() === 'nota ajuste documento soporte')
        return 392;
      throw error;
    }
  }

  private async makePostRequest(endpoint: string, payload: any): Promise<any> {
    const baseUrl = this.configService.get<string>('FACTUS_API_URL');
    const token = await this.authGateway.getAccessToken();

    try {
      this.logger.log(`Sending POST request to ${baseUrl}${endpoint}...`);
      this.logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Error response from Factus API [${response.status}]: ${errorText}`,
        );
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed request to ${endpoint}: ${error.message}`);
      throw error;
    }
  }

  private async makeDeleteRequest(endpoint: string): Promise<any> {
    const baseUrl = this.configService.get<string>('FACTUS_API_URL');
    const token = await this.authGateway.getAccessToken();

    try {
      this.logger.log(`Sending DELETE request to ${endpoint}...`);
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Error response from Factus API [${response.status}]: ${errorText}`,
        );
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed request to ${endpoint}: ${error.message}`);
      throw error;
    }
  }

  async createInvoice(
    invoice: FactusInvoiceRequest,
  ): Promise<FactusInvoiceResponse> {
    const numberingRangeId =
      invoice.numberingRangeId ||
      (await this.getActiveNumberingRangeId('Factura de Venta'));

    const payload = {
      reference_code: invoice.referenceCode,
      numbering_range_id: numberingRangeId,
      observation: invoice.observation,
      payment_details: invoice.paymentDetails.map((p) => ({
        payment_form: p.paymentForm,
        payment_method_code: p.paymentMethodCode,
        amount: p.amount,
        reference_code: p.referenceCode,
        due_date: p.dueDate,
      })),
      customer: {
        identification_document_code:
          invoice.customer.identificationDocumentCode,
        identification: invoice.customer.identification,
        dv: invoice.customer.dv,
        legal_organization_code: invoice.customer.legalOrganizationCode,
        tribute_code: invoice.customer.tributeCode || 'ZZ',
        company: invoice.customer.company,
        trade_name: invoice.customer.tradeName,
        names: invoice.customer.names,
        address: invoice.customer.address,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
        municipality_code: invoice.customer.municipalityCode,
      },
      items: invoice.items.map((item) => ({
        code_reference: item.codeReference,
        name: item.name,
        quantity: Number(item.quantity).toFixed(2),
        discount_rate: Number(item.discountRate).toFixed(2),
        price: Number(item.price).toFixed(2),
        unit_measure_code: item.unitMeasureCode || '94',
        standard_code: item.standardCode || '999',
        note: item.note,
        taxes: item.taxes.map((t) => ({
          code: t.code,
          rate: t.rate,
          is_excluded: t.isExcluded || false,
        })),
      })),
    };

    const rawResponse = await this.makePostRequest(
      '/v2/bills/validate',
      payload,
    );
    return this.mapResponse(rawResponse);
  }

  async destroyInvoice(
    referenceCode: string,
  ): Promise<{ status: string; message: string }> {
    const response = await this.makeDeleteRequest(
      `/v2/bills/destroy/reference/${encodeURIComponent(referenceCode)}`,
    );
    return {
      status: response.status || 'ok',
      message: response.message || 'Factura eliminada correctamente',
    };
  }

  async createCreditNote(
    creditNote: FactusCreditNoteRequest,
  ): Promise<FactusCreditNoteResponse> {
    const numberingRangeId =
      creditNote.numberingRangeId ||
      (await this.getActiveNumberingRangeId('Nota Crédito'));

    const payload: any = {
      reference_code: creditNote.referenceCode,
      correction_concept_code: creditNote.correctionConceptCode,
      customization_id: creditNote.customizationId || '20',
      bill_number: creditNote.billNumber,
      numbering_range_id: numberingRangeId,
      observation: creditNote.observation,
      payment_details: creditNote.paymentDetails.map((p) => ({
        payment_form: p.paymentForm,
        payment_method_code: p.paymentMethodCode,
        amount: p.amount,
        reference_code: p.referenceCode,
        due_date: p.dueDate,
      })),
      items: creditNote.items.map((item) => ({
        code_reference: item.codeReference,
        name: item.name,
        quantity: Number(item.quantity).toFixed(2),
        discount_rate: Number(item.discountRate).toFixed(2),
        price: Number(item.price).toFixed(2),
        unit_measure_code: item.unitMeasureCode || '94',
        standard_code: item.standardCode || '999',
        note: item.note,
        taxes: item.taxes.map((t) => ({
          code: t.code,
          rate: t.rate,
          is_excluded: t.isExcluded || false,
        })),
      })),
    };

    if (creditNote.customer) {
      payload.customer = {
        identification_document_code:
          creditNote.customer.identificationDocumentCode,
        identification: creditNote.customer.identification,
        dv: creditNote.customer.dv,
        legal_organization_code: creditNote.customer.legalOrganizationCode,
        tribute_code: creditNote.customer.tributeCode || 'ZZ',
        company: creditNote.customer.company,
        trade_name: creditNote.customer.tradeName,
        names: creditNote.customer.names,
        address: creditNote.customer.address,
        email: creditNote.customer.email,
        phone: creditNote.customer.phone,
        municipality_code: creditNote.customer.municipalityCode,
      };
    }

    const rawResponse = await this.makePostRequest(
      '/v2/credit-notes/validate',
      payload,
    );
    return this.mapResponse(rawResponse);
  }

  async downloadInvoicePdf(
    number: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }> {
    const rawResponse = await this.makeGetRequest(
      `/v2/bills/${number}/download-pdf`,
    );
    return {
      pdfBase64Encoded:
        rawResponse.data?.pdf_base_64_encoded ||
        rawResponse.pdf_base_64_encoded,
      fileName: rawResponse.data?.file_name || rawResponse.file_name,
    };
  }

  async downloadAdjustmentNotePdf(
    number: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }> {
    const rawResponse = await this.makeGetRequest(
      `/v2/adjustment-notes/${number}/download-pdf`,
    );
    return {
      pdfBase64Encoded:
        rawResponse.data?.pdf_base_64_encoded ||
        rawResponse.pdf_base_64_encoded,
      fileName: rawResponse.data?.file_name || rawResponse.file_name,
    };
  }

  // --- Support Document methods ---

  async createSupportDocument(
    request: FactusSupportDocumentRequest,
  ): Promise<FactusSupportDocumentResponse> {
    const numberingRangeId =
      request.numberingRangeId ||
      (await this.getActiveNumberingRangeId('Documento Soporte'));

    const payload = {
      reference_code: request.referenceCode,
      numbering_range_id: numberingRangeId,
      created_time: request.createdTime,
      observation: request.observation,
      payment_details: request.paymentDetails.map((p) => ({
        payment_form: p.paymentForm,
        payment_method_code: p.paymentMethodCode,
        amount: p.amount,
        reference_code: p.referenceCode,
        due_date: p.dueDate,
      })),
      provider: {
        identification_document_code:
          request.provider.identification_document_code,
        identification: request.provider.identification,
        dv: request.provider.dv,
        names: request.provider.names,
        address: request.provider.address,
        country_code: request.provider.country_code,
        municipality_code: request.provider.municipality_code,
        legal_organization_code: request.provider.legal_organization_code,
      },
      items: request.items.map((item) => ({
        code_reference: item.codeReference,
        name: item.name,
        quantity: Number(item.quantity).toFixed(2),
        discount_rate: Number(item.discountRate).toFixed(2),
        price: Number(item.price).toFixed(2),
        unit_measure_code: item.unitMeasureCode || '94',
        standard_code: item.standardCode || '999',
        note: item.note,
        taxes: item.taxes.map((t) => ({
          code: t.code,
          rate: t.rate,
          is_excluded: t.isExcluded || false,
        })),
      })),
    };

    const rawResponse = await this.makePostRequest(
      '/v2/support-documents/validate',
      payload,
    );
    this.logger.log(
      `Support document response: ${JSON.stringify(rawResponse)}`,
    );
    return this.mapSupportDocumentResponse(rawResponse);
  }

  // ── Support Document Adjustment Note methods ──

  async createSupportDocumentAdjustmentNote(
    request: FactusSupportDocumentAdjustmentNoteRequest,
  ): Promise<FactusSupportDocumentAdjustmentNoteResponse> {
    const numberingRangeId =
      request.numberingRangeId ||
      (await this.getActiveNumberingRangeId('Nota Ajuste Documento Soporte'));

    const payload: any = {
      reference_code: request.referenceCode,
      correction_concept_code: request.correctionConceptCode,
      support_document_number: request.supportDocumentNumber,
      numbering_range_id: numberingRangeId,
      observation: request.observation,
      payment_details: request.paymentDetails.map((p) => ({
        payment_form: p.paymentForm,
        payment_method_code: p.paymentMethodCode,
        amount: p.amount,
        reference_code: p.referenceCode,
        due_date: p.dueDate,
      })),
      items: request.items.map((item) => ({
        code_reference: item.codeReference,
        name: item.name,
        quantity: Number(item.quantity).toFixed(2),
        discount_rate: Number(item.discountRate).toFixed(2),
        price: Number(item.price).toFixed(2),
        unit_measure_code: item.unitMeasureCode || '94',
        standard_code: item.standardCode || '999',
        note: item.note,
        taxes: item.taxes.map((t) => ({
          code: t.code,
          rate: t.rate,
          is_excluded: t.isExcluded || false,
        })),
      })),
    };

    if (request.provider) {
      payload.provider = {
        identification_document_code:
          request.provider.identification_document_code,
        identification: request.provider.identification,
        dv: request.provider.dv,
        names: request.provider.names,
        address: request.provider.address,
        country_code: request.provider.country_code,
        municipality_code: request.provider.municipality_code,
        legal_organization_code: request.provider.legal_organization_code,
      };
    }

    const rawResponse = await this.makePostRequest(
      '/v1/adjustment-notes/support-documents/validate',
      payload,
    );
    return this.mapSupportDocumentAdjustmentNoteResponse(rawResponse);
  }

  async destroySupportDocumentAdjustmentNote(
    referenceCode: string,
  ): Promise<{ status: string; message: string }> {
    const response = await this.makeDeleteRequest(
      `/v1/adjustment-notes/support-documents/reference/${encodeURIComponent(referenceCode)}`,
    );
    return {
      status: response.status || 'ok',
      message: response.message || 'Nota de ajuste eliminada correctamente',
    };
  }

  async downloadSupportDocumentAdjustmentNotePdf(
    number: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }> {
    const rawResponse = await this.makeGetRequest(
      `/v2/adjustment-notes/${number}/download-pdf`,
    );
    return {
      pdfBase64Encoded:
        rawResponse.data?.pdf_base_64_encoded ||
        rawResponse.pdf_base_64_encoded,
      fileName: rawResponse.data?.file_name || rawResponse.file_name,
    };
  }

  async destroySupportDocument(
    referenceCode: string,
  ): Promise<{ status: string; message: string }> {
    const response = await this.makeDeleteRequest(
      `/v1/support-documents/reference/${encodeURIComponent(referenceCode)}`,
    );
    return {
      status: response.status || 'ok',
      message: response.message || 'Documento soporte eliminado correctamente',
    };
  }

  async downloadSupportDocumentPdf(
    number: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }> {
    const rawResponse = await this.makeGetRequest(
      `/v2/support-documents/${number}/download-pdf`,
    );
    return {
      pdfBase64Encoded:
        rawResponse.data?.pdf_base_64_encoded ||
        rawResponse.pdf_base_64_encoded,
      fileName: rawResponse.data?.file_name || rawResponse.file_name,
    };
  }

  private mapSupportDocumentAdjustmentNoteResponse(
    res: any,
  ): FactusSupportDocumentAdjustmentNoteResponse {
    const d = res.data;
    if (!d) return res;

    return {
      status: res.status,
      message: res.message,
      data: {
        referenceCode: d.reference_code,
        number: d.number,
        cude: d.cude || d.cuds || null,
        cuds: d.cuds || null,
        qrUrl: d.links?.qr || null,
        publicUrl: d.links?.public_url || null,
        isValidated: d.is_validated,
        validatedAt: d.validated_at,
        createdAt: d.created_at,
        numberingRange: d.numbering_range
          ? {
              prefix: d.numbering_range.prefix,
              from: d.numbering_range.from,
              to: d.numbering_range.to,
              resolutionNumber: d.numbering_range.resolution_number,
              startDate: d.numbering_range.start_date,
              endDate: d.numbering_range.end_date,
              months: d.numbering_range.months,
            }
          : null,
        items: d.items || [],
        taxes: d.taxes || [],
        totals: d.totals
          ? {
              prepaymentAmount: Number(d.totals.prepayment_amount || 0),
              grossAmount: Number(d.totals.gross_amount || 0),
              taxableAmount: Number(d.totals.taxable_amount || 0),
              taxAmount: Number(d.totals.tax_amount || 0),
              surchargeAmount: Number(d.totals.surcharge_amount || 0),
              total: Number(d.totals.total || 0),
            }
          : null,
        errors: d.errors || [],
        links: {
          qr: d.links?.qr,
          publicUrl: d.links?.public_url,
        },
      },
    };
  }

  private mapSupportDocumentResponse(res: any): FactusSupportDocumentResponse {
    const d = res.data;
    if (!d) return res;

    return {
      status: res.status,
      message: res.message,
      data: {
        referenceCode: d.reference_code,
        number: d.number,
        cude: d.cuds || d.cude || null,
        cuds: d.cuds || null,
        qrUrl: d.links?.qr || null,
        publicUrl: d.links?.public_url || null,
        isValidated: d.is_validated,
        validatedAt: d.validated_at,
        createdAt: d.created_at,
        items: d.items || [],
        taxes: d.taxes || [],
        totals: d.totals
          ? {
              prepaymentAmount: Number(d.totals.prepayment_amount || 0),
              grossAmount: Number(d.totals.gross_amount || 0),
              taxableAmount: Number(d.totals.taxable_amount || 0),
              taxAmount: Number(d.totals.tax_amount || 0),
              surchargeAmount: Number(d.totals.surcharge_amount || 0),
              total: Number(d.totals.total || 0),
            }
          : null,
        errors: d.errors || [],
      },
    };
  }

  private mapResponse(res: any): any {
    const d = res.data;
    if (!d) return res;

    return {
      status: res.status,
      message: res.message,
      data: {
        referenceCode: d.reference_code,
        number: d.number,
        qrUrl: d.links?.qr,
        publicUrl: d.links?.public_url,
        cude: d.cude || d.cufe,
        cufe: d.cufe || d.cude,
        isValidated: d.is_validated,
        validatedAt: d.validated_at,
        createdAt: d.created_at,
        sendEmail: d.send_email || false,
        numberingRange: d.numbering_range
          ? {
              prefix: d.numbering_range.prefix,
              from: d.numbering_range.from,
              to: d.numbering_range.to,
              resolutionNumber: d.numbering_range.resolution_number,
              startDate: d.numbering_range.start_date,
              endDate: d.numbering_range.end_date,
              months: d.numbering_range.months,
            }
          : null,
        items: (d.items || []).map((i: any) => ({
          codeReference: i.code_reference,
          name: i.name,
          quantity: Number(i.quantity),
          price: Number(i.price),
          discountRate: Number(i.discount_rate),
          subtotal: Number(i.subtotal),
        })),
        taxes: (d.taxes || []).map((t: any) => ({
          code: t.code,
          rate: t.rate,
          taxableAmount: Number(t.taxable_amount),
          taxAmount: Number(t.tax_amount),
        })),
        totals: d.totals
          ? {
              prepaymentAmount: Number(d.totals.prepayment_amount || 0),
              grossAmount: Number(d.totals.gross_amount || 0),
              taxableAmount: Number(d.totals.taxable_amount || 0),
              taxAmount: Number(d.totals.tax_amount || 0),
              surchargeAmount: Number(d.totals.surcharge_amount || 0),
              total: Number(d.totals.total || 0),
            }
          : null,
        links: {
          qr: d.links?.qr,
          publicUrl: d.links?.public_url,
        },
      },
    };
  }
}
