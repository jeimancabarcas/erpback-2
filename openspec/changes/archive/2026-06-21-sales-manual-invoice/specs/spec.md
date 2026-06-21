# Spec: sales-manual-invoice

## Domain: sales-manual-invoice

### Purpose

This change introduces support for creating sales invoices that are intentionally excluded from DIAN electronic billing via Factus. A new boolean discriminator field `isElectronic` is added to the `Invoice` entity and propagated through the entire stack — backend entity, TypeORM migration, DTO validation, service logic, API responses, and Angular frontend. When `isElectronic` is `false`, the Factus submission block is skipped entirely and the invoice receives a locally-generated `MAN-xxxx` number instead of a DIAN-assigned number. Inventory stock reduction via `consumeStock()` always runs regardless of invoice type. Credit notes and debit notes on manual invoices are explicitly blocked at the service layer. The frontend exposes a `MatSlideToggle` labeled "Venta manual" with an inline amber warning and renders a "MANUAL" badge in the invoice list; the PDF download button is hidden for manual invoices.

---

### Requirements

---

#### Requirement: Invoice Entity Discriminator Field

The `Invoice` entity MUST expose an `isElectronic` boolean column mapped to `is_electronic` in the `invoices` table, defaulting to `true`, NOT NULL.

**Scenario: New column is present on entity**
- Given: the `Invoice` TypeORM entity is loaded
- When: a developer inspects its column metadata
- Then: a column named `is_electronic` exists with type `boolean`, `nullable: false`, and `default: true`

**Scenario: Existing rows are not broken after migration**
- Given: the `invoices` table has pre-existing rows with no `is_electronic` value
- When: the migration runs `ADD COLUMN is_electronic BOOLEAN NOT NULL DEFAULT TRUE`
- Then: all pre-existing rows have `is_electronic = true` and no constraint violation occurs

---

#### Requirement: TypeORM Migration for is_electronic

The codebase MUST contain a TypeORM migration that adds the `is_electronic` column with `NOT NULL DEFAULT TRUE` to the `invoices` table. The migration MUST be reversible (i.e., include a `down()` that drops the column).

**Scenario: Migration up adds column with default**
- Given: a database with the current `invoices` schema (no `is_electronic` column)
- When: the migration `up()` is executed
- Then: the `invoices` table gains a column `is_electronic BOOLEAN NOT NULL DEFAULT TRUE` and all existing rows satisfy the constraint

**Scenario: Migration down removes column cleanly**
- Given: a database with `is_electronic` column present
- When: the migration `down()` is executed
- Then: the `is_electronic` column is dropped without error

---

#### Requirement: CreateInvoiceDto Optional isElectronic Field

`CreateInvoiceDto` MUST accept an optional `isElectronic?: boolean` field. When the field is absent from the request body, the service MUST treat it as `true` (electronic). The field MUST be validated as boolean when present.

**Scenario: Request without isElectronic defaults to electronic**
- Given: a POST `/sales/invoices` request body that does not include `isElectronic`
- When: the DTO is deserialized and the service processes it
- Then: `isElectronic` is treated as `true` and the Factus block executes normally

**Scenario: Request with isElectronic: false marks the invoice as manual**
- Given: a POST `/sales/invoices` request body containing `"isElectronic": false`
- When: the DTO is deserialized
- Then: `dto.isElectronic` is `false` and the service skips the Factus block

**Scenario: Request with non-boolean isElectronic is rejected**
- Given: a POST `/sales/invoices` request body containing `"isElectronic": "yes"`
- When: the validation pipe processes the DTO
- Then: a `400 Bad Request` is returned with a validation error on the `isElectronic` field

---

#### Requirement: SalesService — Conditional Factus Gating

`SalesService.create()` MUST gate the entire Factus submission block on `isElectronic !== false`. When `isElectronic` is `false`, the method MUST skip the Factus call and assign a `MAN-xxxx` invoice number instead. The `consumeStock()` call MUST execute unconditionally regardless of invoice type.

