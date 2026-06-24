# Delta for Sales — Adjustment Note Emission

## MODIFIED Requirements

### Requirement: Tax Calculation

The system MUST compute item taxes using the product's configured `Tax` relations (from `product.taxes` M2M) instead of hardcoded IVA 19%. The `priceBeforeTax` formula `price / (1 + totalTaxRate/100)` MUST use the sum of the product's tax percentages. This applies to BOTH `createCreditNote`/`createCreditNoteLocal` and `createDebitNote`/`createDebitNoteLocal`.

(Previously: hardcoded `price / 1.19` with IVA tax code `01`/rate `19.00` in both electronic and manual paths)

#### Scenario: Electronic NC uses dynamic tax rates

- GIVEN invoice has product P-001 with taxes IVA 19% and ICA 0.5%
- WHEN an electronic credit note is created for P-001
- THEN the Factus payload includes taxes `[{code: "01", rate: "19.00"}, {code: "03", rate: "0.50"}]`
- AND `priceBeforeTax` = `unitPrice / (1 + 0.195)`

#### Scenario: Local NC uses dynamic tax rates

- GIVEN invoice has product P-001 with IVA 19%
- WHEN a manual credit note is created via `createCreditNoteLocal`
- THEN the note item stores calculated `taxAmount` from the product's tax configuration
- AND `InvoiceItemTax` records are created for the note item

#### Scenario: Tax rate change between invoice and note

- GIVEN product tax rate increased from 19% to 21% after invoice emission
- WHEN a credit note references the invoice item
- THEN the note MUST use the ORIGINAL tax rate from the invoice's `InvoiceItemTax` records

### Requirement: Note Item Entity

CreditNoteItem and DebitNoteItem MUST include `productId`, `purchasePrice`, `taxAmount`, and a `OneToMany` relation to `InvoiceItemTax`.

(Previously: only `codeReference`, `name`, `quantity`, `unitPrice`, `subtotal`)

#### Scenario: Note created with product fields

- GIVEN a credit note item references invoice item with `productId: "P-001"`, `purchasePrice: $8`, `taxAmount: $1.90`
- WHEN the item is persisted
- THEN `CreditNoteItem.productId = "P-001"`, `purchasePrice = 8.00`, `taxAmount = 1.90`
- AND the item has `invoiceItemTaxes` relation with proportional tax records

## ADDED Requirements

### Requirement: scenarioType Discriminator

The `CreateSalesNoteDto` MUST include a `scenarioType` field derived from `correctionConceptCode`. This SHALL route to the correct scenario strategy.

#### Scenario: Scenario type derived from concept code

- GIVEN `correctionConceptCode = "3"` for a credit note
- WHEN `createCreditNote()` is called
- THEN `scenarioType = "discount"` is derived
- AND the scenario B handler executes (no inventory, proportional tax)

### Requirement: Inventory Reversal on Return

When a credit note is created with concept codes `1`, `2`, or `5` (scenarios involving inventory), the system MUST call `InventoryService.restoreStock()` for each returned product item.

#### Scenario: Inventory restored for partial return

- GIVEN a partial return credit note for product P-001, qty 3
- WHEN the note is saved
- THEN `restoreStock("P-001", 3, manager)` is called within the same transaction
