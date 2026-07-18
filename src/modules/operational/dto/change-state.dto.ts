import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ChangeStateDto {
  @IsIn(['INICIADO', 'PAUSADO', 'FINALIZADO', 'CANCELADO'], {
    message: 'El estado debe ser INICIADO, PAUSADO, FINALIZADO o CANCELADO',
  })
  estado: string;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @MaxLength(2000, { message: 'El motivo no puede exceder los 2000 caracteres' })
  motivo?: string;
}
