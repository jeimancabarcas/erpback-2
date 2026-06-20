import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreatePurchaseOrderItemDto {
  @IsUUID('all', { message: 'El ID del producto debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  productId: string;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  quantity: number;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  price: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID('all', { message: 'El ID del proveedor debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El proveedor es obligatorio' })
  supplierId: string;

  @IsDateString({}, { message: 'La fecha debe ser una fecha válida' })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  orderDate: string;

  @IsString({ message: 'Las observaciones deben ser texto' })
  @IsOptional()
  observations?: string;

  @IsArray({ message: 'Los items deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}
