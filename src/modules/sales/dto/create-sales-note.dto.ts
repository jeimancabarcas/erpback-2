import { IsArray, IsNotEmpty, IsOptional, IsString, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesNoteItemDto {
  @IsString()
  @IsNotEmpty({ message: 'El código de referencia es obligatorio' })
  codeReference: string;

  @IsNumber()
  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  quantity: number;

  @IsNumber()
  @IsOptional()
  price?: number;
}

export class CreateSalesNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'El concepto de corrección es obligatorio' })
  correctionConceptCode: string;

  @IsString()
  @IsOptional()
  observation?: string;

  @IsString()
  @IsOptional()
  billNumber?: string;

  @IsNumber()
  @IsOptional()
  numberingRangeId?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesNoteItemDto)
  items?: CreateSalesNoteItemDto[];
}
