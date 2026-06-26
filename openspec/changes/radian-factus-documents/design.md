# Design: Radian Factus Documents — Finance Module

## Technical Approach

Read-through proxy to Factus V2 API for querying bills and credit notes. New `IFactusQueryGateway` interface + `FactusHttpQueryAdapter` in Factus module (hexagonal P&A). New `FinanceModule` with controller/service that injects the gateway and exposes JWT-guarded REST endpoints. Maps Factus pagination response → existing `PaginatedResult<T>` contract.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| Add list methods to `IFactusInvoicingGateway` | God interface; consumers depend on write methods they don't use | **Rejected** — violates ISP |
| New `IFactusQueryGateway` | More files, but clean segregation; follows CQRS-lite read/write split | **Chosen** — matches existing pattern, ISP-compliant |
| Query logic directly in FinanceService | Duplicates auth/token logic; Factus API coupling leaks into Finance | **Rejected** — keeps Factus knowledge inside Factus module |
| Use `any` for injected gateway (existing pattern) | Loses type safety; but matches `FactusHttpInvoicingAdapter` style | **Follow project convention** — `@Inject('IFactusQueryGateway') private readonly queryGateway: any` |

## Data Flow

```
FinanceController            FinanceService           FactusHttpQueryAdapter      Factus V2 API
     │                            │                          │                       │
     │  GET /finance/bills        │                          │                       │
     │───────────────────────────>│                          │                       │
     │                            │  listBills(filters)      │                       │
     │                            │─────────────────────────>│                       │
     │                            │                          │  GET /v2/bills?...     │
     │                            │                          │──────────────────────>│
     │                            │                          │     { data, meta }     │
     │                            │                          │<──────────────────────│
     │                            │   PaginatedResult<T>     │                       │
     │                            │<─────────────────────────│                       │
     │  PaginatedResult<Dto>      │                          │                       │
     │<───────────────────────────│                          │                       │
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/factus/interfaces/factus-query-gateway.interface.ts` | Create | `IFactusQueryGateway`, `BillQueryFilters`, `CreditNoteQueryFilters`, `PaginatedFactusResponse<T>`, `FactusBill`, `FactusCreditNote` DTOs |
| `src/modules/factus/adapters/factus-http-query.adapter.ts` | Create | `FactusHttpQueryAdapter`: `makeGetRequest` helper, query string builder, pagination mapper |
| `src/modules/factus/factus.module.ts` | Modify | Register `'IFactusQueryGateway'` → `FactusHttpQueryAdapter`, export the token |
| `src/modules/finance/finance.module.ts` | Create | Module importing FactusModule, registering FinanceController + FinanceService |
| `src/modules/finance/finance.controller.ts` | Create | `GET /finance/bills`, `GET /finance/credit-notes` with JwtAuthGuard |
| `src/modules/finance/finance.service.ts` | Create | Maps controller DTOs → gateway filters → `FinanceDocumentDto` |
| `src/modules/finance/dto/query-bills.dto.ts` | Create | class-validator decorated DTO for bill query params |
| `src/modules/finance/dto/query-credit-notes.dto.ts` | Create | class-validator decorated DTO for credit note query params |
| `src/modules/finance/interfaces/finance-document.interface.ts` | Create | `FinanceDocumentDto`: flattened frontend-friendly shape |
| `src/app.module.ts` | Modify | Import `FinanceModule` |

## Interfaces / Contracts

### IFactusQueryGateway

```typescript
export interface IFactusQueryGateway {
  listBills(filters: BillQueryFilters): Promise<PaginatedFactusResponse<FactusBill>>;
  listCreditNotes(filters: CreditNoteQueryFilters): Promise<PaginatedFactusResponse<FactusCreditNote>>;
}
```

### PaginatedFactusResponse (within query gateway domain)

```typescript
export interface PaginatedFactusResponse<T> {
  data: T[];
  meta: { page: number; lastPage: number; limit: number; total: number };
}
```

Maps from Factus API snake_case: `{ current_page → page, last_page → lastPage, per_page → limit, total → total }`.

### FinanceDocumentDto

```typescript
export interface FinanceDocumentDto {
  id: string;          // Factus reference code
  number: string;      // Document number (e.g. "FAC-001")
  clientName: string;
  clientIdentification: string;
  total: number;
  status: string;      // "validated" | "pending"
  createdAt: string;   // ISO date
  type: 'bill' | 'credit-note';
}
```

### Adapter Query Helper

The adapter builds Factus filter query params using bracket format:
```
filter[identification]=X&filter[names]=X&filter[number]=X&filter[status]=0&
filter[created_at][start_date]=2024-01-01&filter[created_at][end_date]=2024-12-31&
filter[per_page]=10&page=1
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | FactusHttpQueryAdapter — query string builder, pagination mapping, error throw | Mock `IFactusAuthGateway` + `ConfigService` via `Test.createTestingModule` |
| Unit | FinanceService — DTO mapping, error wrapping | Mock `IFactusQueryGateway`, verify transform to `PaginatedResult<FinanceDocumentDto>` |
| Unit | FinanceController — param binding, guard presence | Use `TestingModule`, override `FinanceService`, check `@UseGuards(JwtAuthGuard)` |
| E2E | Full endpoint — /finance/bills with query params | Supertest + sandbox Factus token (or mock HTTP via nock/interceptor) |

## Migration / Rollout

No migration required. All changes are additive — new endpoints, new module. Existing Factus module unchanged. Frontend switches HTTP calls after deployment.

## Open Questions

- [ ] Factus API `status` field: is it numeric (0/1) or string (`'pending'`/`'validated'`)? Spec says numeric, verify with first live call.
- [ ] `FactusBill` / `FactusCreditNote` DTO shape: Factus list endpoints may return different fields than individual get endpoints. Design as interface only; populate from first API response.