import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';

// ---------------------------------------------------------------------------
// Filter DTOs (all optional — defaults applied in adapter layer)
// ---------------------------------------------------------------------------

export interface BillQueryFilters {
  identification?: string;
  names?: string;
  number?: string;
  status?: string; // '0' = pending, '1' = validated
  createdAtStart?: string;
  createdAtEnd?: string;
  page?: number;
  perPage?: number;
}

export interface CreditNoteQueryFilters {
  identification?: string;
  names?: string;
  number?: string;
  status?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  page?: number;
  perPage?: number;
}

// ---------------------------------------------------------------------------
// Factus API response shapes (list-endpoint light DTOs)
// ---------------------------------------------------------------------------

export interface FactusBill {
  id: number;
  number: string;
  reference_code: string;
  created_at: string;
  status: string;
  total: number;
  customer: {
    identification: string;
    names: string;
  };
}

export interface FactusCreditNote {
  id: number;
  number: string;
  reference_code: string;
  created_at: string;
  status: string;
  total: number;
  customer: {
    identification: string;
    names: string;
  };
}

// ---------------------------------------------------------------------------
// Paginated response from Factus API (camelCase after mapping)
// ---------------------------------------------------------------------------

export interface PaginatedFactusResponse<T> {
  data: T[];
  meta: {
    page: number;
    lastPage: number;
    limit: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Gateway interface — segregated query port
// ---------------------------------------------------------------------------

export interface IFactusQueryGateway {
  listBills(
    filters: BillQueryFilters,
  ): Promise<PaginatedFactusResponse<FactusBill>>;
  listCreditNotes(
    filters: CreditNoteQueryFilters,
  ): Promise<PaginatedFactusResponse<FactusCreditNote>>;
}

// Injection token
export const FACTUS_QUERY_GATEWAY = 'IFactusQueryGateway';
