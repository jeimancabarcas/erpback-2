# Tasks: credit-debit-notes-manual-sales-pdf

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-480 (backend 200-280 + frontend 100-130 + tests 50-70) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (backend foundation + core logic) → PR 2 (frontend + tests) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: entities, PdfModule, service changes (T1-T11) | PR 1 | All backend logic. Tests in separate PR to keep diffs focused. |
| 2 | Frontend: utils, dialog, filter + all tests (T12-T18) | PR 2 | Depends on PR 1 API contract only. Can be reviewed independently. |

## Phase 1: Foundation — Entities & Service Scaffolding

---

### T1: Install pdfkit and type definitions

- **Title**: Install pdfkit + @types/pdfkit npm dependencies
- **Description**: Add `pdfkit` as a runtime dependency and `@types/pdfkit` as a dev dependency in the backend `package.json`. Run `npm install` to update `package-lock.json`.
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\package.json` (modify)
- **Dependencies**: None
- **Estimated effort**: Small
- **Acceptance criteria**:
  - `pdfkit` appears in `dependencies` in `package.json`
  - `@types/pdfkit` appears in `devDependencies` in `package.json`
  - `npm install` completes without errors
  - `import * as PDFDocument from 'pdfkit'` compiles without type errors
- **Testing notes**: No runtime tests needed. Verify with a build check (`npm run build`).

---

### T2: Create CreditNoteItem and DebitNoteItem entities

- **Title**: Create credit_note_items and debit_note_items entity files
- **Description**: Create two new TypeORM entity files. `CreditNoteItem` has `@PrimaryGeneratedColumn('uuid') id`, `@ManyToOne → creditNote`, `creditNoteId`, `codeReference`, `name`, `quantity`, `unitPrice` (decimal 12,2), `subtotal` (decimal 12,2). `DebitNoteItem` mirrors the structure with `debitNoteId` and `@ManyToOne → debitNote`. Both use `@Entity` with table names `credit_note_items` and `debit_note_items`. Add `@Index` on the foreign key columns for query performance.
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\entities\credit-note-item.entity.ts` (create)
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\entities\debit-note-item.entity.ts` (create)
- **Dependencies**: None
- **Estimated effort**: Small
- **Acceptance criteria**:
  - `CreditNoteItem` entity matches the DDL: `credit_note_items` table with all specified columns
  - `DebitNoteItem` entity matches the DDL: `debit_note_items` table with all specified columns
  - Foreign key `credit_note_id` references `credit_notes(id)` with `ON DELETE CASCADE`
  - Foreign key `debit_note_id` references `debit_notes(id)` with `ON DELETE CASCADE`
  - Both entities have an `id` UUID primary key
  - TypeORM synchronize creates both tables on next startup (or migration equivalent)
- **Testing notes**: Verify entity registration compiles. Run TypeORM sync and confirm table creation in dev DB.

---

### T3: Add `items` OneToMany relation to CreditNote and DebitNote entities

- **Title**: Add items relation to CreditNote and DebitNote entities
- **Description**: Add `@OneToMany(() => CreditNoteItem, (item) => item.creditNote) items: CreditNoteItem[]` to `CreditNote`. Add `@OneToMany(() => DebitNoteItem, (item) => item.debitNote) items: DebitNoteItem[]` to `DebitNote`. Import the new entities. Ensure both sides of the relation are properly defined with the foreign key column.
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\entities\credit-note.entity.ts` (modify)
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\entities\debit-note.entity.ts` (modify)
- **Dependencies**: T2 (CreditNoteItem/DebitNoteItem entities must exist)
- **Estimated effort**: Small
- **Acceptance criteria**:
  - `CreditNote.items` resolves to `CreditNoteItem[]` via `@OneToMany`
  - `DebitNote.items` resolves to `DebitNoteItem[]` via `@OneToMany`
  - Existing code that imports `CreditNote`/`DebitNote` continues to compile
  - `find` with `relations: ['items']` returns the related items
- **Testing notes**: Compile check. Integration: create a note, verify items relation loads correctly.

---

### T4: Create PdfModule and PdfGenerationService scaffold

- **Title**: Create PdfModule and PdfGenerationService with initial method signature
- **Description**: Create a new `PdfModule` under `src/modules/pdf/`. Create `PdfGenerationService` with the method `generateInvoicePdf(invoice, creditNotes, debitNotes): string` returning a base64-encoded PDF string. Initially the method can return a placeholder; full pdfkit implementation comes in T6. Register `PdfGenerationService` as a `@Injectable()` provider in the module, and export it so `SalesModule` can import it. The module should not import anything beyond `@nestjs/common`.
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\pdf\pdf.module.ts` (create)
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\pdf\pdf-generation.service.ts` (create)
- **Dependencies**: T1 (pdfkit must be installed, though full implementation is T6)
- **Estimated effort**: Small
- **Acceptance criteria**:
  - `PdfModule` is a valid NestJS module, exports `PdfGenerationService`
  - `PdfGenerationService` is `@Injectable()` and can be injected
  - `generateInvoicePdf()` exists with correct signature: `(invoice: Invoice, creditNotes: CreditNote[], debitNotes: DebitNote[]) => string`
- **Testing notes**: Unit test scaffold — inject the service, call method, assert it returns a string.

---

### T5: Register new entities and PdfModule in SalesModule

- **Title**: Register CreditNoteItem, DebitNoteItem repos and import PdfModule in SalesModule
- **Description**: Add `CreditNoteItem` and `DebitNoteItem` to the `TypeOrmModule.forFeature()` array in `SalesModule`. Add `PdfModule` to the `imports` array so `PdfGenerationService` is available for injection in `SalesService`. Verify the module compiles and the DI graph resolves.
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\sales.module.ts` (modify)
- **Dependencies**: T2 (entities exist), T4 (PdfModule exists)
- **Estimated effort**: Small
- **Acceptance criteria**:
  - `SalesModule` compiles without circular dependency errors
  - `CreditNoteItem` and `DebitNoteItem` repositories are injectable in `SalesService`
  - `PdfGenerationService` is injectable in `SalesService`
