# Exploration: Invoice Autoincrement & Factus Emission Tracking

**Change:** `invoice-autoincrement-emission-tracking`
**Date:** 2026-06-23
**Scope:** Backend (NestJS/TypeORM) + Frontend (Angular)

---

## 1. Current State Analysis

### 1.1 Invoice Numbering — Current Approach

**File:** `erpbackend/src/modules/sales/sales.service.ts`

#### Manual invoices (lines 146–157):
```typescript
// Uses queryRunner.manager.createQueryBuilder inside a transaction:
const lastManual = await queryRunner.manager
  .createQueryBuilder(Invoice, 'inv')
  .where('inv.isElectronic = :isElectronic', { isElectronic: false })
  .andWhere("inv.invoiceNumber LIKE 'MAN-%'")
  .orderBy('inv.invoiceNumber', 'DESC')
  .getOne();
const lastSeq = lastManual
  ? parseInt(lastManual.invoiceNumber.replace('MAN-', ''), 10)
  : 0;
invoiceNumber = `MAN-${(lastSeq + 1).toString().padStart(8, '0')}`;
```

#### Electronic invoices (lines 141, 159, 174):
```typescript
const count = await queryRunner.manager.count(Invoice);  // total count of all invoices
// ...
invoiceNumber = `FAC-${(count + 1).toString().padStart(4, '0')}`;
// Then overridden by Factus response if successful
```

### 1.2 Root Cause of the "Error"

**Race condition on `invoiceNumber` unique constraint violation.**

The `invoiceNumber` column has `@Column({ unique: true })` (line 27 of `invoice.entity.ts`), but both numbering strategies have the exact same flaw:

1. **Manual invoices**: `SELECT MAX(invoiceNumber) WHERE LIKE 'MAN-%'` — two concurrent transactions both read the same max value because PostgreSQL READ COMMITTED isolation means neither sees the other's uncommitted insert. Both generate the same `MAN-XXXXXXXX` number. Second commit = unique violation.

2. **Electronic invoices**: `SELECT COUNT(*) FROM invoices` — same race. Both get the same count, both generate `FAC-XXXX`, second commit = unique violation.

3. **The fallback path**: If Factus API fails for electronic invoices, the `FAC-{count+1}` number is used as `invoiceNumber`. But there's no Factus-specific fallback handling — the invoice is still created with a potentially duplicate local number.

4. **String-based sorting illusion**: The `ORDER BY invoiceNumber DESC` on a string column happens to work for zero-padded `MAN-XXXXXXXX` format, but is fundamentally the wrong data type for sequential numbering.

### 1.3 Factus Emission Tracking — Data Discard

**File:** `erpbackend/src/modules/sales/sales.service.ts`, method `emit()` (lines 215–285)

```typescript
// emit() after Factus response:
const factusNumber = factusResponse?.data?.number || null;
invoice.isElectronic = true;
invoice.factusNumber = factusNumber;
return this.invoiceRepository.save(invoice);
```

**The Factus response contains** (from `FactusInvoiceResponseData` interface):
- `number` (string) — **SAVED** as `factusNumber`
- `cude` / `cufe` (string) — **DISCARDED**
- `qrUrl` (string) — **DISCARDED**
- `publicUrl` (string) — **DISCARDED**
- `isValidated` (boolean) — **DISCARDED**
- `validatedAt` (string | null) — **DISCARDED**
- `createdAt` (string) — **DISCARDED**
- `numberingRange` (FactusNumberingRange | null) — **DISCARDED**
- `items` (FactusResponseItem[]) — **DISCARDED**
- `taxes` (FactusResponseTax[]) — **DISCARDED**
- `totals` (FactusInvoiceResponseTotals | null) — **DISCARDED**
- `links.qr` (string) — **DISCARDED**
- `links.publicUrl` (string) — **DISCARDED**

**Compare with CreditNote/DebitNote entities** (which DO store emission data properly):
```typescript
// credit-note.entity.ts — stores:
noteNumber, cude, qrUrl, publicUrl
```

The invoice entity stores only `factusNumber: string | null` — a single field out of 14+ available fields.

### 1.4 PDF Download Flow

**`downloadInvoicePdf()`** (lines 1009–1047):
- Loads invoice + credit/debit notes
- Calls `PdfGenerationService.generateInvoicePdf()` for ALL invoices (both manual and electronic)
- Returns a local PDF with invoice history. This is correct.

**`downloadDianPdf()`** (lines 1049–1073):
- Called ONLY for electronic invoices
- Relies on `invoice.factusNumber || invoice.invoiceNumber` to call Factus API
- **Problem**: If `factusNumber` is null (because the emission data was discarded) and `invoiceNumber` is a local `FAC-XXXX` or `MAN-XXXX` format, the Factus call will fail with HTTP 404
- **No local caching**: PDF is always fetched from Factus API — no local storage or caching

