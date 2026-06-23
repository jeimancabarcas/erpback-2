# Design: Credit/Debit Notes for Manual Sales — PDF Generation

## Technical Approach

Branch `downloadInvoicePdf` on `invoice.isElectronic` — manual invoices get a local PDF via new `PdfGenerationService` (pdfkit in-memory buffer). Remove the `BadRequestException` guard in `createCreditNote`/`createDebitNote`; for manual invoices, skip Factus entirely, persist notes + items in a transaction with sequential per-invoice numbering (`NC-MAN-{inv}-{seq}`/`ND-MAN-{inv}-{seq}`), and set `CANCELLED` status locally on concept '2'. Add `CreditNoteItem`/`DebitNoteItem` entities for PDF detail. Frontend: extract Base64 → blob logic into shared `pdf-utils.ts`, conditionally show PDF button + label for manual invoices with notes, pass `fileName`, fix `revokeObjectURL` leak. Add `isElectronic` filter to `QueryInvoicesDto`.

## Architecture Decisions

| Decision | Alternatives | Choice & Rationale |
|----------|-------------|-------------------|
| PDF library | pdf-lib (modification-focused), raw PDF bytes (existing fragile approach) | **pdfkit** — stream-friendly, NestJS pattern, handles table layout well |
| PdfGenerationService location | Inside SalesService as private method | **New PdfModule** — keeps SRP, testable in isolation, avoids bloating SalesService |
| Note items persistence | Derive from invoice items at PDF time | **New credit_note_items/debit_note_items tables** — required by spec (FR4), enables accurate PDF even if invoice items change later |
| Sequential numbering mechanism | DB sequence, UUID prefix | **COUNT + 1 in transaction** — simple, scoped per invoice+type, no infra dependency |
| Transaction scope | Two-phase (note then items) | **Single transaction** for note + items + status change (FR4.2, NFR3) — use DataSource queryRunner |
| Frontend PDF utils | Keep inline in component | **Shared pdf-utils.ts** — eliminates duplicate code, both detail-dialog and future callers benefit |
| `isElectronic` filter strategy | Custom query builder | **Use buildWhere with exactFields** — follows existing pattern, minimal change, handles omission gracefully |

## Data Flow

```
Manual Credit Note (isElectronic=false):

  POST /invoices/:id/credit-note
    → SalesService.createCreditNote()
      → Load invoice+items (reject if CANCELLED or not found)
      → isElectronic === false → SKIP Factus
      → BEGIN TRANSACTION
        → COUNT existing credit notes for this invoice → seq
        → Build noteNumber = NC-MAN-{inv}-{seq}
        → CREATE CreditNote record (cude=null, qrUrl=null, publicUrl=null)
        → CREATE CreditNoteItem[] records
        → IF correctionConceptCode === '2': UPDATE invoice.status = CANCELLED
      → COMMIT
      → Return CreditNote (same shape as electronic path)

Manual Invoice PDF Download:

  GET /invoices/:id/pdf
    → SalesService.downloadInvoicePdf()
      → Load invoice (reject if not found)
      → isElectronic === false
        → Load creditNotes + debitNotes (+ items relation)
        → PdfGenerationService.generateInvoicePdf(invoice, creditNotes, debitNotes)
          → pdfkit: header → items table → applied notes → balance
          → Return base64 string
      → Return { pdfBase64Encoded, fileName: "{inv}-historial.pdf" }

Cancellation (concept '2'):

  createCreditNote() with correctionConceptCode='2'
    → Local path (same as above)
    → After CreditNote saved: invoice.status = CANCELLED
    → Within same transaction → atomic
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/pdf/pdf.module.ts` | Create | Register PdfGenerationService, export for SalesModule |
| `src/modules/pdf/pdf-generation.service.ts` | Create | `generateInvoicePdf(invoice, creditNotes, debitNotes): string` using pdfkit |
| `src/modules/sales/entities/credit-note-item.entity.ts` | Create | `@Entity('credit_note_items')` with id, creditNoteId, codeReference, name, quantity, unitPrice, subtotal |
| `src/modules/sales/entities/debit-note-item.entity.ts` | Create | `@Entity('debit_note_items')` — same columns, references debitNoteId |
| `src/modules/sales/entities/credit-note.entity.ts` | Modify | Add `@OneToMany(() => CreditNoteItem, item => item.creditNote) items` |
| `src/modules/sales/entities/debit-note.entity.ts` | Modify | Add `@OneToMany(() => DebitNoteItem, item => item.debitNote) items` |
| `src/modules/sales/sales.service.ts` | Modify | `downloadInvoicePdf()`: guard → local PDF path. `createCreditNote()`: remove manual guard, add local path. `createDebitNote()`: same. Add `CreditNoteItem`/`DebitNoteItem` repo injections. Add sequential numbering helper. Wrap note creation in queryRunner transaction. |
| `src/modules/sales/sales.module.ts` | Modify | Import `PdfModule`, add `CreditNoteItem`/`DebitNoteItem` to TypeOrm.forFeature |
| `src/modules/sales/dto/query-invoices.dto.ts` | Modify | Add `@IsOptional() @IsBoolean() isElectronic?: boolean` |
| `package.json` | Modify | Add `pdfkit` + `@types/pdfkit` dependencies |
| Frontend: `src/app/utils/pdf-utils.ts` | Create | `downloadBase64Pdf(base64, fileName)` — atob → Blob → URL.createObjectURL → window.open → setTimeout(revokeObjectURL, 2000) |
| Frontend: `components/.../invoice-detail-dialog.component.ts` | Modify | Conditional button: show when `inv.isElectronic || notes.length > 0`, label "Ver PDF Historial" for manual, call `downloadBase64Pdf` instead of inline decode |

