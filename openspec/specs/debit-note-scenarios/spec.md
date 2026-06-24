# Debit Note Scenarios

## Purpose

Define per-scenario business rules for debit notes (ND). Scenarios E (financial interest) and F (undercharge correction).

## Requirements

### Requirement: Debit Scenario Router

The system SHALL route debit note creation based on `dto.correctionConceptCode`.

| Code | Scenario | Product | Tax | Validation |
|------|----------|---------|-----|------------|
| 1 | E — Financial Interest | Virtual line item (no productId) | Interest-specific tax rate (MAY be IVA-exempt) | No product lookup |
| 2-4 | F — Undercharge Correction | Maps to invoice product | Proportionate tax | New price > original price |

#### Scenario: E — Financial Interest creates virtual item

- GIVEN invoice INV-001 is overdue and the user creates a debit note with correctionConceptCode `1`
- WHEN the DTO has items with no productId (description-based only)
- THEN a virtual line item is created with the interest amount as subtotal
- AND `consumeStock()` is NOT called (no physical product)
- AND the item uses a default tax rate (configurable, may be 0% if IVA-exempt)
- AND the Factus payload uses interest-specific tax codes

#### Scenario: E — Virtual item has no inventory impact

- GIVEN a financial interest debit note
- WHEN the note is persisted
- THEN `CreditNoteItem.restoreStock` / `InventoryService` is NOT invoked
- AND `productId` is null on the item

#### Scenario: F — Undercharge increases price

- GIVEN invoice item had unitPrice $100, the debit note item sets price to $110
- WHEN the note is created
- THEN the differential ($10) becomes the item's unitPrice for the debit note
- AND taxes are recalculated proportionally on the $10 differential
- AND `consumeStock()` is NOT called

#### Scenario: F — Price must be higher than original

- GIVEN invoice item had unitPrice $100
- WHEN the debit note sets price to $90
- THEN `400 Bad Request` is returned (undercharge requires price increase)
