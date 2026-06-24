import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { CreateSalesNoteDto } from './dto/create-sales-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('stats/financial')
  getFinancialStats() {
    return this.salesService.getFinancialStats();
  }

  @Get('notes')
  findAllNotes() {
    return this.salesService.findAllNotes();
  }

  @Post('invoices')
  create(@Body() createDto: CreateInvoiceDto) {
    return this.salesService.create(createDto);
  }

  @Get('invoices')
  findAll(@Query() queryDto: QueryInvoicesDto) {
    return this.salesService.findAll(queryDto);
  }

  @Get('invoices/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOne(id);
  }

  @Post('invoices/:id/emit')
  emit(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.emit(id);
  }

  @Post('invoices/:id/credit-note')
  createCreditNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSalesNoteDto,
  ) {
    return this.salesService.createCreditNote(id, dto);
  }

  @Post('invoices/:id/debit-note')
  createDebitNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSalesNoteDto,
  ) {
    return this.salesService.createDebitNote(id, dto);
  }

  @Get('invoices/:id/notes')
  findNotes(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findNotesByInvoice(id);
  }

  @Get('invoices/:id/pdf')
  downloadPdf(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.downloadInvoicePdf(id);
  }

  @Get('invoices/:id/dian-pdf')
  downloadDianPdf(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.downloadDianPdf(id);
  }

  @Delete('invoices/:id/factus')
  cancelFactusInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('referenceCode') referenceCode?: string,
  ) {
    return this.salesService.cancelFactusInvoice(id, referenceCode);
  }

  @Get('credit-notes/:id/pdf')
  downloadCreditNotePdf(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.downloadAdjustmentNotePdf(id, 'Credit');
  }

  @Get('debit-notes/:id/pdf')
  downloadDebitNotePdf(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.downloadAdjustmentNotePdf(id, 'Debit');
  }
}
