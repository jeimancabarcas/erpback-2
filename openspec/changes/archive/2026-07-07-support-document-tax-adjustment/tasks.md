# Implementation Tasks: support-document-tax-adjustment

## Review Workload Forecast

| Field                   | Value                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Estimated changed lines | ~1,350–1,550                                                                                   |
| 400-line budget risk    | High                                                                                           |
| Chained PRs recommended | Yes                                                                                            |
| Suggested split         | PR 1 (Backend Data + Gateway) → PR 2 (Backend Business Logic) → PR 3 (Frontend) → PR 4 (Tests) |
| Delivery strategy       | auto-chain                                                                                     |
| Chain strategy          | feature-branch-chain                                                                           |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

---

## Implementation Overview

| PR   | Tasks   | Est. Lines | Depends On |
| ---- | ------- | ---------- | ---------- |
| PR 1 | T1–T5   | ~330       | None       |
| PR 2 | T6–T9   | ~390       | PR 1       |
| PR 3 | T10–T11 | ~210       | PR 2       |
| PR 4 | T12–T13 | ~400-500   | PR 1–3     |

Backend paths rooted at: `C:/Users/jeima/Desktop/ERP Repositories/erpbackend/src/modules/`
Frontend paths rooted at: `C:/Users/jeima/Desktop/ERP Repositories/erpfrontend/src/app/`

---

# PR 1 — Backend Foundation (Data + Gateway)

## T1: Factus types and gateway interface extensions

**Files:** `erpbackend/src/modules/factus/interfaces/factus-invoicing-gateway.interface.ts`

**Description:** Add three new TypeScript interfaces (`FactusSupportDocumentAdjustmentNoteRequest`, `FactusSupportDocumentAdjustmentNoteResponse`, `FactusSupportDocumentAdjustmentNoteResponseData`) and three new abstract method signatures to `IFactusInvoicingGateway` (`createSupportDocumentAdjustmentNote`, `destroySupportDocumentAdjustmentNote`, `downloadSupportDocumentAdjustmentNotePdf`). These follow the existing credit-note pattern.

**TDD sequence (strict_tdd: true):**

- RED: Write a unit test that verifies the interface compiles and declares the 3 new methods with correct signatures. Expect TypeScript compilation error if types are missing.
- GREEN: Add the 3 new interfaces and 3 method signatures to the existing file.
- TRIANGULATE: Add a test that creates a concrete stub implementing the 3 new methods — ensures the interface contract is satisfied.
- REFACTOR: No significant refactoring needed.

**Acceptance criteria:**

- `FactusSupportDocumentAdjustmentNoteRequest` defined with fields: `referenceCode`, `correctionConceptCode`, `supportDocumentNumber`, `numberingRangeId?`, `observation?`, `paymentDetails`, `provider?`, `items`
- `FactusSupportDocumentAdjustmentNoteResponseData` defined with fields: `referenceCode`, `number`, `cude`, `qrUrl?`, `publicUrl?`, `isValidated`, `validatedAt`, `createdAt`, `numberingRange`, `items`, `taxes`, `totals`, `links`
- `FactusSupportDocumentAdjustmentNoteResponse` defined with `status`, `message`, `data`
- Interface declares 3 new methods with matching parameter/return types
- Existing method signatures remain unchanged
- Reuses existing shared types: `FactusPaymentDetail`, `FactusItem`, `FactusNumberingRange`, `FactusInvoiceResponseTotals`, `FactusSupportDocumentProvider`

**Est. changed lines:** ~50 (additions only, same file)

---

## T2: Factus HTTP adapter — 3 new methods

**Files:** `erpbackend/src/modules/factus/adapters/factus-http-invoicing.adapter.ts`

**Description:** Implement three new methods in `FactusHttpInvoicingAdapter`:

1. `createSupportDocumentAdjustmentNote(request)` → `POST /v1/adjustment-notes/support-documents/validate`
2. `destroySupportDocumentAdjustmentNote(referenceCode)` → `DELETE /v1/adjustment-notes/support-documents/reference/{code}`
3. `downloadSupportDocumentAdjustmentNotePdf(number)` → `GET /v2/adjustment-notes/{number}/download-pdf`

Also add fallback numbering range ID `392` for `'Nota Ajuste Documento Soporte'` in `getActiveNumberingRangeId()`.

**TDD sequence (strict_tdd: true):**

