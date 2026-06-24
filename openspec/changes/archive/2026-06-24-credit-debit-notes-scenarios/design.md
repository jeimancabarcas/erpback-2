# Design: Credit/Debit Note Scenarios

## Technical Approach

Replace hardcoded IVA 19% with dynamic product-tax calculation (same pattern as invoice `create()`), add per-scenario strategy routing, and introduce `restoreStock()` FIFO reversal. Apply uniformly across both electronic (`createCreditNote/createDebitNote`) and manual (`createCreditNoteLocal/createDebitNoteLocal`) paths.

Six scenario strategies (A–F) mapped by `correctionConceptCode`, sharing a common tax-recalculation utility and inventory-reversal method.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| Strategy pattern vs. if/else ladder | If/else simpler now but harder to extend; strategy map is O(1) dispatch | Strategy map `Record<string, ScenarioHandler>` in `sales.service.ts` |
| Separate `TaxRecalculationService` vs. inline utility | Service adds DI overhead; utility is pure math with no deps | Inline pure functions in `sales/helpers/tax-recalculator.ts` |
| New `NoteItemTax` entity vs. JSON blob on item | JSON loses referential integrity and queryability | New `CreditNoteItemTax` / `DebitNoteItemTax` entities (same pattern as `InvoiceItemTax`) |
| `restoreStock` LIFO vs. original-batch tracking | LIFO is simplest: reverse `consumeStock` order without storing consumption per batch | LIFO: find batches consumed (`remaining < initial`), restore to most recent consumption first |

## Data Flow

```
DTO → createCreditNote/createDebitNote
  → resolve isElectronicNote (dto ?? invoice)
  → validateNoteElectronicStatus() guard (reject e-note for manual invoice)
  → scenarioRouter(correctionConceptCode)
      ├── A (1/5): validateItemsHaveProductId → proportionalTax(qty) → restoreStock → persist
      ├── B (3): validatePriceLower → proportionalTax(price) → persist
      ├── C (4): validatePriceDiff > 0 → proportionalTax(price) → persist
      ├── D (2): validateNotCancelled → loop items → restoreStock(all) → mark invoice CANCELLED
      └── (electronic): build Factus payload with real tax codes → call gateway → persist
```

### Scenario A Flow (Partial Return)

```
DTO items → match InvoiceItems → validate qty <= invoice qty
  → proportionalTax(InvoiceItemTax, noteQty/invoiceQty)
  → restoreStock(productId, quantity, manager)
  → create CreditNoteItem with productId, purchasePrice, taxAmount
  → save CreditNoteItemTax rows (proportionate from InvoiceItemTax)
  → if electronic: build FactusItems with product taxes → gateway.createCreditNote()
```

### Scenario D Flow (Total Annulment)

```
correctionConceptCode === '2'
  → for each InvoiceItem: restoreStock(productId, item.quantity, manager)
  → reverse ALL InvoiceItemTax amounts
  → set Invoice.status = CANCELLED
  → if electronic: full reversal items → Factus gateway
```

### Scenario E Flow (Financial Interest — Debit Note)

```
correctionConceptCode === '1'
  → virtual item: productId = null, description-based
  → no consumeStock, no restoreStock
  → default tax rate (configurable, may be 0%)
  → interest amount as subtotal
  → if electronic: interest-specific tax codes in Factus payload
```

## Entity Changes

```
CreditNoteItem:
  + productId? (UUID FK → Product, nullable — null for Scenario E-style items)
  + purchasePrice (decimal, nullable — null for scenarios without inventory impact)
  + taxAmount (decimal, default 0)
  + restored (boolean, default false — idempotency guard)
  + noteItemTaxes (OneToMany → CreditNoteItemTax)

DebitNoteItem:
  + productId? (UUID FK → Product, nullable)
  + purchasePrice (decimal, nullable)
  + taxAmount (decimal, default 0)
  + noteItemTaxes (OneToMany → DebitNoteItemTax)

NEW CreditNoteItemTax: id, creditNoteItemId (FK), taxId, taxCode, taxName, taxRate, taxAmount
NEW DebitNoteItemTax:   id, debitNoteItemId (FK),  taxId, taxCode, taxName, taxRate, taxAmount
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `sales/entities/credit-note-item.entity.ts` | Modify | Add productId, purchasePrice, taxAmount, restored, noteItemTaxes |
| `sales/entities/debit-note-item.entity.ts` | Modify | Add productId, purchasePrice, taxAmount, noteItemTaxes |
| `sales/entities/credit-note-item-tax.entity.ts` | Create | New entity for credit note item tax breakdown |
| `sales/entities/debit-note-item-tax.entity.ts` | Create | New entity for debit note item tax breakdown |
| `inventory/entities/inventory-batch.entity.ts` | — | No changes needed (existing structure supports restoreStock) |
| `sales/helpers/tax-recalculator.ts` | Create | Pure functions for proportional tax distribution |
| `sales/helpers/scenario-handler.interface.ts` | Create | Strategy interface + factory |
| `sales/helpers/scenario-a.ts` | Create | Partial return handler |
| `sales/helpers/scenario-b.ts` | Create | Discount handler |
| `sales/helpers/scenario-c.ts` | Create | Price correction handler |
| `sales/helpers/scenario-d.ts` | Create | Total annulment handler |
| `sales/helpers/scenario-e.ts` | Create | Financial interest handler |
| `sales/helpers/scenario-f.ts` | Create | Undercharge correction handler |
| `sales/sales.service.ts` | Modify | Route to scenarios, wire tax calc & restoreStock, replace `price/1.19` |
| `sales/dto/create-sales-note.dto.ts` | Modify | Add `scenarioType` flag, make `productId` optional in item DTO |
| `inventory/inventory.service.ts` | Modify | Add `restoreStock()` |
| `sales/sales.module.ts` | Modify | Register new entities in TypeOrm.forFeature |
| `factus/interfaces/factus-invoicing-gateway.interface.ts` | — | Interface unchanged (already supports dynamic tax codes via `FactusTax[]`) |

## Interfaces / Contracts

```typescript
// tax-recalculator.ts
function calculateProportionalTax(
  invoiceItemTaxes: InvoiceItemTax[],
  factor: { type: 'qty' | 'price'; noteValue: number; invoiceValue: number }
): { taxAmount: number; itemTaxes: { taxId: string; taxCode: string; taxRate: number; amount: number }[] }

// restoreStock on InventoryService
async restoreStock(productId: string, quantity: number, manager?: EntityManager): Promise<number>

// Scenario handler
interface ScenarioHandler {
  execute(params: ScenarioParams): Promise<CreditNote | DebitNote>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `calculateProportionalTax` (qty mode, price mode, rounding) | Pure function tests, no mocks |
| Unit | `restoreStock` (single batch, multi-batch, LIFO order) | In-memory batch list |
| Integration | Each scenario A–F with mocked Invoice + InvoiceItemTax | Test DB with real TypeORM entities |
| Integration | Electronic path: Factus payload matches expected structure | Gateway mock, assert `FactusItem.taxes` has real codes |
| E2E | Full credit-note flow (manual + electronic) | API endpoints with test DB |

## Migration / Rollout

No data migration needed. New columns are nullable (`productId?`, `purchasePrice?`), new entities auto-create via `synchronize: true`. Existing NC/ND records remain valid.

## Open Questions

- [ ] Configurable default tax for Scenario E (financial interest): environment variable or DB setting?
- [ ] Should `restored` flag go on `CreditNoteItem` or as a separate join table for multi-item idempotency?