**Scenario: Electronic invoice follows current flow**
- Given: `dto.isElectronic` is `true` (or absent)
- When: `SalesService.create()` runs
- Then: `consumeStock()` is called for each item, then `factusGateway.createInvoice()` is called, and the persisted invoice has the Factus-assigned number (e.g., `SETP990003678`) or the `FAC-xxxx` fallback

**Scenario: Manual invoice skips Factus entirely**
- Given: `dto.isElectronic` is `false`
- When: `SalesService.create()` runs
- Then: `consumeStock()` is called for each item, `factusGateway.createInvoice()` is NOT called, and the persisted invoice has `isElectronic = false`

**Scenario: Manual invoice creation succeeds even when Factus is unavailable**
- Given: `dto.isElectronic` is `false` and the Factus API is down or unreachable
- When: `SalesService.create()` runs
- Then: the invoice is persisted successfully because the Factus call is never attempted

---

#### Requirement: Manual Invoice Numbering (MAN-xxxx)

When `isElectronic` is `false`, `SalesService.create()` MUST generate an invoice number using the pattern `MAN-{count}` where `count` is the total number of existing invoices with `isElectronic = false` plus one, zero-padded to four digits (e.g., `MAN-0001`). This count MUST be scoped exclusively to manual invoices to avoid collisions with `FAC-xxxx` or DIAN numbers.

**Scenario: First manual invoice gets MAN-0001**
- Given: no manual invoices exist in the database (`isElectronic = false` count = 0)
- When: `SalesService.create()` is called with `isElectronic: false`
- Then: the persisted invoice has `invoiceNumber = 'MAN-0001'`

**Scenario: Nth manual invoice gets correct sequential number**
- Given: three manual invoices already exist (`isElectronic = false` count = 3)
- When: `SalesService.create()` is called with `isElectronic: false`
- Then: the persisted invoice has `invoiceNumber = 'MAN-0004'`

**Scenario: Electronic invoice count does not affect manual numbering**
- Given: ten electronic invoices exist and zero manual invoices
- When: `SalesService.create()` is called with `isElectronic: false`
- Then: the persisted invoice has `invoiceNumber = 'MAN-0001'` (not `MAN-0011`)

**Scenario: Manual number does not collide with electronic number**
- Given: a manual invoice `MAN-0001` and an electronic invoice `FAC-0001` both exist
- When: both records are read from the `invoices` table
- Then: `invoiceNumber` is unique for each row; the UNIQUE constraint on `invoices.invoiceNumber` is satisfied

---

#### Requirement: Credit Note and Debit Note Blocked for Manual Invoices

`SalesService.createCreditNote()` and `SalesService.createDebitNote()` MUST throw a `BadRequestException` with the message `'Cannot create notes for manual invoices'` when the parent invoice has `isElectronic = false`. They MUST NOT call Factus in this path.

**Scenario: Credit note attempted on manual invoice is rejected**
- Given: an invoice with `isElectronic = false` exists
- When: `POST /sales/invoices/{id}/credit-note` is called
- Then: a `400 Bad Request` response is returned with message `'Cannot create notes for manual invoices'`

**Scenario: Debit note attempted on manual invoice is rejected**
- Given: an invoice with `isElectronic = false` exists
- When: `POST /sales/invoices/{id}/debit-note` is called
- Then: a `400 Bad Request` response is returned with message `'Cannot create notes for manual invoices'`

**Scenario: Credit note on electronic invoice proceeds normally**
- Given: an invoice with `isElectronic = true` exists
- When: `POST /sales/invoices/{id}/credit-note` is called with valid payload
- Then: the credit note is processed through Factus as before; no change in behavior

---

#### Requirement: Invoice Responses Include isElectronic

`SalesService.findAll()` and `SalesService.findOne()` MUST return the `isElectronic` field in all response payloads. The field MUST reflect the persisted value from the database.

**Scenario: findAll returns isElectronic for all invoices**
- Given: a mix of electronic and manual invoices in the database
- When: `GET /sales/invoices` is called
- Then: each item in the response array contains an `isElectronic` boolean field with the correct value for that invoice

**Scenario: findOne returns isElectronic**
- Given: a manual invoice with `isElectronic = false` exists
- When: `GET /sales/invoices/{id}` is called
- Then: the response contains `"isElectronic": false`

