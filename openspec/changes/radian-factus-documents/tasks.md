# Tasks: Radian Factus Documents — Finance Module

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~780 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

> **Note**: ~780 lines exceeds the standard 400-line budget but fits within the project's explicit 1500-line review budget. No PR split needed.

## Phase 1: Interfaces & Foundation (TDD)

- [x] 1.1 **RED**: write test verifying `IFactusQueryGateway` interface contract compiles and injection token is `'IFactusQueryGateway'`
- [x] 1.2 **GREEN**: create `src/modules/factus/interfaces/factus-query-gateway.interface.ts` — `IFactusQueryGateway`, `BillQueryFilters`, `CreditNoteQueryFilters`, `PaginatedFactusResponse<T>`, `FactusBill`, `FactusCreditNote`
- [x] 1.3 **RED**: write test that `FactusModule` registers and exports `'IFactusQueryGateway'` provider
- [x] 1.4 **GREEN**: update `src/modules/factus/factus.module.ts` — add `'IFactusQueryGateway'` → `FactusHttpQueryAdapter` provider, add export

## Phase 2: FactusHttpQueryAdapter (TDD)

- [x] 2.1 **RED**: unit test query string builder — all filters present, partial filters omit missing params, defaults only
- [x] 2.2 **GREEN**: implement query string builder in `src/modules/factus/adapters/factus-http-query.adapter.ts`
- [x] 2.3 **RED**: unit test `listBills` — pagination mapping (Factus snake_case → `PaginatedFactusResponse`), empty data, non-2xx throws typed error
- [x] 2.4 **GREEN**: implement `listBills` and `listCreditNotes` using `makeGetRequest('/v2/bills'/'...')` + `IFactusAuthGateway` injection, add `PaginatedFactusResponse.meta` mapper
- [x] 2.5 **REFACTOR**: verify error text includes `HTTP ${status}: ${body}` matching existing adapter convention

## Phase 3: Finance Module Scaffold (TDD)

- [x] 3.1 **RED**: write unit test for `FinanceService` — maps `QueryBillsDto` → `BillQueryFilters`, maps `FactusBill` → `FinanceDocumentDto`, preserves pagination metadata
- [x] 3.2 **GREEN**: create `src/modules/finance/interfaces/finance-document.interface.ts` — `FinanceDocumentDto { id, number, clientName, clientIdentification, total, status, createdAt, type }`
- [x] 3.3 **GREEN**: create `src/modules/finance/dto/query-bills.dto.ts` and `query-credit-notes.dto.ts` with class-validator decorators
- [x] 3.4 **GREEN**: create `src/modules/finance/finance.service.ts` — inject `'IFactusQueryGateway'`, transform DTOs → filters, map response → `FinanceDocumentDto`
- [x] 3.5 **RED**: write unit test for `FinanceController` — `GET /finance/bills` binds query params, `@UseGuards(JwtAuthGuard)` present, gateway error propagates as 5xx
- [x] 3.6 **GREEN**: create `src/modules/finance/finance.controller.ts` — two endpoints, `@UseGuards(AuthGuard('jwt'))`, `@Query()` with ValidationPipe
- [x] 3.7 **GREEN**: create `src/modules/finance/finance.module.ts` — imports `FactusModule`, registers `FinanceController` + `FinanceService`
- [x] 3.8 **GREEN**: update `src/app.module.ts` — import `FinanceModule`

## Phase 4: E2E Tests

- [x] 4.1 E2E test: `GET /finance/bills?page=1&perPage=10` with valid JWT returns 200 + `{ data, meta: { total, page, lastPage, limit } }`
- [x] 4.2 E2E test: `GET /finance/credit-notes` with same params returns 200
- [x] 4.3 E2E test: unauthenticated request to any `/finance/*` returns 401
- [x] 4.4 E2E test: Factus API unreachable returns 5xx with error detail