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

// Debit Notes
export interface FactusDebitNoteRequest {
  referenceCode: string;
  correctionConceptCode: string; // concept code
  customizationId?: string;
  billNumber?: string;
  numberingRangeId?: number;
  observation?: string;
  paymentDetails: FactusPaymentDetail[];
  customer?: FactusCustomer;
  items: FactusItem[];
}

export interface FactusDebitNoteResponseData {
  referenceCode: string;
  number: string;
  cude: string; // DIAN CUDE/CUFE
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

export interface FactusDebitNoteResponse {
  status: string;
  message: string;
  data: FactusDebitNoteResponseData;
}

export interface IFactusInvoicingGateway {
  createInvoice(invoice: FactusInvoiceRequest): Promise<FactusInvoiceResponse>;
  createCreditNote(
    creditNote: FactusCreditNoteRequest,
  ): Promise<FactusCreditNoteResponse>;
  createDebitNote(
    debitNote: FactusDebitNoteRequest,
  ): Promise<FactusDebitNoteResponse>;
  downloadInvoicePdf(
    number: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }>;
  downloadAdjustmentNotePdf(
    number: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }>;
}
