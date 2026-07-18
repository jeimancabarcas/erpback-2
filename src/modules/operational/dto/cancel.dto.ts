import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CancelDto {
  @IsNotEmpty({ message: 'El motivo de cancelación es obligatorio' })
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @MaxLength(2000, { message: 'El motivo no puede exceder los 2000 caracteres' })
  motivo: string;
}
