# SDD Proposal: Support Document Tax Adjustment

**Change:** `support-document-tax-adjustment`
**Status:** Draft
**Date:** 2026-07-07
**Author:** SDD Executor

---

## 1. Problem Statement

### Bug: Pre-tax price in `emitSupportDocument()` causes double-taxation

The `PurchaseOrdersService.emitSupportDocument()` method sends the **tax-inclusive** purchase price directly to Factus via the `price` field, then Factus applies taxes on top. This results in an overstated total — the payment amount sent to Factus is approximately `(1 + tax_rate) × correct_total`. The sales module's `emit()` method correctly computes `priceBeforeTax` by dividing the unit price by `(1 + totalTaxRate/100)` and uses `computeFactusTotal()` with integer-cents arithmetic to match Factus's server-side rounding.

**Root cause:** `emitSupportDocument()` line `price: Number(item.price)` — the price stored on `PurchaseOrderItem` is user-entered as a tax-inclusive amount (what the user pays the supplier), but Factus expects a tax-exclusive price and adds taxes server-side.

### Gap: No adjustment notes for support documents (documentos soporte)

Purchase orders with emitted support documents have no mechanism for total annulment (reverse the purchase). The sales module supports credit notes (Scenario D — total annulment via DIAN correction concept code `2`), which:

1. Restores stock via `inventoryService.restoreStock()`
2. Reverses all taxes proportionally
3. Sets invoice status to `CANCELLED`
4. Emits an electronic credit note to Factus

No equivalent exists for purchase orders. Users cannot reverse a completed purchase order that has an electronic support document. The existing `cancel()` method attempts to destroy the support document in Factus, but this does not generate the legally required adjustment note (nota de ajuste) that the DIAN mandates.

### API gap: Factus gateway missing 3 methods

The `IFactusInvoicingGateway` interface and `FactusHttpInvoicingAdapter` are missing:

- `POST /v1/adjustment-notes/support-documents/validate` — create adjustment note
- `DELETE /v1/adjustment-notes/support-documents/reference/{code}` — destroy adjustment note
- `GET /v2/adjustment-notes/{number}/download-pdf` — download PDF

---

## 2. Proposed Solution

### 2.1 Fix pre-tax price in `emitSupportDocument()`

Refactor `emitSupportDocument()` following the sales module pattern:

1. For each item, compute `priceBeforeTax = unitPrice / (1 + totalTaxRate / 100)` using `product.taxes` (same tax rates entity, ManyToMany on `Product`).
2. Send `price: priceBeforeTax` in the Factus payload instead of `price: Number(item.price)`.
3. Compute the payment total using `computeFactusTotal()` (integer-cents arithmetic) — either extracted to a shared utility or duplicated in the purchase-orders module.
4. The payment amount sent to Factus will match the correct tax-exclusive subtotal + computed taxes.

**Impact:** Only affects new support document emissions. Existing documents in Factus are immutable and unaffected.

### 2.2 Add adjustment notes for support documents (Scenario D for purchase orders)

Mirror the invoice credit-note pattern (Scenario D: total annulment, correction concept code `2`):

#### Entities (3 new)

| Entity                               | Table                                       | Purpose                                                                                                                                  |
| ------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `PurchaseOrderAdjustmentNote`        | `purchase_order_adjustment_notes`           | Header: reference code, note number, CUDE, correction concept, amount, observation, QR/PU links, FK to purchase order + support document |
| `PurchaseOrderAdjustmentNoteItem`    | `purchase_order_adjustment_note_items`      | Item line: code reference, name, quantity, unit price, subtotal, product FK, tax amount, consumed flag                                   |
| `PurchaseOrderAdjustmentNoteItemTax` | `purchase_order_adjustment_note_item_taxes` | Tax breakdown: tax FK, code, name, rate, amount                                                                                          |

**Entity change:** Add `adjustmentNotes: PurchaseOrderAdjustmentNote[]` OneToMany to `PurchaseOrder`.

#### Factus Gateway (3 new methods)

