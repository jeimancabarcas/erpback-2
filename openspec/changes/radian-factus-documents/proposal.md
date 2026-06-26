# Proposal: Radian Factus Documents — Finance Module

## Intent

The backend has zero endpoints to list or search electronic documents from Factus API. The frontend finance page (`FinanceService`) uses hardcoded mock data for invoices. We need a read-through proxy that exposes queryable Factus document lists (bills, credit notes) to the frontend, following the existing hexagonal Ports & Adapters pattern.

## Scope

### In Scope
- `IFactusQueryGateway` interface + `FactusHttpQueryAdapter` — list/query documents from Factus V2 API
- `FinanceModule` with controller, service, and DTOs — REST endpoints: `GET /finance/bills`, `/credit-notes`
- Filter parameters: `identification`, `names`, `number`, `status`, `created_at` date range, pagination (`page`, `per_page`)
- Pagination mapping: Factus `{ current_page, last_page, per_page, total }` → backend `PaginatedResult<T>`
- Frontend: replace mock invoice data in `FinanceService` with HTTP calls to new backend endpoints

### Out of Scope
- Debit notes / adjustment notes (`/v2/adjustment-notes`) — future phase
- Support documents (`/v2/support-documents`) — future phase
- DIAN reception endpoints (`/v2/reception/*`) — future phase
- Local persistence/sync of Radian documents — v1 is live proxy only
- PDF download (already exists in `IFactusInvoicingGateway`)
- Document creation/validation (already exists in invoicing gateway)

## Capabilities

### New Capabilities
- `factus-document-query`: Query/list operations via Factus V2 API for electronic documents with filter + pagination
- `finance-document-listing`: REST endpoints exposing Factus document lists to the frontend with mapped response models

### Modified Capabilities
None — no existing spec-level behavior changes. This is additive only.

## Approach

**Architecture**: Follow existing hexagonal pattern. New `IFactusQueryGateway` (string token `'IFactusQueryGateway'`) segregated from `IFactusInvoicingGateway` per ISP. `FactusHttpQueryAdapter` reuses the same `makeGetRequest(token)` + `IFactusAuthGateway` injection pattern from `FactusHttpInvoicingAdapter`. New `FinanceModule` imports `FactusModule`, injects the query gateway, and exposes JWT-guarded REST endpoints.

**Rationale over alternatives**: Adding list methods to `IFactusInvoicingGateway` bloats the interface (god-interface anti-pattern). Direct HTTP in Finance module duplicates auth logic. A separate query gateway respects ISP, reuses auth plumbing, and keeps Factus module a clean adapter layer.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/factus/interfaces/` | New | `IFactusQueryGateway` + DTOs |
| `src/modules/factus/adapters/` | New | `FactusHttpQueryAdapter` |
| `src/modules/factus/factus.module.ts` | Modified | Register + export new provider |
| `src/modules/finance/` | New | Controller, service, DTOs |
| `src/app.module.ts` | Modified | Import `FinanceModule` |
| `erpfrontend/.../finance.service.ts` | Modified | Replace mock invoices with HTTP |
| `erpfrontend/.../finance.model.ts` | Modified | Add pagination/filter types |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Factus pagination 1-indexed vs backend convention | Low | Verify first API call; add offset adapter in query gateway if needed |
| Auth token scope limits query endpoints | Low | Test with sandbox token first; fall back to dedicated scope if needed |
| Factus API downtime → finance page broken | Medium | v1 scope acknowledges this; future phase adds local cache layer |
| Frontend signal-to-observable migration breaks computed metrics | Low | Keep `_invoices` signal; `tap()` into it from HTTP response |

## Rollback Plan

1. Remove `FinanceModule` import from `AppModule`
2. Delete `src/modules/finance/` directory
3. Remove `IFactusQueryGateway` provider from `FactusModule` (keep interface file for future use)
4. Revert `FinanceService` to mock invoice data (original code preserved in git)
5. All changes are additive — no existing endpoints or entities are modified

## Dependencies

- `IFactusAuthGateway` (already exists, exported from `FactusModule`)
- Factus sandbox API available at `FACTUS_API_URL` env var (already configured)
- NestJS `@nestjs/config`, `@nestjs/common` (already in project)

## Success Criteria

- [ ] `GET /finance/bills?identification=X&page=1&per_page=20` returns paginated invoice list from Factus
- [ ] `GET /finance/credit-notes` returns paginated credit notes
- [ ] Pagination metadata matches `PaginatedResult<T>` contract: `{ data, meta: { total, page, lastPage, limit } }`
- [ ] Frontend finance page renders real invoice data from backend (no mock fallback)
- [ ] All new services/gateways have unit tests (strict TDD enabled)
- [ ] JWT guard blocks unauthenticated access to all finance endpoints
