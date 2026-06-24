# Design: Factura Electrónica — Impuestos de Producto

## Technical Approach

Replace hardcoded IVA 19% with per-product taxes from `Product.taxes` (M2M). New `InvoiceItemTax` entity persists tax breakdown per item. `create()` and `emit()` compute `priceBeforeTax` dynamically. Untaxed products → no tax records, empty Factus taxes.

**Spec alignment**: covers `electronic-invoice-taxes` (new) + `sales-manual-invoice` delta.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| Fallback for untaxed | IVA 19% vs none | Back compat vs spec accuracy | **No fallback** — spec says "no InvoiceItemTax records" for untaxed products. Proposal fallback overridden by spec |
| `InvoiceItemTax` FK | `taxId` nullable vs required | Data integrity vs flexibility for deleted tax master | **Nullable** — tax master is reference data; preserving history matters more |
| Schema migration | `synchronize: true` vs migration files | Dev speed vs prod safety | **synchronize** — project uses it consistently (see `app.module.ts:68`). Flag for prod concern noted |
| `FactusItem.taxes` for untaxed | Omit field vs empty array | API compliance vs TS strictness | **Empty array `[]`** — interface requires `FactusTax[]`, Factus sandbox accepts empty |
| Tax calc rounding | `.toFixed(2)` per step vs `Math.round()` | Precision vs DIAN compliance | **`.toFixed(2)` per step** — matches existing pattern in `sales.service.ts`, gives consistent 2-decimal output |

## Data Flow

```
create(dto):
  QueryRunner tx
  └→ for each item:
       Product.findOne(id, relations:['taxes'])
       totalRate = sum(taxes.percentage)
       priceBeforeTax = totalRate > 0 ? unitPrice / (1 + totalRate/100) : unitPrice
       └→ InvoiceItem.create({productId, unitPrice, quantity, subtotal, taxAmount})
       └→ for each tax:
            InvoiceItemTax.create({invoiceItemId, taxId, taxCode, taxRate, taxAmount})
       └→ FactusItem = {price: priceBeforeTax, taxes: taxes.map(t => ({code, rate, isExcluded:false}))}
  if isElectronic: factusGateway.createInvoice(payload)
  Invoice.save + InvoiceItemTax.save

emit(id):
  Invoice.findOne(relations:['items.product.taxes'])
  └→ same tax calc as create()
  └→ persist new InvoiceItemTax records
  └→ factusGateway.createInvoice(payload)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/sales/entities/invoice-item-tax.entity.ts` | **Create** | New entity for tax breakdown per item |
| `src/modules/sales/entities/invoice-item.entity.ts` | Modify | Add `taxAmount` column + `OneToMany` to `InvoiceItemTax` |
| `src/modules/sales/sales.service.ts` | Modify | `create()`: load `product.taxes`, dynamic tax calc, persist `InvoiceItemTax`. `emit()`: same. `findOne()`: add `items.invoiceItemTaxes` |
| `src/modules/sales/sales.module.ts` | Modify | Add `InvoiceItemTax` to `TypeOrmModule.forFeature()` |
| `src/app.module.ts` | Modify | Add `InvoiceItemTax` to entities array |
| `erpfrontend/.../models/invoice.model.ts` | Modify | Add `taxAmount`, `taxes: InvoiceItemTax[]` to `InvoiceItem` + new interface |
| `erpfrontend/.../invoice-detail-dialog.component.ts` | Modify | Add "Impuestos" column per item, tax rows in traceability/totals |
| `erpfrontend/.../sale-form/...` | Modify | Tax summary in total area (subtotal, per-tax breakdown, total) |

## Interfaces / Contracts

```typescript
// BACKEND — New entity
@Entity('invoice_item_taxes')
export class InvoiceItemTax {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => InvoiceItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_item_id' })
  invoiceItem: InvoiceItem;
  @Column() invoiceItemId: string;
  @Column({ name: 'tax_id', nullable: true }) taxId: string;
  @Column({ length: 10 }) taxCode: string;
  @Column('decimal', { precision: 5, scale: 2 }) taxRate: number;
  @Column('decimal', { precision: 12, scale: 2 }) taxAmount: number;
}

// BACKEND — InvoiceItem addition
@Column('decimal', { precision: 12, scale: 2, default: 0 })
taxAmount: number;

@OneToMany(() => InvoiceItemTax, (t) => t.invoiceItem, { cascade: true })
invoiceItemTaxes: InvoiceItemTax[];

// FRONTEND — InvoiceItem addition
export interface InvoiceItem {
  productId: string; quantity: number; unitPrice: number;
  subtotal: number; taxAmount?: number; product?: Product;
  taxes?: InvoiceItemTax[];
}
export interface InvoiceItemTax {
  id: string; taxId?: string; taxCode: string;
  taxRate: number; taxAmount: number;
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| **Backend (Jest)** | `create()` — taxed product (single IVA 19%) | `unitPrice=119000` → `priceBeforeTax=100000`, `taxAmount=19000`, Factus receives `{code:'01', rate:'19.00'}` |
| **Backend (Jest)** | `create()` — multi-tax (IVA 19% + INC 4%) | `unitPrice=123000` → `priceBeforeTax=100000`, IVA 19000, INC 4000, total=23000 |
| **Backend (Jest)** | `create()` — untaxed product | No `InvoiceItemTax` records, Factus item has `taxes: []` |
| **Backend (Jest)** | `create()` — manual invoice (`isElectronic:false`) | No Factus call, no `InvoiceItemTax` persisted |
| **Backend (Jest)** | `emit()` — recalculates taxes | Loads products, persists `InvoiceItemTax`, Factus payload correct |
| **Backend (Jest)** | `InvoiceItemTax` cascade | Delete invoice item → child tax records cascade-deleted |
| **Frontend (Vitest)** | Dialog shows taxes | Renders tax column when `item.taxes` present |
| **Frontend (Vitest)** | Dialog hides taxes | No tax column when `item.taxes` absent |

## Migration / Rollout

`synchronize: true` → TypeORM auto-creates `invoice_item_taxes` table and adds `taxAmount` column on app start. No migration files needed. **Prod risk**: `synchronize: true` can drop data; recommend switching to migrations before prod deploy.

Rollback: drop `invoice_item_taxes`, revert entity changes, revert service logic to hardcoded 19%.

## Open Questions

- [ ] Factus sandbox behavior with `taxes: []` — confirm it accepts empty array vs requiring field omission. Fallback: make `FactusItem.taxes` optional (`taxes?: FactusTax[]`)
- [ ] Credit note / debit note electronic paths still use hardcoded 19% — out of scope per proposal, but should be tracked for follow-up
