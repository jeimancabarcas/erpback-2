# Spec: credit-debit-notes-manual-sales-pdf

## Domain: credit-debit-notes-manual-sales-pdf

### Purpose

This change unblocks credit and debit note creation for manual (non-electronic) invoices and generates a local PDF showing the full invoice history with all applied notes. Currently, manual invoices crash on PDF download (they call Factus with a `MAN-xxxx` number, which fails) and credit/debit notes are blocked with a `BadRequestException`. This change fixes the PDF crash, unblocks notes for manual invoices with local-only processing (no Factus/DIAN), persists credited/debited items for detail in the PDF, and adds a proper PDF generation service using `pdfkit`. The frontend is adjusted to show the PDF button for manual invoices that have notes, extract Base64 decode into a shared util, fix a blob URL leak, and use the `fileName` parameter.

---

## Functional Requirements

---

### FR1: Invoice PDF Guard for Manual Invoices

`GET /sales/invoices/:id/pdf` MUST detect when the invoice has `isElectronic === false` and, instead of calling `factusGateway.downloadInvoicePdf()`, generate a local PDF via `PdfGenerationService` that shows the full invoice history.

- **FR1.1**: The guard MUST check `invoice.isElectronic` BEFORE any Factus call
- **FR1.2**: When `isElectronic === true`, the current Factus path executes unchanged
- **FR1.3**: When `isElectronic === false`, the method MUST call `PdfGenerationService.generateInvoicePdf()` with the invoice and all its associated notes
- **FR1.4**: The returned `fileName` for manual invoices MUST follow the pattern `{invoiceNumber}-historial.pdf` (e.g., `MAN-00000001-historial.pdf`)
- **FR1.5**: The method MUST never call Factus for manual invoices, even if the Factus call would succeed (defense in depth)

---

### FR2: Unblock Credit Notes for Manual Invoices

`SalesService.createCreditNote()` MUST remove the `BadRequestException` guard for manual invoices and process credit notes locally when `isElectronic === false`.

- **FR2.1**: When the parent invoice has `isElectronic === false`, the method MUST skip all Factus-related code (payload building, Factus API call, Factus response parsing)
- **FR2.2**: The method MUST generate a local note number using the pattern `NC-MAN-{invoiceNumber}-{seq}` where `{seq}` is a zero-padded sequential counter starting at 1 per invoice
- **FR2.3**: The method MUST persist a new `CreditNote` record with the local note number, `cude: null`, `qrUrl: null`, `publicUrl: null`
- **FR2.4**: The method MUST persist each credited item as a `CreditNoteItem` record linked to the new credit note
- **FR2.5**: The method MUST validate items against invoice items (quantity must not exceed the invoice item quantity) — same validation as the electronic path
- **FR2.6**: When `dto.items` is empty or not provided, the method MUST treat it as a full-value credit note and create line items for every invoice item
- **FR2.7**: If `dto.correctionConceptCode === '2'` (total cancellation), the method MUST set `invoice.status = InvoiceStatus.CANCELLED` locally (same behavior as the electronic path)
- **FR2.8**: The method MUST return the created `CreditNote` with the same response shape as the electronic path (callers must not need to know the difference)

---

### FR3: Unblock Debit Notes for Manual Invoices

`SalesService.createDebitNote()` MUST follow the same pattern as FR2 for debit notes.

- **FR3.1**: When `isElectronic === false`, skip Factus, generate local number `ND-MAN-{invoiceNumber}-{seq}`, persist `DebitNote` + `DebitNoteItem` records
- **FR3.2**: Same item validation rules as the electronic path (items must reference invoice items if provided)
- **FR3.3**: Debit notes do NOT trigger cancellation (correctionConceptCode is informational for debit notes) — same as the current electronic path behavior
- **FR3.4**: Returns the created `DebitNote` with the same response shape as the electronic path

---

### FR4: Note Items Persistence

New `credit_note_items` and `debit_note_items` tables MUST be created to store the individual items that were credited or debited.

- **FR4.1**: Each item record MUST store: `creditNoteId` / `debitNoteId`, `codeReference`, `name`, `quantity`, `unitPrice`, `subtotal`
- **FR4.2**: Items MUST be persisted within the same transaction as the note creation
- **FR4.3**: The `CreditNote` and `DebitNote` entities MUST expose an `items: CreditNoteItem[]` / `DebitNoteItem[]` `@OneToMany` relation

---

### FR5: Note Numbering for Manual Notes

Manual credit notes MUST follow `NC-MAN-{invoiceNumber}-{seq}` and manual debit notes MUST follow `ND-MAN-{invoiceNumber}-{seq}`.

- **FR5.1**: `{seq}` MUST be a sequential counter per invoice, starting at 1 for the first note of that type on that invoice
- **FR5.2**: The counter MUST be scoped by both `invoiceId` and note type — e.g., a credit note and a debit note on the same invoice each start at 1 independently
- **FR5.3**: The counter MUST be computed by counting existing notes of the same type for the same invoice + 1
- **FR5.4**: Sequential numbering MUST NOT have race conditions — use a transaction or lock to prevent duplicate numbers under concurrent creation

---

### FR6: Local Cancellation via Credit Note

When a credit note with `correctionConceptCode === '2'` is created for a manual invoice, the invoice status MUST change to `CANCELLED` locally.

- **FR6.1**: Same behavior as the electronic path — `invoice.status = InvoiceStatus.CANCELLED` is persisted after saving the credit note
- **FR6.2**: Partial credit notes (any other concept code) MUST NOT change the invoice status
- **FR6.3**: A debit note MUST never change the invoice status (same as electronic path)

---

### FR7: PdfGenerationService

A new `PdfGenerationService` MUST be added to handle local PDF generation for manual invoices.

