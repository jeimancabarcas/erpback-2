export class ElectronicBillListDto {
  id: string;
  number: string;
  status: 'pending' | 'emitted' | 'failed';
  cufe?: string;
  invoiceId: string | null;
  createdAt: Date;
}
