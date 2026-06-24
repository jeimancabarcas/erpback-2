# Credit Note Scenarios

## Purpose

Define per-scenario business rules for credit notes (NC). Each `correctionConceptCode` maps to a strategy with distinct inventory, tax, and validation logic.

## Requirements

### Requirement: Scenario Router

The system SHALL route credit note creation to a scenario handler based on `dto.correctionConceptCode`. Code `1` (habiles), `2` (annulment), `3` (discount), `4` (price correction), `5` (other/partial return).

| Code | Scenario | Inventory | Tax | Validation |
|------|----------|-----------|-----|------------|
| 1,5 | A — Partial Return | restoreStock() | Proportionate from InvoiceItemTax | Items must reference invoice productIds |
| 3 | B — Discount | None | Recalculated on new price | New price < original price |
| 4 | C — Price Correction | None | Differential adjustment | Price diff > 0 |
| 2 | D — Total Annulment | Loop ALL invoice items, restore ALL stock | Reverse ALL InvoiceItemTax | Invoice.status != CANCELLED |

#### Scenario: Scenario A — Partial Return restores inventory

- GIVEN invoice INV-001 has 10 units of product P-001 with 3 remaining InventoryBatch units at $10 and 7 units at $12
- WHEN a credit note is created for product P-001 with quantity 4 (Scenario A)
- THEN `restoreStock(P-001, 4)` is called with FIFO: 3 units restored to batch 1, 1 unit to batch 2
- AND the note item records `productId`, `purchasePrice`, `taxAmount`, and links to `InvoiceItemTax` records for the returned quantity proportion

#### Scenario: Scenario A — quantity exceeds invoice quantity rejected

- GIVEN invoice item has quantity 5
- WHEN a credit note item has quantity 6
- THEN the system returns `400 Bad Request`

#### Scenario: Scenario B — Discount no inventory change

- GIVEN invoice item has unitPrice $100, quantity 2
- WHEN a credit note (discount) sets price to $90
- THEN `restoreStock()` is NOT called
- AND tax is recalculated proportionally using `tax-recalculation-engine`

#### Scenario: Scenario C — Price correction adjusts tax

- GIVEN invoice item had unitPrice $100, tax $19
- WHEN a credit note (price correction) sets price to $80
- THEN tax is $15.20 (proportionate: 19 * 80/100)
- AND inventory is NOT modified

#### Scenario: Scenario D — Total Annulment cancels invoice

- GIVEN invoice INV-001 with status PAID has 3 items totaling $1000
- WHEN a credit note with code `2` (annulment) is created
- THEN ALL items are credited with full quantities
- AND `restoreStock()` is called for EACH item's full quantity across ALL purchased batches
- AND invoice.status becomes `CANCELLED`
- AND taxes are fully reversed

### Requirement: Invoice Status Guard

The system MUST reject credit notes for invoices with `status = CANCELLED`.

#### Scenario: Reject on cancelled invoice

- GIVEN invoice status is CANCELLED
- WHEN `createCreditNote()` is called
- THEN `400 Bad Request` is returned
