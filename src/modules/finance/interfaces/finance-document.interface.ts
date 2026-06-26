export interface FinanceDocumentDto {
  id: string;
  number: string;
  clientName: string;
  clientIdentification: string;
  total: number;
  status: string;
  createdAt: string;
  type: 'bill' | 'credit-note';
}