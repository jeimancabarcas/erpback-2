import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';

export class QueryPurchaseOrdersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