- RED: Write unit tests for each method that stub `makePostRequest`/`makeDeleteRequest`/`makeGetRequest` and verify correct endpoint + payload mapping.
- GREEN: Implement the 3 methods using existing `makePostRequest`, `makeDeleteRequest`, `makeGetRequest` helpers (same patterns as `createSupportDocument`, `destroySupportDocument`, `downloadSupportDocumentPdf`). Add the `mapSupportDocumentAdjustmentNoteResponse` private mapping method. Add fallback for `'Nota Ajuste Documento Soporte'` → `392`.
- TRIANGULATE: Add tests for edge cases: provider omitted, numberingRangeId explicitly provided vs. resolved, Factus API error returns.
- REFACTOR: Extract common payload mapping logic if duplication with existing methods is excessive (e.g., item and payment mapping).

**Acceptance criteria:**

- `createSupportDocumentAdjustmentNote` sends POST to correct endpoint with correctly mapped snake_case payload
- Provider field is optional (omitted from payload when undefined)
- Items mapped with `code_reference`, `name`, `quantity`, `discount_rate`, `price`, `unit_measure_code`, `standard_code`, `taxes`
- `destroySupportDocumentAdjustmentNote` sends DELETE with URL-encoded reference code
- `downloadSupportDocumentAdjustmentNotePdf` sends GET and extracts `pdf_base_64_encoded` + `file_name` from response
- Fallback `392` used for `'Nota Ajuste Documento Soporte'` when lookup fails
- All 3 methods use existing `makeGetRequest`/`makePostRequest`/`makeDeleteRequest` patterns

**Est. changed lines:** ~100

---

## T3: New entity — PurchaseOrderAdjustmentNote

**Files:** `erpbackend/src/modules/purchase-orders/entities/purchase-order-adjustment-note.entity.ts` (NEW)

**Description:** Create TypeORM entity class for the adjustment note header table `purchase_order_adjustment_notes` with columns: `id` (uuid PK), `reference_code` (unique varchar), `note_number` (nullable varchar), `cude` (nullable varchar), `correction_concept_code` (varchar), `amount` (decimal 12,2), `observation` (nullable text), `qr_url` (nullable varchar), `public_url` (nullable varchar), `purchase_order_id` (FK), `support_document_id` (nullable FK), `created_at`, `updated_at`.

Relations: `@ManyToOne(() => PurchaseOrder)`, `@ManyToOne(() => PurchaseOrderSupportDocument)`, `@OneToMany(() => PurchaseOrderAdjustmentNoteItem)` with cascade.

**TDD sequence (strict_tdd: true):**

- RED: Write a test that verifies the entity can be instantiated and has all expected properties. Expect compilation error before entity exists.
- GREEN: Create the entity file with all decorators, columns, and relations.
- TRIANGULATE: Test that cascade persist works for items relation (save note with items in one operation).
- REFACTOR: None needed.

**Acceptance criteria:**

- Table name: `purchase_order_adjustment_notes`
- All columns defined with correct TypeORM decorators
- FK `purchase_order_id` → `PurchaseOrder` with CASCADE delete
- FK `support_document_id` → `PurchaseOrderSupportDocument` with SET NULL delete
- `@OneToMany` to `PurchaseOrderAdjustmentNoteItem` with cascade: true
- `@CreateDateColumn` and `@UpdateDateColumn` for timestamps

**Est. changed lines:** ~55 (new file)

---

## T4: New entities — PurchaseOrderAdjustmentNoteItem + PurchaseOrderAdjustmentNoteItemTax

**Files:**

- `erpbackend/src/modules/purchase-orders/entities/purchase-order-adjustment-note-item.entity.ts` (NEW)
- `erpbackend/src/modules/purchase-orders/entities/purchase-order-adjustment-note-item-tax.entity.ts` (NEW)

**Description:**

`PurchaseOrderAdjustmentNoteItem` — table `purchase_order_adjustment_note_items` with columns: `id` (uuid PK), `code_reference` (varchar), `name` (varchar), `quantity` (int), `unit_price` (decimal 12,2), `subtotal` (decimal 12,2), `product_id` (nullable FK → Product), `tax_amount` (decimal 10,2), `consumed` (boolean, default false), `adjustment_note_id` (FK).

