## Apply Progress — Client Credit Portfolio

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | REFACTOR |
|------|-----------|-------|------------|-----|-------|----------|
| 4.1 | customers-credit.service.spec.ts | Unit | N/A (new) | ✅ Written | ✅ 12/12 | ✅ Clean |
| 4.2 | sales.service.spec.ts | Unit | ✅ 65/65 | ✅ Written | ✅ ON_CREDIT tests | ✅ Clean |
| 4.3 | customers.service.spec.ts | Unit | ✅ 67/67 | ✅ Written | ✅ 2/2 | ✅ Clean |
| 7.1 | credit-portfolio.component.spec.ts | Unit | N/A (new) | ✅ Written | ✅ 6/6 | ✅ Clean |

### Tasks Complete
- Phase 1: 3/3 ✅
- Phase 2: 4/4 ✅
- Phase 3: 5/5 ✅
- Phase 4: 3/4 (e2e deferred)
- Phase 5: 3/3 ✅
- Phase 6: 5/5 ✅
- Phase 7: 1/3 (component tests deferred)
Total: 24/27

### Known Gaps
- Task 4.4 (e2e): Deferred — requires PostgreSQL
- Task 7.2 (RecordPaymentFormMolecule test): Deferred — dialog infra dependency
- Task 7.3 (CustomerService credit methods test): Deferred — frontend test infra incomplete

### Implementation Notes
- Customer credit fields added to Customer entity
- PaymentRecord entity created with invoice/customer FKs and indexes
- ON_CREDIT added to InvoiceStatus enum
- Balance updated in SalesService.create() when creating credit invoices
