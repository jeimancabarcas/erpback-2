import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { QueryBillsDto } from './dto/query-bills.dto';
import { QueryCreditNotesDto } from './dto/query-credit-notes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('bills')
  getBills(@Query(ValidationPipe) query: QueryBillsDto) {
    return this.financeService.getBills(query);
  }

  @Get('credit-notes')
  getCreditNotes(@Query(ValidationPipe) query: QueryCreditNotesDto) {
    return this.financeService.getCreditNotes(query);
  }
}
