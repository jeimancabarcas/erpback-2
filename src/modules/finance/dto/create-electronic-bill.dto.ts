import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ElectronicBillCustomerDto {
  @IsString()
  @IsNotEmpty()
  identification: string;

  @IsString()
  @IsNotEmpty()
  names: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class ElectronicBillItemDto {
  @IsString()
  @IsNotEmpty()
  codeReference: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  discountRate?: number;

  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class ElectronicBillPaymentDetailDto {
  @IsString()
  @IsNotEmpty()
  paymentForm: string;

  @IsString()
  @IsNotEmpty()
  paymentMethodCode: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateElectronicBillDto {
  @IsOptional()
  @IsUUID()
  manualInvoiceId?: string;

  @ValidateNested()
  @Type(() => ElectronicBillCustomerDto)
  customer: ElectronicBillCustomerDto;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ElectronicBillItemDto)
  items: ElectronicBillItemDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ElectronicBillPaymentDetailDto)
  paymentDetails?: ElectronicBillPaymentDetailDto[];
}


