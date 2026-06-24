# Tax Recalculation Engine

## Purpose

Compute proportional tax amounts for credit/debit note items based on original `InvoiceItemTax` records. Removes hardcoded IVA 19%.

## Requirements

### Requirement: Proportional Tax Distribution

When a note item references an invoice item, the system MUST compute taxes proportionally to the quantity or price change.

Two modes:

| Mode | Trigger | Calculation |
|------|---------|-------------|
| Quantity-based | Scenario A (partial return) | `taxAmount = originalTaxAmount * (noteQty / invoiceQty)` |
| Price-based | Scenarios B, C, F | `taxAmount = originalTaxAmount * (notePrice / originalPrice)` |

#### Scenario: Quantity-proportional tax

- GIVEN invoice item has `InvoiceItemTax` with IVA $19.00 for quantity 10
- WHEN a credit note returns quantity 3 (Scenario A)
- THEN each `InvoiceItemTax.taxAmount` on the note item = $19.00 × (3/10) = $5.70

#### Scenario: Price-proportional tax

- GIVEN invoice item has IVA $19.00 at $100 unit price
- WHEN a credit note (discount) reduces price to $80
- THEN tax = $19.00 × (80/100) = $15.20

### Requirement: Rounding

All tax amounts MUST be rounded to 2 decimal places using banker's rounding (half-to-even).

#### Scenario: Rounding edge case

- GIVEN proportional tax = $1.005
- WHEN rounded
- THEN tax = $1.00 (not $1.01)

### Requirement: Multi-Tax Support

If a product has multiple taxes (e.g., IVA 19% + ICA 0.5%), each tax MUST be proportionally distributed independently.

#### Scenario: Two taxes on same item

- GIVEN invoice item has IVA $19.00 and ICA $0.50 for 10 units
- WHEN quantity 5 is returned
- THEN note item gets IVA $9.50 AND ICA $0.25