Relations: `@ManyToOne(() => PurchaseOrderAdjustmentNote)`, `@ManyToOne(() => Product)`, `@OneToMany(() => PurchaseOrderAdjustmentNoteItemTax)` with cascade.

`PurchaseOrderAdjustmentNoteItemTax` — table `purchase_order_adjustment_note_item_taxes` with columns: `id` (uuid PK), `tax_id` (nullable varchar), `tax_code` (varchar), `tax_name` (varchar), `tax_rate` (decimal 5,2), `tax_amount` (decimal 10,2), `adjustment_note_item_id` (FK).

**Acceptance criteria:**

- Both entities created with correct TypeORM decorators
- `PurchaseOrderAdjustmentNoteItem` has all expected columns and relations
- `PurchaseOrderAdjustmentNoteItemTax` has all expected columns and FK to item
- Cascade on item → taxes
- FK to `Product` with SET NULL on delete
- Indexes on `adjustment_note_id` and `product_id`

**Est. changed lines:** ~85 combined (2 new files)

---

## T5: PurchaseOrder entity relation + Module registration

**Files:**

- `erpbackend/src/modules/purchase-orders/entities/purchase-order.entity.ts`
- `erpbackend/src/modules/purchase-orders/purchase-orders.module.ts`

**Description:**

1. Add `@OneToMany(() => PurchaseOrderAdjustmentNote, (note) => note.purchaseOrder) adjustmentNotes: PurchaseOrderAdjustmentNote[];` to `PurchaseOrder` entity (no column change — FK is on the adjustment note side).
2. Add the 3 new entity classes to the `TypeOrmModule.forFeature([...])` array in `PurchaseOrdersModule`.

**TDD sequence (strict_tdd: true):**

- RED: Write a test that loads a PurchaseOrder with `adjustmentNotes` relation and asserts it returns an array. Expect failure before entity relation is added.
- GREEN: Add the `@OneToMany` decorator to `PurchaseOrder` entity. Add 3 new entity imports to the module's `TypeOrmModule.forFeature`.
- TRIANGULATE: Test that module compilation includes all 6 entities.
- REFACTOR: None needed.

**Acceptance criteria:**

- `PurchaseOrder.adjustmentNotes` declared as `@OneToMany` to `PurchaseOrderAdjustmentNote`
- No new columns on `purchase_orders` table (FK is on adjustment_notes)
- `PurchaseOrdersModule.TypeOrmModule.forFeature` includes all 6 entities: `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseOrderSupportDocument`, `PurchaseOrderAdjustmentNote`, `PurchaseOrderAdjustmentNoteItem`, `PurchaseOrderAdjustmentNoteItemTax`

**Est. changed lines:** ~15

---

# PR 2 — Backend Business Logic

## T6: DTO + Scenario handler interface + Scenario D handler

**Files:**

- `erpbackend/src/modules/purchase-orders/dto/create-purchase-order-adjustment-note.dto.ts` (NEW)
- `erpbackend/src/modules/purchase-orders/helpers/purchase-order-adjustment-scenario-handler.interface.ts` (NEW)
- `erpbackend/src/modules/purchase-orders/helpers/purchase-order-adjustment-scenario-d.ts` (NEW)

**Description:**

**DTO:** `CreatePurchaseOrderAdjustmentNoteDto` with `@IsString() @IsIn(['2']) correctionConceptCode: string` and `@IsString() @IsOptional() observation?: string`.

**Scenario Handler Interface:** Define `PurchaseOrderAdjustmentScenarioHandler` interface with `execute(params)` returning `PurchaseOrderAdjustmentScenarioResult` containing `items`, `totalAmount`, `factusItems`, `updatedOrderStatus`. Define supporting types: `PreparedAdjustmentNoteItem`, `NoteItemTaxData`, `PurchaseOrderAdjustmentScenarioParams`.

**Scenario D Handler:** `PurchaseOrderAdjustmentScenarioDHandler` implementing the interface. Injectable via `@Injectable()`, depends on `InventoryService`. For each item:

1. `consumeStock(productId, quantity, queryRunner, { referenceType: 'PURCHASE_ORDER_ADJUSTMENT' })`
2. Compute `priceBeforeTax = price / (1 + totalTaxRate/100)` from product.taxes
3. Build tax breakdown, accumulated items, factus items

**TDD sequence (strict_tdd: true):**

