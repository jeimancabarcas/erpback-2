import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  IsNumber,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProgramadoInsumoDto {
  @IsUUID('all', { message: 'El ID del insumo debe ser un UUID válido' })
  insumoId: string;

  @IsNumber({}, { message: 'La cantidad debe ser un número válido' })
  @Min(0.01, { message: 'La cantidad debe ser mayor a 0' })
  @IsNotEmpty({ message: 'La cantidad es requerida' })
  cantidad: number;
}

export class CreateProgramadoDto {
  @IsUUID('all', { message: 'El ID del cliente debe ser un UUID válido' })
  customerId: string;

  @IsUUID('all', { message: 'El ID del servicio debe ser un UUID válido' })
  servicioId: string;

  @IsNotEmpty({ message: 'La fecha de inicio es obligatoria' })
  @IsString({ message: 'La fecha de inicio debe ser una cadena ISO válida' })
  fechaInicioEstimada: string;

  @IsOptional()
  @IsArray({ message: 'Los insumos deben ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateProgramadoInsumoDto)
  insumos?: CreateProgramadoInsumoDto[];

  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena de texto' })
  @MaxLength(2000, { message: 'Las notas no pueden exceder los 2000 caracteres' })
  notas?: string;
}
