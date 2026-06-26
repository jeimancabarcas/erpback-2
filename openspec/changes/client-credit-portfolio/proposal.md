# Proposal: Client Credit Portfolio

## Intent

Track customer credit purchases. Credit invoices are immediately marked PAID with no balance tracking. Add visible limits, pending balances, and payment recording.

## Scope

**In**: Customer credit fields, ON_CREDIT invoice status, PaymentRecord entity, customer detail portfolio display, payment recording form, soft credit-limit warning.
**Out**: Electronic invoicing, automated dunning, interest, credit scoring.

## Capabilities

### New
- `customer-credit-portfolio`: Portfolio viewing (balance, limit, utilization) + payment recording

### Modified
- `customer-management`: Customer entity gains credit fields; stats endpoint extends
- `sales-manual-invoice`: InvoiceStatus gets ON_CREDIT; create() sets it when paymentType=Crédito

## Approach

Hybrid (Approach 3). Credit fields on Customer + PaymentRecord entity + ON_CREDIT status. Soft warning only. Partial payments allowed. Existing credit invoices = paid-in-full.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| Customer entity | Modified | +credit fields (limit, balance, terms, status) |
| Invoice entity | Modified | +ON_CREDIT to InvoiceStatus |
| sales.service.ts | Modified | create() sets ON_CREDIT; payment recording |
| customers.svc/ctrl | Modified | +stats, +credit/payment endpoints |
| PaymentRecord entity | New | Lightweight payment records table |
| DB migrations | New | 3 migrations (customer, invoice, payment_records) |
| Frontend models/svc | Modified | +credit fields, +ON_CREDIT, +API methods |
| CreditPortfolioOrganism | New | Portfolio section in customer detail |
| RecordPaymentFormMolecule | New | Payment recording dialog |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Invoice status breaks PAID-only filters | Med | Audit all `InvoiceStatus.PAID` references |
| Concurrent payment races | Low | TypeORM transaction + optimistic locking |
| Existing credit invoices show as owed | Low | Exclude from migration |
| Electronic + credit interaction | Low | Document boundary; emit DRAFT only |

## Rollback Plan

1. Migration `down()`: drop payment_records, remove customer columns, revert invoice enum
2. Revert all code (entity, service, controller, DTO, frontend)
3. Deploy. Export payment_records first if needed.

## Dependencies

- `payment_types` seed "Crédito" (code '2') already exists
- Existing specs: `customer-management`, `sales-manual-invoice`

## Assumptions

1. Soft credit limit: Warning only, not hard block
2. Partial payments: Invoice → PAID when sum >= total
3. Existing credit invoices: Treated as paid-in-full
4. Electronic boundary: Credit invoices emit DRAFT for Factus
5. No interest/dunning: Deferred

## Success Criteria

- [ ] Credit-payment invoice gets ON_CREDIT (not PAID)
- [ ] Customer detail shows portfolio: limit, balance, utilization %
- [ ] Payment recorded against ON_CREDIT invoice via detail page
- [ ] Invoice → PAID when recorded payments >= total
- [ ] UI shows soft warning when credit limit exceeded
- [ ] All PAID-only filters/queries remain correct
