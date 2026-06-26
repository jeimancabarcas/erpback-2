import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ElectronicBillsController } from './electronic-bills.controller';
import { ElectronicBillsService } from './electronic-bills.service';
import { FactusModule } from '../factus/factus.module';
import { SalesModule } from '../sales/sales.module';
import { Product } from '../inventory/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    FactusModule,
    SalesModule,
  ],
  controllers: [FinanceController, ElectronicBillsController],
  providers: [FinanceService, ElectronicBillsService],
})
export class FinanceModule {}