- **FR7.1**: The service MUST use `pdfkit` as the PDF generation library
- **FR7.2**: The service MUST expose at minimum: `generateInvoicePdf(invoice, creditNotes, debitNotes): string` returning a base64-encoded PDF string
- **FR7.3**: The PDF output MUST contain:
  - Invoice header: invoice number, issue date, customer name and document
  - Items table: product name, quantity, unit price, subtotal for each line
  - Applied notes section: all credit notes and debit notes applied, each showing note number, date, concept, amount, observation
  - Net balance footer: original total minus credits plus debits = current balance
- **FR7.4**: The service MUST be registered in a new `PdfModule` and imported by `SalesModule`
- **FR7.5**: The service MUST generate valid PDFs that can be opened in any standard PDF viewer
- **FR7.6**: The PDF MUST be generated in memory (buffer), not written to disk

---

### FR8: Frontend PDF Button Visibility

The PDF download button in `InvoiceDetailDialogComponent` MUST be conditionally visible.

- **FR8.1**: Show the button when `invoice.isElectronic === true` (electronic invoices always have external PDF)
- **FR8.2**: Show the button when `invoice.isElectronic === false && notes.length > 0` (manual invoices with at least one note applied)
- **FR8.3**: Hide the button when `invoice.isElectronic === false && notes.length === 0` (manual invoices with no notes have no PDF to show)
- **FR8.4**: The button label must change to "Ver PDF Historial" for manual invoices (instead of "Ver PDF DIAN")

---

### FR9: Frontend Shared PDF Utils

A shared utility module MUST be created for Base64 PDF handling.

- **FR9.1**: A new file `src/app/utils/pdf-utils.ts` MUST export a function `downloadBase64Pdf(base64: string, fileName: string): void` that:
  - Decodes the Base64 string
  - Creates a Blob with MIME type `application/pdf`
  - Creates an object URL via `URL.createObjectURL()`
  - Opens the URL in a new tab
  - Calls `URL.revokeObjectURL()` after a short delay (to allow the tab to load)
- **FR9.2**: The existing inline Base64 decode logic in `InvoiceDetailDialogComponent.viewPdf()` MUST be replaced with a call to this shared util
- **FR9.3**: The `fileName` from the API response MUST be passed to the download mechanism so the PDF tab shows a meaningful filename

---

### FR10: Frontend Resource Leak Fix

`URL.revokeObjectURL()` MUST be called to release the blob URL after the PDF tab opens.

- **FR10.1**: After `window.open(blobUrl, '_blank')`, a `setTimeout` of 2000ms MUST call `URL.revokeObjectURL(blobUrl)`
- **FR10.2**: This MUST be part of the shared `downloadBase64Pdf` utility to ensure all callers benefit

---

### FR11: isElectronic Filter in QueryInvoicesDto

`QueryInvoicesDto` MUST accept an optional `isElectronic?: boolean` query parameter for filtering invoices.

- **FR11.1**: When `isElectronic` is `true`, only invoices with `isElectronic === true` are returned
- **FR11.2**: When `isElectronic` is `false`, only manual invoices are returned
- **FR11.3**: When `isElectronic` is not provided, no filter is applied (all invoices returned)
- **FR11.4**: The `buildWhere` helper or a manual `where` clause must handle the boolean filter correctly

---

## Non-Functional Requirements

---

### NFR1: Existing Electronic Flow Integrity

All existing electronic invoice flows MUST remain 100% unchanged. No code path used by electronic invoices (creation, PDF download, note creation, cancellation) may be altered in behavior. The Factus calls, response parsing, and response shapes for electronic invoices MUST be identical before and after this change.

### NFR2: PDF Validity

The generated PDF MUST be valid according to the PDF 1.4 specification. It MUST open without errors in: Chrome built-in PDF viewer, Adobe Acrobat Reader, and any standard PDF library.

### NFR3: Concurrent Note Creation

Creating two notes simultaneously for the same manual invoice MUST NOT produce duplicate note numbers. The sequential counter query and note creation MUST be wrapped in a transaction or use pessimistic locking.

### NFR4: No DIAN/Factus Dependency

All new manual paths (note creation, PDF generation) MUST function correctly even when the Factus API is completely unreachable. No DIAN/Factus dependency may be introduced for manual operations.

### NFR5: Response Backward Compatibility

The response shape of `POST /sales/invoices/{id}/credit-note`, `POST /sales/invoices/{id}/debit-note`, and `GET /sales/invoices/{id}/pdf` MUST remain the same regardless of whether the invoice is electronic or manual. The frontend must not need to know which path was taken.

---

## Scenarios

---

### Scenario Group 1: Invoice PDF Download

#### SC-1.1: Happy path — Electronic invoice PDF download

- **Given**: an electronic invoice (`isElectronic: true`) with `invoiceNumber = 'SETP990003678'`
- **When**: `GET /sales/invoices/{id}/pdf` is called
- **Then**: `factusGateway.downloadInvoicePdf('SETP990003678')` is called exactly once
- **Then**: the response contains `{ pdfBase64Encoded: string, fileName: string }` from Factus
- **Then**: the response is returned directly without any local PDF generation

#### SC-1.2: Happy path — Manual invoice with notes PDF download

- **Given**: a manual invoice (`isElectronic: false`) with `invoiceNumber = 'MAN-00000001'` that has 2 credit notes and 1 debit note applied
- **When**: `GET /sales/invoices/{id}/pdf` is called
- **Then**: `factusGateway.downloadInvoicePdf()` is NOT called
- **Then**: `PdfGenerationService.generateInvoicePdf()` is called with the invoice and its notes
- **Then**: the response contains `{ pdfBase64Encoded: string, fileName: 'MAN-00000001-historial.pdf' }`
- **Then**: the PDF contains: invoice header, items table, 3 note entries (2 credits, 1 debit), and the net balance

#### SC-1.3: Edge case — Manual invoice with NO notes PDF download

- **Given**: a manual invoice (`isElectronic: false`) with no credit or debit notes applied
- **When**: `GET /sales/invoices/{id}/pdf` is called
- **Then**: `PdfGenerationService.generateInvoicePdf()` is called with empty notes arrays
- **Then**: the PDF contains invoice header and items table only, with "No se han aplicado notas de ajuste" in the notes section
- **Then**: the net balance equals the original totalAmount

