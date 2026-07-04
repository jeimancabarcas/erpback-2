import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentFrequency } from '../entities/invoice.entity';

class CreateInvoiceItemDto {
  @IsUUID('all', { message: 'ID de producto no válido' })
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  productId: string;

  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  quantity: number;

  @IsOptional()
  unitPrice?: number;
}

export class CreateInvoiceDto {
  @IsUUID('all', { message: 'ID de cliente no válido' })
  @IsNotEmpty({ message: 'El cliente es obligatorio' })
  customerId: string;

  @IsOptional()
  date?: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID('all', { message: 'ID de método de pago no válido' })
  @IsOptional()
  paymentMethodId?: string;

  @IsUUID('all', { message: 'ID de tipo de pago no válido' })
  @IsOptional()
  paymentTypeId?: string;

  @IsNumber()
  @Min(1)
  @Max(120)
  @IsOptional()
  installments?: number;

  @IsEnum(PaymentFrequency)
  @IsOptional()
  paymentFrequency?: PaymentFrequency;
}
