import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceElectronicEmission } from './entities/invoice-electronic-emission.entity';
import { CreditNote } from './entities/credit-note.entity';
import { DebitNote } from './entities/debit-note.entity';
import { CreditNoteItem } from './entities/credit-note-item.entity';
import { CreditNoteItemTax } from './entities/credit-note-item-tax.entity';
import { DebitNoteItem } from './entities/debit-note-item.entity';
import { DebitNoteItemTax } from './entities/debit-note-item-tax.entity';
import { InvoiceItemTax } from './entities/invoice-item-tax.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { FactusModule } from '../factus/factus.module';
import { PdfGenerationModule } from '../pdf-generation/pdf-generation.module';
import { ScenarioAHandler } from './helpers/scenario-a';
import { ScenarioBHandler } from './helpers/scenario-b';
import { ScenarioCHandler } from './helpers/scenario-c';
import { ScenarioDHandler } from './helpers/scenario-d';
import { ScenarioEHandler } from './helpers/scenario-e';
import { ScenarioFHandler } from './helpers/scenario-f';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      InvoiceElectronicEmission,
      CreditNote,
      DebitNote,
      CreditNoteItem,
      CreditNoteItemTax,
      DebitNoteItem,
      DebitNoteItemTax,
      InvoiceItemTax,
    ]),
    InventoryModule,
    FactusModule,
    PdfGenerationModule,
  ],
  controllers: [SalesController],
  providers: [
    SalesService,
    ScenarioAHandler,
    ScenarioBHandler,
    ScenarioCHandler,
    ScenarioDHandler,
    ScenarioEHandler,
    ScenarioFHandler,
  ],
  exports: [SalesService],
})
export class SalesModule {}