### 1.5 Frontend Invoice Display

**`SalesPageComponent`** (`sales-page.component.ts`, line 81-92):
- Displays `inv.invoiceNumber` in a styled badge
- Shows `MANUAL` badge when `isElectronic === false`
- Shows `ELECTRÓNICA` badge otherwise
- Uses `inv.invoiceNumber` as the primary displayed identifier

**`InvoiceDetailDialogOrganism`** (`invoice-detail-dialog.component.ts`, lines 252-266):
- Shows "Emitir Electrónicamente" button when `!inv.isElectronic && !inv.factusNumber`
- Shows "Descargar PDF DIAN" button when `inv.isElectronic`
- Shows "Imprimir Factura" button for all invoices (calls `downloadInvoicePdf`)

**Frontend model** (`invoice.model.ts`):
```typescript
export interface Invoice {
  id: string;
  invoiceNumber: string;  // displayed to user
  factusNumber?: string;  // only used for emit logic
  isElectronic?: boolean;
  // ...
}
```

---

## 2. Problem Identification

### 2.1 Critical Issues

| # | Issue | Severity | Component |
|---|-------|----------|-----------|
| 1 | **Race condition on invoiceNumber UNIQUE constraint** — concurrent requests generate duplicate numbers | **HIGH** | SalesService.create() |
| 2 | **All Factus emission data discarded** — CUDE, QR URL, public URL, validation status lost after emit() | **HIGH** | SalesService.emit() |
| 3 | **No way to verify emission status** — can't tell if Factus validated the invoice without re-calling API | **MEDIUM** | Invoice entity |
| 4 | **PDF download fragile** — relies on factusNumber which may be null or invalid | **MEDIUM** | SalesService.downloadDianPdf() |
| 5 | **String-based numbering is semantically wrong** — `invoiceNumber` is currently a display string, used as both identifier and Factus reference | **LOW** | Invoice entity |
| 6 | **No automatic re-validation** — if Factus doesn't validate immediately, the emission is incomplete with no retry mechanism | **MEDIUM** | emit() flow |

### 2.2 What the User Wants

> "quiero que las facturas se generen con un autoincrementable y que no sea ese string"  
> *Invoices should use an auto-incrementing number, not that string*

> "cuando se genere factura electronica se genere un objeto con la informacion relevante para identificar que esa factura fue emitida y se puedan descargar los pdf"  
> *When an electronic invoice is generated, create an object with the relevant info to identify the emission and download PDFs*

---

## 3. Proposed Approach

### 3.1 Autoincrementable Invoice Numbering

#### Option A: PostgreSQL SERIAL column (RECOMMENDED)

Add a `sequentialNumber` column as a `BIGSERIAL` auto-increment column.

```typescript
@PrimaryGeneratedColumn('uuid')
id: string;

@Column({ name: 'sequential_number', generated: 'identity', type: 'int' })
sequentialNumber: number;           // Auto-increment: 1, 2, 3, ...

@Column({ unique: true })
invoiceNumber: string;              // Display format: "FAC-000001" or "MAN-000001"
```

**How it works:**
- `sequentialNumber` uses PostgreSQL `GENERATED BY DEFAULT AS IDENTITY` (or `SERIAL`)
- The DB guarantees unique, gapless-ish sequential numbers
- `invoiceNumber` becomes a DISPLAY field, computed as `FAC-${seq.toString().padStart(6, '0')}` or `MAN-${seq.toString().padStart(6, '0')}`
- For electronic invoices, `factusNumber` stores the actual Factus-assigned number (SETP990003678)
- For manual invoices, `invoiceNumber = MAN-${sequentialNumber}`

**Important nuance**: PostgreSQL `SERIAL`/`IDENTITY` columns are gapless within a transaction but can have gaps due to rollbacks. This is acceptable — the sequence guarantees uniqueness, not continuity.

#### Option B: Dedicated DB Sequence per Invoice Type

```sql
CREATE SEQUENCE invoice_manual_seq START 1;
CREATE SEQUENCE invoice_electronic_seq START 1;
```

Use `SELECT nextval('invoice_manual_seq')` for manual, `nextval('invoice_electronic_seq')` for pre-assignment, and Factus number for electronic.

**Why not Option B**: More complex to manage, two sequences, and the Factus API already assigns the real number for electronic invoices anyway.

#### Option C: Separate counter table with pessimistic locking

```typescript
@Entity('invoice_counters')
export class InvoiceCounter {
  @PrimaryColumn()
  type: string;  // 'MANUAL' | 'ELECTRONIC'

  @Column()
  lastNumber: number;
}
```

