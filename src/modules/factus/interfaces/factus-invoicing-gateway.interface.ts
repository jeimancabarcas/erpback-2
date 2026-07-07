export interface FactusPaymentDetail {
  paymentForm: string;
  paymentMethodCode: string;
  amount: string;
  referenceCode?: string;
  dueDate?: string;
}

export interface FactusCustomer {
  identificationDocumentCode: string;
  identification: string;
  dv?: string;
  legalOrganizationCode: string;
  tributeCode?: string;
  company?: string;
  tradeName?: string;
  names?: string;
  address: string;
  email: string;
  phone: string;
  municipalityCode: string;
}

export interface FactusTax {
  code: string;
  rate: string;
  isExcluded?: boolean;
}

export interface FactusWithholdingTax {
  code: string;
  rate: string;
}

export interface FactusItem {
  codeReference: string;
  name: string;
  quantity: number;
  discountRate: number;
  price: number;
  unitMeasureCode: string;
  standardCode: string;
  note?: string;
  taxes: FactusTax[];
  withholdingTaxes?: FactusWithholdingTax[];
}

export interface FactusNumberingRange {
  prefix: string;
  from: number;
  to: number;
  resolutionNumber: string;
  startDate: string;
  endDate: string;
  months: number;
}

export interface FactusResponseItem {
  codeReference: string;
  name: string;
  quantity: number;
  price: number;
  discountRate: number;
  subtotal: number;
}

export interface FactusResponseTax {
  code: string;
  rate: string;
  taxableAmount: number;
  taxAmount: number;
}

export interface FactusInvoiceResponseTotals {
  prepaymentAmount: number;
  grossAmount: number;
  taxableAmount: number;
  taxAmount: number;
  surchargeAmount: number;
  total: number;
}

// Invoices
export interface FactusInvoiceRequest {
  referenceCode: string;
  numberingRangeId?: number;
  observation?: string;
  paymentDetails: FactusPaymentDetail[];
  customer: FactusCustomer;
  items: FactusItem[];
}

export interface FactusInvoiceResponseData {
  referenceCode: string;
  number: string;
  qrUrl?: string;
  publicUrl?: string;
  cude?: string; // or CUFE
  cufe?: string;
  isValidated: boolean;
  validatedAt: string | null;
  createdAt: string;
  numberingRange: FactusNumberingRange | null;
  items: FactusResponseItem[];
  taxes: FactusResponseTax[];
  totals: FactusInvoiceResponseTotals | null;
  links: { qr?: string; publicUrl?: string };
}

export interface FactusInvoiceResponse {
  status: string;
  message: string;
  data: FactusInvoiceResponseData;
}

// Credit Notes
export interface FactusCreditNoteRequest {
  referenceCode: string;
  correctionConceptCode: string;
  customizationId?: string;
  billNumber?: string;
  numberingRangeId?: number;
  observation?: string;
  paymentDetails: FactusPaymentDetail[];
  customer?: FactusCustomer;
  items: FactusItem[];
}

export interface FactusCreditNoteResponseData {
  referenceCode: string;
  number: string;
  cude: string;
  qrUrl?: string;
  publicUrl?: string;
  sendEmail: boolean;
  isValidated: boolean;
  validatedAt: string | null;
  createdAt: string;
  numberingRange: FactusNumberingRange | null;
  items: any[];
  taxes: any[];
  totals: FactusInvoiceResponseTotals | null;
  links: { qr?: string; publicUrl?: string };
}

export interface FactusCreditNoteResponse {
  status: string;
  message: string;
  data: FactusCreditNoteResponseData;
}

// Support Document types
export interface FactusSupportDocumentEstablishment {
  name: string;
  address: string;
  phone_number: string;
  email: string;
  municipality_code: string;
}

export interface FactusSupportDocumentProvider {
  identification_document_code: string;
  identification: string;
  dv: string;
  names: string;
  address: string;
  country_code: string;
  municipality_code: string;
  legal_organization_code: string;
}

export interface FactusSupportDocumentRequest {
  referenceCode: string;
  createdTime: string;
  observation: string;
  paymentDetails: FactusPaymentDetail[];
  establishment?: FactusSupportDocumentEstablishment;
  provider: FactusSupportDocumentProvider;
  items: FactusItem[];
  numberingRangeId?: number;
}

export interface FactusSupportDocumentResponse {
  status: string;
  message: string;
  data: FactusSupportDocumentResponseData;
}

export interface FactusSupportDocumentResponseData {
  referenceCode: string;
  number: string;
  cude: string;
  qrUrl?: string;
  publicUrl?: string;
  isValidated: boolean;
  validatedAt: string | null;
  createdAt: string;
  items: any[];
  taxes: any[];
  totals: FactusInvoiceResponseTotals | null;
}

export interface IFactusInvoicingGateway {
  createInvoice(invoice: FactusInvoiceRequest): Promise<FactusInvoiceResponse>;
  destroyInvoice(
    referenceCode: string,
  ): Promise<{ status: string; message: string }>;
  createCreditNote(
    creditNote: FactusCreditNoteRequest,
  ): Promise<FactusCreditNoteResponse>;
  downloadInvoicePdf(
    number: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }>;
  downloadAdjustmentNotePdf(
    number: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }>;
  createSupportDocument(
    request: FactusSupportDocumentRequest,
  ): Promise<FactusSupportDocumentResponse>;
  destroySupportDocument(
    referenceCode: string,
  ): Promise<{ status: string; message: string }>;
  downloadSupportDocumentPdf(
    number: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }>;
}
