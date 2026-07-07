# purchase-orders Specification

## Purpose

Define the behavior for correcting the pre-tax pricing gap in support document emission and enabling adjustment notes (notas de ajuste) for purchase orders with electronic support documents. An adjustment note represents a total annulment (concept 2) of a purchase order that was already emitted to Factus, reversing stock and cancelling the order.

## Requirements

### Requirement: Pre-tax Price in Support Document Emission

The system MUST send pre-tax (`priceBeforeTax`) prices to Factus when emitting support documents, and MUST compute the payment total using integer-cents arithmetic via `computeFactusTotal()`.

#### Scenario: Item prices are sent as priceBeforeTax

- GIVEN a purchase order with items that have tax-inclusive `price` values and associated product taxes
- WHEN `emitSupportDocument()` is called
- THEN the system SHALL compute `priceBeforeTax = unitPrice / (1 + totalTaxRate/100)` for each item using the product's current tax rates
- AND the Factus payload SHALL include `price: priceBeforeTax` for each item
- AND `price` in the Factus payload SHALL NOT be the raw tax-inclusive `Number(item.price)`

#### Scenario: Payment total uses computeFactusTotal

- GIVEN a purchase order with multiple items and varying tax rates
- WHEN `emitSupportDocument()` builds the payment details
- THEN `paymentDetails[0].amount` SHALL equal the result of `computeFactusTotal()` (integer-cents arithmetic)
- AND the total SHALL NOT be computed via manual floating-point arithmetic on tax-inclusive prices

#### Scenario: computeFactusTotal matches Factus server-side totals

- GIVEN a purchase order with items and taxes
- WHEN the support document is emitted to Factus
- THEN the payment amount sent SHALL match the total computed by Factus on the server
- AND there SHALL be no discrepancy between the sent amount and the Factus-validated total

#### Scenario: Supplier validation is unchanged

- GIVEN a supplier missing required Factus fields (NIT, name, address, municipalityCode, legalOrganizationCode)
- WHEN `emitSupportDocument()` is called
- THEN the system SHALL reject the request with `BadRequestException` listing the missing fields
- AND the validation logic SHALL be identical to the pre-fix behavior

#### Scenario: Existing guards are unchanged

- GIVEN a purchase order that already has a support document emitted
- WHEN `emitSupportDocument()` is called
- THEN the system SHALL reject with `ConflictException`: "Ya existe un documento soporte para esta orden"

### Requirement: Adjustment Note Emission (Concept 2 — Total Annulment)

The system MUST support emitting an adjustment note for a purchase order that has an electronic support document, using only correction concept code `'2'` (total annulment). The adjustment note SHALL be sent to Factus and persisted locally.

#### Scenario: Successful adjustment note emission

- GIVEN a purchase order with an emitted and validated support document
- AND the purchase order has items with known quantities and prices
- AND the supplier has all required Factus fields
- WHEN `emitAdjustmentNote()` is called with `correctionConceptCode: '2'`
- THEN the system SHALL consume stock for ALL purchase order items via `inventoryService.consumeStock()`
- AND the system SHALL build a Factus payload with `correctionConceptCode: '2'`, the support document number, and items with `priceBeforeTax`
- AND the system SHALL call `factusGateway.createSupportDocumentAdjustmentNote()`
- AND the system SHALL persist a `PurchaseOrderAdjustmentNote` entity with the Factus response data
- AND the system SHALL set the purchase order status to `'CANCELLED'`
- AND the adjustment note SHALL be linked to both the purchase order and the support document

#### Scenario: Only concept 2 is accepted

- GIVEN a purchase order with a support document
- WHEN `emitAdjustmentNote()` is called with `correctionConceptCode` not equal to `'2'`
- THEN the system SHALL reject the request with `BadRequestException`
- AND the message SHALL indicate that only total annulment (concept 2) is supported

#### Scenario: All items are processed for total annulment

- GIVEN a purchase order with 3 items
- WHEN an adjustment note is emitted with concept 2
- THEN ALL 3 items SHALL be included in the Factus payload
- AND ALL 3 items SHALL have stock consumed
- AND no item filtering or partial selection SHALL occur

#### Scenario: Pre-tax prices in adjustment note items

- GIVEN a purchase order item with tax-inclusive `price` and product taxes with total rate 19%
- WHEN building Factus items for the adjustment note
- THEN `priceBeforeTax` SHALL be computed as `unitPrice / 1.19`
- AND the Factus item `price` field SHALL contain `priceBeforeTax`, not the tax-inclusive value

#### Scenario: Adjustment note items include tax breakdown

