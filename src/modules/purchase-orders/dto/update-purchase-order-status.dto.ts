import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';

export class UpdatePurchaseOrderStatusDto {
  @IsEnum(PurchaseOrderStatus, { message: 'Estado no válido' })
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  status: PurchaseOrderStatus;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
