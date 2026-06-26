import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsUUID('all', { message: 'invoiceId debe ser un UUID válido' })
  invoiceId: string;

  @IsNumber({}, { message: 'amount debe ser un número' })
  @Min(0.01, { message: 'amount debe ser mayor a 0' })
  amount: number;

  @IsOptional()
  @IsString({ message: 'notes debe ser una cadena de texto' })
  notes?: string;
}
