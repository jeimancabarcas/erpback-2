# Proposal: Factura Electrónica — Impuestos de Producto

## Intent

Replace hardcoded IVA 19% (`code: '01', rate: '19.00'`) in Factus payload with each product's configured taxes via the `Product.taxes` ManyToMany relation. Display tax breakdown per item in invoice detail.

## Scope

### In Scope
- Backend: Load `product.taxes` + calculate tax amounts in `create()` and `emit()`
- Backend: Pass correct tax codes/rates to Factus per item
- Backend: Store tax breakdown per item in new `invoice_item_taxes` table
- Frontend: Display tax column per item in invoice detail dialog
- Frontend: Show tax summary in sale form total area
- Migration: Create `invoice_item_taxes` table

### Out of Scope
- Payment method/type configuration (future)
- Credit/debit note tax handling (future)
- Editing taxes on existing invoices
- Tax configuration UI (already exists in product form)

## Capabilities

### New Capabilities
- `electronic-invoice-taxes`: Load product taxes, calculate per-item tax amounts, pass correct codes/rates to Factus payload, persist breakdown

### Modified Capabilities
- `sales-manual-invoice`: Tax calculation in electronic invoice creation changes from hardcoded 19% to dynamic per-product taxes

## Approach

1. **InvoiceItemTax entity** — new `invoice_item_taxes` junction: `invoiceItemId`, `taxId`, `taxCode`, `taxRate`, `taxAmount`. Supports multiple taxes per item (product M2M).
2. **`create()`** — load `Product` with `relations: ['taxes']`. For each item, derive `priceBeforeTax = unitPrice / (1 + sum(taxRates))`, compute per-tax amounts. Build `FactusItem.taxes` array from product's taxes. Persist `InvoiceItemTax` records.
3. **`emit()`** — same approach using existing items loaded with `items.product.taxes`.
4. **`findOne()`** — add `items.product.taxes` to relations so detail dialog gets tax data.
5. **Frontend** — add `InvoiceItem.taxes` array to model. Invoice detail dialog: new "Impuestos" column per item. Sale form total: show tax summary.
6. **Fallback** — products without taxes assigned → default to IVA 19% for backward compatibility.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/sales/entities/invoice-item.entity.ts` | Modified | Add `taxAmount` column |
| `src/modules/sales/entities/invoice-item-tax.entity.ts` | **New** | Junction for tax breakdown |
| `src/modules/sales/sales.service.ts` | Modified | Tax logic in `create()`, `emit()`, `findOne()` |
| `erpfrontend/.../models/invoice.model.ts` | Modified | Add `taxes` to `InvoiceItem` |
| `erpfrontend/.../invoice-detail-dialog/` | Modified | Tax column + breakdown |
| `erpfrontend/.../sale-form/` | Modified | Tax summary in totals |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Products without taxes assigned | Low | Fallback to IVA 19% |
| Factus API rejects new codes | Low | Same DIAN code format, existing codes |
| Price calculation drift (unitPrice vs priceBeforeTax) | Med | Keep `unitPrice` as final price, derive before-tax for Factus |

## Rollback Plan

1. Run migration `down()` to drop `invoice_item_taxes` table.
2. Revert `sales.service.ts` to hardcoded tax values.
3. Revert frontend model and display changes.
4. Verify invoices can still be created.

## Dependencies

- Tax master data already seeded
- Products can be assigned taxes via existing product form

## Success Criteria

- [ ] Factus payload uses product's actual tax codes/rates per item (not hardcoded)
- [ ] Tax breakdown persisted in `invoice_item_taxes` per invoice item
- [ ] Invoice detail dialog shows tax column and breakdown
- [ ] Products with no taxes assigned fall back to IVA 19%
- [ ] All existing tests pass (`npm run test` both repos)