#### SC-1.4: Error case — Manual invoice not found

- **Given**: no invoice exists with the given ID
- **When**: `GET /sales/invoices/{id}/pdf` is called
- **Then**: a `404 Not Found` is returned
- **Then**: no Factus call and no PDF generation occurs

#### SC-1.5: Error case — PdfGenerationService failure

- **Given**: a manual invoice exists and `PdfGenerationService.generateInvoicePdf()` throws an error
- **When**: `GET /sales/invoices/{id}/pdf` is called
- **Then**: a `500 Internal Server Error` is returned with an appropriate error message
- **Then**: the error is logged but no Factus call is made as a fallback

---

### Scenario Group 2: Credit Note Creation

#### SC-2.1: Happy path — Credit note on manual invoice with items

- **Given**: a manual invoice with `invoiceNumber = 'MAN-00000001'`, `totalAmount = 1500.00`, and 3 line items
- **When**: `POST /sales/invoices/{id}/credit-note` with `{ correctionConceptCode: '1', items: [{ codeReference: 'SKU-001', quantity: 1, price: 500 }] }`
- **Then**: the `BadRequestException` is NOT thrown
- **Then**: `factusGateway.createCreditNote()` is NOT called
- **Then**: a `CreditNote` is persisted with `noteNumber = 'NC-MAN-MAN-00000001-1'`
- **Then**: one `CreditNoteItem` is persisted with the referenced item details
- **Then**: the response contains a `CreditNote` object with `cude: null`, `qrUrl: null`, `publicUrl: null`
- **Then**: the invoice status remains `PAID` (concept code is not '2')

#### SC-2.2: Happy path — Full-value credit note (no items specified)

- **Given**: a manual invoice with `totalAmount = 1500.00` and 3 line items
- **When**: `POST /sales/invoices/{id}/credit-note` with `{ correctionConceptCode: '1' }` (no items array)
- **Then**: a `CreditNoteItem` is created for each of the 3 invoice items with the full quantities and prices
- **Then**: `noteNumber = 'NC-MAN-MAN-00000001-1'`
- **Then**: `amount` equals invoice `totalAmount` (1500.00)

#### SC-2.3: Happy path — Total cancellation via credit note

- **Given**: a manual invoice with status `PAID` and any items
- **When**: `POST /sales/invoices/{id}/credit-note` with `{ correctionConceptCode: '2' }`
- **Then**: the credit note is persisted normally
- **Then**: `invoice.status` is updated to `CANCELLED`
- **Then**: subsequent `GET /sales/invoices/{id}` returns `status: 'CANCELLED'`

#### SC-2.4: Sequential numbering — Multiple credit notes on same invoice

- **Given**: a manual invoice that already has 1 credit note (NC-MAN-MAN-00000001-1)
- **When**: a second credit note is created on the same invoice
- **Then**: `noteNumber = 'NC-MAN-MAN-00000001-2'`
- **When**: a third credit note is created
- **Then**: `noteNumber = 'NC-MAN-MAN-00000001-3'`

#### SC-2.5: Sequential numbering — Credit notes on different invoices

- **Given**: invoice A has 1 credit note and invoice B has 0 credit notes
- **When**: a credit note is created on invoice B
- **Then**: `noteNumber = 'NC-MAN-{invoiceB}-1'` (not 'NC-MAN-{invoiceB}-2')
- **Then**: the counter is scoped per invoice

#### SC-2.6: Item validation — Quantity exceeds invoice item quantity

- **Given**: a manual invoice where item SKU-001 has `quantity = 2`
- **When**: `POST /sales/invoices/{id}/credit-note` with `{ items: [{ codeReference: 'SKU-001', quantity: 5 }] }`
- **Then**: a `400 Bad Request` is returned with message indicating quantity exceeds the invoiced quantity
- **Then**: no CreditNote is persisted

#### SC-2.7: Item validation — Item does not belong to invoice

- **Given**: a manual invoice that does not contain SKU-999
- **When**: `POST /sales/invoices/{id}/credit-note` with `{ items: [{ codeReference: 'SKU-999', quantity: 1 }] }`
- **Then**: a `400 Bad Request` is returned with message indicating the item does not belong to this invoice
- **Then**: no CreditNote is persisted

#### SC-2.8: Edge case — Already cancelled invoice

- **Given**: a manual invoice with status `CANCELLED`
- **When**: `POST /sales/invoices/{id}/credit-note` is called
- **Then**: a `400 Bad Request` is returned (same as electronic path behavior — cancelled invoices cannot have notes)
- **Then**: no CreditNote is persisted

#### SC-2.9: Edge case — Concurrent credit note creation

- **Given**: a manual invoice with no existing credit notes
- **When**: two simultaneous requests create credit notes on the same invoice
- **Then**: first request gets `NC-MAN-MAN-00000001-1` and second gets `NC-MAN-MAN-00000001-2`
- **Then**: no duplicate note number error occurs

#### SC-2.10: Error case — Invoice not found

- **Given**: no invoice exists with the given ID
- **When**: `POST /sales/invoices/{id}/credit-note` is called
- **Then**: a `404 Not Found` is returned

#### SC-2.11: Error case — Database write failure

- **Given**: a manual invoice exists but the database is unavailable
- **When**: `POST /sales/invoices/{id}/credit-note` is called
- **Then**: the transaction is rolled back
- **Then**: no CreditNote or CreditNoteItem is persisted
- **Then**: a `500 Internal Server Error` is returned

---

### Scenario Group 3: Debit Note Creation

#### SC-3.1: Happy path — Debit note on manual invoice with items

