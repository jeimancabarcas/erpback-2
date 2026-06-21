# Exploration: sales-invoice-notes-applied-total

> Generated: 2026-06-21 | Artifact store: hybrid | Mode: openspec + engram

---

## Current State

### Frontend — Invoices Table (`sales-page.component.ts`)

| Column | Source field | Notes |
|--------|-------------|-------|
| No. Factura | `inv.invoiceNumber` | Displayed with badge |
| Cliente | `inv.customer?.name`, `inv.customer?.documentNumber` | Two-line cell |
| Fecha | `inv.date` | DatePipe |
| **Monto Total** | **`inv.totalAmount`** | Raw invoice total, **no note adjustment** |
| Estado | `inv.status` | Pill badge (PAID / DRAFT / CANCELLED) |
| Acciones | — | PDF icon-button + eye icon-button |

**`displayedColumns`**: `['invoiceNumber', 'customer', 'date', 'amount', 'status', 'actions']`

The **PDF button** (`picture_as_pdf` icon, calls `downloadPdf(inv)`) lives in the `actions` column at lines 166–173. It calls `invoiceService.getInvoicePdf(invoice.id)` and opens a new tab.

The same PDF functionality exists in full in `InvoiceDetailDialogOrganism` (lines 238–255 of `invoice-detail-dialog.component.ts`), including a loading state indicator.

### Backend — Entity Relationships

```
Invoice (invoices)
  ├── OneToMany → InvoiceItem     (via invoice_id)
  ├── ManyToOne ← Customer        (via customer_id)
  ├── [NO relation declared] ← CreditNote (credit_notes.invoice_id FK)
  └── [NO relation declared] ← DebitNote  (debit_notes.invoice_id FK)

CreditNote (credit_notes)
  └── ManyToOne → Invoice (invoice_id FK, onDelete: CASCADE)
  └── amount: decimal(12,2)   <- the credited amount

DebitNote (debit_notes)
  └── ManyToOne → Invoice (invoice_id FK, onDelete: CASCADE)
  └── amount: decimal(12,2)   <- the debited amount
```

**Key observation**: `Invoice` entity has **no `@OneToMany` relations to `CreditNote` or `DebitNote`**. The relation is declared only on the note side. This means TypeORM cannot eager-load notes through the invoice repository without adding those inverse relations to the entity.

### Backend — `findAll` query (`sales.service.ts`, lines 187–219)

```typescript
const [data, total] = await this.invoiceRepository.findAndCount({
  where,
  order: { [sortBy]: order },
  take: limit,
  skip,
  relations: ['customer', 'items', 'items.product'],
  // Does NOT join creditNotes or debitNotes
});
```

**Current response shape per invoice:**
```json
{
  "id": "...",
  "invoiceNumber": "FAC-0001",
  "date": "...",
  "totalAmount": 1190.00,
  "status": "PAID",
  "customer": { ... },
  "items": [ ... ]
}
```
No `creditNotes`, no `debitNotes`, no `netTotal`.

### Frontend — `Invoice` model (`invoice.model.ts`)

```typescript
export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  totalAmount: number;   // only gross total — no netTotal field
  status: InvoiceStatus;
  notes?: string;
  items: InvoiceItem[];
  customer?: Customer;
}
```

---

## Affected Areas

- `erpbackend/src/modules/sales/entities/invoice.entity.ts` — Add `@OneToMany` relations to CreditNote and DebitNote
- `erpbackend/src/modules/sales/sales.service.ts` — Extend `findAll` to join notes and compute `netTotal`
- `erpfrontend/src/app/models/invoice.model.ts` — Add `netTotal?: number`
- `erpfrontend/src/app/components/pages/sales-page/sales-page.component.ts` — Use `netTotal` in amount cell; remove PDF button and `downloadPdf` method

---

## Approaches

### 1. Backend `netTotal` field (RECOMMENDED)

Add `@OneToMany` to `Invoice` entity for both note types. In `findAll`, add them to `relations`. After the query, map each invoice to compute and attach `netTotal`:
```
netTotal = totalAmount - sum(creditNotes.amount) + sum(debitNotes.amount)
```