| Method                                       | Endpoint                                                         | Purpose                         |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| `createSupportDocumentAdjustmentNote()`      | `POST /v1/adjustment-notes/support-documents/validate`           | Emit adjustment note to Factus  |
| `destroySupportDocumentAdjustmentNote()`     | `DELETE /v1/adjustment-notes/support-documents/reference/{code}` | Destroy pending adjustment note |
| `downloadSupportDocumentAdjustmentNotePdf()` | `GET /v2/adjustment-notes/{number}/download-pdf`                 | Download PDF                    |

**New types:** `FactusSupportDocumentAdjustmentNoteRequest`, `FactusSupportDocumentAdjustmentNoteResponse` — follow the credit-note request shape but adapted for support documents (provider instead of customer).

#### Handler: Purchase Order Scenario D

Create `purchase-orders/helpers/purchase-order-adjustment-scenario-d.ts` mirroring `sales/helpers/scenario-d.ts`:

1. Validate: `order.status === 'COMPLETED'`, support document exists with Factus-assigned number, no prior adjustment note.
2. **Consume stock** via `inventoryService.consumeStock()` (purchase reversal = remove stock — opposite of credit notes which restore stock).
3. Compute `priceBeforeTax` per item from tax-inclusive price using `product.taxes`.
4. Build Factus items with `priceBeforeTax` and tax breakdown.
5. Return `{ items, totalAmount, factusItems }`.

#### Service Method: `emitAdjustmentNote()`

1. Load purchase order with all relations (items, products, taxes, support documents, supplier).
2. Validate preconditions (status COMPLETED, support doc exists, no existing adjustment note).
3. Validate supplier has all Factus-required fields.
4. Route to scenario handler via `correctionConceptCode` (only `'2'` = total annulment in V1).
5. Scenario handler: consume stock, compute `priceBeforeTax`, build Factus items.
6. If electronic (support document was emitted to Factus): build payload, call `factusGateway.createSupportDocumentAdjustmentNote()`, save response (note number, CUDE, QR, public URL).
7. Set `order.status = 'CANCELLED'` (discriminator: presence of adjustment note distinguishes from direct cancellation).
8. Persist adjustment note entity.

#### Controller Endpoints

| Method | Route                                             | Handler                                 |
| ------ | ------------------------------------------------- | --------------------------------------- |
| `POST` | `purchase-orders/:id/adjustment-note`             | `emitAdjustmentNote(id, dto)`           |
| `GET`  | `purchase-orders/:id/adjustment-note/:noteId/pdf` | `downloadAdjustmentNotePdf(id, noteId)` |

### 2.3 Frontend Changes

#### Model extensions (`purchase-order.model.ts`)

Add interfaces:

- `PurchaseOrderAdjustmentNote` — header fields (referenceCode, noteNumber, cude, amount, items, etc.)
- `PurchaseOrderAdjustmentNoteItem` — item fields
- `CreateAdjustmentNoteDto` — `{ correctionConceptCode: string; observation?: string }`

#### Service additions (`purchase-order.service.ts`)

Add methods:

- `emitAdjustmentNote(orderId, dto): Observable<PurchaseOrderAdjustmentNote>`
- `downloadAdjustmentNotePdf(orderId, noteId): Observable<{ pdfBase64Encoded; fileName }>`

#### Detail modal changes (`purchase-order-detail-modal.component.ts`)

Current COMPLETED state actions:

1. "Emitir documento soporte" (disabled if support doc exists)
2. "Descargar PDF" (shown if support doc exists)
3. "Cancelar Orden"

New COMPLETED state (with support document, no adjustment note):

1. "Emitir documento soporte" → disabled (doc exists)
2. "Descargar PDF" → existing
3. **"Emitir nota de ajuste"** → new button
4. "Cancelar Orden" → existing

New COMPLETED + Adjustment Note state:

1. Show adjustment note info section (similar to green support doc section, yellow/orange styling)
2. "Descargar PDF nota de ajuste" button
3. Status reflects cancellation (badge updates to "Cancelada")
4. All action buttons disabled