- RED: Write tests for: DTO validation (invalid concept code rejected, valid accepted), handler interface contract (compile-time), scenario D handler: calls consumeStock, computes priceBeforeTax, rejects CANCELLED order.
- GREEN: Create all 3 files. Implement DTO with class-validator decorators. Implement handler interface. Implement handler with consumeStock loop.
- TRIANGULATE: Add tests for: multiple items (all processed), zero tax rate items (priceBeforeTax = price), Factus item shape correctness.
- REFACTOR: Extract priceBeforeTax computation into a private helper if repeated.

**Acceptance criteria:**

- DTO validates `correctionConceptCode` must be `'2'`, `observation` optional
- Handler interface defines full contract with typed params and result
- Scenario D handler: `consumeStock` called per item with `referenceType: 'PURCHASE_ORDER_ADJUSTMENT'`
- `priceBeforeTax` correctly computed from tax-inclusive price
- Tax breakdown includes each tax with code, rate, amount
- Factus items built with correct structure
- Throws `BadRequestException` if PO already CANCELLED
- Handler registered as `@Injectable()` in module providers

**Est. changed lines:** ~120 (3 new files)

---

## T7: Fix pre-tax bug in emitSupportDocument()

**Files:** `erpbackend/src/modules/purchase-orders/purchase-orders.service.ts`

**Description:** Refactor `emitSupportDocument()` to:

1. Compute `priceBeforeTax = unitPrice / (1 + totalTaxRate/100)` per item using `product.taxes` (same formula as sales `emit()`).
2. Send `price: priceBeforeTax` in each Factus item (instead of `price: Number(item.price)` — the bug).
3. Replace manual float total computation with `computeFactusTotal()` — copy the integer-cents private method from `SalesService` (keep per-service per design decision).

**TDD sequence (strict_tdd: true):**

- RED: Write tests that capture the bug: create a purchase order with 19% tax-inclusive price 119, assert `priceBeforeTax` = 100, assert Factus payload `price` = 100, assert computeFactusTotal matches expected. The test should fail with current code (price=119).
- GREEN: Implement fix: add priceBeforeTax computation, use priceBeforeTax in Factus items, add `computeFactusTotal()` private method, use it for payment total.
- TRIANGULATE: Add tests for: multi-item orders with different tax rates, zero-tax items, edge cases (tax rate 0%, tax rate 100%), that existing support document guard still works.
- REFACTOR: Ensure `computeFactusTotal` is a private copy (no shared utility). Verify no other code path is affected.

**Acceptance criteria:**

- `priceBeforeTax` computed as `unitPrice / (1 + totalTaxRate/100)` using product.taxes
- Factus payload sends `price: priceBeforeTax` (not `price: Number(item.price)`)
- Payment total computed via `computeFactusTotal()` integer-cents arithmetic
- Existing guards: supplier validation, duplicate DS check, COMPLETED-only check — unchanged
- `computeFactusTotal()` copied as private method (per design decision — 2 copies now exist, revisit if 3rd appears)

**Est. changed lines:** ~40

---

## T8: Service method — emitAdjustmentNote() + downloadAdjustmentNotePdf()

**Files:** `erpbackend/src/modules/purchase-orders/purchase-orders.service.ts` (modified)

**Description:** Add two new methods:

**`emitAdjustmentNote(id, dto)`:**

1. Load PO with relations: `['items', 'items.product', 'items.product.taxes', 'supplier', 'supportDocuments', 'adjustmentNotes']`
2. Validate: status='COMPLETED', support doc exists with number, no existing adj note, supplier has Factus fields
3. Run in transaction: route to scenario D handler by correctionConceptCode → handler.execute()
4. Build Factus payload with `referenceCode='NA-{orderNumber}-{timestamp}'`, `correctionConceptCode='2'`, `supportDocumentNumber`, paymentDetails with `computeFactusTotal()`, provider mapping, items with `priceBeforeTax`
5. Call `factusGateway.createSupportDocumentAdjustmentNote()`
6. Persist `PurchaseOrderAdjustmentNote`, items, item taxes
7. Set `order.status = 'CANCELLED'`
8. On Factus failure → rollback transaction (no stock consumed, no entities saved)

**`downloadAdjustmentNotePdf(id, noteId)`:**

1. Look up adjustment note by noteId + purchaseOrderId
2. Validate note exists and has `noteNumber`
3. Call `factusGateway.downloadSupportDocumentAdjustmentNotePdf(number)`
4. Return `{ pdfBase64Encoded, fileName }`

