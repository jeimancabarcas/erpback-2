# sales-invoice-list Specification

## Purpose

Defines the action controls available in the sales invoice table and the
boundaries of the PDF download feature — removed from row actions and preserved
exclusively inside the invoice detail dialog.

---

## Requirements

### Requirement: Invoice Table Row Actions Must Not Contain PDF Download Button

The invoice table in the Sales module MUST NOT render a PDF download button in
the row actions column. The `downloadPdf()` method MUST NOT be callable from
the table row context.

#### Scenario: User opens invoice list — no PDF button visible

- GIVEN the user navigates to the Sales module invoice list
- WHEN the table renders with one or more invoice rows
- THEN no PDF download button or icon MUST appear in any row's actions column

#### Scenario: PDF button is absent regardless of invoice state

- GIVEN the user views the invoice list with invoices in various states
  (e.g., paid, pending, overdue)
- WHEN the table renders
- THEN no row MUST display a PDF download control in its actions column,
  regardless of invoice state

---

### Requirement: PDF Download Remains Available in Invoice Detail Dialog

The PDF download functionality MUST remain accessible from within the invoice
detail dialog. Removing the PDF button from the table row MUST NOT affect the
download behavior inside the dialog.

#### Scenario: User opens invoice detail dialog — PDF button is present

- GIVEN the user is on the Sales module invoice list
- WHEN the user opens the detail dialog for any invoice
- THEN the PDF download button MUST be visible and functional within the dialog

#### Scenario: PDF download from dialog produces correct file

- GIVEN the user has opened the invoice detail dialog
- WHEN the user clicks the PDF download button
- THEN the system MUST initiate a download of the PDF corresponding to that
  invoice without error
