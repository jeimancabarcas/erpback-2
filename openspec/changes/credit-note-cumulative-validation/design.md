# Design: Credit Note Cumulative Validation

## Technical Approach

Add a `validateCumulativeLimits()` guard inside `processCreditNoteWithHandler()` that runs **before** `handler.execute()`. It queries existing credit note amounts/quantities for the invoice, computes the new note's totals from the DTO + invoice data, and rejects (400) if the sum exceeds `invoice.totalAmount` or any invoice item quantity. This single injection point covers both electronic and manual credit note paths.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `validateCumulativeLimits()` inside `processCreditNoteWithHandler()` vs. inside each handler | Single point vs. 4x duplication | **processCreditNoteWithHandler** — one guard, both paths covered |
| Pre-compute note amount from DTO items vs. extract from `ScenarioResult` | Extract needs handler to run (too late — would waste work) vs. pre-compute from DTO + invoice | **Pre-compute from DTO** — deterministic, matches handler logic, runs before any persist work |
| Quantity check inside the same loop vs. separate per-product query | Same loop can match productIds; separate query is cleaner | **Separate sum query per productId** — cleaner SQL, easier to test |
| Amount check uses `SUM(amount)` vs. load all notes in memory | SUM is cheaper but needs a raw query | **SUM via queryRunner.manager** — one query, no entity hydration overhead |

## Data Flow

```
createCreditNote(invoiceId, dto)
  │
  ├─ load Invoice + items + product + taxes
  ├─ validate CANCELLED status
  ├─ resolve handler from correctionConceptCode
  │
  └─ processCreditNoteWithHandler(invoice, dto, handler, isElectronic)
       │
       ├─ startTransaction
       ├─ validateCumulativeLimits(invoice, dto, queryRunner)     ← NEW
       │    │
       │    ├─ SUM existing credit note amounts for invoice
       │    ├─ SUM existing credit note item qty per productId
       │    ├─ compute new note amount from dto.items + invoice.items
       │    ├─ (amount) existing + new > invoice.totalAmount → 400
       │    └─ (qty, A/D only) existing + new > invoiceItem.quantity → 400
       │
       ├─ handler.execute(params)           ← unchanged
       ├─ persist CreditNote + Items + Tax   ← unchanged
       ├─ commitTransaction
       └─ return saved CreditNote
```

## Validation Algorithm

### Amount Check (all scenarios)

```
existingAmount = SUM(credit_notes.amount WHERE invoice_id = :id)

newNoteAmount = 0
for each dtoItem in dto.items:
  match invoiceItem by (dtoItem.productId OR invoiceItem.product.sku == dtoItem.codeReference)
  unitPrice = dtoItem.price ?? invoiceItem.unitPrice
  newNoteAmount += dtoItem.quantity * unitPrice

if existingAmount + newNoteAmount > invoice.totalAmount → throw 400
```

### Quantity Check (scenarios A, D only)

```
for each dtoItem where dtoItem.productId is present:
  existingQty = SUM(credit_note_items.quantity
    WHERE product_id = :productId
    AND credit_note_id IN (SELECT id FROM credit_notes WHERE invoice_id = :id))

  invoiceItem = matched invoice item for this dtoItem
  if existingQty + dtoItem.quantity > invoiceItem.quantity → throw 400
```

Scenario detection: `dto.correctionConceptCode in ('1','5','2')` → quantity check applies. Scenarios B (`'3'`) and C (`'4'`) skip quantity check.

## Integration Points

| Point | File | Change |
|-------|------|--------|
| Guard call | `sales.service.ts:720` (inside `processCreditNoteWithHandler`, before `handler.execute`) | Insert `await this.validateCumulativeLimits(invoice, dto, queryRunner.manager)` |
| New method | `sales.service.ts` | Add `private async validateCumulativeLimits(...)` |
| Invoice status guard | `sales.service.ts:1017` | Already exists for CANCELLED — no change |

## Data Queries

```typescript
// Cumulative amount (TypeORM via queryRunner.manager)
const result = await queryRunner.manager
  .createQueryBuilder(CreditNote, 'cn')
  .select('COALESCE(SUM(cn.amount), 0)', 'total')
  .where('cn.invoiceId = :invoiceId', { invoiceId })
  .getRawOne<{ total: string }>();

// Cumulative quantities per productId
const qtyResults = await queryRunner.manager
  .createQueryBuilder(CreditNoteItem, 'cni')
  .select('cni.productId', 'productId')
  .addSelect('COALESCE(SUM(cni.quantity), 0)', 'totalQty')
  .innerJoin(CreditNote, 'cn', 'cn.id = cni.creditNoteId')
  .where('cn.invoiceId = :invoiceId', { invoiceId })
  .andWhere('cni.productId IS NOT NULL')
  .groupBy('cni.productId')
  .getRawMany<{ productId: string; totalQty: string }>();
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/sales/sales.service.ts` | Modify | Add `validateCumulativeLimits()` method + call it in `processCreditNoteWithHandler()` |
| `src/modules/sales/sales.service.spec.ts` | Modify | Add test cases for cumulative validation |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `validateCumulativeLimits` rejects when amount exceeds | Mock `queryRunner.manager.createQueryBuilder` for SUM query; pass DTO with items; assert 400 |
| Unit | `validateCumulativeLimits` rejects when qty exceeds (A/D) | Same setup, assert 400 for productId qty |
| Unit | `validateCumulativeLimits` accepts within limits | Assert no throw |
| Unit | Quantity check skipped for B/C | Pass B/C correctionConceptCode; assert no qty validation |
| Unit | Concurrent 60%+60% — second fails | Simulate SUM reflecting already-saved note in second call |
| Integration | `POST /sales/invoices/:id/credit-note` end-to-end | Create invoice, create one credit note, attempt second that exceeds limit |

## Migration / Rollout

No migration required. This is a pure code-level guard — no schema or data changes. Rollback: revert the validation call and method.

## Open Questions

None.
