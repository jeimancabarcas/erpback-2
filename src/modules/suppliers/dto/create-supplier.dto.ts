import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString({ message: 'El NIT debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El NIT es obligatorio' })
  nit: string;

  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  name: string;

  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  address: string;

  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  phone: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsOptional()
  email?: string;
}
