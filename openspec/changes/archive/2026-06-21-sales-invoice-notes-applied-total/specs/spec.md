# Specs — sales-invoice-notes-applied-total

This change introduces one **new** capability and modifies one **existing** capability.
Full specs (not deltas) are written for both because no prior spec files existed.

---

## Capability: sales-invoice-net-total (NEW)

Full spec path: `openspec/specs/sales-invoice-net-total/spec.md`

### Requirement: Invoice List Joins Credit and Debit Notes

The invoice list API MUST join `creditNotes` and `debitNotes` for every invoice
returned by `GET /sales/invoices`.

#### Scenario: Notes joined in list response

- GIVEN the `findAll` query is executed
- WHEN the database contains invoices with associated credit or debit notes
- THEN each invoice in the response MUST include its related `creditNotes` and
  `debitNotes` collections

#### Scenario: No notes present

- GIVEN an invoice has no credit notes and no debit notes
- WHEN `findAll` is executed
- THEN the invoice in the response MUST include empty collections without error

---

### Requirement: Backend Computes netTotal Per Invoice

The API response MUST include `netTotal` per invoice:
`netTotal = totalAmount - SUM(creditNotes.amount) + SUM(debitNotes.amount)`

#### Scenario: No notes — netTotal equals totalAmount

- GIVEN `totalAmount = 1000`, no notes
- WHEN `GET /sales/invoices` is called
- THEN response MUST include `netTotal = 1000`

#### Scenario: One credit note

- GIVEN `totalAmount = 1000`, credit note `amount = 200`
- WHEN `GET /sales/invoices` is called
- THEN response MUST include `netTotal = 800`

#### Scenario: One debit note

- GIVEN `totalAmount = 1000`, debit note `amount = 150`
- WHEN `GET /sales/invoices` is called
- THEN response MUST include `netTotal = 1150`

#### Scenario: Both note types

- GIVEN `totalAmount = 1000`, credit `200`, debit `150`
- WHEN `GET /sales/invoices` is called
- THEN response MUST include `netTotal = 950`

---

### Requirement: Frontend Invoice Model Includes netTotal Field

The frontend `Invoice` model MUST declare `netTotal?: number`.

#### Scenario: Model accepts netTotal

- GIVEN API returns invoice with `netTotal`
- WHEN frontend deserializes response
- THEN `netTotal` MUST be accessible without type errors

#### Scenario: Backward compatible when absent

- GIVEN API returns invoice without `netTotal`
- WHEN frontend deserializes response
- THEN `Invoice` model MUST remain valid; `netTotal` MUST be `undefined`

---

### Requirement: Frontend Sales Table Displays Net Total Column

The table MUST show a "Total Neto" column rendering `netTotal ?? totalAmount`.

#### Scenario: netTotal present

- GIVEN `totalAmount = 1000`, `netTotal = 800`
- WHEN table renders the row
- THEN "Total Neto" column MUST display `800`

#### Scenario: netTotal absent — fallback to totalAmount

- GIVEN `totalAmount = 1000`, no `netTotal`
- WHEN table renders the row
- THEN "Total Neto" column MUST display `1000`

#### Scenario: Column header

- GIVEN the sales table is rendered
- WHEN the user views the invoice list
- THEN the net total column header MUST read "Total Neto"

---

## Capability: sales-invoice-list (NEW)

Full spec path: `openspec/specs/sales-invoice-list/spec.md`

### Requirement: Invoice Table Row Actions Must Not Contain PDF Download Button

The invoice table MUST NOT render a PDF download button in the row actions column.

#### Scenario: No PDF button in row actions

- GIVEN the user navigates to the Sales module invoice list
- WHEN the table renders
- THEN no PDF download button or icon MUST appear in any row's actions column

#### Scenario: PDF button absent regardless of invoice state

- GIVEN invoices in various states (paid, pending, overdue)
- WHEN the table renders
- THEN no row MUST display a PDF download control, regardless of state

---

### Requirement: PDF Download Remains Available in Invoice Detail Dialog

PDF download functionality MUST remain accessible inside the invoice detail dialog.

#### Scenario: PDF button present in detail dialog

- GIVEN the user is on the invoice list
- WHEN the user opens the detail dialog for any invoice
- THEN the PDF download button MUST be visible and functional

#### Scenario: PDF download produces correct file

- GIVEN the user has opened the detail dialog
- WHEN the user clicks the PDF download button
- THEN the system MUST initiate a download of the corresponding invoice PDF
  without error
