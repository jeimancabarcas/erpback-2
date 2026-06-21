# Design: Sales Invoice Notes-Applied Total

## Technical Approach

Extend the existing TypeORM `Invoice` entity with two `@OneToMany` relations
(no DB migration — FKs already live on the note side), then enrich the
`findAll` query to eager-load those relations and compute `netTotal` in-process
before returning the paginated result. On the frontend, add `netTotal?` to the
`Invoice` model, rebind the amount column, and remove the now-redundant PDF
button from the row actions.

No new endpoints, no schema migration, no DTO class changes — the enriched
field is added to the plain object returned by the service, which is already
returned as-is by the controller.

---

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Where to compute `netTotal` | Service layer (in-process after query) | DB computed column; controller layer | Service owns business logic; avoids migration; controller stays thin |
| How to load notes | `relations` array in `findAndCount` | `leftJoinAndSelect` via QueryBuilder | Existing pattern in `findAll` uses `relations` — keep consistency |
| Return shape | Spread invoice + add `netTotal` inline | New DTO class | No DTO class exists today; adding one would touch controller — out of scope |
| `netTotal` type | `number` (computed, not persisted) | `string` (decimal) | `Number()` coercion used on `totalAmount` already; frontend expects `number` |

---

## Data Flow

```
GET /sales/invoices
        │
        ▼
SalesController.findAll(queryDto)
        │
        ▼
SalesService.findAll(queryDto)
  ├─ invoiceRepository.findAndCount({
  │    relations: ['customer','items','items.product',
  │                'creditNotes','debitNotes']   ← NEW
  │  })
  │
  └─ data.map(inv => ({
       ...inv,
       netTotal: Number(inv.totalAmount)
                 - sum(inv.creditNotes[].amount)   ← NEW
                 + sum(inv.debitNotes[].amount)     ← NEW
     }))
        │
        ▼
PaginatedResult<Invoice & { netTotal: number }>
        │
        ▼ HTTP JSON
Angular InvoiceService (http.get)
        │
        ▼
Invoice[] (model now has netTotal?: number)
        │
        ▼
sales-page.component  "amount" column
  → (inv.netTotal ?? inv.totalAmount) | currency   ← CHANGED
  header: "Total Neto"                              ← CHANGED
  PDF button: REMOVED
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `erpbackend/src/modules/sales/entities/invoice.entity.ts` | Modify | Add `@OneToMany` for `creditNotes: CreditNote[]` and `debitNotes: DebitNote[]`; add imports |
| `erpbackend/src/modules/sales/sales.service.ts` | Modify | Add `'creditNotes'` and `'debitNotes'` to `relations` array; map result to include computed `netTotal` |
| `erpfrontend/src/app/models/invoice.model.ts` | Modify | Add `netTotal?: number` to `Invoice` interface |
| `erpfrontend/src/app/components/pages/sales-page/sales-page.component.ts` | Modify | Column header → "Total Neto"; binding → `(inv.netTotal ?? inv.totalAmount)`; remove PDF `<button>` block (lines 166–173); remove `downloadPdf()` method (lines 338–357) |

---

## Interfaces / Contracts

### Backend — enriched invoice object (no new class needed)

```typescript
// Returned by SalesService.findAll — plain spread, not a new DTO
{
  ...invoice,               // all existing Invoice entity fields
  netTotal: number          // computed: totalAmount - Σcn.amount + Σdn.amount
}
```

### Backend — netTotal computation

```typescript
// Inside findAll, after findAndCount:
const enriched = data.map((inv) => {
  const creditSum = inv.creditNotes.reduce(
    (acc, cn) => acc + Number(cn.amount), 0,
  );
  const debitSum = inv.debitNotes.reduce(
    (acc, dn) => acc + Number(dn.amount), 0,
  );
  return { ...inv, netTotal: Number(inv.totalAmount) - creditSum + debitSum };
});
return { data: enriched, meta: { total, page, lastPage: Math.ceil(total / limit), limit } };
```

### Frontend — Invoice model addition

```typescript
export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  totalAmount: number;
  netTotal?: number;      // ADD
  status: InvoiceStatus;
  notes?: string;
  items: InvoiceItem[];
  customer?: Customer;
}
```

### Frontend — template binding change

```html
<!-- BEFORE (line 138) -->
<th mat-header-cell … mat-sort-header="totalAmount">Monto Total</th>
<!-- BEFORE (line 140) -->
<span>{{ inv.totalAmount | currency }}</span>

<!-- AFTER -->
<th mat-header-cell … mat-sort-header="totalAmount">Total Neto</th>
<span>{{ (inv.netTotal ?? inv.totalAmount) | currency }}</span>
```

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (service) | `netTotal` formula: no notes → equals `totalAmount`; credit only → subtracted; debit only → added; both → combined | Jest unit test on `findAll` with mocked repository returning controlled note arrays |
| Unit (service) | Empty `creditNotes`/`debitNotes` arrays produce no error | Same Jest suite, zero-length arrays |
| Unit (frontend) | `Invoice` model accepts `netTotal?: number` without TS errors | TypeScript compilation (CI type-check) |
| Integration (e2e) | `GET /sales/invoices` returns `netTotal` in each item | NestJS e2e test seeding invoice + notes; assert `res.body.data[0].netTotal` |
| Manual / visual | "Total Neto" column visible; PDF button absent from row; detail-dialog PDF still works | Browser smoke test on dev environment |

---

## Migration / Rollout

No migration required. The `invoice_id` FK columns already exist on
`credit_notes` and `debit_notes` tables. TypeORM loads them via the new
`@OneToMany` decorators without altering schema.

Rollback: revert the four changed files. No DB state to undo.

---

## Open Questions

- [ ] Should `netTotal` be rounded to 2 decimal places explicitly
  (e.g. `Math.round(value * 100) / 100`) or is raw float precision acceptable
  for the currency pipe? *(Low risk — currency pipe handles display formatting;
  no persistence involved.)*