Inject `@InjectRepository(PurchaseOrderAdjustmentNote)` in constructor. Add scenario handler map injection (D handler).

**TDD sequence (strict_tdd: true):**

- RED: Write tests for each guard (not COMPLETED → 409, no DS → 400, existing note → 409, missing supplier fields → 400, CANCELLED PO → 409). Write test for successful emission: mock handler, mock factus, verify entities persisted and status changed. Write test that Factus failure rolls back transaction (mock consumeStock + mock factus throws, verify consumeStock not committed).
- GREEN: Implement both methods with all validation, transaction logic, and Factus integration.
- TRIANGULATE: Add tests for: scenario handler not found for unknown concept codes, Factus error message propagation, `downloadAdjustmentNotePdf` not-found cases.
- REFACTOR: Ensure transaction boundary is correct (Factus call inside transaction). Consider extracting supplier validation into shared helper if duplicated with emitSupportDocument.

**Acceptance criteria:**

- `emitAdjustmentNote()` validates all 5 guard conditions
- Runs in TypeORM transaction (pessimistic lock on PO)
- Routes to Scenario D handler via correctionConceptCode map
- Builds correct Factus payload with `referenceCode`, `supportDocumentNumber`, `provider`, `items` with `priceBeforeTax`
- Calls `factusGateway.createSupportDocumentAdjustmentNote()`
- On success: persists note + items + taxes, sets status to CANCELLED
- On Factus failure: rolls back (no stock consumed, no entities persisted)
- `downloadAdjustmentNotePdf()` loads note by id + purchaseOrderId, validates `noteNumber`, calls Factus gateway
- New `PurchaseOrderAdjustmentNote` repository injected

**Est. changed lines:** ~200

---

## T9: Controller endpoints

**Files:** `erpbackend/src/modules/purchase-orders/purchase-orders.controller.ts`

**Description:** Add two new routes:

1. `@Post(':id/adjustment-note')` — calls `purchaseOrdersService.emitAdjustmentNote(id, dto)` with `@Body() dto: CreatePurchaseOrderAdjustmentNoteDto`
2. `@Get(':id/adjustment-note/:noteId/pdf')` — calls `purchaseOrdersService.downloadAdjustmentNotePdf(id, noteId)`

Both behind existing `@UseGuards(JwtAuthGuard)` on controller class.

**TDD sequence (strict_tdd: true):**

- RED: Write controller spec tests: POST returns 401 without JWT, POST returns 201 with valid dto, GET returns 200 with valid IDs.
- GREEN: Add both route handlers to controller.
- TRIANGULATE: Test error cases: invalid UUID params (ParseUUIDPipe), invalid body (missing correctionConceptCode).
- REFACTOR: None needed.

**Acceptance criteria:**

- `POST /purchase-orders/:id/adjustment-note` accepts `{ correctionConceptCode: '2', observation?: string }`
- `GET /purchase-orders/:id/adjustment-note/:noteId/pdf` returns `{ pdfBase64Encoded, fileName }`
- Both routes behind JWT auth guard
- UUID validation via `ParseUUIDPipe` on both params
- Returns proper NestJS response structures (delegating to service)

**Est. changed lines:** ~30

---

# PR 3 — Frontend

## T10: Frontend models + service extensions

**Files:**

- `erpfrontend/src/app/models/purchase-order.model.ts`
- `erpfrontend/src/app/services/purchase-order.service.ts`

**Description:**

**Model additions (`purchase-order.model.ts`):**

- `PurchaseOrderAdjustmentNote` interface: `id`, `referenceCode`, `noteNumber`, `cude?`, `correctionConceptCode`, `amount`, `observation?`, `qrUrl?`, `publicUrl?`, `items?: PurchaseOrderAdjustmentNoteItem[]`, `createdAt`
- `PurchaseOrderAdjustmentNoteItem` interface: `codeReference`, `name`, `quantity`, `unitPrice`, `subtotal`, `productId?`, `taxAmount`, `consumed`
- `CreateAdjustmentNoteDto` interface: `correctionConceptCode: string`, `observation?: string`
- Add `adjustmentNotes?: PurchaseOrderAdjustmentNote[]` to `PurchaseOrder` interface

**Service additions (`purchase-order.service.ts`):**

