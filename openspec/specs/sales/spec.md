# Sales — Adjustment Note Emission

## Purpose

This spec covers credit/debit note creation with electronic status awareness: the invoice detail dialog reloads notes after creation, and both frontend and backend guard against emitting electronic notes for manual invoices.

## Requirements

### Requirement: Modal Reload After Note Creation

When the adjustment form dialog closes after creating a note, the invoice detail dialog MUST reload the notes list using `loadNotes(invoiceId)` without requiring the user to re-open the dialog. The `openAdjustmentDialog()` method MUST subscribe to `dialogRef.afterClosed()` and, when `result?.success` is truthy, trigger a reload. The dialog data passed to the adjustment form MUST include `isElectronic` from the parent invoice.

#### Scenario: Notes list refreshes after successful note creation

- GIVEN the invoice detail dialog is open showing invoice INV-001
- WHEN the user clicks "Emitir Nota (Crédito/Débito)"
- AND the adjustment form dialog creates a note and returns `{ success: true }`
- THEN `loadNotes(inv.id)` is called via the `afterClosed()` subscription
- AND the notes section displays the newly created note without re-opening the dialog

#### Scenario: Notes list does NOT reload on dialog cancel

- GIVEN the invoice detail dialog is open
- WHEN the adjustment form dialog is closed without submitting (no result)
- THEN `loadNotes()` is NOT called
- AND the notes list remains unchanged

#### Scenario: Notes list unchanged on failed creation

- GIVEN the adjustment form dialog is open
- WHEN the submission fails and the dialog closes without `success: true`
- THEN `loadNotes()` is NOT called
- AND the existing notes list is preserved

#### Scenario: Dialog data includes `isElectronic`

- GIVEN the invoice detail dialog has `invoice.isElectronic`
- WHEN `openAdjustmentDialog()` opens the adjustment form
- THEN the dialog data MUST include `{ invoice: { ..., isElectronic: invoice.isElectronic } }`
- AND the adjustment form receives the parent invoice's electronic status

### Requirement: Conditional Electronic Toggle — Frontend

The "Nota Electrónica (DIAN)" toggle in the adjustment form dialog SHALL be disabled when the parent invoice is not electronic (`isElectronic = false`). The toggle's default value MUST match the parent invoice's `isElectronic` value. When the toggle is disabled, AND the invoice is manual, a visual explanation SHALL be shown indicating that electronic notes require an electronic invoice.

#### Scenario: Toggle disabled for manual invoices

- GIVEN the adjustment form dialog receives `invoice.isElectronic = false`
- WHEN the dialog renders
- THEN the slide-toggle for "Nota Electrónica (DIAN)" is disabled
- AND `isElectronic` signal is set to `false`
- AND an explanation message is displayed in the UI

#### Scenario: Toggle defaults to electronic for electronic invoices

- GIVEN the adjustment form dialog receives `invoice.isElectronic = true`
- WHEN the dialog renders
- THEN the slide-toggle is enabled
- AND `isElectronic` signal is set to `true`
- AND the user MAY toggle it off if they want a manual note

#### Scenario: Toggle state propagates to DTO on submission

- GIVEN the adjustment form is rendered with toggle disabled and `isElectronic = false`
- WHEN the user submits the form
- THEN the DTO sent to the backend MUST include `isElectronic: false`
- GIVEN the toggle is enabled and checked (`isElectronic = true`)
- WHEN the user submits the form
- THEN the DTO MUST include `isElectronic: true`

### Requirement: Conditional Electronic Guard — Backend

The backend `SalesService.createCreditNote()` and `SalesService.createDebitNote()` MUST reject electronic credit/debit note creation when the parent invoice is not electronic (`invoice.isElectronic === false`), returning a 400 Bad Request with a descriptive message. The guard MUST be evaluated AFTER resolving `isElectronicNote` from `dto.isElectronic ?? invoice.isElectronic`. This is defense-in-depth — the frontend also prevents this, but the backend MUST enforce the invariant at the data boundary.

#### Scenario: Backend rejects electronic note for manual invoice

- GIVEN an invoice with `isElectronic = false`
- WHEN `POST /sales/invoices/{id}/credit-note` is called with `isElectronic: true` in the DTO
- THEN the backend returns `400 Bad Request`
- AND the response message indicates that electronic adjustment notes can only be emitted for electronic invoices
- AND no CreditNote record is persisted

#### Scenario: Backend rejects electronic debit note for manual invoice

- GIVEN an invoice with `isElectronic = false`
- WHEN `POST /sales/invoices/{id}/debit-note` is called with `isElectronic: true` in the DTO
- THEN the backend returns `400 Bad Request`
- AND the response message indicates that electronic adjustment notes can only be emitted for electronic invoices
- AND no DebitNote record is persisted

#### Scenario: Backend allows manual note for manual invoice

- GIVEN an invoice with `isElectronic = false`
- WHEN `POST /sales/invoices/{id}/credit-note` is called with `isElectronic: false` or omitted
- THEN the backend processes the request normally via the local path
- AND no 400 error is thrown for electronic status

#### Scenario: Backend allows electronic note for electronic invoice (unchanged)

- GIVEN an invoice with `isElectronic = true`
- WHEN `POST /sales/invoices/{id}/credit-note` is called with `isElectronic: true` or omitted
- THEN the backend processes the request via the Factus electronic path
- AND the existing electronic note emission logic is unchanged

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
