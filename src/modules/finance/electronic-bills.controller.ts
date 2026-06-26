import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ElectronicBillsService } from './electronic-bills.service';
import { CreateElectronicBillDto } from './dto/create-electronic-bill.dto';
import { CreateElectronicCreditNoteDto } from './dto/create-electronic-credit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class ElectronicBillsController {
  constructor(
    private readonly electronicBillsService: ElectronicBillsService,
  ) {}

  @Post('electronic-bills')
  create(@Body(ValidationPipe) dto: CreateElectronicBillDto) {
    return this.electronicBillsService.create(dto);
  }

  /**
   * Create an electronic credit note via Factus API.
   * Resolves the emission by billNumber, builds the Factus payload,
   * calls factusGateway.createCreditNote(), and returns the response directly.
   */
  @Post('electronic-bills/credit-note')
  createCreditNote(@Body(ValidationPipe) dto: CreateElectronicCreditNoteDto) {
    return this.electronicBillsService.createCreditNote(dto);
  }

  /** Look up local invoice ID by Factus document number (for credit-note creation) */
  @Get('electronic-bills/by-document/:number')
  findByDocumentNumber(@Param('number') number: string) {
    return this.electronicBillsService.findByDocumentNumber(number);
  }
}
