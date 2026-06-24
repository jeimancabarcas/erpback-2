# Tasks: Credit/Debit Note Scenarios

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation) → PR 2 (Tax + Inventory) → PR 3 (Scenarios + Wiring) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Entities + DTO + module registration | PR 1 | Base = feature/credit-debit-notes-scenarios; tests for new fields |
| 2 | Tax recalc engine + restoreStock | PR 2 | Base = PR 1 branch; pure function tests + inventory unit tests |
| 3 | Scenario handlers + service wiring | PR 3 | Base = PR 2 branch; integration tests for all 6 scenarios |

## Phase 1: Foundation — Entities & DTO

- [x] 1.1 Add `productId`, `purchasePrice`, `taxAmount`, `restored`, `OneToMany → noteItemTaxes` to `CreditNoteItem` entity
- [x] 1.2 Add `productId`, `purchasePrice`, `taxAmount`, `OneToMany → noteItemTaxes` to `DebitNoteItem` entity
- [x] 1.3 Create `CreditNoteItemTax` entity (mirrors `InvoiceItemTax` pattern)
- [x] 1.4 Create `DebitNoteItemTax` entity (mirrors `InvoiceItemTax` pattern)
- [x] 1.5 Add `productId` (optional) and `scenarioType` to `CreateSalesNoteItemDto`
- [x] 1.6 Register `CreditNoteItemTax` & `DebitNoteItemTax` in `SalesModule.forFeature`
- [x] 1.7 TDD: write/update tests for entity creation and DTO validation

## Phase 2: Core — Tax Recalculation & Inventory

- [x] 2.1 Create `sales/helpers/tax-recalculator.ts` with `calculateProportionalTax()` (qty + price modes, banker's rounding)
- [x] 2.2 Add `restoreStock(productId, qty, manager?)` to `InventoryService` (LIFO within consumed batches)
- [x] 2.3 TDD: unit test `calculateProportionalTax` (edge cases: rounding, multi-tax, zero qty)
- [x] 2.4 TDD: unit test `restoreStock` (single batch, multi-batch, transactional rollback, idempotency via `restored`)

## Phase 3: Strategy Handlers & Service Wiring

- [x] 3.1 Create `scenario-handler.interface.ts` with `ScenarioHandler` + `ScenarioParams` types
- [x] 3.2 Create scenario-A (partial return: validate items → proportionalTax qty-mode → restoreStock → persist note + itemTaxes)
- [x] 3.3 Create scenario-B (discount: validate price lower → proportionalTax price-mode → persist)
- [x] 3.4 Create scenario-C (price correction: validate diff > 0 → proportionalTax price-mode → persist)
- [x] 3.5 Create scenario-D (total annulment: loop all items → restoreStock each → reverse taxes → mark invoice CANCELLED)
- [x] 3.6 Create scenario-E (financial interest: virtual line item, default tax rate, no inventory impact)
- [x] 3.7 Create scenario-F (undercharge: validate price higher → proportionalTax price-mode on differential → persist)
- [x] 3.8 Refactor `createCreditNote`/`createCreditNoteLocal` to use `scenarioRouter` with strategy map, replacing `price/1.19`
- [x] 3.9 Refactor `createDebitNote`/`createDebitNoteLocal` to use `scenarioRouter`, replacing `price/1.19`
- [x] 3.10 Wire electronic paths: build Factus payloads with real tax codes per scenario, call gateway
- [x] 3.11 TDD: integration test each scenario A–F (manual + electronic paths) with mocked Invoice + InvoiceItemTax

## Phase 4: Testing & Verification

- [x] 4.1 Run full test suite (90 existing + new) — all pass
- [x] 4.2 Verify manual NC/ND produce correct per-scenario records with dynamic tax (not `19.00`)
- [x] 4.3 Verify electronic NC/ND Factus payload uses product tax codes (not hardcoded `01`)

## Phase 5: Cleanup

- [x] 5.1 Remove dead code: inline `price/1.19` branches, unused import of `FactusTax` pattern from old path
- [x] 5.2 Document new DTO fields and scenario routing in relevant module comments