- `emitAdjustmentNote(orderId: string, dto: CreateAdjustmentNoteDto): Observable<PurchaseOrderAdjustmentNote>` — POST
- `downloadAdjustmentNotePdf(orderId: string, noteId: string): Observable<{ pdfBase64Encoded: string; fileName: string }>` — GET

**TDD sequence (strict_tdd: true):**

- RED: Write tests for: model interfaces compilation, service method calls correct URLs, service methods return correct observable types.
- GREEN: Add interfaces to model file. Add both methods to service.
- TRIANGULATE: Test error handling in service methods.
- REFACTOR: None needed.

**Acceptance criteria:**

- All 3 new interfaces defined in model file
- `PurchaseOrder` interface includes optional `adjustmentNotes`
- Service has `emitAdjustmentNote()` method calling `POST /purchase-orders/{orderId}/adjustment-note`
- Service has `downloadAdjustmentNotePdf()` method calling `GET /purchase-orders/{orderId}/adjustment-note/{noteId}/pdf`
- Imports updated

**Est. changed lines:** ~60

---

## T11: Frontend detail modal — adjustment note UI

**Files:** `erpfrontend/src/app/components/organisms/purchase-order-detail-modal/purchase-order-detail-modal.component.ts`

**Description:** Modify the purchase order detail modal component to support adjustment note operations:

1. **New signals:** `adjustmentNote = computed(...)` — derives from `order.adjustmentNotes[0]`. Extend `actionInProgress` union type to include `'emitAdjustment'` and `'downloadAdjustmentPdf'`.

2. **Adjustment note info section** (after support document info, in the scrollable content area): Yellow/amber styled section showing note number and CUDE when `adjustmentNote()` is not null.

3. **New buttons in COMPLETED case footer:**
   - "Emitir nota de ajuste" button — visible when `supportDocument() && !adjustmentNote()`. Calls `emitAdjustmentNote()`.
   - "Descargar PDF ajuste" button — visible when `adjustmentNote()`. Calls `downloadAdjustmentNotePdf()`.

4. **New methods:**
   - `emitAdjustmentNote()` — calls `purchaseOrderService.emitAdjustmentNote()` with `correctionConceptCode: '2'`. On success: updates local order state with CANCELLED status and the new note. Shows loading/error states.
   - `downloadAdjustmentNotePdf()` — calls `purchaseOrderService.downloadAdjustmentNotePdf()`. Base64 decode and trigger download (same pattern as existing `downloadPdf()`).

5. **Status display:** No change needed — CANCELLED status already shows "Orden Cancelada" block.

**TDD sequence (strict_tdd: true):**

- RED: Write component tests: button not visible for CREATED orders, button not visible for COMPLETED without DS, button visible for COMPLETED with DS and no adj note, button hidden for CANCELLED, button hidden when adjustmentNote exists, click calls correct service method.
- GREEN: Add all template changes and component logic.
- TRIANGULATE: Test loading states spinner, error display, PDF download creates blob and triggers link click.
- REFACTOR: Extract PDF download trigger into a shared utility if duplicated pattern.

**Acceptance criteria:**

- "Emitir nota de ajuste" button visible for COMPLETED + DS + no adjustment note
- Button shows spinner + "Emitiendo..." during request
- Button disabled while any action in progress
- On success: order status updates to CANCELLED, adjustment note section appears
- Adjustment note info section (yellow/amber) shows note number and CUDE
- "Descargar PDF ajuste" button visible when adjustment note exists
- PDF download follows same base64-decode + blob + link.click pattern
- Error messages displayed in error banner
- Existing support document emit/download/cancel buttons unaffected
- No SCSS changes needed (reuses existing classes)

**Est. changed lines:** ~150

---

# PR 4 — Tests

## T12: Backend tests

**Files:**

- `erpbackend/src/modules/factus/adapters/factus-http-invoicing.adapter.spec.ts`
- `erpbackend/src/modules/purchase-orders/purchase-orders.service.spec.ts`
- `erpbackend/src/modules/purchase-orders/purchase-orders.controller.spec.ts`
- `erpbackend/src/modules/purchase-orders/helpers/purchase-order-adjustment-scenario-d.spec.ts` (NEW)

**Description:**

**Adapter tests (existing file):**

