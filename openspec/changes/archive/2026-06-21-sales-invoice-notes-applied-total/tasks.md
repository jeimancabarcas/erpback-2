# Tasks: sales-invoice-notes-applied-total

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120–180 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend entity + service + frontend model + template | PR 1 | All phases in one PR; tests and docs included |

---

## Phase 1: Backend Entity & Service (TDD)

- [x] 1.1 **RED** — In `erpbackend/src/modules/sales/sales.service.spec.ts` (create if absent), write Jest unit tests asserting: (a) `findAll` returns `netTotal` equal to `totalAmount` when no notes exist; (b) `netTotal` = `totalAmount - creditNote.amount` when one credit note exists; (c) `netTotal` = `totalAmount + debitNote.amount` when one debit note exists; (d) `netTotal` combines both types when both exist.
- [x] 1.2 **GREEN** — Add `@OneToMany(() => CreditNote, (cn) => cn.invoice) creditNotes: CreditNote[]` and `@OneToMany(() => DebitNote, (dn) => dn.invoice) debitNotes: DebitNote[]` to `erpbackend/src/modules/sales/entities/invoice.entity.ts`; add all necessary imports.
- [x] 1.3 **GREEN** — In `erpbackend/src/modules/sales/sales.service.ts` `findAll`: add `'creditNotes'` and `'debitNotes'` to the relations array; after `findAndCount`, map each invoice to include `netTotal = Number(totalAmount) - SUM(creditNotes.amount) + SUM(debitNotes.amount)`; return enriched result.
- [x] 1.4 **REFACTOR** — Verify TypeScript compilation (`npm run build` in `erpbackend`). Resolve any ESLint warnings on changed files.

## Phase 2: Frontend Model & Template (TDD)

- [x] 2.1 **RED** — In `erpfrontend/src/app/components/pages/sales-page/`, write or update a Vitest test asserting: (a) the amount column displays `netTotal` when present; (b) falls back to `totalAmount` when `netTotal` is absent; (c) no PDF button exists in the rendered row actions.
- [x] 2.2 **GREEN** — Add `netTotal?: number` to the `Invoice` interface/type in `erpfrontend/src/app/models/invoice.model.ts`.
- [x] 2.3 **GREEN** — In `erpfrontend/src/app/components/pages/sales-page/sales-page.component.ts`: (a) change column header from "Monto Total" to "Total Neto"; (b) change binding from `inv.totalAmount` to `(inv.netTotal ?? inv.totalAmount)`; (c) remove the PDF icon-button block from the template actions cell; (d) remove `downloadPdf()` from the component class. Do NOT remove `getInvoicePdf` from the invoice service.
- [x] 2.4 **REFACTOR** — Run `npx tsc --noEmit` in `erpfrontend` to verify no type errors. Run prettier format on changed files.

## Phase 3: Verification

- [ ] 3.1 Run backend tests: `npm run test` in `erpbackend` — confirm all pass.
- [ ] 3.2 Run frontend tests: `npm run test -- --watch=false` in `erpfrontend` — confirm all pass.
- [ ] 3.3 Run backend build: `npm run build` in `erpbackend` — confirm no compilation errors.
- [ ] 3.4 Run frontend type check: `npx tsc --noEmit` in `erpfrontend` — confirm zero type errors.
