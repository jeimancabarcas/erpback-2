import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ElectronicBillCustomerDto,
  ElectronicBillItemDto,
  ElectronicBillPaymentDetailDto,
} from './create-electronic-bill.dto';

export class CreateElectronicCreditNoteDto {
  @IsString()
  @IsNotEmpty()
  billNumber: string;

  @IsString()
  @IsNotEmpty()
  referenceCode: string;

  @IsString()
  @IsNotEmpty()
  correctionConceptCode: string;

  @IsOptional()
  @IsString()
  observation?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ElectronicBillPaymentDetailDto)
  paymentDetails: ElectronicBillPaymentDetailDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ElectronicBillCustomerDto)
  customer?: ElectronicBillCustomerDto;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ElectronicBillItemDto)
  items: ElectronicBillItemDto[];
}
