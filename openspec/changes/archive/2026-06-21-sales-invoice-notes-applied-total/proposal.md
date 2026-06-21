# Proposal: Sales Invoice Notes-Applied Total

## Intent

Invoices in the sales table display a raw `totalAmount` that does not reflect
credit or debit notes already applied. Users must open each invoice detail to
see the actual net balance, creating confusion and extra clicks. Additionally,
a PDF download button duplicated in the table row adds clutter since the same
action is available inside the invoice detail dialog.

## Scope

### In Scope
- Add `@OneToMany` relations from `Invoice` to `CreditNote` and `DebitNote`
- Enrich `sales.service.ts findAll` to join notes and compute `netTotal` per invoice
- Add `netTotal?: number` to the frontend `Invoice` model
- Display `netTotal ?? totalAmount` in the sales table under a "Total Neto" header
- Remove the redundant PDF icon-button from the invoices table row actions
- Remove the `downloadPdf()` method from `sales-page.component.ts`

### Out of Scope
- DB migration (FK already lives on the note side; no schema change needed)
- Changes to the invoice detail dialog or its PDF download feature
- Changes to `invoice.service.ts getInvoicePdf` (still used by the dialog)
- Pagination or filtering of notes
- Any credit/debit note CRUD

## Capabilities

> This section is the CONTRACT between proposal and specs phases.

### New Capabilities
- `sales-invoice-net-total`: Computing `netTotal = totalAmount - SUM(creditNotes.amount) + SUM(debitNotes.amount)` per invoice in the backend `findAll` response and rendering it in the frontend sales table as "Total Neto".

### Modified Capabilities
- `sales-invoice-list`: Remove the redundant PDF icon-button and `downloadPdf()` method from the invoices table actions column; the feature remains available in the invoice detail dialog.

## Approach

1. **Backend entity** — Decorate `Invoice` with `@OneToMany(() => CreditNote, n => n.invoice)` and `@OneToMany(() => DebitNote, n => n.invoice)`. No migration required.
2. **Backend service** — In `findAll`, add `leftJoinAndSelect` for `creditNotes` and `debitNotes`. Map each invoice to include `netTotal` in the returned DTO.
3. **Frontend model** — Append `netTotal?: number` to the `Invoice` interface/class.
4. **Frontend component** — Bind the "Total Neto" column to `netTotal ?? totalAmount`. Delete the PDF `<button>` block from the template and the `downloadPdf()` method from the class.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `erpbackend/src/modules/sales/entities/invoice.entity.ts` | Modified | Add `@OneToMany` for `creditNotes` and `debitNotes` |
| `erpbackend/src/modules/sales/sales.service.ts` | Modified | Join notes in `findAll`, compute and expose `netTotal` |
| `erpfrontend/src/app/models/invoice.model.ts` | Modified | Add optional `netTotal?: number` field |
| `erpfrontend/src/app/components/pages/sales-page/sales-page.component.ts` | Modified | Render "Total Neto", remove PDF button and `downloadPdf()` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `leftJoinAndSelect` on notes degrades `findAll` perf on large datasets | Low | Notes per invoice are bounded; add DB indexes on FK if needed |
| Removing PDF button breaks a workflow users rely on in the list | Low | Feature remains fully accessible in the detail dialog |
| `netTotal` undefined if no notes exist | Low | Frontend falls back to `totalAmount` via `??` operator |

## Rollback Plan

Revert the four changed files to their previous state via `git revert` or
manual reset. No migration was applied, so no DB rollback is needed. The PDF
button can be restored by re-adding the template block and `downloadPdf()` method.

## Dependencies

- `CreditNote` and `DebitNote` entities must expose an `invoice` relation with
  an `amount` column (confirmed via exploration — FK already exists on note side).

## Success Criteria

- [ ] `GET /sales/invoices` response includes `netTotal` for each invoice
- [ ] `netTotal` equals `totalAmount` when no credit/debit notes exist
- [ ] Sales table column header reads "Total Neto" and displays `netTotal`
- [ ] PDF button is absent from the table row; PDF download still works in detail dialog
- [ ] No DB migration file is required or generated