Use `SELECT ... FOR UPDATE` to lock the row, increment, and use the value.

**Why not Option C**: Over-engineered when PostgreSQL already provides sequences. The SERIAL/IDENTITY approach is simpler and proven.

**Recommendation: Option A** — add a `sequentialNumber` integer column with PostgreSQL `GENERATED BY DEFAULT AS IDENTITY`.

### 3.2 Factus Emission Tracking Entity

**New entity: `InvoiceElectronicEmission`**

```typescript
@Entity('invoice_electronic_emissions')
export class InvoiceElectronicEmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  // === Factus Response Fields ===

  @Column({ name: 'factus_number', type: 'varchar' })
  factusNumber: string;                      // The DIAN invoice number (e.g., SETP990003678)

  @Column({ type: 'varchar', nullable: true })
  cude: string | null;                       // DIAN CUDE/CUFE

  @Column({ name: 'qr_url', type: 'varchar', nullable: true })
  qrUrl: string | null;                      // QR code URL for DIAN

  @Column({ name: 'public_url', type: 'varchar', nullable: true })
  publicUrl: string | null;                  // Public PDF URL

  @Column({ name: 'is_validated', default: false })
  isValidated: boolean;                      // Whether Factus validated the invoice

  @Column({ name: 'validated_at', type: 'timestamp', nullable: true })
  validatedAt: Date | null;                  // When DIAN validated it

  @Column({ name: 'emitted_at', type: 'timestamp' })
  emittedAt: Date;                           // When Factus created it

  @Column({ name: 'numbering_range_prefix', type: 'varchar', nullable: true })
  numberingRangePrefix: string | null;       // e.g., SETP

  @Column({ name: 'numbering_range_from', type: 'int', nullable: true })
  numberingRangeFrom: number | null;

  @Column({ name: 'numbering_range_to', type: 'int', nullable: true })
  numberingRangeTo: number | null;

  @Column({ name: 'numbering_range_resolution', type: 'varchar', nullable: true })
  numberingRangeResolution: string | null;

  // === Financial Totals ===

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  total: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  taxAmount: number | null;

  // === Metadata ===

  @Column({ type: 'jsonb', nullable: true })
  rawResponse: object | null;                // Full raw response for debugging

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

**Relationship**: `Invoice 1 → 0..1 InvoiceElectronicEmission` (optional one-to-one)

**Changes to Invoice entity**:
- Remove `factusNumber` column (moved to the emission entity)
- Keep `isElectronic` boolean
- Keep `invoiceNumber` as display string
- Add `sequentialNumber` auto-increment column
- Add `@OneToOne(() => InvoiceElectronicEmission)` relation

### 3.3 PDF Download Flow Improvement

**Current flow:**
```
downloadDianPdf(id)
  → finds invoice
  → extracts factusNumber || invoiceNumber
  → calls factusGateway.downloadInvoicePdf(number)
  → returns base64 PDF
```

**New flow with emission tracking:**
```
downloadDianPdf(id)
  → finds invoice + emission relation
  → checks emission.isValidated
  → if not validated → throw "Invoice not yet validated by DIAN"
  → calls factusGateway.downloadInvoicePdf(emission.factusNumber)
  → returns base64 PDF
```

**Improvements:**
1. Always uses the real `factusNumber` from the emission record (never falls back to `invoiceNumber`)
2. Validates that the emission exists and is validated before attempting download
3. Could optionally cache the PDF locally (store base64 in emission record or file system) to avoid repeated Factus calls

### 3.4 Migration Strategy

#### Phase 1: New tables and columns

1. Create `invoice_electronic_emissions` table
2. Add `sequential_number` to `invoices` table as `INT GENERATED BY DEFAULT AS IDENTITY`
3. Remove `factus_number` from `invoices` (requires data migration)

#### Phase 2: Data migration for existing records

For existing invoices with `factusNumber !== null`, create a corresponding `InvoiceElectronicEmission` record:
```sql
INSERT INTO invoice_electronic_emissions (
  id, invoice_id, factus_number, emitted_at, created_at
)
SELECT gen_random_uuid(), id, factus_number, created_at, NOW()
FROM invoices
WHERE factus_number IS NOT NULL;
```

#### Phase 3: Backfill sequential numbers

Since `GENERATED BY DEFAULT AS IDENTITY` doesn't retroactively number existing rows:
```sql
-- Create a temporary sequence
CREATE SEQUENCE temp_seq START 1;

-- Update existing rows ordered by created_at
UPDATE invoices
SET sequential_number = nextval('temp_seq')
WHERE sequential_number IS NULL
ORDER BY created_at;

