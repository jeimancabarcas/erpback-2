# Proposal: sales-manual-invoice

## Intent

The ERP currently routes every sale through Factus (DIAN electronic invoicing) with no opt-out path. When the Factus service is unavailable, the business cannot record any sale at all — inventory is not reduced and no local record is created, because the Factus call sits synchronously inside the DB transaction. The feature request is to allow users to flag a sale as "manual", which skips the Factus call entirely: the invoice is persisted locally, inventory is reduced, and the sale is fully recorded in the system — but no electronic document is emitted to DIAN. This unblocks sales operations during connectivity issues and covers scenarios where the customer explicitly does not require an electronic invoice.

---

## Scope

### In Scope

- Add `isElectronic: boolean` column to the `invoices` table (TypeORM migration, backfill existing rows as `true`).
- Add `isElectronic?: boolean` to `CreateInvoiceDto` (backend and frontend), defaulting to `true` for full backward compatibility.
- Gate the `FactusGateway.createInvoice()` call in `SalesService.create()` behind `isElectronic !== false`.
- Introduce a separate `MAN-{padded-count}` invoice number sequence for manual invoices, scoped independently from the `FAC-{padded-count}` / DIAN number sequence.
- Guard `SalesService.createCreditNote()` and `SalesService.createDebitNote()` to throw a `BadRequestException` when the parent invoice is a manual invoice (no DIAN record exists to reference).
- Add a "Venta manual" toggle to `SaleFormComponent` with an inline warning that the invoice will not be sent to DIAN.
- Pass `isElectronic` through `InvoiceService.createInvoice()` (frontend service layer).
- Show a "MANUAL" badge in the invoice list (`SalesPageComponent`) to visually distinguish manual from electronic invoices.
- Add `isElectronic` as an optional filter to `QueryInvoicesDto` and `SalesService.findAll()`.

### Out of Scope

- DIAN nullification or cancellation of manual invoices (no DIAN record to cancel).
- PDF generation for manual invoices.
- Offline queue / retry mechanism for Factus failures on electronic invoices.
- Migrating or converting an existing manual invoice to electronic after the fact.
- Fixing the hardcoded `municipalityCode: '68679'` sandbox value in `mapCustomerToFactus()` (latent bug in electronic path, tracked separately).

---

## Approach

### 1. Database — Migration

Add a non-null boolean column `is_electronic` with a server-side default of `true` so existing rows are automatically backfilled on migration:

```sql
ALTER TABLE invoices
  ADD COLUMN is_electronic BOOLEAN NOT NULL DEFAULT TRUE;
```

TypeORM migration class generated via `typeorm migration:generate`. No data-loss risk — all current rows are electronic.

### 2. Invoice Entity

```typescript
@Column({ name: 'is_electronic', default: true })
isElectronic: boolean;
```

### 3. Invoice Number Sequencing

Two independent counts are maintained at runtime, both derived from DB queries scoped by `isElectronic`:

- **Electronic:** count of existing electronic invoices → `FAC-{(count+1).padStart(4,'0')}` (existing logic, unchanged).
- **Manual:** count of existing manual invoices → `MAN-{(count+1).padStart(4,'0')}`.

Both use the `UNIQUE` constraint on `invoiceNumber`; the prefix difference (`FAC-` vs `MAN-`) guarantees no collision. If a DIAN number is returned for an electronic invoice, it replaces the local `FAC-` fallback (existing behavior).

> **Race condition note:** the current `FAC-` counter already has the same optimistic-count race. That race is pre-existing; this proposal does not worsen it and does not introduce a new one for `MAN-`. A DB sequence (`CREATE SEQUENCE`) can be introduced as a follow-up if the race becomes a production concern.

### 4. SalesService.create() — Factus Gate

Inside the existing `queryRunner` transaction, after `consumeStock()`:

```typescript
const isManual = dto.isElectronic === false;

let invoiceNumber: string;
if (!isManual) {
  // existing Factus block — unchanged
  invoiceNumber = `FAC-${(electronicCount + 1).toString().padStart(4, '0')}`;
  try {
    const factusResponse = await this.factusGateway.createInvoice(factusPayload);
    if (factusResponse?.data?.number) {
      invoiceNumber = factusResponse.data.number;
    }
  } catch (error) {
    throw new BadRequestException(`Error al emitir Factura en Factus: ${error.message}`);
  }
} else {
  // manual path — skip Factus entirely
  invoiceNumber = `MAN-${(manualCount + 1).toString().padStart(4, '0')}`;
}
```

`consumeStock()` is called unconditionally before this gate — inventory is always reduced regardless of invoice type.

### 5. Credit / Debit Note Guard

At the top of `createCreditNote()` and `createDebitNote()`, load the parent invoice and check:

