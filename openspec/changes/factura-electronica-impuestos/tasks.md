# Tasks: Factura Electrónica — Impuestos de Producto

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-400 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Decision needed before apply | Yes |

**Note**: Under 400 lines — single PR viable. `size:exception` required before apply per `single-pr` strategy.

## Phase 1: Backend — InvoiceItemTax Entity

- [x] **T-01**: Create `src/modules/sales/entities/invoice-item-tax.entity.ts` — `InvoiceItemTax` entity with `id` (UUID PK), `invoiceItemId` (FK CASCADE), `taxId` (nullable), `taxCode` (varchar 10), `taxRate` (decimal 5,2), `taxAmount` (decimal 12,2). `ManyToOne` → `InvoiceItem`.
- [x] **T-02**: Add `taxAmount` column (decimal 12,2 default 0) + `@OneToMany(() => InvoiceItemTax)` to `InvoiceItem` entity (`src/modules/sales/entities/invoice-item.entity.ts`).
- [x] **T-03**: Register `InvoiceItemTax` in `sales.module.ts` `TypeOrmModule.forFeature()`.
- [x] **T-04**: Add `InvoiceItemTax` import + entity entry to `src/app.module.ts` entities array.

## Phase 2: Backend — Sales Service Tax Logic

- [x] **T-05**: Update `create()` in `sales.service.ts` — load `product.taxes` (relations), compute `priceBeforeTax` dynamically, persist `InvoiceItemTax` records per item, pass dynamic tax array to Factus payload. Untaxed products → no tax records, Factus `taxes: []`.
- [x] **T-06**: Update `emit()` in `sales.service.ts` — load `items.product.taxes` in `findOne`, apply same dynamic tax calc, persist `InvoiceItemTax` records.
- [x] **T-07**: Update `findOne()` — add `items.invoiceItemTaxes` to relations array.
- [x] **T-08**: Write Jest tests in `sales.service.spec.ts` — single-tax (IVA 19%, unitPrice=119000), multi-tax (IVA+INC 4%, unitPrice=123000), untaxed product (no InvoiceItemTax, Factus taxes=[]), manual skip (`isElectronic:false`, no tax records), emit recalc.

## Phase 3: Frontend — Invoice Model

- [x] **T-09**: Add `InvoiceItemTax` interface to `src/app/models/invoice.model.ts` (`id`, `taxId?`, `taxCode`, `taxRate`, `taxAmount`).
- [x] **T-10**: Add `taxAmount?: number` + `taxes?: InvoiceItemTax[]` to `InvoiceItem` interface.

## Phase 4: Frontend — Invoice Detail Display

- [x] **T-11**: Update `invoice-detail-dialog.component.ts` — add "Impuestos" column per item row showing tax codes/rates/amounts.
- [x] **T-12**: Add invoice-level tax summary below items table (subtotal, per-tax-code breakdown, total).
- [x] **T-13**: Write Vitest tests — renders tax column when `item.taxes` present, hides when absent.

## Phase 5: Frontend — Sale Form Tax Summary

- [x] **T-14**: Update `sale-form.component.ts` totals section — add tax breakdown by code below item total (subtotal → IVA 19% → INC 4% → total).
- [x] **T-15**: Write Vitest tests — tax breakdown renders correctly with mock items.

### Implementation Order
Phases 1-2 (backend) must complete before 3-5 (frontend) since the API shapes the model. Phase 3 must precede 4-5 since the model drives the UI. Frontend phases 4-5 are independent of each other.
