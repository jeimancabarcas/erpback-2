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

### Requirement: Cumulative Amount Validation

The system MUST reject a credit note when `SUM(all existing credit note amounts for the same invoice) + new note amount > invoice.totalAmount`. Applies to ALL scenarios (A, B, C, D).

#### Scenario: 60% + 50% amount exceeds invoice total

- GIVEN invoice INV-001 has totalAmount $1000 and one existing credit note for $600
- WHEN a second credit note for $500 is created
- THEN the system returns `400 Bad Request`

#### Scenario: 60% + 40% amount within limit

- GIVEN invoice INV-001 has totalAmount $1000 and one existing credit note for $600
- WHEN a second credit note for $400 is created
- THEN the credit note is accepted

#### Scenario: Single 110% note also rejected

- GIVEN invoice INV-001 has totalAmount $1000 and no existing credit notes
- WHEN a single credit note for $1100 is created
- THEN the system returns `400 Bad Request`

### Requirement: Cumulative Quantity Validation per Product

The system MUST reject a credit note in scenarios A (partial return) and D (total annulment) when `SUM(all existing credit note item quantities per productId for the same invoice) + new note quantity > original invoice item quantity`. MUST NOT apply to scenarios B (discount) or C (price correction).

#### Scenario: Partial return after another return exceeds item quantity

- GIVEN invoice item P-001 has quantity 10 and an existing credit note returned 6 units of P-001
- WHEN a Scenario A credit note requests 5 more units of P-001
- THEN the system returns `400 Bad Request`

#### Scenario: Discount scenario bypasses quantity check

- GIVEN invoice item P-001 has quantity 10 and existing credit notes sum to 9 units returned via Scenario A
- WHEN a Scenario B (discount) credit note for P-001 with quantity 2 is created
- THEN the quantity check is skipped (amount validation still applies)

#### Scenario: Price correction with zero quantity passes

- GIVEN invoice item P-001 has quantity 10
- WHEN a Scenario C (price correction) credit note has quantity 0 for P-001
- THEN the quantity validation is skipped

### Requirement: Transactional Race Condition Guard

The cumulative sum queries MUST execute inside the same database transaction as the credit note creation to prevent concurrent requests from both validating against stale sums.

#### Scenario: Two concurrent 60%+ notes — only one succeeds

- GIVEN invoice INV-001 has totalAmount $1000 and zero existing credit notes
- WHEN two concurrent requests each attempt a $600 credit note
- THEN exactly one succeeds and the other returns `400 Bad Request`
