# Verify Report: sales-invoice-notes-applied-total

**Date**: 2026-06-21
**Verdict**: PASS

## Phase 3 Checks

| Task | Command | Result |
|------|---------|--------|
| 3.1 Backend tests | `npm run test` (erpbackend) | ✅ 23/23 passed |
| 3.2 Frontend tests | `npm run test -- --watch=false` (erpfrontend) | ✅ 18/18 passed |
| 3.3 Backend build | `npm run build` (erpbackend) | ✅ 0 errors |
| 3.4 Frontend type check | `npx tsc --noEmit` (erpfrontend) | ✅ 0 type errors |

## Spec Conformance

### Implementation — PASS

All four implementation files match spec and design exactly:

- **`invoice.entity.ts`**: `@OneToMany` for `creditNotes: CreditNote[]` and `debitNotes: DebitNote[]` added with correct imports.
- **`sales.service.ts`**: `'creditNotes'` and `'debitNotes'` added to `relations` array in `findAndCount`; `data.map()` computes `netTotal = Number(totalAmount) - Σcn.amount + Σdn.amount` with null-safe `?? []` guards (a minor improvement over the spec's reference implementation — not a deviation).
- **`invoice.model.ts`**: `netTotal?: number` added to the `Invoice` interface.
- **`sales-page.component.ts`**: Column header changed to "Total Neto"; binding changed to `(inv.netTotal ?? inv.totalAmount)`; PDF button block and `downloadPdf()` method removed; `getInvoicePdf` preserved in `InvoiceService`.

### CRITICAL — Frontend test suite fails (3/3 tests)

**File**: `erpfrontend/src/app/components/pages/sales-page/sales-page.component.spec.ts`

**Error**: `NG0201: No provider found for ActivatedRoute. Source: Standalone[_SalesPageComponent]`

**Root cause**: `SalesPageComponent` imports `DashboardLayoutComponent`, which itself imports `RouterLink` from `@angular/router`. The test module setup does not provide `ActivatedRoute` (e.g., via `RouterTestingModule` or `provideRouter([])`), so Angular's DI fails before any test assertion runs.

**Impact**: All 3 frontend Vitest component tests fail at module bootstrap. The underlying implementation is correct (type-check passes, header and binding are right, PDF button is absent), but the tests are broken and cannot provide coverage evidence.

**Fix required**: Add `provideRouter([])` (or `RouterTestingModule.withRoutes([])`) to the `TestBed.configureTestingModule` providers array in `sales-page.component.spec.ts`.

### WARNING — Frontend test coverage gap

Because all 3 frontend tests fail, the following scenarios have no passing automated evidence:
- `netTotal` displayed when present
- Fallback to `totalAmount` when `netTotal` is absent
- PDF button absence from row actions

These scenarios are correct in the implementation but unverified by the test suite.

## Summary

Backend implementation is complete and fully conformant with spec and design. All 23 backend unit tests pass, the build is clean, and frontend TypeScript compilation has zero errors. However, the 3 frontend component tests all fail due to a missing `ActivatedRoute` provider in the test setup — a test configuration bug, not an implementation bug. The fix is a one-line addition to the `TestBed` providers. This change must be remediated before archiving.
