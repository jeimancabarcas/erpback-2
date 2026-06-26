import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IFactusQueryGateway,
  BillQueryFilters,
  CreditNoteQueryFilters,
  PaginatedFactusResponse,
  FactusBill,
  FactusCreditNote,
} from '../factus/interfaces/factus-query-gateway.interface';
import { FinanceDocumentDto } from './interfaces/finance-document.interface';
import { QueryBillsDto } from './dto/query-bills.dto';
import { QueryCreditNotesDto } from './dto/query-credit-notes.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @Inject('IFactusQueryGateway')
    private readonly queryGateway: any,
  ) {}

  async getBills(query: QueryBillsDto): Promise<PaginatedResult<FinanceDocumentDto>> {
    const filters: BillQueryFilters = {
      identification: query.identification,
      names: query.names,
      number: query.number,
      status: query.status,
      createdAtStart: query.startDate,
      createdAtEnd: query.endDate,
      page: query.page ?? 1,
      perPage: query.perPage ?? 10,
    };

    const response: PaginatedFactusResponse<FactusBill> =
      await (this.queryGateway as IFactusQueryGateway).listBills(filters);

    this.logger.log(`Received ${response.data?.length ?? 0} bills from Factus`);
    return this.mapToPaginatedResult(response, 'bill');
  }

  async getCreditNotes(
    query: QueryCreditNotesDto,
  ): Promise<PaginatedResult<FinanceDocumentDto>> {
    const filters: CreditNoteQueryFilters = {
      identification: query.identification,
      names: query.names,
      number: query.number,
      status: query.status,
      createdAtStart: query.startDate,
      createdAtEnd: query.endDate,
      page: query.page ?? 1,
      perPage: query.perPage ?? 10,
    };

    const response: PaginatedFactusResponse<FactusCreditNote> =
      await (this.queryGateway as IFactusQueryGateway).listCreditNotes(filters);

    this.logger.log(`Received ${response.data?.length ?? 0} credit notes from Factus`);
    return this.mapToPaginatedResult(response, 'credit-note');
  }

  private mapToPaginatedResult(
    response: PaginatedFactusResponse<any>,
    type: 'bill' | 'credit-note',
  ): PaginatedResult<FinanceDocumentDto> {
    const rawData = Array.isArray(response.data) ? response.data : [];
    const data: FinanceDocumentDto[] = rawData.map((item) => ({
      id: item.reference_code || item.id,
      number: item.number || item.reference_code || '',
      clientName: item.customer?.names || item.names || '',
      clientIdentification: item.customer?.identification || item.identification || '',
      total: item.total ?? 0,
      status: String(item.status ?? '0') === '1' ? '1' : '0',
      createdAt: item.created_at || item.createdAt || '',
      type,
    }));

    return {
      data,
      meta: {
        page: response.meta?.page ?? 1,
        lastPage: response.meta?.lastPage ?? 0,
        limit: response.meta?.limit ?? 10,
        total: response.meta?.total ?? 0,
      },
    };
  }
}