export class ElectronicBillResponseDto {
  id: string;
  number: string;
  cufe?: string;
  qrUrl?: string;
  publicUrl?: string;
  status: 'pending' | 'emitted' | 'failed';
  warning?: string;
}