```typescript
if (!invoice.isElectronic) {
  throw new BadRequestException(
    'No se puede emitir nota crédito/débito sobre una factura manual. No existe registro en DIAN.'
  );
}
```

This prevents a Factus call that would reference a non-existent DIAN document.

### 6. DTO Changes

**Backend `CreateInvoiceDto`:**
```typescript
@IsOptional()
@IsBoolean()
isElectronic?: boolean;  // undefined → treated as true (electronic)
```

**Backend `QueryInvoicesDto`:**
```typescript
@IsOptional()
@IsBoolean()
@Transform(({ value }) => value === 'true')
isElectronic?: boolean;
```

**Frontend `CreateInvoiceDto` (`invoice.model.ts`):**
```typescript
isElectronic?: boolean;
```

### 7. Frontend — SaleFormComponent

- Add a `MatSlideToggle` or `MatButtonToggle` labeled "Venta manual" to the form.
- When toggled to manual, show an inline `MatChip` or `<p>` warning: _"Esta venta no generará factura electrónica ante la DIAN."_
- Bind the toggle to a form control; include its value in the DTO on submit.
- Default: toggle off (electronic).

### 8. Invoice List Badge

In `SalesPageComponent` invoice table, add a column or badge:
- Electronic invoices: no badge (current behavior, or a subtle "ELECTRÓNICA" chip).
- Manual invoices: a visually distinct "MANUAL" chip (e.g. `color="warn"` or a neutral grey).

---

## Key Decisions

| Decision | Option Chosen | Rationale |
|---|---|---|
| Discriminator field type | `boolean isElectronic` | Simpler than an enum; the business only needs two states now. An enum (`ELECTRONIC \| MANUAL`) adds no value today and complicates the migration. If a third type is needed later, a rename migration is straightforward. |
| Manual invoice number format | `MAN-{padded-4-digit-count}` | Prefix guarantees no collision with `FAC-` or DIAN alphanumeric numbers. Count is scoped to manual invoices only (separate DB count query). |
| Factus gate placement | Inside `SalesService.create()`, after `consumeStock()`, before the existing Factus block | Minimal diff; preserves transaction boundary. Inventory is always reduced. No refactor of the transaction manager needed. |
| Credit/debit notes on manual invoices | Block with `BadRequestException` | A credit/debit note requires a DIAN record. Silently skipping Factus would produce an invalid note. Blocking is the correct behavior; unlocking this is explicitly out of scope. |
| DB migration strategy | `ALTER TABLE … ADD COLUMN … DEFAULT TRUE` (backfill at migration time) | Non-null default applied in one migration. No data pipeline or multi-step backfill needed. Zero downtime for small tables. |
| Frontend toggle component | `MatSlideToggle` (single toggle) | Simpler than a segmented control; matches the existing Material Design component set. |
| Backward compatibility | `isElectronic` defaults to `true`; undefined treated as electronic | Existing API consumers and integrations are unaffected. No breaking change. |

---

## Risks

### CRITICAL

| # | Risk | Mitigation |
|---|------|------------|
| C1 | **`invoiceNumber` UNIQUE collision** — if two manual invoices are created concurrently, the optimistic count read may produce the same `MAN-xxxx` value, violating the UNIQUE constraint and causing a 500 error. | Use a DB-level unique constraint to catch the race and surface a retryable error. Document the race as a known limitation. Follow-up: replace with a `CREATE SEQUENCE` for true serialization. |
| C2 | **TypeORM migration required** — missing or mis-ordered migration breaks the production deployment. | Generate migration with `typeorm migration:generate`, verify SQL in review, run against a staging DB before production. |

### WARNING

| # | Risk | Mitigation |
|---|------|------------|
| W1 | **Credit/debit notes on manual invoices** — without the guard, the system would call Factus with a non-existent DIAN reference, producing a silent error or a misleading response. | Guard added in scope (see Approach §5). |
| W2 | **Frontend toggle not setting default correctly** — if the form control initializes to `null` instead of `undefined`, the backend may receive `null` and misinterpret it as "not electronic". | Backend gate uses `dto.isElectronic === false` (strict equality), so `null` and `undefined` both fall through to the electronic path. Test explicitly. |
| W3 | **Manual invoices appear in DIAN reporting queries** — if any reporting module filters on invoice data without checking `isElectronic`, it may include manual invoices in electronic totals. | Audit reporting queries as part of the spec phase. Add `isElectronic` filter to `QueryInvoicesDto` in scope. |

---

## Open Questions

None. All key design decisions are resolved above. The spec phase should detail the exact TypeORM migration SQL, the count-query scope for `MAN-` sequencing, and the frontend form validation constraints.
