import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdatePurchaseOrderDto {
  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @IsString()
  @IsOptional()
  observations?: string;
}