- GIVEN a purchase order item with product taxes
- WHEN building the Factus payload for an adjustment note
- THEN each item's `taxes` array SHALL include entries with `code` and `rate` for each tax on the product
- AND the tax rates SHALL be the current rates from the product at emission time

### Requirement: Adjustment Note Guards

The system MUST enforce guards to prevent invalid adjustment note emission.

#### Scenario: Support document must exist

- GIVEN a purchase order with NO support document emitted
- WHEN `emitAdjustmentNote()` is called
- THEN the system SHALL reject with an appropriate error
- AND the message SHALL indicate that a support document must exist before emitting an adjustment note

#### Scenario: No duplicate adjustment notes

- GIVEN a purchase order that already has an adjustment note
- WHEN `emitAdjustmentNote()` is called again
- THEN the system SHALL reject with `ConflictException`
- AND the message SHALL indicate that an adjustment note already exists for this order

#### Scenario: Purchase order not already cancelled

- GIVEN a purchase order with status `'CANCELLED'`
- WHEN `emitAdjustmentNote()` is called
- THEN the system SHALL reject with `ConflictException`
- AND the message SHALL indicate that the order is already cancelled

#### Scenario: Supplier must have Factus fields

- GIVEN a purchase order with a support document but the supplier is missing Factus-required fields
- WHEN `emitAdjustmentNote()` is called
- THEN the system SHALL reject with `BadRequestException`
- AND the missing fields SHALL be listed in the error message

#### Scenario: Support document must have a Factus number

- GIVEN a purchase order with a support document that has `number: null` (e.g., emission to Factus failed)
- WHEN `emitAdjustmentNote()` is called
- THEN the system SHALL reject with an appropriate error
- AND the message SHALL indicate that the support document was not successfully emitted to Factus

### Requirement: Stock Reversal on Adjustment Note

The system MUST reverse the stock impact of a purchase order when an adjustment note is emitted, using `inventoryService.consumeStock()` for each item.

#### Scenario: Stock consumed for each item

- GIVEN a purchase order with items: "Widget A" (qty 5) and "Widget B" (qty 3)
- AND the original purchase increased stock by those quantities
- WHEN an adjustment note is emitted
- THEN `consumeStock()` SHALL be called for "Widget A" with quantity 5
- AND `consumeStock()` SHALL be called for "Widget B" with quantity 3
- AND the `referenceType` context SHALL be `'PURCHASE_ORDER_ADJUSTMENT'`

#### Scenario: Stock consumption happens within transaction

- GIVEN a purchase order with items
- WHEN an adjustment note is being emitted
- THEN the stock consumption for all items and the adjustment note persistence SHALL be wrapped in a single TypeORM transaction
- AND if `consumeStock()` fails for any item, the entire transaction SHALL roll back
- AND no adjustment note entity SHALL be persisted
- AND no partial stock changes SHALL be applied

#### Scenario: consumeStock uses PURCHASE_ORDER_ADJUSTMENT reference type

- GIVEN an adjustment note is being emitted
- WHEN `consumeStock()` is called for each item
- THEN the context SHALL include `referenceType: 'PURCHASE_ORDER_ADJUSTMENT'`
- AND the `referenceId` SHALL be the adjustment note ID
- AND the inventory movement SHALL be distinguishable from direct purchase order cancellation reversals

#### Scenario: Stock direction is opposite of credit notes

- GIVEN a purchase order was created (stock was added to inventory)
- WHEN an adjustment note annuls the purchase order
- THEN stock SHALL be removed from inventory (consume)
- AND this SHALL be the opposite of credit note stock behavior (which restores stock for sale reversals)

### Requirement: Purchase Order Status on Adjustment

The system MUST set the purchase order status to `'CANCELLED'` upon successful adjustment note emission, using the adjustment note's presence as the discriminator between direct cancellation and adjustment-note cancellation.

#### Scenario: Status set to CANCELLED

- GIVEN a purchase order with status `'PLACED'` (or equivalent post-simplification status)
- WHEN an adjustment note is emitted successfully
- THEN the purchase order status SHALL be updated to `'CANCELLED'`
- AND the status change SHALL be persisted in the same transaction

#### Scenario: Discriminator via adjustment note entity

- GIVEN a purchase order with status `'CANCELLED'`
- WHEN determining if it was cancelled directly or via adjustment note
- THEN the presence of a related `PurchaseOrderAdjustmentNote` entity SHALL indicate adjustment-note cancellation
- AND the absence of an adjustment note SHALL indicate direct cancellation

### Requirement: Factus Error Handling for Adjustment Notes

The system MUST handle Factus errors during adjustment note emission gracefully, preventing local state changes when the Factus call fails.

