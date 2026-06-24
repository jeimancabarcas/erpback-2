# Proposal: Credit Note Cumulative Validation

## Intent

Prevent credit notes from exceeding invoice totals when multiple notes exist for the same invoice. E.g., 60% + 50% credit = 110% — invalid.

## Scope

### In Scope
- Cumulative quantity check per product across all credit notes on the invoice
- Cumulative amount check per invoice across all credit notes
- Both electronic (Factus) and manual (local) paths
- Quantity check excluded for scenarios B (discount) and C (price correction)

### Out of Scope
- Debit notes (same problem, deferred)
- Frontend feedback for cumulative limits
- Historical data backfill or retroactive validation

## Capabilities

### New Capabilities
None — this is a cross-cutting validation layer within existing capabilities.

### Modified Capabilities
- `credit-note-scenarios`: Add cumulative validation requirements — per-product quantity cap (scenarios A/D) and per-invoice amount cap (all scenarios). Existing per-item quantity check remains.

## Approach

1. Add `validateCumulativeLimits()` in `SalesService` — queries existing credit notes for the invoice, sums amounts and per-product quantities.
2. Call from `processCreditNoteWithHandler()` before `handler.execute()`.
3. Reject with 400 if new note pushes beyond `invoice.totalAmount` or any invoice item quantity.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/modules/sales/sales.service.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition between concurrent notes | Low | Sum query inside same transaction before persist |
| Scenario D annulment followed by new note | Low | D sets invoice to CANCELLED, already guarded |
| Direct DB notes bypass validation | Low | Out of scope — API enforcement is sufficient |

## Rollback Plan

Revert the validation call in `processCreditNoteWithHandler()` and remove `validateCumulativeLimits()`. No schema changes.

## Dependencies

- `creditNoteRepository` and `creditNoteItemRepository` (already injected)

## Success Criteria

- [ ] 60% + 50% quantity for same product → second rejected with 400
- [ ] 60% + 50% amount for same invoice → second rejected with 400
- [ ] Scenarios B/C pass quantity check (amounts only)
- [ ] Single-note over-limit still rejected (110% in one note)
- [ ] Both electronic and manual paths enforce equally
