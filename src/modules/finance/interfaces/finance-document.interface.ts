export interface FinanceDocumentCustomer {
  identificationDocument?: { code: string; name: string };
  identification: string;
  dv?: string | null;
  graphicRepresentationName?: string;
  tradeName?: string | null;
  company?: string | null;
  names: string;
  address?: string;
  email?: string | null;
  phone?: string | null;
  legalOrganization?: { code: string; name: string };
  municipality?: {
    code: string;
    name: string;
    department?: { code: string; name: string };
  } | null;
}

export interface FinanceDocumentPaymentDetail {
  paymentForm?: { code: string; name: string };
  paymentMethod?: { code: string; name: string };
  referenceCode?: string | null;
  amount: string;
  dueDate?: string | null;
}

export interface FinanceDocumentDto {
  id: string;
  number: string;
  document?: { code: string; name: string };
  operationType?: { code: string; name: string };
  referenceCode: string;
  customer: FinanceDocumentCustomer;
  paymentDetails?: FinanceDocumentPaymentDetail[];
  total: string;
  errors?: Record<string, string> | null;
  status: string;
  isNegotiableInstrument?: boolean;
  hasClaim?: boolean;
  sendEmail?: boolean;
  isValidated?: boolean;
  validatedAt?: string | null;
  createdAt: string;
  creditNotes?: any[];
  debitNotes?: any[];
  type: 'bill' | 'credit-note';
}