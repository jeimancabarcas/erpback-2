import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateInvoiceItemDto {
  @IsUUID('all', { message: 'ID de producto no válido' })
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  productId: string;

  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  quantity: number;

  @IsNotEmpty({ message: 'El precio unitario es obligatorio' })
  unitPrice: number;
}

export class CreateInvoiceDto {
  @IsUUID('all', { message: 'ID de cliente no válido' })
  @IsNotEmpty({ message: 'El cliente es obligatorio' })
  customerId: string;

  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  date: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