-- Drop temp sequence
DROP SEQUENCE temp_seq;
```

#### Phase 4: Frontend updates

1. Update `Invoice` model to include `sequentialNumber`
2. Update invoice number display to use `invoiceNumber` (unchanged for users)
3. Add `emission` object to the invoice detail view (show CUDE, QR URL, public URL)

---

## 4. Frontend Impact

### 4.1 Model Changes

```typescript
// Current
export interface Invoice {
  id: string;
  invoiceNumber: string;
  factusNumber?: string;
  isElectronic?: boolean;
  // ...
}

// After
export interface Invoice {
  id: string;
  sequentialNumber: number;     // NEW
  invoiceNumber: string;        // Same display format
  isElectronic?: boolean;
  emission?: {                  // NEW — full emission data
    factusNumber: string;
    cude: string | null;
    qrUrl: string | null;
    publicUrl: string | null;
    isValidated: boolean;
    validatedAt: string | null;
    emittedAt: string;
    total: number | null;
  };
  // ...
}
```

### 4.2 Component Changes

| Component | Change |
|-----------|--------|
| `SalesPageComponent` | Replace `inv.factusNumber` references with `inv.emission?.factusNumber` in emit button logic |
| `InvoiceDetailDialogOrganism` | Show CUDE, QR URL, public URL from emission data. Update emit button condition to `!inv.isElectronic && !inv.emission` |
| `SaleFormMolecule` | No significant changes needed — `invoiceNumber` display format remains the same |
| `InvoiceService` | No changes needed — all data comes from backend |

### 4.3 PDF Download

- `getInvoiceDianPdf(id)` — no signature change, still calls `GET /sales/invoices/:id/dian-pdf`
- The backend now has proper emission data to pass to Factus
- No frontend logic change required for the download itself

---

## 5. Risks & Considerations

### 5.1 Migration Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `sequentialNumber` gaps due to rollbacks | Low — sequences inherently have gaps, users won't see gaps in `invoiceNumber` display | Accept as expected behavior; document that gaps are normal |
| Existing `factusNumber` data loss | High if not migrated | Run data migration BEFORE removing column; verify with `COUNT(*)` |
| Frontend stale references to `factusNumber` | Medium | Use `emission.factusNumber` instead; keep backward-compatible getter if needed |

### 5.2 Concurrency

- `sequentialNumber` uses DB-level identity generation — **no race condition possible**
- Two concurrent requests get different sequential numbers guaranteed by PostgreSQL
- The `unique` constraint on `invoiceNumber` is preserved but now `invoiceNumber` is derived from the collision-free `sequentialNumber`

### 5.3 Rollback Plan

1. Revert backend code changes
2. Run migration `down` — drop `sequential_number` column, drop `invoice_electronic_emissions` table
3. Restore `factus_number` column if removed
4. Revert frontend changes

### 5.4 Credit/Debit Note Implications

- CreditNotes and DebitNotes already use a separate numbering scheme (`NC-MAN-{invNumber}-{seq}`)
- Their numbering is scoped per invoice and uses `COUNT + 1` with transaction protection
- Consider if notes should also get auto-increment IDs, but that's out of scope for this change

---

## 6. Effort Estimate

| Area | Complexity | Estimated Time |
|------|-----------|----------------|
| Invoice entity changes + migration | Medium | 2-3 hours |
| InvoiceElectronicEmission entity + migration | Medium | 1-2 hours |
| SalesService.create() — sequentialNumber integration | Low | 1 hour |
| SalesService.emit() — emission tracking integration | Low | 1 hour |
| SalesService.downloadDianPdf() — use emission data | Low | 0.5 hours |
| Data migration for existing records | Medium | 1 hour |
| Frontend model updates | Low | 0.5 hours |
| Frontend component updates (emit button, detail view) | Low | 1 hour |
| Tests | Medium | 2-3 hours |
| **Total** | | **10-14 hours** |

---

## 7. Ready for Proposal

Yes. The exploration is complete and the approach is clear:

1. Add `sequentialNumber` as auto-increment identity column → **solves the race condition**
2. Create `InvoiceElectronicEmission` entity → **preserves all Factus data** and enables PDF download
3. Update `emit()` and `downloadDianPdf()` to use the emission entity → **robust PDF flow**
4. Migrate existing data → **no data loss**
5. Update frontend models and components → **minimal changes**

The orchestrator should tell the user that:
- The root cause is a race condition on `invoiceNumber` due to `MAX+1` / `COUNT+1` instead of DB-level auto-increment
- The solution replaces the fragile string numbering with a proper auto-increment column
- A new `InvoiceElectronicEmission` entity will track all Factus response data (not just the number)
- PDF download will use the emission record's `factusNumber` for reliable Factus API calls
- Existing invoices with `factusNumber` will be migrated to the new emission entity