- **Testing notes**: Compile check. Start the app, verify no DI errors on startup.

---

## Phase 2: Core Logic — Note Creation & PDF Generation

---

### T6: Implement PdfGenerationService with pdfkit

- **Title**: Full pdfkit implementation of PdfGenerationService.generateInvoicePdf()
- **Description**: Implement `generateInvoicePdf(invoice, creditNotes, debitNotes): string` using pdfkit. The PDF must contain in order:
  1. **Header**: title "Historial de Factura {invoiceNumber}", issue date, customer name and document number
  2. **Items table**: columns Producto, Cantidad, Precio Unit., Subtotal with one row per invoice item and a total row
  3. **Applied notes section**: heading "Notas de Ajuste Aplicadas". Each credit note shown with negative sign (red styling concept), each debit note with positive sign (blue). Show note number, date, concept, observation, amount. If no notes exist, show "No se han aplicado notas de ajuste".
  4. **Net balance footer**: formula "Total Original - Créditos + Débitos = Saldo Actual" with calculated values.

  Use pdfkit's `doc.pipe()` to a buffer, then convert to base64. Use `doc.fontSize()`, `doc.text()`, `doc.rect()` for table borders. Keep layout simple but readable — stick to monochrome + grayscale for table borders, use bold font for headers. Do NOT write to disk (in-memory buffer only). Validate the output starts with `%PDF-1.4` and ends with `%%EOF`.

- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\pdf\pdf-generation.service.ts` (modify — replace placeholder)
- **Dependencies**: T1 (pdfkit installed), T4 (service scaffold exists)
- **Estimated effort**: Large
- **Acceptance criteria**:
  - Output is a valid base64 string
  - Decoded PDF starts with `%PDF-1.4` and ends with `%%EOF`
  - PDF contains: invoice header, items table, notes section, net balance
  - With empty notes, shows "No se han aplicado notas de ajuste"
  - Balance formula: `$1,000.00 - $200.00 + $50.00 = $850.00`
  - PDF opens without errors in Chrome PDF viewer
- **Testing notes**:
  - Unit: generate PDF with known data, assert raw bytes contain expected text strings
  - Unit: verify base64 decodes to valid PDF header/footer
  - Edge case: empty notes list
  - Edge case: single item, multiple items

---

### T7: Refactor createCreditNote for manual invoices — local path

- **Title**: Unblock credit note creation for manual invoices with local processing
- **Description**: Remove the `BadRequestException` guard in `SalesService.createCreditNote()` that blocks manual invoices. When `invoice.isElectronic === false`:
  - Skip all Factus-related code (payload building, Factus API call, response parsing)
  - Compute sequential note number: count existing credit notes for this invoice → `NC-MAN-{invoiceNumber}-{seq}` (seq starts at 1, zero-padded)
  - Wrap everything in a `DataSource.createQueryRunner()` transaction
  - Validate items against invoice items (same validation as electronic path)
  - When `dto.items` is empty/not provided, create items for every invoice item (full-value note)
  - Persist `CreditNote` with `cude: null`, `qrUrl: null`, `publicUrl: null`
  - Persist each `CreditNoteItem` linked to the new credit note
  - If `correctionConceptCode === '2'`, update invoice status (see T10)
  - Return the same response shape as the electronic path
  - For electronic invoices, the existing Factus path must remain **100% unchanged**
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\sales.service.ts` (modify)
- **Dependencies**: T5 (entities registered, PdfModule imported), T3 (items relation on CreditNote)
- **Estimated effort**: Large
- **Acceptance criteria**:
  - Manual credit note succeeds without throwing `BadRequestException`
  - `factusGateway.createCreditNote()` is NOT called for manual invoices
  - Note number follows `NC-MAN-{inv}-{seq}` pattern
  - `CreditNote` has `cude: null`, `qrUrl: null`, `publicUrl: null`
  - Empty `dto.items` creates items for all invoice items
  - Item validation rejects quantities exceeding invoice item quantity
  - Item validation rejects items not belonging to the invoice
  - Already-cancelled invoice is rejected with 400
  - Electronic path still calls Factus and returns the same shape as before
- **Testing notes**:
  - Unit: mock repos + Factus gateway, assert local path is taken when `isElectronic === false`
  - Unit: assert Factus is NOT called for manual
  - Unit: assert item validation errors
  - Integration: full create → credit note → assert DB records

---

### T8: Refactor createDebitNote for manual invoices — local path

- **Title**: Unblock debit note creation for manual invoices with local processing
- **Description**: Same pattern as T7 for debit notes. Remove `BadRequestException` guard. When `isElectronic === false`:
  - Skip Factus entirely
  - Compute `ND-MAN-{invoiceNumber}-{seq}` (independent counter from credit notes)
  - Persist `DebitNote` + `DebitNoteItem` records in a transaction
  - Same item validation rules
  - Debit notes never cancel the invoice (ignore concept code '2' for status)
  - Electronic path must be unchanged
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\sales.service.ts` (modify)
- **Dependencies**: T5 (entities registered), T3 (items relation on DebitNote)
- **Estimated effort**: Medium
- **Acceptance criteria**:
  - Manual debit note succeeds without `BadRequestException`
  - `factusGateway.createDebitNote()` is NOT called for manual invoices
  - Note number follows `ND-MAN-{inv}-{seq}` pattern (counter independent from credit notes)
  - `DebitNote` has `cude: null`, `qrUrl: null`, `publicUrl: null`
  - Invoice status never changes regardless of `correctionConceptCode`
  - Electronic path unchanged
- **Testing notes**:
  - Unit: same mock approach as T7 but for debit notes
  - Unit: assert status never changes
  - Integration: create → debit note → assert DB records

---

### T9: Guard downloadInvoicePdf for manual invoices → local PDF

- **Title**: Branch downloadInvoicePdf on isElectronic for local PDF generation
- **Description**: In `SalesService.downloadInvoicePdf()`, after loading the invoice, check `invoice.isElectronic`. When `false`:
  - Load the invoice's associated credit notes and debit notes (with items relation)
  - Call `PdfGenerationService.generateInvoicePdf(invoice, creditNotes, debitNotes)`
  - Return `{ pdfBase64Encoded, fileName: '{invoiceNumber}-historial.pdf' }`
  - Never call `factusGateway.downloadInvoicePdf()` for manual invoices
  - When `true`, the existing Factus path executes unchanged
  - Handle service errors: log and throw `InternalServerError`, do NOT fall back to Factus
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\sales.service.ts` (modify)
- **Dependencies**: T6 (PdfGenerationService fully implemented), T5 (PdfModule imported)
- **Estimated effort**: Medium
- **Acceptance criteria**:
  - Manual invoice returns PDF from `PdfGenerationService`, not Factus
  - Manual invoice response includes `fileName: 'MAN-XXXXXXXX-historial.pdf'`
  - Electronic invoice still calls `factusGateway.downloadInvoicePdf()`
  - Manual invoice without notes still generates PDF (empty notes section)
  - `NotFoundException` for non-existent invoice still works
  - PDF service errors logged, no Factus fallback, 500 returned
