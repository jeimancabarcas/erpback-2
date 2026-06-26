export class PaymentRecordDto {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  amount: number;
  paymentDate: Date;
  notes?: string | null;
  createdAt: Date;
}
