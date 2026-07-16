import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServicioActividadInputDto {
  @IsUUID('all', { message: 'El ID de la actividad debe ser un UUID válido' })
  actividadId: string;
}

export class CreateServicioDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  descripcion?: string;

  @IsNumber({}, { message: 'El precio base debe ser un número' })
  @Min(0, { message: 'El precio base no puede ser negativo' })
  precioBase: number;

  @IsOptional()
  @IsArray({ message: 'Las actividades deben ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateServicioActividadInputDto)
  actividades?: CreateServicioActividadInputDto[];
}
