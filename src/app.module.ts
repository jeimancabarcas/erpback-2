import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { User } from './modules/users/entities/user.entity';
import { InventoryCategory } from './modules/inventory/entities/inventory-category.entity';
import { Product } from './modules/inventory/entities/product.entity';
import { Supplier } from './modules/suppliers/entities/supplier.entity';
import { PurchaseOrder } from './modules/purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from './modules/purchase-orders/entities/purchase-order-item.entity';
import { InventoryBatch } from './modules/inventory/entities/inventory-batch.entity';
import { CustomersModule } from './modules/customers/customers.module';
import { Customer } from './modules/customers/entities/customer.entity';
import { SalesModule } from './modules/sales/sales.module';
import { Invoice } from './modules/sales/entities/invoice.entity';
import { InvoiceItem } from './modules/sales/entities/invoice-item.entity';
import { CreditNote } from './modules/sales/entities/credit-note.entity';
import { DebitNote } from './modules/sales/entities/debit-note.entity';
import { CreditNoteItem } from './modules/sales/entities/credit-note-item.entity';
import { DebitNoteItem } from './modules/sales/entities/debit-note-item.entity';
import { FactusModule } from './modules/factus/factus.module';
import { PdfGenerationModule } from './modules/pdf-generation/pdf-generation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: configService.get<'mysql' | 'postgres'>('DB_TYPE', 'postgres'),
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [
          User,
          InventoryCategory,
          Product,
          Supplier,
          PurchaseOrder,
          PurchaseOrderItem,
          InventoryBatch,
          Customer,
          Invoice,
          InvoiceItem,
          CreditNote,
          DebitNote,
          CreditNoteItem,
          DebitNoteItem,
        ],
        synchronize: true, // Only for development
      }),
    }),
    AuthModule,
    UsersModule,
    InventoryModule,
    SuppliersModule,
    PurchaseOrdersModule,
    CustomersModule,
    SalesModule,
    FactusModule,
    PdfGenerationModule,
  ],
})
export class AppModule {}