- **Testing notes**:
  - Unit: mock both Factus and PdfGenerationService, assert correct path per `isElectronic`
  - Unit: assert Factus NOT called for manual even when PDF service throws
  - Integration: GET invoice PDF → assert valid response shape

---

### T10: Local cancellation support for credit note concept '2'

- **Title**: Set invoice status to CANCELLED when credit note has correctionConceptCode '2'
- **Description**: Within the local credit note path (T7), after persisting the `CreditNote` and `CreditNoteItem` records, check `dto.correctionConceptCode === '2'`. If so, set `invoice.status = InvoiceStatus.CANCELLED` and persist within the same transaction. This mirrors the existing electronic cancellation behavior but operates locally. Debit notes never cancel invoices (same as electronic path).
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\sales.service.ts` (modify — part of T7 changes)
- **Dependencies**: T7 (local credit note path exists)
- **Estimated effort**: Small (included within T7)
- **Acceptance criteria**:
  - Credit note with `correctionConceptCode === '2'` changes `invoice.status` to `CANCELLED`
  - Other concept codes (e.g., '1', '3') do NOT change status
  - Debit notes never change status regardless of concept code
  - Status change is atomic within the same transaction as note creation
- **Testing notes**: Unit test with both '2' and non-'2' concept codes, assert status change.

---

### T11: Implement sequential numbering with transaction safety

- **Title**: Add sequential numbering helper with race-condition protection
- **Description**: Create a private helper method in `SalesService` (or extract to a utility) that computes the next sequential number for a given invoice and note type. The helper should COUNT existing notes of that type for the invoice (e.g., `creditNoteRepository.count({ where: { invoiceId } })`) and add 1. The number must be computed INSIDE the transaction to prevent race conditions under concurrent requests. Use `queryRunner.manager.count()` instead of repository methods to stay within the transaction boundary. The counter is scoped by BOTH `invoiceId` AND note type — e.g., credit note seq and debit note seq for the same invoice are independent and both start at 1.
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\sales.service.ts` (modify — add private helper)
- **Dependencies**: T7, T8 (both need the helper)
- **Estimated effort**: Small
- **Acceptance criteria**:
  - Helper returns correct `seq` starting at 1 for first note of that type on an invoice
  - Credit and debit note counters are independent on the same invoice
  - Second credit note on same invoice returns seq=2
  - Computation occurs inside transaction boundary
  - Two concurrent requests on same invoice produce unique numbers (no collisions)
- **Testing notes**:
  - Unit: mock count, assert correct seq returned
  - Integration: create 2 credit notes simultaneously on same invoice, assert unique numbers

---

## Phase 3: Frontend — Conditional UI & Shared Utils

---

### T12: Create shared pdf-utils.ts with downloadBase64Pdf

- **Title**: Create shared Base64 PDF download utility for frontend
- **Description**: Create `src/app/utils/pdf-utils.ts` exporting `downloadBase64Pdf(base64: string, fileName: string): void`. The function:
  1. Decodes the base64 string using `atob()`
  2. Creates a `Uint8Array` from the decoded bytes
  3. Creates a `Blob` with MIME type `application/pdf`
  4. Creates an object URL via `URL.createObjectURL(blob)`
  5. Opens the URL in a new tab: `window.open(blobUrl, '_blank')`
  6. If `fileName` is provided, attempt to set the download attribute (or use as tab title fallback)
  7. Calls `URL.revokeObjectURL(blobUrl)` after 2000ms via `setTimeout`
  8. Includes try/catch with `console.error` and user alert on failure

  The `fileName` parameter should be used: create a hidden `<a>` element with `download` attribute and trigger click, OR pass it via URL fragment for display purposes. Prefer the download attribute approach for browser compatibility.

- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpfrontend\src\app\utils\pdf-utils.ts` (create)
- **Dependencies**: None
- **Estimated effort**: Small
- **Acceptance criteria**:
  - `downloadBase64Pdf()` exists as a named export
  - Creates Blob, object URL, opens tab, revokes after 2000ms
  - `fileName` is passed through to the download mechanism
  - Error handling: malformed base64 shows alert and logs error
- **Testing notes**:
  - Unit: mock `URL.createObjectURL`/`URL.revokeObjectURL`, `window.open`, assert calls
  - Unit: assert `setTimeout` calls `revokeObjectURL` with correct URL

---

### T13: Modify InvoiceDetailDialogComponent for conditional PDF

- **Title**: Conditionally show PDF button and update label for manual invoices
- **Description**: In `InvoiceDetailDialogOrganism`:
  1. Change PDF button visibility: show when `inv.isElectronic || notes().creditNotes.length > 0 || notes().debitNotes.length > 0`
  2. Change button label: "Ver PDF Historial" for manual invoices, "Ver PDF DIAN" for electronic
  3. Replace the inline `atob()` / `Uint8Array` / `Blob` / `URL.createObjectURL` code in `viewPdf()` with a call to the shared `downloadBase64Pdf(res.pdfBase64Encoded, res.fileName)` from `pdf-utils.ts`
  4. The inline decode logic must be removed entirely — no duplicate blob handling

- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpfrontend\src\app\components\organisms\invoice-detail-dialog\invoice-detail-dialog.component.ts` (modify)
- **Dependencies**: T12 (pdf-utils.ts must exist)
- **Estimated effort**: Small
- **Acceptance criteria**:
  - PDF button visible when `inv.isElectronic === true` (regardless of notes)
  - PDF button visible when `!inv.isElectronic && (creditNotes.length > 0 || debitNotes.length > 0)`
  - PDF button hidden when `!inv.isElectronic && notes.length === 0`
  - Label is "Ver PDF Historial" for manual invoices
  - Label is "Ver PDF DIAN" for electronic invoices
  - `viewPdf()` calls `downloadBase64Pdf()` and passes `fileName`
  - No inline `atob()`/`Blob`/`URL.createObjectURL` code remains in the component
- **Testing notes**:
  - Component test: set different invoice states, assert button visibility and label
  - Component test: click button with mock service, assert `downloadBase64Pdf` is called

---

### T14: Update invoice service to pass fileName from response