**State flow:**

```
CREATED → complete() → COMPLETED → emitSupportDocument() → COMPLETED (with DS)
  → emitAdjustmentNote() → CANCELLED (with DS + adjustment note)
```

---

## 3. Scope

### In scope

| Area                      | Details                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Bug fix**               | Pre-tax price refactor in `emitSupportDocument()`                                                      |
| **Factus types**          | New request/response types for support document adjustment notes                                       |
| **Factus gateway**        | Interface + HTTP adapter: create, destroy, download PDF                                                |
| **Entities**              | `PurchaseOrderAdjustmentNote`, `PurchaseOrderAdjustmentNoteItem`, `PurchaseOrderAdjustmentNoteItemTax` |
| **PurchaseOrder entity**  | Add `adjustmentNotes` OneToMany relation                                                               |
| **Scenario D handler**    | `purchase-order-adjustment-scenario-d.ts` — consume stock, compute priceBeforeTax, build Factus items  |
| **Service method**        | `emitAdjustmentNote()` in `PurchaseOrdersService`                                                      |
| **Controller**            | `POST :id/adjustment-note`, `GET :id/adjustment-note/:noteId/pdf`                                      |
| **Frontend models**       | New TypeScript interfaces                                                                              |
| **Frontend service**      | New HTTP methods in `PurchaseOrderService`                                                             |
| **Frontend detail modal** | Adjustment note button + info section + PDF download                                                   |

### Out of scope

| Area                                                                | Reason                                                                                                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Partial adjustments (correction concept codes other than `'2'`)** | V1 only needs total annulment (code 2). Partial returns/concept codes 1, 3, 4 are future scope.                                         |
| **Adjustment note list page / table column**                        | Minimal V1 — detail modal shows the note. List page indicator can be added later.                                                       |
| **Send adjustment note PDF by email**                               | Not requested; follows existing "Próximamente" pattern.                                                                                 |
| **Manual (non-Factus) adjustment notes**                            | If support document emission failed, there's nothing to adjust. Only electronic support documents with Factus-assigned numbers qualify. |
| **Migration scripts**                                               | TypeORM `synchronize: true` handles table creation in development. No production migration needed per user decision.                    |
| **`PurchaseOrderHistory` entity as separate concept**               | User decided: adjustment notes ARE the history. No separate history entity needed.                                                      |

---

## 4. Success Criteria

1. **Bug fixed:** `emitSupportDocument()` sends `priceBeforeTax` (tax-exclusive) + correct tax breakdown. Payment total computed via integer-cents arithmetic matches Factus server-side computation exactly. Existing documents remain unchanged.

2. **Factus gateway complete:** All 3 new methods implemented in interface and HTTP adapter. Sandbox-tested with DIAN test environment.

3. **Adjustment note emission works end-to-end:**
   - `POST /purchase-orders/{id}/adjustment-note` creates a `PurchaseOrderAdjustmentNote` entity.
   - Stock is consumed (reduced) by the adjustment — verified via product stock queries.
   - Purchase order status transitions to `CANCELLED`.
   - Adjustment note is persisted in Factus (response includes note number, CUDE).
   - PDF download returns a valid PDF file.

4. **Frontend flow complete:**
   - "Emitir nota de ajuste" button appears for COMPLETED orders with support documents.
   - Clicking the button calls the API and shows the adjustment note info section.
   - "Descargar PDF nota de ajuste" button downloads the PDF.
   - After emission, order shows as "Cancelada" with adjustment note details visible.

5. **No regressions:**
   - Existing `cancel()` for CREATED/COMPLETED orders still works.
   - Existing support document emission still works (with corrected prices).
   - Existing PDF download still works.
   - Existing stock management (complete, cancel) unchanged.

---

## 5. Risks and Mitigations