- `createSupportDocumentAdjustmentNote` maps camelCase → snake_case correctly
- Provider is optional (omitted from payload when undefined)
- `destroySupportDocumentAdjustmentNote` calls correct DELETE endpoint
- `downloadSupportDocumentAdjustmentNotePdf` extracts `pdf_base_64_encoded` from response
- Fallback numbering range ID returns 392 for 'Nota Ajuste Documento Soporte'

**Scenario D handler tests (new file):**

- Calls `consumeStock` for each item with correct params
- Throws if PO already CANCELLED
- Computes `priceBeforeTax` correctly from tax-inclusive price
- Builds correct Factus items structure
- Processes all items (no filtering)
- Zero tax items still processed (priceBeforeTax = price)

**Service tests (existing file):**

- `computeFactusTotal` integer-cents arithmetic
- `emitSupportDocument` pre-tax fix: priceBeforeTax sent instead of raw price
- `emitSupportDocument` total uses computeFactusTotal
- `emitAdjustmentNote` guards: not COMPLETED → 409, no DS → 400, existing note → 409, missing supplier fields → 400, CANCELLED PO → 409
- `emitAdjustmentNote` successful flow: handler called, Factus called, entities persisted, status=CANCELLED
- `emitAdjustmentNote` Factus failure rollback: stock not consumed
- `downloadAdjustmentNotePdf` loads note, validates, calls gateway

**Controller tests (existing file):**

- POST `:id/adjustment-note` returns 401 without JWT
- POST `:id/adjustment-note` returns 200 with valid dto
- GET `:id/adjustment-note/:noteId/pdf` returns 200
- Invalid UUID returns 400

**Est. changed lines:** ~300

---

## T13: Frontend tests

**Files:**

- `erpfrontend/src/app/services/purchase-order.service.spec.ts`
- `erpfrontend/src/app/components/organisms/purchase-order-detail-modal/purchase-order-detail-modal.component.spec.ts`

**Description:**

**Service tests:**

- `emitAdjustmentNote()` calls correct POST endpoint with dto
- `downloadAdjustmentNotePdf()` calls correct GET endpoint
- Returns correct observable types

**Component tests:**

- Button "Emitir nota de ajuste" visible for COMPLETED + DS + no adjustment note
- Button hidden when no support document
- Button hidden when adjustment note already exists
- Button disabled while action in progress
- After emission: status → CANCELLED, note info section visible
- "Descargar PDF ajuste" visible when adjustment note exists
- PDF download triggers file download
- Error display on failure
- Loading state spinner during emission

**Est. changed lines:** ~100-200

---

## Dependency Graph (All Tasks)

```
T1 (types + interface) ──→ T2 (adapter) ──┐
                                           ├──→ T5 (entity relation + module)
T3 (adj note entity) ──────────────────────┘
T4 (item + tax entities) ──────────────────┘
                                           │
T5 ──→ T6 (dto + handler) ──→ T7 (pre-tax fix) ──→ T8 (service methods) ──→ T9 (controller)
                                                                              │
                                                                              └──→ T10 (frontend models) ──→ T11 (frontend modal)
                                                                                                             │
T1─T11 ──→ T12 (backend tests) ──→ T13 (frontend tests)
```

## PR Boundaries

| PR   | Entry Gate    | Exit Gate                                            | Rollback                                  |
| ---- | ------------- | ---------------------------------------------------- | ----------------------------------------- |
| PR 1 | `main` branch | All new types + entities compile, adapter tests pass | No data migrated — revert code            |
| PR 2 | PR 1 merged   | Service tests pass, pre-tax fix verified in sandbox  | Revert code, revert any perm data changes |
| PR 3 | PR 2 merged   | Frontend tests pass, modal renders correctly         | Revert frontend code                      |
| PR 4 | PR 1–3 merged | All tests pass (backend + frontend)                  | Revert test files                         |

## Risk Notes

- **Pre-tax fix regression:** Only affects new support documents. Test in sandbox before production. Rollback = revert the emitSupportDocument changes.
- **Factus API uncertainty:** `/v1/adjustment-notes/support-documents/validate` endpoint may differ from spec. Test early in sandbox (PR 2) and adapt payload as needed.
- **Numbering range fallback:** 392 is a guess — confirm via Factus sandbox API call.
- **TypeORM synchronize:** Tables auto-created. No migration files. If production uses migrations, a follow-up migration task may be needed.
- **Double-reversal prevention:** Status guards prevent re-entry. The `cancel()` method checks status before consuming stock.