- **Title**: Verify frontend invoice.service.ts passes fileName to dialog
- **Description**: Review `InvoiceService.getInvoicePdf()` — it already returns `{ pdfBase64Encoded, fileName }`. No changes needed to the service itself. Verify that `InvoiceDetailDialogOrganism.viewPdf()` passes `res.fileName` to `downloadBase64Pdf()`. If the dialog passes the full response object, confirm `fileName` is accessible and used.
- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpfrontend\src\app\services\invoice.service.ts` (inspect/verify, no changes needed)
  - `C:\Users\jeima\Desktop\ERP Repositories\erpfrontend\src\app\components\organisms\invoice-detail-dialog\invoice-detail-dialog.component.ts` (modify if needed)
- **Dependencies**: T13 (dialog modification)
- **Estimated effort**: Small
- **Acceptance criteria**: `fileName` from API response is passed to `downloadBase64Pdf()` and used in the download mechanism
- **Testing notes**: Integration test — mock API returns `{ pdfBase64Encoded, fileName }`, assert `downloadBase64Pdf` called with both params.

---

## Phase 4: Polish — Filters, Edge Cases & Tests

---

### T15: Add isElectronic filter to QueryInvoicesDto

- **Title**: Add optional isElectronic boolean filter to QueryInvoicesDto
- **Description**: Add `@IsOptional() @IsBoolean() isElectronic?: boolean` to `QueryInvoicesDto`. In `SalesService.findAll()`, modify the `buildWhere` call to include `isElectronic` in the `exactFields` array or handle it manually. The filter must:
  - When `true`, return only invoices where `isElectronic === true`
  - When `false`, return only manual invoices (`isElectronic === false`)
  - When omitted (undefined), not filter at all
  - Combine correctly with other existing filters (`status`, `customerId`, `invoiceNumber`)
  - Non-boolean values should be handled gracefully (ignore the param, no error)

  Note: `buildWhere` currently has a limitation — falsy values don't pass the `if (queryDto[field])` check. For a boolean `false`, `queryDto[field]` is `false`, which fails `if (false)`. Either handle `isElectronic` as a special case outside `buildWhere`, or modify `buildWhere` to support explicit boolean checks. Prefer handling it as a special case in `findAll()` to avoid affecting other callers.

- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\dto\query-invoices.dto.ts` (modify)
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\sales.service.ts` (modify — findAll method)
- **Dependencies**: None (standalone DTO change)
- **Estimated effort**: Small
- **Acceptance criteria**:
  - `?isElectronic=true` returns only electronic invoices
  - `?isElectronic=false` returns only manual invoices
  - No `isElectronic` param returns all invoices (unchanged behavior)
  - Filter combines with `status`, `customerId`, etc.
  - Invalid values like `isElectronic=yes` are ignored without error
  - Pagination works correctly with the filter applied
- **Testing notes**:
  - Unit: mock repository with different `isElectronic` values, assert correct `where` clause
  - Integration: request with/without filter, assert count matches

---

### T16: Add unit tests for SalesService manual paths

- **Title**: Write unit tests for createCreditNote, createDebitNote, downloadInvoicePdf manual paths
- **Description**: Add tests to `sales.service.spec.ts` covering:
  1. `downloadInvoicePdf`: manual → calls PdfGenerationService, electronic → calls Factus
  2. `createCreditNote`: manual path skips Factus, persists note + items, returns correct shape
  3. `createCreditNote`: cancellation (concept '2') sets invoice status to CANCELLED
  4. `createCreditNote`: partial vs full-value (empty items)
  5. `createCreditNote`: item validation errors (quantity exceeds, item not in invoice)
  6. `createCreditNote`: cancelled invoice rejection
  7. `createDebitNote`: manual path, independent counter, no status change
  8. `downloadInvoicePdf`: Factus fallback guard (never call Factus for manual)
  9. Existing electronic flows unchanged (regression tests)

  Mock boundary: mock `factusGateway`, `PdfGenerationService`, all repositories. Use the real `DataSource` mock or create a `queryRunner` mock for transaction testing.

- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\sales\sales.service.spec.ts` (modify)
- **Dependencies**: T7, T8, T9, T10 (all SalesService changes must be implemented)
- **Estimated effort**: Medium
- **Acceptance criteria**:
  - All manual path tests pass
  - All existing electronic path tests still pass (no regressions)
  - Coverage confirms both branches of `isElectronic` are tested for each method
  - Mock calls assert Factus is never called for manual invoices
- **Testing notes**: Run `npm test` — focus on `sales.service.spec.ts`.

---

### T17: Add unit tests for PdfGenerationService

- **Title**: Write unit tests for PdfGenerationService PDF content and validity
- **Description**: Create `pdf-generation.service.spec.ts` with tests:
  1. Generated base64 decodes to valid PDF (starts with `%PDF-1.4`, ends with `%%EOF`)
  2. PDF contains invoice header (invoice number, date, customer name)
  3. PDF contains all invoice items in items table
  4. PDF contains applied notes section with credit and debit notes
  5. PDF with empty notes shows "No se han aplicado notas de ajuste"
  6. Net balance formula is correct: `$1,000.00 - $200.00 + $50.00 = $850.00`
  7. Single-item invoice generates correctly
  8. Multiple-item invoice generates correctly

  Use real pdfkit (do NOT mock it). Assert against the raw decoded PDF buffer using string matching for expected content.

- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpbackend\src\modules\pdf\pdf-generation.service.spec.ts` (create)
- **Dependencies**: T6 (PdfGenerationService fully implemented)
- **Estimated effort**: Medium
- **Acceptance criteria**:
  - All PDF content tests pass
  - Test verifies PDF header/footer bytes
  - Test verifies expected strings appear in PDF output
  - Edge cases covered: empty notes, single item, multiple items
- **Testing notes**: `npm test` — service uses real pdfkit, no mocking needed. Assert raw text content in the PDF stream.

---

### T18: Add frontend tests for pdf-utils and dialog conditions

- **Title**: Write frontend unit tests for pdf-utils.ts and InvoiceDetailDialogComponent
- **Description**: For `pdf-utils.ts`:
  1. Mock `URL.createObjectURL` and `URL.revokeObjectURL`
  2. Assert `downloadBase64Pdf` creates blob, opens window, revokes URL after delay
  3. Assert error handling on malformed base64
  4. Assert `fileName` is used in download attribute

  For `InvoiceDetailDialogOrganism`:
  1. Test PDF button visibility: `isElectronic=true` → visible; `isElectronic=false, notes=0` → hidden; `isElectronic=false, notes>0` → visible
  2. Test button label: manual → "Ver PDF Historial", electronic → "Ver PDF DIAN"
  3. Test `viewPdf()` calls `downloadBase64Pdf` from shared util (not inline decode)
  4. Test loading state

- **Files**:
  - `C:\Users\jeima\Desktop\ERP Repositories\erpfrontend\src\app\utils\pdf-utils.spec.ts` (create)
  - `C:\Users\jeima\Desktop\ERP Repositories\erpfrontend\src\app\components\organisms\invoice-detail-dialog\invoice-detail-dialog.component.spec.ts` (create or modify)
- **Dependencies**: T12, T13 (frontend changes implemented)
- **Estimated effort**: Medium
- **Acceptance criteria**:
  - All frontend tests pass with `ng test` or equivalent
  - Mock assertions confirm `revokeObjectURL` is called
  - Button visibility tests cover all 3 states (electronic, manual with notes, manual without notes)
- **Testing notes**: Use Angular TestBed for component tests. Use Jasmine mocks for URL utilities.

---

## Dependency Graph

```
T1 (pdfkit install)
  ↓
T4 (PdfModule scaffold)
  ↓
T6 (full PdfGenerationService impl)
  ↓
T2 (CreditNoteItem/DebitNoteItem entities)
  ↓
T3 (items relation on CreditNote/DebitNote)
  ↓           ↓
T5 (register in SalesModule)
  ↓      ↓    ↓    ↓
T7  ←───┘    │    │   (createCreditNote local path)
T8  ←────────┘    │   (createDebitNote local path)
T9  ←─────────────┘   (downloadInvoicePdf guard)
 ↓
T10, T11 (cancellation, sequential numbering — part of T7/T8)

T12 (pdf-utils.ts)
  ↓
T13 (dialog component)
  ↓
T14 (invoice service verify)

T15 (isElectronic filter — standalone)

T16 ← T7, T8, T9, T10, T11 (SalesService tests)
T17 ← T6 (PdfGenerationService tests)
T18 ← T12, T13 (frontend tests)
```

### Parallel tracks:
- **Track A (Backend foundation)**: T1 → T2 → T3 → T5 → (T7, T8, T9, T10, T11)
- **Track B (PDF engine)**: T1 → T4 → T6 (depends only on T1)
- **Track C (Frontend)**: T12 → T13 → T14 (independent of backend, only depends on API contract)
- **Track D (Filter)**: T15 (fully standalone)
- **Track E (Testing)**: T16, T17, T18 (leaf tasks, implement last)

T7 and T8 need the infrastructure from Track A + Track B merged at T5, but T4→T6 is fast (T6 is the largest task). Consider starting T4/T6 early in parallel.

---

## Estimated Total Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| **Phase 1: Foundation** | T1, T2, T3, T4, T5 | 5 Small |
| **Phase 2: Core Logic** | T6, T7, T8, T9, T10, T11 | 1 Large, 2 Medium, 3 Small |
| **Phase 3: Frontend** | T12, T13, T14 | 2 Small, 1 Tiny |
| **Phase 4: Polish** | T15, T16, T17, T18 | 2 Medium, 2 Small |
| **Total** | **18 tasks** | **1 Large + 4 Medium + 13 Small** |

**Rough total**: ~5-7 days of dev work (T6 is the single largest at ~1-2 days). Testing (T16-T18) adds ~1-1.5 days.