**Pros:** Single source of truth. Frontend just reads a scalar. Future-proof for reports/exports. No business logic on the client.
**Cons:** Two extra LEFT JOINs per list query (negligible at this data volume). Requires entity change.
**Effort:** Low

---

### 2. Return note arrays, compute on frontend

Backend adds `creditNotes[]` and `debitNotes[]` arrays to each invoice in the list response. Frontend computes the net total.

**Pros:** No entity change needed if sub-queried separately. Frontend pattern already exists in invoice detail dialog.
**Cons:** Business logic leaks to frontend. Response payload grows. Calculation must be duplicated in every consumer. Not sortable by net total without backend support.
**Effort:** Low (worse architecture)

---

### 3. QueryBuilder with SQL SUM aggregate

Use a TypeORM `QueryBuilder` with LEFT JOINs and `SUM()` to produce `netTotal` as a computed SQL column without entity relation changes.

**Pros:** No entity change. Efficient single query.
**Cons:** Loses TypeORM entity typing. Manual mapping needed. More complex to maintain. Not significantly faster than Option 1 for typical ERP volumes.
**Effort:** Medium

---

## Recommendation

**Use Approach 1 — backend `netTotal`.**

Step-by-step minimal changes:

1. **`invoice.entity.ts`**: Add two `@OneToMany` decorators:
   ```typescript
   @OneToMany(() => CreditNote, (cn) => cn.invoice)
   creditNotes: CreditNote[];

   @OneToMany(() => DebitNote, (dn) => dn.invoice)
   debitNotes: DebitNote[];
   ```
   Also add the inverse property references on note entities (`invoice: Invoice`) — they already have `ManyToOne` but the lambda arrow `cn => cn.invoice` must match a property that TypeORM can navigate. Check that `CreditNote.invoice` is already named `invoice` (it is, per entity code).

2. **`sales.service.ts` `findAll`**: Change relations to include notes, then map:
   ```typescript
   relations: ['customer', 'items', 'items.product', 'creditNotes', 'debitNotes'],
   ```
   After query:
   ```typescript
   const enriched = data.map(inv => ({
     ...inv,
     netTotal: Number(inv.totalAmount)
       - (inv.creditNotes ?? []).reduce((s, n) => s + Number(n.amount), 0)
       + (inv.debitNotes ?? []).reduce((s, n) => s + Number(n.amount), 0),
   }));
   return { data: enriched, meta: { ... } };
   ```

3. **`invoice.model.ts` (frontend)**: Add `netTotal?: number` to `Invoice` interface.

4. **`sales-page.component.ts`**:
   - Amount cell: change `{{ inv.totalAmount | currency }}` to `{{ (inv.netTotal ?? inv.totalAmount) | currency }}`
   - Consider renaming column header "Monto Total" to "Monto Neto"
   - Remove the entire PDF icon-button block (lines 166–173 in current file)
   - Remove the `downloadPdf()` method (lines 338–357)
   - Keep `InvoiceService.getInvoicePdf` in the service — it is still used by `InvoiceDetailDialogOrganism`

---

## Risks

- **Non-breaking**: Adding `netTotal` to `findAll` response is additive. Existing consumers reading `totalAmount` are unaffected.
- **No DB migration**: Adding `@OneToMany` to `Invoice` adds no new DB column (FK is on the note side). Pure TypeORM metadata change.
- **PDF removal safety**: `downloadPdf` only exists in `SalesPageComponent`. `getInvoicePdf` service method is also called in `InvoiceDetailDialogOrganism.viewPdf()` — must NOT be removed from the service.
- **Column label**: If the column header is not updated, users may be confused by a "Monto Total" that is actually the net. Recommend updating to "Total Neto" or adding a tooltip.
- **Notes on CANCELLED invoices**: A credit note with `correctionConceptCode === '2'` cancels the invoice. In that case `netTotal` will be 0 or near 0, which is correct and informative.

---

## Ready for Proposal

**Yes.** 4 files, all surgical. No migration, no breaking change. Can proceed to proposal/spec immediately.
