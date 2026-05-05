import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { CustomerStatus, DocumentType } from '../entities/customer.entity';

export class CreateCustomerDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  name: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsOptional()
  email?: string;

  @IsEnum(DocumentType, { message: 'Tipo de documento no válido' })
  @IsNotEmpty({ message: 'El tipo de documento es obligatorio' })
  documentType: DocumentType;

  @IsString({ message: 'El número de documento debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  documentNumber: string;

  @IsEnum(CustomerStatus, { message: 'Estado no válido' })
  @IsOptional()
  status?: CustomerStatus;

  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @IsOptional()
  phone?: string;

  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  @IsOptional()
  address?: string;
}
