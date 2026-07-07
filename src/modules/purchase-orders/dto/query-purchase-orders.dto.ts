import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryPurchaseOrdersDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
