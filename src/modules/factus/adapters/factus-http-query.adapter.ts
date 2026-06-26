import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import {
  IFactusQueryGateway,
  BillQueryFilters,
  CreditNoteQueryFilters,
  PaginatedFactusResponse,
  FactusBill,
  FactusCreditNote,
} from '../interfaces/factus-query-gateway.interface';

@Injectable()
export class FactusHttpQueryAdapter implements IFactusQueryGateway {
  private readonly logger = new Logger(FactusHttpQueryAdapter.name);

  constructor(
    @Inject('IFactusAuthGateway')
    private readonly authGateway: any,
    private readonly configService: ConfigService,
  ) {}

  async listBills(
    filters: BillQueryFilters,
  ): Promise<PaginatedFactusResponse<FactusBill>> {
    return this.executeQuery<FactusBill>('/v2/bills', filters);
  }

  async listCreditNotes(
    filters: CreditNoteQueryFilters,
  ): Promise<PaginatedFactusResponse<FactusCreditNote>> {
    return this.executeQuery<FactusCreditNote>('/v2/credit-notes', filters);
  }

  private async executeQuery<T>(
    endpoint: string,
    filters: Record<string, any>,
  ): Promise<PaginatedFactusResponse<T>> {
    const queryString = this.buildQueryString(filters);
    const url = `${endpoint}${queryString ? '?' + queryString : ''}`;
    return this.makeGetRequest(url);
  }

  private buildQueryString(filters: Record<string, any>): string {
    const params: string[] = [];

    // Map flat filter keys to Factus bracket-format query params
    const filterMap: Record<string, string> = {
      identification: 'filter[identification]',
      names: 'filter[names]',
      number: 'filter[number]',
      status: 'filter[status]',
    };

    for (const [key, value] of Object.entries(filterMap)) {
      if (filters[key] !== undefined && filters[key] !== null) {
        params.push(`${value}=${encodeURIComponent(String(filters[key]))}`);
      }
    }

    // Date range filters use nested bracket format
    if (filters.createdAtStart) {
      params.push(
        `filter[created_at][start_date]=${encodeURIComponent(String(filters.createdAtStart))}`,
      );
    }
    if (filters.createdAtEnd) {
      params.push(
        `filter[created_at][end_date]=${encodeURIComponent(String(filters.createdAtEnd))}`,
      );
    }

    // Pagination
    params.push(`filter[per_page]=${filters.perPage ?? 10}`);
    params.push(`page=${filters.page ?? 1}`);

    return params.join('&');
  }

  private async makeGetRequest(endpoint: string): Promise<any> {
    const baseUrl = this.configService.get<string>('FACTUS_API_URL');
    const token = await this.authGateway.getAccessToken();

    try {
      this.logger.log(`Sending GET request to ${endpoint}...`);
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Error response from Factus API [${response.status}]: ${errorText}`,
        );
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const raw = await response.json();
      return this.mapPaginatedResponse(raw);
    } catch (error) {
      this.logger.error(`Failed request to ${endpoint}: ${error.message}`);
      throw error;
    }
  }

  private mapPaginatedResponse(raw: any): any {
    const data = Array.isArray(raw.data) ? raw.data : [];
    return {
      data,
      meta: {
        page: raw.current_page ?? 1,
        lastPage: raw.last_page ?? 0,
        limit: raw.per_page ?? 10,
        total: raw.total ?? 0,
      },
    };
  }
}