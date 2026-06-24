# Proposal: credit-debit-notes-scenarios

## Intent

NC/ND hardcode IVA 19% (`price / 1.19`), lack inventory reversal, and have no per-scenario logic. Blocks partial returns, discounts, corrections, and financial charges for DIAN-compliant notes.

**Critical context**: Notes emit for BOTH **manual** and **electronic** invoices. There are separate code paths (`createCreditNote`/`createDebitNote` for electronic, `createCreditNoteLocal`/`createDebitNoteLocal` for manual), and BOTH paths have the hardcoded tax issue and lack inventory reversal. The fix must apply uniformly across both.

## Scope

### In Scope
- Dynamic tax from Product → Tax M2M (remove `price / 1.19`)
- `restoreStock` for credit note returns
- New fields on NC/ND items: `productId`, `purchasePrice`, `taxAmount`, `InvoiceItemTax` link
- Six scenario rules (A–F) with per-type validation
- Factus payload: real tax codes/rates per product

### Out of Scope
- PDF redesign (templates stay, tax lines update)
- Purchase-order reconciliation, multi-currency notes
- Frontend forms for creating NC/ND (existing modal should adapt to new fields)

## Capabilities

### New Capabilities
- `credit-note-scenarios`: A (partial return), B (discount), C (price correction), D (total annulment) — per-scenario validation, inventory/ tax logic
- `debit-note-scenarios`: E (financial interest), F (undercharge correction) — non-product lines, proportional tax
- `tax-recalculation-engine`: Dynamic tax distribution from product config for proportional partial adjustments
- `inventory-reversal`: FIFO `restoreStock` method on inventory batches for return credit notes

### Modified Capabilities
- `sales/adjustment-note-emission`: Tax calculation requirements CHANGE from hardcoded IVA 19% to dynamic product taxes

## Approach

1. Add `restoreStock()` to `InventoryService` (reverse FIFO)
2. Extend NC/ND item entities with `productId`, `purchasePrice`, `taxAmount`, `InvoiceItemTax` relation
3. Replace `price / 1.19` with dynamic product-tax calc (same pattern as invoice creation) — applies to BOTH `createCreditNote`/`createCreditNoteLocal` and `createDebitNote`/`createDebitNoteLocal`
4. Refactor NC/ND creation into per-scenario strategy methods (unified approach for manual + electronic)
5. Add `scenarioType` discriminator to DTO

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `sales/entities/credit-note-item.entity.ts` | Modified | Add productId, purchasePrice, taxAmount, taxes relation |
| `sales/entities/debit-note-item.entity.ts` | Modified | Same as credit-note-item |
| `sales/services/sales.service.ts` | Modified | Refactor NC/ND creation, add scenario routing |
| `inventory/inventory.service.ts` | Modified | Add `restoreStock()` FIFO reversal |
| `sales/dto/create-sales-note.dto.ts` | Modified | Add `scenarioType` discriminator, optional `productId` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `restoreStock` inconsistent batches | Low | Transactional, same pattern as consumeStock |
| Existing NC/ND break on new fields | Low | Nullable fields, defaults in migration |
| Factus rejects tax codes | Medium | Use same mapping as invoice (already validated) |

## Rollback Plan

Revert migrations, revert `restoreStock`, restore hardcoded tax calc. No data loss — new fields nullable.

## Dependencies

- Factus API accepts dynamic tax code/rate per item (already confirmed via invoice creation)
- Inventory batch data must exist for FIFO reversal

## Success Criteria

- [ ] All 6 scenarios (A–F) produce correct NC/ND local records with proper tax breakdown
- [ ] Credit note for product return restocks FIFO batches correctly
- [ ] Factus payload for electronic NC/ND uses real tax codes, not hardcoded `01`/`19.00`
- [ ] Manual NC/ND also use dynamic tax calculation (same as electronic)
- [ ] Existing tests (sales.service.spec) pass with refactored code
