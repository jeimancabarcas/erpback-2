import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceElectronicEmission } from './entities/invoice-electronic-emission.entity';
import { CreditNote } from './entities/credit-note.entity';
import { CreditNoteItem } from './entities/credit-note-item.entity';
import { CreditNoteItemTax } from './entities/credit-note-item-tax.entity';
import { InvoiceItemTax } from './entities/invoice-item-tax.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { FactusModule } from '../factus/factus.module';
import { PdfGenerationModule } from '../pdf-generation/pdf-generation.module';
import { SettingsModule } from '../settings/settings.module';
import { ScenarioDHandler } from './helpers/scenario-d';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      InvoiceElectronicEmission,
      CreditNote,
      CreditNoteItem,
      CreditNoteItemTax,
      InvoiceItemTax,
    ]),
    InventoryModule,
    FactusModule,
    PdfGenerationModule,
    SettingsModule,
  ],
  controllers: [SalesController],
  providers: [
    SalesService,
    ScenarioDHandler,
  ],
  exports: [
    SalesService,
    TypeOrmModule.forFeature([InvoiceElectronicEmission]),
  ],
})
export class SalesModule {}