## Interfaces / Contracts

```typescript
// PdfGenerationService
export class PdfGenerationService {
  generateInvoicePdf(
    invoice: Invoice,
    creditNotes: CreditNote[],
    debitNotes: DebitNote[],
  ): string; // returns base64-encoded PDF
}

// Manual credit note response (same shape as electronic)
{
  id: string;
  referenceCode: string;
  noteNumber: "NC-MAN-MAN-00000001-1";  // local pattern
  cude: null;     // always null for manual
  qrUrl: null;    // always null for manual
  publicUrl: null; // always null for manual
  correctionConceptCode: string;
  amount: number;
  observation: string | null;
  invoiceId: string;
  createdAt: Date;
  updatedAt: Date;
  items: CreditNoteItem[];
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit — SalesService | `downloadInvoicePdf` guard (manual→local, electronic→Factus) | Mock Factus + PdfGenerationService, assert call/no-call per path |
| Unit — SalesService | `createCreditNote` manual path: local numbering, items persistence, cancellation | Mock repos, assert CreditNote+CreditNoteItem saved, status change on '2' |
| Unit — SalesService | `createDebitNote` manual path: local numbering, items persistence | Same pattern as credit, assert no status change |
| Unit — SalesService | Item validation: quantity exceeds, item not in invoice | Assert BadRequestException, no persist |
| Unit — SalesService | Electronic flow unchanged | Assert Factus called, same mock setup as existing tests |
| Unit — PdfGenerationService | PDF structure: header, items, notes, balance | Generate with known data, assert raw PDF contains expected strings (e.g. `%PDF-1.4`, `MAN-00000001`, `$1,000.00`) |
| Unit — PdfGenerationService | Empty notes edge case | Assert "No se han aplicado notas" in PDF output |
| Integration | Concurrent note creation | Two simultaneous requests on same invoice, assert unique noteNumbers (no collisions) |
| Integration | Full create→PDF cycle for manual invoice | Create invoice → create credit note → download PDF → assert valid PDF |
| Frontend — component | Button visibility conditions | `inv.isElectronic && notes=0` → visible. `!inv.isElectronic && notes=0` → hidden. `!inv.isElectronic && notes>0` → visible |
| Frontend — pdf-utils | Blob creation, URL.revokeObjectURL | Mock URL.createObjectURL/revokeObjectURL, assert calls |
| E2E | Full flow: manual invoice → credit note → PDF | SuperTest: POST invoice → POST credit-note → GET pdf → assert 200 + valid PDF |

**Mock boundary**: Mock `factusGateway` for all manual paths (must never be called). Mock `PdfGenerationService` in SalesService unit tests; test PdfGenerationService separately with real `pdfkit`.

## Migration / Rollout

No data migration required. New tables (`credit_note_items`, `debit_note_items`) are created synchronously via TypeORM `synchronize` (current project config) or a new migration file. Electronic invoices' existing credit/debit notes will have `items: []` until the migration runs — the PDF generation handles empty items gracefully.

## Open Questions

- [ ] Does TypeORM `synchronize` handle the new entity registration automatically, or does the project need a dedicated migration file?
- [ ] Should the sequential counter reset on a specific event (e.g., invoice re-activation after cancellation)?
