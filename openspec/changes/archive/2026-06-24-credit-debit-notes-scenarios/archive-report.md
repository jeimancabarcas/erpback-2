# Archive Report: credit-debit-notes-scenarios

**Archived**: 2026-06-24
**Previous path**: `openspec/changes/credit-debit-notes-scenarios/`
**Archive path**: `openspec/changes/archive/2026-06-24-credit-debit-notes-scenarios/`
**Mode**: openspec (filesystem)

## Task Completion Gate

- `tasks.md` checked: 21/21 tasks complete (all `[x]`)
- Implementation tasks fully completed: Yes
- Stale checkbox reconciliation: Not needed

## Specs Synced

Delta spec domain: `sales`

| Requirement | Action | Details |
|-------------|--------|---------|
| Modal Reload After Note Creation | Preserved | Existing requirement, unchanged |
| Conditional Electronic Toggle — Frontend | Preserved | Existing requirement, unchanged |
| Conditional Electronic Guard — Backend | Preserved | Existing requirement, unchanged |
| Tax Calculation | Added (merged from MODIFIED) | Dynamic tax from product M2M, replaces hardcoded `price/1.19` |
| Note Item Entity | Added (merged from MODIFIED) | New fields: `productId`, `purchasePrice`, `taxAmount`, `noteItemTaxes` relation |
| scenarioType Discriminator | Added | `scenarioType` derived from `correctionConceptCode` |
| Inventory Reversal on Return | Added | `restoreStock()` for credit notes with concept codes 1, 2, 5 |

## Archive Contents

| Artifact | Status |
|----------|--------|
| `proposal.md` | ✅ Present |
| `specs/sales/spec.md` | ✅ Present (delta spec) |
| `design.md` | ✅ Present |
| `tasks.md` | ✅ Present (21/21 tasks complete) |
| `archive-report.md` | ✅ Present (this file) |

## Source of Truth Updated

`openspec/specs/sales/spec.md` — merged 4 new requirements from delta (now 7 requirements total)

## Change Scope Summary

- **Entities added/modified**: CreditNoteItem, DebitNoteItem (+ fields), CreditNoteItemTax (new), DebitNoteItemTax (new)
- **New files**: `tax-recalculator.ts`, 6 scenario handlers (A–F), `scenario-handler.interface.ts`
- **Modified**: `sales.service.ts`, `inventory.service.ts`, `sales.module.ts`, DTOs
- **Tests**: 129/129 passing (unit + integration)

## Verification Status

- Phase 4 (Verification): ✅ Confirmed by orchestrator
- Phase 5 (Cleanup): ✅ Confirmed by orchestrator
- All checks passed per orchestrator

## Risks and Notes

- No CRITICAL issues in verification
- No destructive delta merge performed
- Complete and clean archive
