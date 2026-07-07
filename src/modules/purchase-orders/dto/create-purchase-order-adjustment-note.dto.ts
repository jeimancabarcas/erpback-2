import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreatePurchaseOrderAdjustmentNoteDto {
  @IsString()
  @IsIn(['2'])
  correctionConceptCode: string;

  @IsString()
  @IsOptional()
  observation?: string;
}