- **Given**: a manual invoice with `invoiceNumber = 'MAN-00000001'` and 3 line items
- **When**: `POST /sales/invoices/{id}/debit-note` with `{ correctionConceptCode: '3', items: [{ codeReference: 'SKU-001', quantity: 1, price: 200 }] }`
- **Then**: the `BadRequestException` is NOT thrown
- **Then**: `factusGateway.createDebitNote()` is NOT called
- **Then**: a `DebitNote` is persisted with `noteNumber = 'ND-MAN-MAN-00000001-1'`
- **Then**: one `DebitNoteItem` is persisted with the referenced item details
- **Then**: the response contains a `DebitNote` object with `cude: null`, `qrUrl: null`, `publicUrl: null`
- **Then**: the invoice status remains unchanged

#### SC-3.2: Sequential numbering — Separate counter from credit notes

- **Given**: a manual invoice with 2 existing credit notes (NC-...) and 0 debit notes
- **When**: a debit note is created
- **Then**: `noteNumber = 'ND-MAN-MAN-00000001-1'` (counter is independent of credit note counter)
- **When**: a second debit note is created
- **Then**: `noteNumber = 'ND-MAN-MAN-00000001-2'`

#### SC-3.3: Debit note does NOT cancel the invoice

- **Given**: a manual invoice with status `PAID`
- **When**: `POST /sales/invoices/{id}/debit-note` with any `correctionConceptCode` including '2'
- **Then**: the debit note is persisted
- **Then**: the invoice status remains `PAID` (debit notes never cancel)

#### SC-3.4: Error case — Debit note on non-existent invoice

- **Given**: no invoice exists with the given ID
- **When**: `POST /sales/invoices/{id}/debit-note` is called
- **Then**: a `404 Not Found` is returned

---

### Scenario Group 4: PDF Content Verification

#### SC-4.1: PDF structure validation

- **Given**: a manual invoice with items and applied notes
- **When**: the local PDF is generated via `PdfGenerationService`
- **Then**: the PDF contains these sections in order:
  1. **Header**: "Historial de Factura {invoiceNumber}", issue date, customer name and document number
  2. **Items Table**: columns for Producto, Cantidad, Precio Unit., Subtotal, with one row per invoice item and a total row
  3. **Applied Notes**: heading "Notas de Ajuste Aplicadas", with each credit note (shown in red/negative) and debit note (shown in blue/positive), displaying note number, date, concept, observation, amount
  4. **Net Balance**: original total, credits total, debits total, and current balance formula: "Total Original - Créditos + Débitos = Saldo Actual"

#### SC-4.2: PDF with mixed notes

- **Given**: a manual invoice with 1 credit note (-$200) and 1 debit note (+$50), original total $1000
- **When**: the PDF is generated
- **Then**: the notes section shows both entries
- **Then**: the balance section shows: `$1,000.00 - $200.00 + $50.00 = $850.00`

#### SC-4.3: PDF is valid base64

- **Given**: a generated PDF base64 string
- **When**: the string is decoded with `atob()`
- **Then**: the result starts with `%PDF-1.4`
- **Then**: the result ends with `%%EOF`
- **Then**: the result can be parsed by a PDF library without errors

---

### Scenario Group 5: Frontend PDF Handling

#### SC-5.1: Happy path — PDF button visible for manual invoice with notes

- **Given**: a manual invoice with `creditNotes.length > 0 || debitNotes.length > 0`
- **When**: the invoice detail dialog is rendered
- **Then**: the PDF button is visible with label "Ver PDF Historial"

#### SC-5.2: Edge case — PDF button hidden for manual invoice without notes

- **Given**: a manual invoice with `creditNotes.length === 0 && debitNotes.length === 0`
- **When**: the invoice detail dialog is rendered
- **Then**: the PDF button is NOT rendered in the DOM

#### SC-5.3: Edge case — PDF button visible for electronic invoice (regardless of notes)

- **Given**: an electronic invoice with `creditNotes.length === 0`
- **When**: the invoice detail dialog is rendered
- **Then**: the PDF button is visible with label "Ver PDF DIAN"

#### SC-5.4: PDF download uses shared util

- **Given**: user clicks the PDF button on a manual invoice with notes
- **When**: the API returns `{ pdfBase64Encoded, fileName }`
- **Then**: `downloadBase64Pdf(base64, fileName)` from `pdf-utils.ts` is called
- **Then**: a new browser tab opens with the PDF content
- **Then**: `URL.revokeObjectURL()` is called after 2000ms

#### SC-5.5: PDF blob URL leak is fixed

- **Given**: the original `viewPdf()` method in `InvoiceDetailDialogComponent`
- **When**: the code is inspected
- **Then**: the inline `atob()`/`Uint8Array`/`Blob`/`URL.createObjectURL` logic is no longer present
- **Then**: the method calls the shared `downloadBase64Pdf` utility instead

#### SC-5.6: fileName is passed to download

- **Given**: the API response includes `fileName: 'MAN-00000001-historial.pdf'`
- **When**: the PDF is opened
- **Then**: the browser tab title or download filename reflects the `fileName` value

---

### Scenario Group 6: isElectronic Filter

#### SC-6.1: Filter by electronic invoices

- **Given**: a mix of electronic (10) and manual (3) invoices exist
- **When**: `GET /sales/invoices?isElectronic=true` is called
- **Then**: only the 10 electronic invoices are returned
- **Then**: manual invoices are excluded

#### SC-6.2: Filter by manual invoices

- **Given**: a mix of electronic (10) and manual (3) invoices exist
- **When**: `GET /sales/invoices?isElectronic=false` is called
- **Then**: only the 3 manual invoices are returned
- **Then**: electronic invoices are excluded

#### SC-6.3: No filter applied when isElectronic is omitted

- **Given**: a mix of electronic and manual invoices exist
- **When**: `GET /sales/invoices` is called (no isElectronic parameter)
- **Then**: all invoices (electronic + manual) are returned
- **Then**: pagination and sorting work the same as before

#### SC-6.4: Filter combined with other query params

- **Given**: invoices exist with various statuses and electronic types
- **When**: `GET /sales/invoices?isElectronic=false&status=PAID` is called
- **Then**: only PAID manual invoices are returned
- **Then**: the filter combines correctly with other existing filters