#### Scenario: Factus create fails before stock consumption

- GIVEN the Factus create call fails (network error, validation error, etc.)
- WHEN `emitAdjustmentNote()` is called
- THEN the system SHALL throw an appropriate error
- AND no stock SHALL have been consumed
- AND no adjustment note entity SHALL have been persisted
- AND the purchase order status SHALL remain unchanged

#### Scenario: Factus error message propagated to caller

- GIVEN the Factus API returns an error response
- WHEN `emitAdjustmentNote()` processes the response
- THEN the error SHALL be wrapped in a `BadRequestException`
- AND the message SHALL include the Factus error details: "Error al emitir nota de ajuste en Factus: {details}"

#### Scenario: Adjustment note destruction on Factus

- GIVEN an adjustment note was emitted and needs to be voided
- WHEN `destroySupportDocumentAdjustmentNote()` is called on the Factus gateway
- THEN the system SHALL call the Factus API DELETE endpoint with the adjustment note reference code
- AND the gateway SHALL return `{ status, message }`

### Requirement: Adjustment Note Entities

The system MUST include three new entities to model purchase order adjustment notes: header, items, and tax breakdown.

#### Scenario: PurchaseOrderAdjustmentNote entity structure

- GIVEN the database schema
- WHEN the `purchase_order_adjustment_notes` table is inspected
- THEN the table SHALL have columns: `id` (uuid PK), `reference_code` (unique), `note_number`, `cude`, `correction_concept_code`, `amount`, `observation`, `qr_url`, `public_url`, `purchase_order_id` (FK), `support_document_id` (FK), `created_at`, `updated_at`
- AND the entity SHALL have `@ManyToOne` relations to `PurchaseOrder` and `PurchaseOrderSupportDocument`
- AND the entity SHALL have `@OneToMany` relation to `PurchaseOrderAdjustmentNoteItem` with cascade

#### Scenario: PurchaseOrderAdjustmentNoteItem entity structure

- GIVEN the database schema
- WHEN the `purchase_order_adjustment_note_items` table is inspected
- THEN the table SHALL have columns: `id` (uuid PK), `code_reference`, `name`, `quantity`, `unit_price`, `subtotal`, `product_id`, `tax_amount`, `consumed` (boolean), `adjustment_note_id` (FK)
- AND the entity SHALL have `@ManyToOne` relations to `PurchaseOrderAdjustmentNote` and `Product`
- AND the entity SHALL have `@OneToMany` relation to `PurchaseOrderAdjustmentNoteItemTax` with cascade

#### Scenario: PurchaseOrderAdjustmentNoteItemTax entity structure

- GIVEN the database schema
- WHEN the `purchase_order_adjustment_note_item_taxes` table is inspected
- THEN the table SHALL have columns: `id` (uuid PK), `tax_id`, `tax_code`, `tax_name`, `tax_rate`, `tax_amount`, `adjustment_note_item_id` (FK)
- AND the entity SHALL have `@ManyToOne` relation to `PurchaseOrderAdjustmentNoteItem`

#### Scenario: PurchaseOrder entity relation update

- GIVEN the `PurchaseOrder` entity
- WHEN the entity definition is inspected
- THEN it SHALL include an optional `@OneToMany` relation `adjustmentNotes` targeting `PurchaseOrderAdjustmentNote`

#### Scenario: No explicit migration required

- GIVEN the application uses TypeORM `synchronize: true`
- WHEN the new entities are defined with proper decorators
- THEN the database tables SHALL be auto-created
- AND no manual migration file SHALL be required

### Requirement: Backend Controller Endpoints

The system MUST expose REST endpoints for adjustment note operations.

#### Scenario: POST endpoint for adjustment note emission

- GIVEN the backend is running
- WHEN a POST request is sent to `/purchase-orders/:id/adjustment-note` with body `{ correctionConceptCode: '2', observation?: string }`
- THEN the system SHALL call `purchaseOrdersService.emitAdjustmentNote(id, dto)`
- AND return the created `PurchaseOrderAdjustmentNote`

#### Scenario: GET endpoint for adjustment note PDF download

- GIVEN the backend is running
- WHEN a GET request is sent to `/purchase-orders/:id/adjustment-note/:noteId/pdf`
- THEN the system SHALL call `purchaseOrdersService.downloadAdjustmentNotePdf(id, noteId)`
- AND return the PDF as base64-encoded data with filename

### Requirement: Frontend Adjustment Note UI

The system MUST provide UI controls in the purchase order detail modal for emitting adjustment notes and downloading their PDFs.

#### Scenario: Emitir nota de ajuste button appears for eligible orders

