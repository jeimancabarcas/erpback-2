import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrderSupportDocument } from './entities/purchase-order-support-document.entity';
import { PurchaseOrderAdjustmentNote } from './entities/purchase-order-adjustment-note.entity';
import { PurchaseOrderAdjustmentNoteItem } from './entities/purchase-order-adjustment-note-item.entity';
import { PurchaseOrderAdjustmentNoteItemTax } from './entities/purchase-order-adjustment-note-item-tax.entity';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrderAdjustmentScenarioDHandler } from './helpers/purchase-order-adjustment-scenario-d';
import { InventoryModule } from '../inventory/inventory.module';
import { FactusModule } from '../factus/factus.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      PurchaseOrderSupportDocument,
      PurchaseOrderAdjustmentNote,
      PurchaseOrderAdjustmentNoteItem,
      PurchaseOrderAdjustmentNoteItemTax,
    ]),
    InventoryModule,
    FactusModule,
    ConfigModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, PurchaseOrderAdjustmentScenarioDHandler],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
