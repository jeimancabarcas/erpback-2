import { IsNotEmpty, IsString, IsInt, Min, IsUUID, IsOptional } from 'class-validator';

export class CreateProductDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsString({ message: 'El SKU debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El SKU es obligatorio' })
  sku: string;

  @IsInt({ message: 'El stock actual debe ser un número entero' })
  @Min(0, { message: 'El stock actual no puede ser negativo' })
  currentStock: number;

  @IsInt({ message: 'El stock mínimo debe ser un número entero' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  minStock: number;

  @IsInt({ message: 'El stock máximo debe ser un número entero' })
  @Min(0, { message: 'El stock máximo no puede ser negativo' })
  maxStock: number;

  @IsUUID('all', { message: 'El ID de la categoría debe ser un UUID válido' })
  @IsOptional()
  categoryId?: string;

  @IsOptional()
  sellingPrice?: number;
}
