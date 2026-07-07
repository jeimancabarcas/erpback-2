import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryCategory } from './entities/inventory-category.entity';
import { Product } from './entities/product.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryCategory,
      Product,
      InventoryBatch,
      InventoryMovement,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