---

#### Requirement: Frontend Invoice Model Includes isElectronic

The frontend `Invoice` model/interface in `src/app/models/invoice.model.ts` MUST include an `isElectronic?: boolean` field so the field is available in invoice list and detail views.

**Scenario: Model accepts isElectronic from API response**
- Given: the API returns `{ ..., isElectronic: false }` for a manual invoice
- When: the response is deserialized into the frontend `Invoice` model
- Then: `invoice.isElectronic` is `false` without TypeScript type errors

---

#### Requirement: Sale Form — Manual Toggle with Amber Warning

`SaleFormComponent` MUST include a `MatSlideToggle` labeled "Venta manual". When the toggle is switched ON (manual mode), an inline amber warning MUST appear with the text "Esta venta NO generará factura electrónica ante la DIAN". When the toggle is OFF (default), the warning MUST NOT be visible.

**Scenario: Toggle is off by default**
- Given: the sale form dialog is opened
- When: no user interaction has occurred
- Then: the "Venta manual" toggle is in the OFF position and the amber warning is not rendered

**Scenario: Toggle turned on shows warning**
- Given: the sale form dialog is open with the toggle in the OFF position
- When: the user switches the "Venta manual" toggle to ON
- Then: the amber warning "Esta venta NO generará factura electrónica ante la DIAN" becomes visible

**Scenario: Toggle turned off hides warning**
- Given: the toggle is ON and the warning is visible
- When: the user switches the toggle back to OFF
- Then: the amber warning is no longer rendered

---

#### Requirement: Sale Form Sends isElectronic in DTO

When `onSubmit()` is called in `SaleFormComponent`, the DTO sent to the backend MUST include `isElectronic: !isManual` where `isManual` reflects the current toggle state.

**Scenario: Electronic sale sends isElectronic: true**
- Given: the "Venta manual" toggle is OFF
- When: the user submits the sale form
- Then: the POST body contains `"isElectronic": true` (or omits the field, which the backend defaults to `true`)

**Scenario: Manual sale sends isElectronic: false**
- Given: the "Venta manual" toggle is ON
- When: the user submits the sale form
- Then: the POST body contains `"isElectronic": false`

---

#### Requirement: Invoice List Displays MANUAL Badge

In the invoice list table (sales page), when an invoice has `isElectronic === false`, the invoice number cell MUST display an amber Material chip labeled "MANUAL" alongside or below the invoice number. Electronic invoices MUST NOT show this badge.

**Scenario: Manual invoice shows MANUAL badge**
- Given: the invoice list renders and one row corresponds to a manual invoice (`isElectronic: false`)
- When: the user views that row
- Then: an amber chip with the text "MANUAL" is visible in the invoice number cell

**Scenario: Electronic invoice shows no badge**
- Given: the invoice list renders and one row corresponds to an electronic invoice (`isElectronic: true`)
- When: the user views that row
- Then: no "MANUAL" badge is rendered in that row

---

#### Requirement: PDF Download Hidden for Manual Invoices

The PDF download button in the invoice list and/or invoice detail view MUST be hidden (not merely disabled) when `invoice.isElectronic === false`. The button MUST remain visible and functional for electronic invoices.

**Scenario: PDF button hidden for manual invoice**
- Given: the invoice list or detail renders a manual invoice (`isElectronic: false`)
- When: the user views the corresponding row or detail
- Then: the PDF download button is not present in the DOM for that invoice

**Scenario: PDF button visible for electronic invoice**
- Given: the invoice list or detail renders an electronic invoice (`isElectronic: true`)
- When: the user views the corresponding row or detail
- Then: the PDF download button is rendered and clickable

---

### Out of Scope

The following behaviors are explicitly excluded from this change and MUST NOT be implemented:

- DIAN nullification or cancellation of manual invoices
- PDF generation or rendering for manual invoices
- Credit note or debit note creation on manual invoices (blocked with a `BadRequestException` — no future path is implied)
- Filtering invoices by `isElectronic` via `QueryInvoicesDto` (no filter field is added in this change)