| Risk                                                                                                                                                               | Impact                                                   | Mitigation                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pre-tax refactor regression** — changing price semantics in `emitSupportDocument()` could break the total calculation for users accustomed to the buggy behavior | Medium — users may see different totals on new documents | Unit-test the new `priceBeforeTax` computation. Compare old vs new totals in sandbox. Document the fix as a correction. Only affects new documents, not existing. |
| **Factus API endpoint uncertainty** — `/v1/adjustment-notes/support-documents/validate` may have different payload shape than expected                             | High — blocks the entire adjustment note feature         | Test early in Factus sandbox. Adapt payload shape as needed. Make the adapter method flexible with optional fields.                                               |
| **Numbering range for adjustment notes** — Factus may require a specific numbering range ID for "Nota Ajuste Documento Soporte"                                    | Medium — emission fails if range is missing              | Add fallback ID constant (e.g., `392`). Test in sandbox before proceeding.                                                                                        |
| **Double-reversal** — if a purchase order is cancelled directly AND an adjustment note is emitted, stock consumed twice                                            | High — data corruption                                   | Gate both flows by status checks (CANCELLED status prevents re-entry). The adjustment note flow also checks for existing adjustment notes.                        |
| **Tax rate drift** — product tax rates may change between purchase order creation and adjustment note emission                                                     | Low — amounts may not perfectly match original           | Use current tax rates at time of adjustment note emission (consistent with sales Scenario D behavior). The DIAN accepts this.                                     |
| **Status model ambiguity** — both direct cancellation and adjustment note annulment end at CANCELLED status                                                        | Low — hard to distinguish without additional query       | Use presence of adjustment note entity as the discriminator. Alternatively, add `cancellationReason` or separate `ANNULLED` status if product owner requests.     |

---

## 6. Implementation Sequence

| Step | Description                                                                                                                                                                         | Dependencies                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1    | **Factus types + gateway interface** — Add `FactusSupportDocumentAdjustmentNoteRequest`, `FactusSupportDocumentAdjustmentNoteResponse`, and 3 method signatures                     | None                                                                  |
| 2    | **Factus HTTP adapter** — Implement `createSupportDocumentAdjustmentNote()`, `destroySupportDocumentAdjustmentNote()`, `downloadSupportDocumentAdjustmentNotePdf()`                 | Step 1                                                                |
| 3    | **Fix pre-tax price in `emitSupportDocument()`** — Refactor to `priceBeforeTax` + integer-cents total                                                                               | None (independent of steps 1-2 for implementation, but test together) |
| 4    | **New entities** — Create `PurchaseOrderAdjustmentNote`, `PurchaseOrderAdjustmentNoteItem`, `PurchaseOrderAdjustmentNoteItemTax`; add `adjustmentNotes` relation to `PurchaseOrder` | None (TypeORM sync)                                                   |
| 5    | **Scenario D handler** — Create `purchase-order-adjustment-scenario-d.ts`                                                                                                           | Step 4                                                                |
| 6    | **Service method** — Add `emitAdjustmentNote()` to `PurchaseOrdersService`                                                                                                          | Steps 1, 2, 4, 5                                                      |
| 7    | **Controller endpoints** — Add `POST :id/adjustment-note` and `GET :id/adjustment-note/:noteId/pdf`                                                                                 | Step 6                                                                |
| 8    | **Frontend models + service** — Add TS interfaces and HTTP methods                                                                                                                  | Steps 6-7                                                             |
| 9    | **Frontend detail modal** — Add adjustment note UI                                                                                                                                  | Step 8                                                                |

---

## 7. Rollback Strategy

- **Before deploy:** All changes are additive (new entities, new endpoints, new frontend UI). No destructive changes.
- **After deploy with bug:** Roll back the pre-tax fix by reverting the `emitSupportDocument()` changes. Adjustment note feature can be feature-flagged behind a config toggle if desired.
- **Database:** TypeORM `synchronize` creates new tables on application start. To remove, delete tables manually or set `synchronize: false` and revert entity files.
- **Factus:** Adjustment notes emitted to Factus are legally binding documents. Test thoroughly in sandbox before production Factus API calls.