#### SC-6.5: Invalid isElectronic value rejected

- **Given**: a request with `isElectronic=yes`
- **When**: `GET /sales/invoices` is called
- **Then**: the query parameter is ignored or a 400 is returned (depends on validation strategy — either is acceptable as long as it doesn't error)
- **Then**: no filter is applied

---

### Scenario Group 7: Existing Behavior Preservation

#### SC-7.1: Electronic credit note flow unchanged

- **Given**: an electronic invoice
- **When**: `POST /sales/invoices/{id}/credit-note` is called
- **Then**: the full Factus path executes: payload building, `factusGateway.createCreditNote()`, response parsing
- **Then**: the returned CreditNote has `noteNumber`, `cude`, `qrUrl`, `publicUrl` from Factus
- **Then**: no local PDF generation or local numbering happens

#### SC-7.2: Electronic debit note flow unchanged

- **Given**: an electronic invoice
- **When**: `POST /sales/invoices/{id}/debit-note` is called
- **Then**: the full Factus path executes unchanged

#### SC-7.3: Electronic invoice PDF download unchanged

- **Given**: an electronic invoice
- **When**: `GET /sales/invoices/{id}/pdf` is called
- **Then**: the request is forwarded directly to `factusGateway.downloadInvoicePdf()`
- **Then**: the response from Factus is returned as-is

#### SC-7.4: Adjustment note PDF download for electronic notes unchanged

- **Given**: an electronic credit note with a valid Factus note number
- **When**: `GET /sales/credit-notes/{id}/pdf` is called
- **Then**: `factusGateway.downloadAdjustmentNotePdf()` is called
- **Then**: the Factus response is returned

#### SC-7.5: Electronic invoice creation unchanged

- **Given**: a create invoice request with `isElectronic: true` (or omitted)
- **When**: `POST /sales/invoices` is called
- **Then**: `consumeStock()` is called for each item, then `factusGateway.createInvoice()` is called
- **Then**: the invoice has a Factus-assigned number or `FAC-xxxx` fallback

#### SC-7.6: Manual invoice creation unchanged

- **Given**: a create invoice request with `isElectronic: false`
- **When**: `POST /sales/invoices` is called
- **Then**: `consumeStock()` is called for each item, `factusGateway.createInvoice()` is NOT called
- **Then**: the invoice has `invoiceNumber = 'MAN-xxxx'` and `isElectronic = false`

#### SC-7.7: findAll query with no isElectronic filter returns same shape

- **Given**: the existing `GET /sales/invoices` endpoint
- **When**: called without `isElectronic`
- **Then**: the response structure (paginated result with `data` and `meta`) is identical to before
- **Then**: the `netTotal` computation on each invoice still works correctly

---

## Acceptance Criteria

| ID | Deliverable | Criterion | Related Scenario |
|----|------------|-----------|-----------------|
| AC-1 | FR1 | `downloadInvoicePdf` for manual invoice returns `{ pdfBase64Encoded, fileName }` without calling Factus | SC-1.2 |
| AC-2 | FR1 | `downloadInvoicePdf` for electronic invoice still calls Factus | SC-1.1 |
| AC-3 | FR2 | `createCreditNote` for manual invoice creates CreditNote locally without Factus call | SC-2.1 |
| AC-4 | FR2 | Manual credit note has `noteNumber` matching `NC-MAN-{inv}-{seq}` pattern | SC-2.1, SC-2.4 |
| AC-5 | FR2 | Manual credit note has `cude: null`, `qrUrl: null`, `publicUrl: null` | SC-2.1 |
| AC-6 | FR2 | Credit note with `correctionConceptCode === '2'` cancels invoice locally | SC-2.3 |
| AC-7 | FR3 | `createDebitNote` for manual invoice creates DebitNote locally without Factus call | SC-3.1 |
| AC-8 | FR3 | Manual debit note has `noteNumber` matching `ND-MAN-{inv}-{seq}` pattern | SC-3.1, SC-3.2 |
| AC-9 | FR4 | `CreditNoteItem` and `DebitNoteItem` records are persisted for each item in the note | SC-2.1, SC-2.2 |
| AC-10 | FR5 | Sequential counter is scoped per invoice and per note type, starts at 1 | SC-2.4, SC-2.5, SC-3.2 |
| AC-11 | FR6 | Invoice status changes to `CANCELLED` only for credit note with concept code '2' | SC-2.3 |
| AC-12 | FR7 | Generated PDF contains header, items table, applied notes, and balance sections | SC-4.1 |
| AC-13 | FR7 | Generated PDF is valid (starts with `%PDF-1.4`, ends with `%%EOF`) | SC-4.3 |
| AC-14 | FR8 | PDF button visible for manual invoice with notes, hidden for manual without notes | SC-5.1, SC-5.2 |
| AC-15 | FR8 | PDF button always visible for electronic invoices | SC-5.3 |
| AC-16 | FR8 | Button label changes to "Ver PDF Historial" for manual invoices | SC-5.1 |
| AC-17 | FR9 | Shared `downloadBase64Pdf()` utility exists in `pdf-utils.ts` | SC-5.4, SC-5.5 |
| AC-18 | FR9 | `viewPdf()` calls shared utility instead of inline decode | SC-5.5 |
| AC-19 | FR10 | `URL.revokeObjectURL()` is called after PDF opens | SC-5.4 |
| AC-20 | FR10 | `fileName` from API response is used in the download mechanism | SC-5.6 |
| AC-21 | FR11 | `GET /sales/invoices?isElectronic=false` returns only manual invoices | SC-6.2 |
| AC-22 | FR11 | `GET /sales/invoices?isElectronic=true` returns only electronic invoices | SC-6.1 |
| AC-23 | FR11 | `GET /sales/invoices` (no filter) returns all invoices | SC-6.3 |
| AC-24 | NFR1 | All electronic invoice test scenarios pass without changes | SC-7.1–7.6 |
| AC-25 | NFR2 | Generated PDF opens without errors in Chrome and Acrobat | SC-4.3 |

---

## Sequence Diagrams

### Flow 1: Creating a Credit Note for a Manual Invoice

```
User                    Frontend                  SalesController            SalesService                   DB
 |                         |                           |                        |                           |
 | Click "Emitir Nota"     |                           |                        |                           |
 |------------------------>|                           |                        |                           |
 |                         | POST /invoices/:id/credit-note                    |                           |
 |                         |-------------------------->|                        |                           |
 |                         |                           | createCreditNote(id, dto)                        |
 |                         |                           |----------------------->|                           |
 |                         |                           |                        |                           |
 |                         |                           |                        | Load invoice + items      |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |<--------------------------|
 |                         |                           |                        |                           |
 |                         |                           |                        | Check isElectronic === false|
 |                         |                           |                        | (skip Factus block)       |
 |                         |                           |                        |                           |
 |                         |                           |                        | Count existing credit     |
 |                         |                           |                        | notes for this invoice    |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |<--------------------------|
 |                         |                           |                        | (returns 2)              |
 |                         |                           |                        |                           |
 |                         |                           |                        | Build note number:        |
 |                         |                           |                        | NC-MAN-MAN-00001-3       |
 |                         |                           |                        |                           |
 |                         |                           |                        | Create CreditNote record |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        | (returns saved note)     |
 |                         |                           |                        |<--------------------------|
 |                         |                           |                        |                           |
 |                         |                           |                        | Create CreditNoteItem[]   |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |<--------------------------|
 |                         |                           |                        |                           |
 |                         |                           |<-----------------------|                           |
 |                         |<--------------------------|                        |                           |
 |                         |                           |                        |                           |
 |<------------------------|                           |                        |                           |
```

### Flow 2: Downloading PDF for a Manual Invoice

```
User                    Frontend                  SalesController            SalesService          PdfGenerationService
 |                         |                           |                        |                         |
 | Click "Ver PDF Historial"                           |                        |                         |
 |------------------------>|                           |                        |                         |
 |                         | GET /invoices/:id/pdf     |                        |                         |
 |                         |-------------------------->|                        |                         |
 |                         |                           | downloadInvoicePdf(id) |                         |
 |                         |                           |----------------------->|                         |
 |                         |                           |                        |                         |
 |                         |                           |                        | Load invoice + notes    |
 |                         |                           |                        |-------- DB ----------->|
 |                         |                           |                        |<-----------------------|
 |                         |                           |                        |                         |
 |                         |                           |                        | Check isElectronic === false |
 |                         |                           |                        | (skip Factus)          |
 |                         |                           |                        |                         |
 |                         |                           |                        | generateInvoicePdf(    |
 |                         |                           |                        |   invoice, notes)      |
 |                         |                           |                        |----------------------->|
 |                         |                           |                        |                         |
 |                         |                           |                        |   Build PDF with       |
 |                         |                           |                        |   pdfkit: header,      |
 |                         |                           |                        |   items table, notes,  |
 |                         |                           |                        |   balance footer       |
 |                         |                           |                        |                         |
 |                         |                           |                        |<----- base64 string----|
 |                         |                           |                        |                         |
 |                         |                           |<--- { pdfBase64Encoded,|                         |
 |                         |                           |       fileName }       |                         |
 |                         |<--------------------------|                        |                         |
 |                         |                           |                        |                         |
 |  downloadBase64Pdf()    |                           |                        |                         |
 |<------------------------|                           |                        |                         |
 |                         |                           |                        |                         |
 |  atob() → Blob → URL   |                           |                        |                         |
 |  window.open(blobUrl)   |                           |                        |                         |
 |  setTimeout → revoke    |                           |                        |                         |
```

### Flow 3: Creating a Debit Note for a Manual Invoice

```
(Identical structure to Flow 1, replacing "Credit" with "Debit")

User                    Frontend                  SalesController            SalesService                   DB
 |                         |                           |                        |                           |
 |------------------------>|                           |                        |                           |
 |                         | POST /invoices/:id/debit-note                      |                           |
 |                         |-------------------------->|                        |                           |
 |                         |                           | createDebitNote(id, dto)                           |
 |                         |                           |----------------------->|                           |
 |                         |                           |                        |                           |
 |                         |                           |                        | Load invoice + items    |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |<--------------------------|
 |                         |                           |                        |                           |
 |                         |                           |                        | Check isElectronic === false|
 |                         |                           |                        | (skip Factus block)     |
 |                         |                           |                        |                           |
 |                         |                           |                        | Count existing debit    |
 |                         |                           |                        | notes for this invoice  |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |<--------------------------|
 |                         |                           |                        |                           |
 |                         |                           |                        | Build note number:      |
 |                         |                           |                        | ND-MAN-MAN-00001-{seq}  |
 |                         |                           |                        |                           |
 |                         |                           |                        | Create DebitNote record |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |<--------------------------|
 |                         |                           |                        |                           |
 |                         |                           |                        | Create DebitNoteItem[]  |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |<--------------------------|
 |                         |                           |                        |                           |
 |                         |                           |                        | No status change        |
 |                         |                           |                        | (debit notes never      |
 |                         |                           |                        |  cancel invoices)       |
 |                         |                           |                        |                           |
 |                         |                           |<-----------------------|                           |
 |                         |<--------------------------|                        |                           |
 |<------------------------|                           |                        |                           |
```

### Flow 4: Total Cancellation via Credit Note

```
User                    Frontend                  SalesController            SalesService                   DB
 |                         |                           |                        |                           |
 |                         | POST /invoices/:id/credit-note                     |                           |
 |                         | correctionConceptCode: '2' |                        |                           |
 |------------------------>|-------------------------->|                        |                           |
 |                         |                           | createCreditNote(id, {                           |
 |                         |                           |   correctionConceptCode: '2' })                   |
 |                         |                           |----------------------->|                           |
 |                         |                           |                        |                           |
 |                         |                           |                        | Load invoice (status: PAID)|
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |<--------------------------|
 |                         |                           |                        |                           |
 |                         |                           |                        | isElectronic === false   |
 |                         |                           |                        | → local path             |
 |                         |                           |                        |                           |
 |                         |                           |                        | BEGIN TRANSACTION        |
 |                         |                           |                        |                           |
 |                         |                           |                        | Count credit notes → seq=1|
 |                         |                           |                        |                           |
 |                         |                           |                        | INSERT CreditNote       |
 |                         |                           |                        | (NC-MAN-MAN-00001-1)    |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |                           |
 |                         |                           |                        | INSERT CreditNoteItems  |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |                           |
 |                         |                           |                        | UPDATE invoice SET      |
 |                         |                           |                        |   status = 'CANCELLED'  |
 |                         |                           |                        |-------------------------->|
 |                         |                           |                        |                           |
 |                         |                           |                        | COMMIT TRANSACTION      |
 |                         |                           |                        |                           |
 |                         |                           |<--- CreditNote response|                           |
 |                         |<--------------------------|                        |                           |
 |                         |                           |                        |                           |
 |  Dialog refreshes       |                           |                        |                           |
 |  Invoice status shown   |                           |                        |                           |
 |  as CANCELLED           |                           |                        |                           |
 |<------------------------|                           |                        |                           |
```

---

## Error Scenarios

| ID | Component | Error Condition | Behavior | HTTP Status |
|----|-----------|----------------|----------|-------------|
| E-1 | `downloadInvoicePdf` | Invoice not found | Throw `NotFoundException` | 404 |
| E-2 | `downloadInvoicePdf` | `PdfGenerationService` throws | Log error, throw `BadRequestException` or `InternalServerError`; do NOT fall back to Factus | 500 |
| E-3 | `createCreditNote` | Invoice not found | Throw `NotFoundException` | 404 |
| E-4 | `createCreditNote` | Invoice is CANCELLED | Throw `BadRequestException` (same as electronic path) | 400 |
| E-5 | `createCreditNote` | Item quantity exceeds invoice item quantity | Throw `BadRequestException` | 400 |
| E-6 | `createCreditNote` | Item code does not belong to invoice | Throw `BadRequestException` | 400 |
| E-7 | `createCreditNote` | Transaction rollback (DB error) | Rollback, throw `BadRequestException` or `InternalServerError` | 500 |
| E-8 | `createCreditNote` | Concurrent note number collision (rare) | Wrap in transaction; if constraint violation, retry or throw | 500 |
| E-9 | `createDebitNote` | Invoice not found | Throw `NotFoundException` | 404 |
| E-10 | `createDebitNote` | Item validation failures | Same as E-5/E-6 | 400 |
| E-11 | `createDebitNote` | Transaction rollback | Same as E-7 | 500 |
| E-12 | `PdfGenerationService` | pdfkit instantiation fails | Throw error to caller | N/A (service error) |
| E-13 | `PdfGenerationService` | Invoice has no items | Generate PDF with empty items section showing "Sin productos" | N/A |
| E-14 | `QueryInvoicesDto` | `isElectronic` is not a boolean | Query parameter is ignored, no filter applied | 200 (no error) |
| E-15 | Frontend `downloadBase64Pdf` | Base64 string is malformed | Catch error, log it, show user-friendly alert | N/A |
| E-16 | Frontend PDF API call | HTTP error from server (`4xx`/`5xx`) | Show user-friendly alert "Error al descargar el PDF" | N/A |

---

## Data Model Changes

### New Entity: CreditNoteItem

```typescript
@Entity('credit_note_items')
export class CreditNoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CreditNote, (cn) => cn.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'credit_note_id' })
  creditNote: CreditNote;

  @Column({ name: 'credit_note_id' })
  creditNoteId: string;

  @Column({ name: 'code_reference', type: 'varchar' })
  codeReference: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;
}
```

### New Entity: DebitNoteItem

```typescript
@Entity('debit_note_items')
export class DebitNoteItem {
  // Same structure as CreditNoteItem, replacing creditNoteId with debitNoteId
  // and ManyToOne relation to DebitNote
}
```

### Modified Entity: CreditNote

Add `@OneToMany(() => CreditNoteItem, (item) => item.creditNote) items: CreditNoteItem[]` relation.

### Modified Entity: DebitNote

Add `@OneToMany(() => DebitNoteItem, (item) => item.debitNote) items: DebitNoteItem[]` relation.

### New DDL

```sql
CREATE TABLE credit_note_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  code_reference VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL
);

CREATE TABLE debit_note_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debit_note_id UUID NOT NULL REFERENCES debit_notes(id) ON DELETE CASCADE,
  code_reference VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL
);

CREATE INDEX idx_credit_note_items_credit_note_id ON credit_note_items(credit_note_id);
CREATE INDEX idx_debit_note_items_debit_note_id ON debit_note_items(debit_note_id);
```

---

## API Changes

### Modified Endpoints

| Endpoint | Method | Change | Before | After |
|----------|--------|--------|--------|-------|
| `/sales/invoices/:id/pdf` | GET | Add manual invoice guard | Calls `factusGateway.downloadInvoicePdf()` for all invoices | Calls Factus for electronic; generates local PDF for manual |
| `/sales/invoices/:id/credit-note` | POST | Unblock for manual invoices | Throws `BadRequestException` when `isElectronic === false` | Creates note locally when `isElectronic === false`; Factus path for electronic unchanged |
| `/sales/invoices/:id/debit-note` | POST | Unblock for manual invoices | Throws `BadRequestException` when `isElectronic === false` | Creates note locally when `isElectronic === false`; Factus path for electronic unchanged |
| `/sales/invoices` | GET | Add `isElectronic` query filter | No filter by electronic type | Accepts `?isElectronic=true\|false` optional query param |

### Response Shape Changes

None. All modified endpoints return the same TypeScript interface responses as before. The `CreditNote` and `DebitNote` objects for manual notes will have `cude: null`, `qrUrl: null`, `publicUrl: null` instead of Factus-assigned values. The frontend already handles nullable fields.

### Response Shape — Manual Invoice PDF Download

```json
{
  "pdfBase64Encoded": "JVBERi0xLjcN... (base64 string)",
  "fileName": "MAN-00000001-historial.pdf"
}
```

Same shape as the electronic path, only the `fileName` pattern differs.

---

## Frontend Changes

### New File: `src/app/utils/pdf-utils.ts`

```typescript
export function downloadBase64Pdf(
  base64Encoded: string,
  fileName: string
): void {
  try {
    const byteCharacters = atob(base64Encoded);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    // Revoke after allowing the tab to load the URL
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch (e) {
    console.error('Error decoding PDF:', e);
    alert('Error al procesar el PDF.');
  }
}
```

### Modified File: `src/app/components/organisms/invoice-detail-dialog/invoice-detail-dialog.component.ts`

- **Template changes**:
  - Change PDF button condition from always visible to: `inv.isElectronic || notes().creditNotes.length > 0 || notes().debitNotes.length > 0`
  - Change button label dynamically: `inv.isElectronic ? 'Ver PDF DIAN' : 'Ver PDF Historial'`
  - Apply red style (`bg-red-600`) for electronic, indigo style for manual PDF button

- **Component changes**:
  - Import `downloadBase64Pdf` from `../../utils/pdf-utils`
  - Replace inline Base64 decode logic in `viewPdf()` with call to `downloadBase64Pdf(res.pdfBase64Encoded, res.fileName)`
  - Remove `pdfLoading` state after PDF opens (not after decode, to keep loading indicator during API call)

### Modified File: `src/app/services/invoice.service.ts`

No changes needed — the service already returns `{ pdfBase64Encoded: string; fileName: string }` from `getInvoicePdf()`. The frontend just needs to use the `fileName` field.

### Modified File: `src/app/models/invoice.model.ts`

No changes needed — `isElectronic?: boolean` already exists.

### Modified File: `src/app/models/sales-note.model.ts`

No changes needed — `CreditNote` and `DebitNote` interfaces already have nullable `cude`, `qrUrl`, `publicUrl` fields.

---

## Existing Behavior Preservation

The following behaviors MUST remain 100% unchanged:

### Backend — Fully Preserved Paths

1. **Electronic invoice creation**: Factus call, stock consumption, total calculation, `FAC-xxxx` or DIAN number assignment — all unchanged
2. **Manual invoice creation**: Stock consumption, `MAN-xxxx` numbering, no Factus — all unchanged
3. **Electronic credit note creation**: Factus call, item validation, CUDE/QR/URL assignment, status cancellation on concept '2' — unchanged
4. **Electronic debit note creation**: Factus call, item validation, CUDE/QR/URL assignment — unchanged
5. **Electronic invoice PDF download**: `factusGateway.downloadInvoicePdf()` call, Factus response returned directly — unchanged
6. **Adjustment note PDF download**: Factus call for electronic notes, fallback to simulated PDF — unchanged
7. **Financial stats** (`getFinancialStats`): Calculation logic, no changes
8. **findAllNotes**: Returns all notes regardless of invoice type (already works, notes for manual invoices will just start appearing)
9. **findNotesByInvoice**: Returns notes for a specific invoice — unchanged
10. **Cancellation**: Credit note with concept '2' on electronic invoice sets status to CANCELLED — unchanged

### Backend — Response Shapes

- `CreditNote` and `DebitNote` response objects keep the same fields (manual notes will have `null` values for Factus-specific fields)
- `Invoice` response objects keep the same fields (no structural changes)
- `PaginatedResult<Invoice>` response keeps the same `data`/`meta` structure
- PDF download response keeps `{ pdfBase64Encoded, fileName }` shape

### Frontend — Fully Preserved Behavior

1. **Electronic invoice PDF button**: Always visible, label "Ver PDF DIAN", calls `getInvoicePdf()` — unchanged
2. **Manual invoice creation form**: Toggle, warning badge, `MAN-XXXX` display — unchanged
3. **Invoice list table**: MANUAL badge, columns, sorting, pagination — unchanged
4. **Electronic notes display**: Shows note number, CUDE, public URL link to Factus PDF — unchanged
5. **Note creation dialog**: Opens for all non-CANCELLED invoices — unchanged
6. **All existing routes, guards, services**: Unchanged

### What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Manual invoice PDF download | Calls Factus → crashes with 500 | Returns local PDF with full history |
| Manual invoice credit notes | Blocked with 400 error | Created locally with `NC-MAN-{inv}-{seq}` |
| Manual invoice debit notes | Blocked with 400 error | Created locally with `ND-MAN-{inv}-{seq}` |
| Manual invoice note items | Not persisted | Persisted in `credit_note_items`/`debit_note_items` |
| PDF for manual notes | Never reached | New local PDF via `PdfGenerationService` |
| Frontend PDF button | Hidden for all manual invoices | Visible when manual invoice has notes |
| Frontend Base64 decode | Inline in component | Shared `pdf-utils.ts` utility |
| `URL.revokeObjectURL` | Never called | Called after 2s timeout |
| `fileName` parameter | Ignored (not used in download) | Passed through from API response |
| `QueryInvoicesDto` | No `isElectronic` filter | Accepts optional `isElectronic` boolean |
| `package.json` | No PDF libraries | Adds `pdfkit` + `@types/pdfkit` |

---

## Out of Scope (Reinforced from Proposal)

These behaviors are explicitly excluded from this change and MUST NOT be implemented:

- DIAN/Factus integration for manual notes (manual notes never call Factus)
- Fiscal/legal PDF compliance (the PDF is informational, not a DIAN-valid document)
- Print layout customization (PDF uses a fixed layout)
- Email delivery of PDFs
- PDF generation for electronic invoices (electronic invoices keep using Factus PDFs)
- CUDE or QR code generation for manual notes (these are only relevant for DIAN documents)
- Batch PDF generation or download-all functionality