- GIVEN the purchase order detail modal is open for an order with an emitted support document
- AND the order does NOT already have an adjustment note
- AND the order status is NOT `'CANCELLED'`
- WHEN the modal renders the actions footer
- THEN an "Emitir nota de ajuste" button SHALL be visible

#### Scenario: Button disabled when adjustment note exists

- GIVEN the purchase order detail modal is open for an order that already has an adjustment note
- WHEN the modal renders the actions footer
- THEN the "Emitir nota de ajuste" button SHALL be disabled
- AND the tooltip SHALL indicate "Nota de ajuste ya emitida"

#### Scenario: Button hidden for orders without support document

- GIVEN the purchase order detail modal is open for an order with NO support document
- WHEN the modal renders the actions footer
- THEN the "Emitir nota de ajuste" button SHALL NOT be visible

#### Scenario: Adjustment note info section displays after emission

- GIVEN a purchase order has an adjustment note
- WHEN the detail modal renders the content area
- THEN a section SHALL display the adjustment note number and CUDE
- AND the section SHALL use a distinct visual style (e.g., yellow/amber) from the support document section (green)

#### Scenario: Descargar PDF button for adjustment note

- GIVEN a purchase order has an adjustment note
- WHEN the detail modal renders the actions footer
- THEN a "Descargar PDF nota de ajuste" button SHALL be visible
- AND clicking it SHALL call the backend PDF download endpoint

#### Scenario: Status reflects cancellation

- GIVEN a purchase order was cancelled via adjustment note
- WHEN the detail modal renders
- THEN the status badge SHALL show "Cancelada"
- AND the cancelled state message SHALL be displayed in the actions footer

#### Scenario: Loading states during emission and download

- GIVEN the user clicks "Emitir nota de ajuste"
- WHEN the request is in progress
- THEN the button SHALL show a spinner and "Emitiendo..." text
- AND all other action buttons SHALL be disabled

#### Scenario: Error display

- GIVEN the adjustment note emission fails
- WHEN the error response is received
- THEN the error message SHALL be displayed in the modal's error banner
- AND no local state SHALL be changed (the order remains in its previous state)

### Requirement: Frontend Model and Service Extensions

The system MUST include TypeScript interfaces and HTTP service methods for adjustment note operations.

#### Scenario: PurchaseOrderAdjustmentNote interface

- GIVEN the frontend model file `purchase-order.model.ts`
- WHEN the file is inspected
- THEN an interface `PurchaseOrderAdjustmentNote` SHALL be defined with fields: `id`, `referenceCode`, `noteNumber`, `cude`, `correctionConceptCode`, `amount`, `observation`, `qrUrl`, `publicUrl`, `items`, `createdAt`

#### Scenario: PurchaseOrderAdjustmentNoteItem interface

- GIVEN the frontend model file
- WHEN the file is inspected
- THEN an interface `PurchaseOrderAdjustmentNoteItem` SHALL be defined with fields: `codeReference`, `name`, `quantity`, `unitPrice`, `subtotal`, `productId`, `taxAmount`, `consumed`

#### Scenario: CreateAdjustmentNoteDto interface

- GIVEN the frontend model file
- WHEN the file is inspected
- THEN an interface `CreateAdjustmentNoteDto` SHALL be defined with fields: `correctionConceptCode: string`, `observation?: string`

#### Scenario: PurchaseOrderService HTTP methods

- GIVEN the frontend `PurchaseOrderService`
- WHEN the service is inspected
- THEN an `emitAdjustmentNote(orderId, dto)` method SHALL exist returning `Observable<PurchaseOrderAdjustmentNote>`
- AND a `downloadAdjustmentNotePdf(noteId)` method SHALL exist returning `Observable<{ pdfBase64Encoded, fileName }>`

### Non-Functional Requirements

#### NFR: Transactional Integrity

Adjustment note emission, stock consumption for all items, and purchase order status update MUST be wrapped in a single TypeORM transaction. If any step fails, the entire operation SHALL roll back, leaving no partial state.

#### NFR: computeFactusTotal Integer-Cents Arithmetic

The `computeFactusTotal()` utility (shared with sales module) MUST be used for all Factus payment total computations in the support document flow. Direct floating-point arithmetic SHALL NOT be used for monetary totals sent to Factus.

#### NFR: No Regressions

Existing purchase order operations (create, update, delete, emit support document, download support document PDF, cancel) MUST continue to work without behavioral changes. The pre-tax fix SHALL only affect newly emitted support documents.

#### NFR: TypeORM Synchronize

The application uses `synchronize: true` for schema management. New entities SHALL be auto-created by TypeORM on application startup. No manual migration files SHALL be required or generated for this change.
