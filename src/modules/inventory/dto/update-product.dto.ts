import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsString({ message: 'El motivo del ajuste debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo del ajuste no puede estar vacío' })
  adjustmentReason?: string;
}
