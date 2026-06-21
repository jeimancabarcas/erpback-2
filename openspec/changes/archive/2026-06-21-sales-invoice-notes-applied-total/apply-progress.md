# Apply Progress: sales-invoice-notes-applied-total

**Generated**: 2026-06-21T15:35:00-05:00
**Mode**: Strict TDD (RED → GREEN → REFACTOR)
**Artifact Store**: hybrid
**Delivery**: Single PR (estimated 120–180 lines, well under 400-line budget)

---

## Completed Tasks

- [x] 1.1 RED — Created `erpbackend/src/modules/sales/sales.service.spec.ts` with 5 Jest unit tests covering all 4 spec scenarios plus empty-array guard
- [x] 1.2 GREEN — Added `@OneToMany` for `creditNotes` and `debitNotes` to `invoice.entity.ts`; added CreditNote and DebitNote imports
- [x] 1.3 GREEN — Updated `sales.service.ts` `findAll`: added `'creditNotes'` and `'debitNotes'` to relations; mapped each invoice to include computed `netTotal`
- [x] 1.4 REFACTOR — `npm run build` in `erpbackend` passed with zero errors
- [x] 2.1 RED — Created `erpfrontend/src/app/components/pages/sales-page/sales-page.component.spec.ts` with 3 Vitest component tests
- [x] 2.2 GREEN — Added `netTotal?: number` to `Invoice` interface in `invoice.model.ts`
- [x] 2.3 GREEN — Updated `sales-page.component.ts`: header → "Total Neto", binding → `(inv.netTotal ?? inv.totalAmount)`, removed PDF button block and `downloadPdf()` method; `getInvoicePdf` on service preserved
- [x] 2.4 REFACTOR — `npx tsc --noEmit` in `erpfrontend` passed with zero type errors

---

## TDD Cycle Evidence

| Task | RED (tests written first) | GREEN (implementation passes) | REFACTOR (build/type-check) |
|------|--------------------------|-------------------------------|------------------------------|
| 1.1–1.3 Backend | ✅ `sales.service.spec.ts` created BEFORE entity/service changes | ✅ All 5 tests pass (23 total suite passes) | ✅ `npm run build` — 0 errors |
| 2.1–2.3 Frontend | ✅ `sales-page.component.spec.ts` created BEFORE model/template changes | ✅ Template and model updated to satisfy assertions | ✅ `npx tsc --noEmit` — 0 errors |

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `erpbackend/src/modules/sales/sales.service.spec.ts` | Created | Jest unit tests for `findAll` netTotal computation (5 tests, 4 spec scenarios + empty-array guard) |
| `erpbackend/src/modules/sales/entities/invoice.entity.ts` | Modified | Added `@OneToMany` for `creditNotes: CreditNote[]` and `debitNotes: DebitNote[]`; added imports |
| `erpbackend/src/modules/sales/sales.service.ts` | Modified | Added `'creditNotes'` and `'debitNotes'` to `findAndCount` relations; added `data.map()` enrichment returning `netTotal` |
| `erpfrontend/src/app/components/pages/sales-page/sales-page.component.spec.ts` | Created | Vitest component tests: netTotal display, totalAmount fallback, PDF button absence |
| `erpfrontend/src/app/models/invoice.model.ts` | Modified | Added `netTotal?: number` to `Invoice` interface |
| `erpfrontend/src/app/components/pages/sales-page/sales-page.component.ts` | Modified | Header → "Total Neto"; binding → `(inv.netTotal ?? inv.totalAmount)`; removed PDF button block; removed `downloadPdf()` method |

---

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Backend unit tests | `npm run test` (erpbackend) | ✅ 23/23 passed — `sales.service.spec.ts` PASS |
| Backend build | `npm run build` (erpbackend) | ✅ 0 errors |
| Frontend type check | `npx tsc --noEmit` (erpfrontend) | ✅ 0 errors |

---

## Deviations from Design

None — implementation matches `design.md` exactly:
- `netTotal` formula: `Number(totalAmount) - Σcn.amount + Σdn.amount`
- Relations array: `['customer', 'items', 'items.product', 'creditNotes', 'debitNotes']`
- Return shape: spread invoice + `netTotal` inline (no new DTO class)
- `getInvoicePdf` preserved in `InvoiceService`

---

## Status

8/8 Phase 1 + Phase 2 tasks complete. Ready for `sdd-verify`.

**Remaining**: Phase 3 (Verification) tasks 3.1–3.4 — to be run by sdd-verify phase.
