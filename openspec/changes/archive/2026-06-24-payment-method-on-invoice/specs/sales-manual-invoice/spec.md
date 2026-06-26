# Delta for sales-manual-invoice

## ADDED Requirements

### Requirement: Eager-loaded Payment Relations on API Responses

`SalesService.findAll()` and `SalesService.findOne()` MUST return `paymentMethod` and `paymentType` objects (with `id`, `name`, `code`) eagerly loaded via TypeORM `relations`. Responses SHALL include both objects as nested payload fields.

#### Scenario: findAll returns payment config for all invoices

- GIVEN invoices with various payment methods and types in the database
- WHEN `GET /sales/invoices` is called
- THEN each invoice response contains `paymentMethod` and `paymentType` objects with `id`, `name`, and `code`

#### Scenario: findOne returns resolved payment objects

- GIVEN an invoice with a specific payment method (e.g., Credit Card) and payment type (e.g., Installments)
- WHEN `GET /sales/invoices/{id}` is called
- THEN the response contains `"paymentMethod": { "id": "...", "name": "Credit Card", "code": "55" }` and `"paymentType": { "id": "...", "name": "Installments", "code": "2" }`

### Requirement: Backward-Compatible Factus Payload Defaults

When `paymentMethodId` / `paymentTypeId` are not provided at invoice creation, Factus payloads SHALL use `paymentForm: '1'` (Contado) and `paymentMethodCode: '10'` (Efectivo) — identical to current hardcoded behavior. Existing invoices with NULL payment columns are unaffected.

#### Scenario: Omitted IDs produce current default codes

- GIVEN an invoice created without `paymentMethodId` or `paymentTypeId`
- WHEN the Factus payload is assembled
- THEN `paymentForm` is `'1'` and `paymentMethodCode` is `'10'`

#### Scenario: Provided IDs produce selected codes

- GIVEN an invoice created with `paymentMethodId` targeting code `'55'` and `paymentTypeId` targeting code `'2'`
- WHEN the Factus payload is assembled
- THEN `paymentForm` is `'2'` and `paymentMethodCode` is `'55'`

## MODIFIED Requirements

### Requirement: SalesService — Conditional Factus Gating

`SalesService.create()` MUST gate the entire Factus submission block on `isElectronic !== false`. When `isElectronic` is `false`, the method MUST skip the Factus call and assign a `MAN-xxxx` invoice number instead. The Factus payload MUST include dynamic `paymentForm` and `paymentMethodCode` resolved from `resolvePaymentConfig(dto)` — not hardcoded values. The `consumeStock()` call MUST execute unconditionally regardless of invoice type.
(Previously: Factus payload used hardcoded `paymentForm: '1'` and `paymentMethodCode: '10'`)

**Scenario: Electronic invoice follows current flow**
- GIVEN `dto.isElectronic` is `true` (or absent)
- WHEN `SalesService.create()` runs
- THEN `consumeStock()` is called for each item, then `factusGateway.createInvoice()` is called with resolved payment codes, and the persisted invoice has the Factus-assigned number or `FAC-xxxx` fallback

**Scenario: Manual invoice skips Factus entirely**
- GIVEN `dto.isElectronic` is `false`
- WHEN `SalesService.create()` runs
- THEN `consumeStock()` is called for each item, `factusGateway.createInvoice()` is NOT called, and the persisted invoice has `isElectronic = false`

**Scenario: Manual invoice creation succeeds even when Factus is unavailable**
- GIVEN `dto.isElectronic` is `false` and the Factus API is down
- WHEN `SalesService.create()` runs
- THEN the invoice is persisted successfully because the Factus call is never attempted

### Requirement: Credit Note and Debit Note Blocked for Manual Invoices

`SalesService.createCreditNote()` and `SalesService.createDebitNote()` MUST throw a `BadRequestException` with the message `'Cannot create notes for manual invoices'` when the parent invoice has `isElectronic = false`. For electronic invoices, Factus payloads MUST use dynamically resolved payment codes instead of hardcoded `'1'`/`'10'`.
(Previously: Factus payloads for electronic notes used hardcoded codes)

**Scenario: Credit note attempted on manual invoice is rejected**
- GIVEN an invoice with `isElectronic = false` exists
- WHEN `POST /sales/invoices/{id}/credit-note` is called
- THEN a `400 Bad Request` response is returned with message `'Cannot create notes for manual invoices'`

**Scenario: Credit note on electronic invoice uses dynamic payment codes**
- GIVEN an invoice with `isElectronic = true` that has a specific payment method (code `'55'`) and type (code `'2'`)
- WHEN a credit note is created and the Factus payload is assembled
- THEN `paymentForm` is `'2'` and `paymentMethodCode` is `'55'`