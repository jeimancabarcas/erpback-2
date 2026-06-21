# sales-invoice-net-total Specification

## Purpose

Defines how credit and debit notes are joined to each invoice in the `findAll`
backend response and how the resulting `netTotal` value is rendered in the
frontend sales table.

---

## Requirements

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
- THEN the invoice in the response MUST include empty `creditNotes` and
  `debitNotes` collections without error

---

### Requirement: Backend Computes netTotal Per Invoice

The API response MUST include a `netTotal` field for each invoice, computed as:

```
netTotal = totalAmount - SUM(creditNotes.amount) + SUM(debitNotes.amount)
```

The field MUST appear in the DTO/response object alongside `totalAmount`.

#### Scenario: Invoice with no notes — netTotal equals totalAmount

- GIVEN an invoice with `totalAmount = 1000` and no credit or debit notes
- WHEN `GET /sales/invoices` is called
- THEN the response MUST include `netTotal = 1000`

#### Scenario: Invoice with one credit note

- GIVEN an invoice with `totalAmount = 1000` and one credit note with
  `amount = 200`
- WHEN `GET /sales/invoices` is called
- THEN the response MUST include `netTotal = 800`

#### Scenario: Invoice with one debit note

- GIVEN an invoice with `totalAmount = 1000` and one debit note with
  `amount = 150`
- WHEN `GET /sales/invoices` is called
- THEN the response MUST include `netTotal = 1150`

#### Scenario: Invoice with both credit and debit notes

- GIVEN an invoice with `totalAmount = 1000`, one credit note of `200`, and one
  debit note of `150`
- WHEN `GET /sales/invoices` is called
- THEN the response MUST include `netTotal = 950`
  (`1000 - 200 + 150`)

---

### Requirement: Frontend Invoice Model Includes netTotal Field

The frontend `Invoice` model MUST declare `netTotal` as an optional numeric
field (`netTotal?: number`).

#### Scenario: Model accepts netTotal from API

- GIVEN the API returns an invoice object with a `netTotal` property
- WHEN the frontend deserializes the response
- THEN the `netTotal` value MUST be accessible on the `Invoice` model without
  type errors

#### Scenario: Model is backward compatible when netTotal is absent

- GIVEN the API returns an invoice object without a `netTotal` property
- WHEN the frontend deserializes the response
- THEN the `Invoice` model MUST remain valid and `netTotal` MUST be `undefined`

---

### Requirement: Frontend Sales Table Displays Net Total Column

The frontend invoice table MUST display a "Total Neto" column that shows
`netTotal` when present, falling back to `totalAmount` when `netTotal` is
absent or `undefined`.

#### Scenario: netTotal is present — column shows netTotal

- GIVEN the API returns an invoice with `totalAmount = 1000` and `netTotal = 800`
- WHEN the sales table renders the invoice row
- THEN the "Total Neto" column MUST display `800`

#### Scenario: netTotal is absent — column falls back to totalAmount

- GIVEN the API returns an invoice with `totalAmount = 1000` and no `netTotal`
  field
- WHEN the sales table renders the invoice row
- THEN the "Total Neto" column MUST display `1000`

#### Scenario: Column header reads "Total Neto"

- GIVEN the sales table is rendered
- WHEN the user views the invoice list
- THEN the column that displays the net total MUST have the header text
  "Total Neto"
