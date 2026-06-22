# Proposal: Credit/Debit Notes for Manual Sales — PDF Generation

## Intent

Fix production crash on PDF download for manual invoices. Unblock credit/debit notes for manual sales without Factus/DIAN. Generate a single local PDF showing full invoice history + all applied notes.

## Scope

**In Scope:** (1) Guard `downloadInvoicePdf` for manual → return local PDF, never call Factus. (2) Unblock credit/debit note creation for manual invoices — skip Factus, process locally. (3) Add pdfkit + `PdfGenerationService`. (4) PDF output: invoice header, items table, all applied notes, current balance. (5) Persist credited/debited items in new tables for PDF detail. (6) Note numbering: `NC-MAN-{invNum}-{seq}` / `ND-MAN-{invNum}-{seq}`. (7) Total cancellation (concept code 2) sets invoice status to CANCELLED locally. (8) Frontend: show PDF button for manual with notes, extract Base64 decode to shared util, fix blob URL leak, use `fileName` param. (9) Add `isElectronic` filter to `QueryInvoicesDto`.

**Out of Scope:** DIAN/Factus integration for manual notes, fiscal/legal PDF compliance, print layout customization, email delivery.

## Capabilities

### New Capabilities
- `manual-sales-pdf`: Local PDF generation showing invoice + notes history
- `manual-credit-debit-notes`: Credit/debit note creation for manual invoices with local processing

### Modified Capabilities
- `sales-manual-invoice`: Requirement "Credit Note and Debit Note Blocked for Manual Invoices" — change from throw to local-only processing (skip Factus, persist locally, generate PDF)

## Approach

Add `pdfkit` dependency. Create `PdfGenerationService` with a single method: invoice header → items table → applied notes (credit/debit with amounts and observations) → net balance footer. For manual invoice PDF download, detect `isElectronic === false` and generate via this service. For manual notes, bypass Factus in `createCreditNote/createDebitNote`, assign local numbering, persist note items in new join tables, and generate PDF via same service. Frontend: show PDF button when `isElectronic || notes.length > 0`, extract repeated Base64 decode into shared `pdf-utils.ts`, call `revokeObjectURL` after tab open, pass `fileName` to download attribute.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/modules/sales/sales.service.ts` | Modified — PDF guard, unblock notes, persist note items |
| `src/modules/sales/entities/credit-note.entity.ts` | Modified — add `items` relation |
| `src/modules/sales/entities/debit-note.entity.ts` | Modified — add `items` relation |
| `src/modules/sales/entities/credit-note-item.entity.ts` (new) | New — credited items persistence |
| `src/modules/sales/entities/debit-note-item.entity.ts` (new) | New — debited items persistence |
| `src/modules/sales/dto/query-invoices.dto.ts` | Modified — add optional `isElectronic` filter |
| `src/modules/pdf/pdf-generation.service.ts` (new) | New — PDF builder module |
| `src/modules/pdf/pdf.module.ts` (new) | New — module registration |
| `package.json` | Modified — add pdfkit + @types/pdfkit |
| Frontend: `services/invoice.service.ts` | Modified — use fileName param for download |
| Frontend: `utils/pdf-utils.ts` (new) | New — shared Base64 decode + download |
| Frontend: `invoice-detail-dialog.component.ts` | Modified — show PDF for manual with notes, use shared util |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PDF layout differences erode user trust | Med | Mirror existing simulated PDF layout first |
| Note number collision on concurrent create | Low | Use DB sequence or typeorm optimistic locking |
| Refactor breaks existing electronic flow | Med | Keep Factus path identical; test both paths end-to-end |
| pdfkit streaming doesn't fit NestJS response pattern | Low | Buffer PDF output in memory, return as base64 (matches existing contract) |

## Rollback Plan

Remove new service/entities/migration, restore `BadRequestException` guards in both note methods, remove `isElectronic` filter from DTO, revert frontend PDF visibility and utils. No data migration needed for rollback — new tables have no downstream consumers.

## Dependencies

- `pdfkit` + `@types/pdfkit` (npm). Chosen over pdf-lib (modification-focused, less suited for generation) and pdfmake (heavier, less NestJS-friendly).
- Frontend: no new dependencies.

## Success Criteria

- [ ] `downloadInvoicePdf` for manual invoice returns a valid PDF without calling Factus
- [ ] `createCreditNote` and `createDebitNote` succeed for manual invoices, persist with local numbering
- [ ] Generated PDF contains invoice items + all applied notes + running balance
- [ ] Existing electronic invoice flows pass all existing tests unchanged
- [ ] Frontend PDF button visible for manual invoices with notes, hidden for manual without notes
- [ ] `URL.revokeObjectURL` called after PDF tab opens (no leak)
