import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateInventoryCategoryDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  name: string;

  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsOptional()
  description?: string;
}
