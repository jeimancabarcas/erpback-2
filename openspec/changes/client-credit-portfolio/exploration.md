## Exploration: Client Credit Portfolio

### Current State

The system currently has **no customer credit tracking**. Here's what exists today:

**Payment Types (Settings)**:
The `payment_types` table already has a seed record for `Crédito` (code `'2'`, name `'Crédito'`, description `'Pago a crédito/plazo'`). The `Invoice` entity already has a `paymentTypeId` FK to this table, and invoices can already be categorized as "credit" at creation time via `CreateInvoiceDto.paymentTypeId`.

**Invoice Status (Current)**:
`InvoiceStatus` enum is limited to `DRAFT | PAID | CANCELLED`. There is **no** `PENDING` or `ON_CREDIT` status. When an invoice is created with `paymentTypeId` referencing "Crédito", it is still immediately marked as `PAID` in `sales.service.ts` line 281: `status: InvoiceStatus.PAID`.

**Customer Entity**:
No credit-related fields exist. The `Customer` entity has only: id, name, email, documentType, documentNumber, status (ACTIVE/INACTIVE), phone, address, createdAt, updatedAt.

**Customer Stats** (`customers.service.ts` `getStats()`):
Currently returns `{ customer, totalInvoiced, invoiceCount }` — no pending balance, no credit limit, no payment terms. It aggregates across ALL invoices regardless of payment type or status.

**Finance Module**:
The existing `FinanceModule` is **only** a Factus query gateway — it fetches bills and credit notes from the DIAN electronic invoicing API. It has no relation to internal customer credit management.

**Frontend Customer Detail**:
The `SalesCustomerDetailPageComponent` shows:
- Left column: `CustomerInfoMolecule` (entity data) + `CustomerStatsMolecule` (totalBilled, invoiceCount)
- Right column: `CustomerInvoicesTableOrganism` (invoice history with pagination)
No credit portfolio section exists.

**Frontend Invoice Model** (`invoice.model.ts`):
The `Invoice` interface has `paymentMethodId` and `paymentTypeId` in `CreateInvoiceDto` but the `Invoice` response interface does NOT expose `paymentMethodId`, `paymentTypeId`, or the resolved `paymentMethod`/`paymentType` objects. The `Invoice` model needs these fields added for credit portfolio display.

### Affected Areas

**Backend**:
- `src/modules/customers/entities/customer.entity.ts` — Add credit fields: creditLimit, currentBalance, paymentTerms, creditStatus (e.g., GOOD/OVERDUE/BLOCKED)
- `src/modules/customers/customers.service.ts` — Extend `getStats()` to include credit portfolio data (pending balance, overdue amount, credit utilization); add methods for credit management (set credit limit, record payment, update balance)
- `src/modules/customers/customers.controller.ts` — Add endpoints: `GET /customers/:id/credit` for portfolio, `POST /customers/:id/credit/payment` for payment recording, `PATCH /customers/:id/credit` for credit limit changes
- `src/modules/customers/customers.module.ts` — May need to import additional modules if payment recording logic requires transaction support
- `src/modules/sales/entities/invoice.entity.ts` — Add new status `PENDING` or `ON_CREDIT` to `InvoiceStatus` enum
- `src/modules/sales/sales.service.ts` — Modify `create()` to conditionally set `PENDING` status when `paymentTypeId` is "Crédito" (code '2'); add payment recording logic that transitions from PENDING → PAID
- `src/modules/settings/entities/payment-method.entity.ts` / `payment-type.entity.ts` — Unchanged (already have credit concept)
- `src/modules/customers/dto/` — New DTOs for credit operations: `CustomerCreditDto`, `RecordPaymentDto`

**Frontend**:
- `src/app/models/customer.model.ts` — Add credit fields to `Customer` interface; add `CustomerCreditPortfolio` interface; extend `CustomerStats` interface
- `src/app/models/invoice.model.ts` — Add `PENDING` to `InvoiceStatus` type; add `paymentType` and `paymentMethod` fields to `Invoice` response interface
- `src/app/services/customer.service.ts` — Add methods: `getCustomerCredit()`, `recordPayment()`, `updateCreditLimit()`
- `src/app/components/pages/sales-page/sales-customer-detail-page/sales-customer-detail-page.component.ts` — Add credit portfolio section in the template
- `src/app/components/molecules/customer-stats/customer-stats.component.ts` — Extend to show pending balance alongside totalBilled
- New molecule/organism: `CustomerCreditPortfolioMolecule` or `CustomerCreditPortfolioOrganism` to display credit status, limit, current balance, overdue amount, payment history
- New molecule: `RecordPaymentFormMolecule` or dialog for recording payments against credit invoices

**Database**:
- New migration for `customers` table: add `credit_limit`, `current_balance`, `payment_terms_days`, `credit_status` columns
- New migration for `invoices` table: add new enum value `PENDING` to `InvoiceStatus` (or add `ON_CREDIT`)

### Approaches

1. **Lightweight: Customer Fields Only on Customer Entity**
   Add credit fields directly to the `Customer` entity (creditLimit, currentBalance, overdueBalance, lastPaymentDate). Change invoice creation to set `PENDING` status when `paymentTypeId = Crédito`. Extend `getStats()` to compute credit portfolio. Frontend shows the data in the customer detail page inline (no new entity).
   - Pros: Minimal new code, no new tables, reuses existing invoice infrastructure, fastest path
   - Cons: No audit trail for credit changes, no payment tracking per invoice, credit history is derived live from invoices
   - Effort: Low

2. **Full Credit Portfolio Module with Payments Entity**
   Add a `CreditPayment` entity for recording individual payments against credit invoices. Add `CustomerCredit` entity for tracking credit limit per customer with history. Invoices with credit payment type get `PENDING` status and transition to `PAID` when payments sum to total. Customer detail shows payment schedule and aging.
   - Pros: Complete audit trail, supports partial payments, supports late payment tracking, proper accounting
   - Cons: More entities, more endpoints, more frontend work, more tests
   - Effort: Medium/High

3. **Hybrid: Customer Fields + Invoice Status Change + Simple Payment Tracking**
   Add credit fields to `Customer` (creditLimit, currentBalance). Add `PENDING` to `InvoiceStatus`. Extend `getStats()` to compute pending balance. Record payments as a transaction that creates a payment record and updates invoice status + customer balance. Use a lightweight `Payment` entity (not full CreditPayment module) with invoiceId, amount, date.
   - Pros: Balance of simplicity and audit trail, payment recording is structured, extends naturally from existing code
   - Cons: Still requires new entity and migration, some new frontend components
   - Effort: Medium

### Recommendation

**Approach 3 (Hybrid)** — It's the sweet spot. The system already has `paymentTypeId` on invoices and "Crédito" seeded in `payment_types`. The missing pieces are:
1. A `PENDING` / `ON_CREDIT` status in `InvoiceStatus` so credit invoices aren't immediately marked `PAID`
2. Credit fields on `Customer` for limit and balance tracking
3. A lightweight payment recording mechanism
4. Frontend display on the customer detail page

This reuses the existing invoice infrastructure, adds verifiable audit data through a simple payment record, and avoids over-engineering with a full credit module. The approach is aligned with how the system already handles invoices — the main change is adding a new status transition flow (DRAFT → ON_CREDIT → PAID).

### Risks

- **Invoice Status Change Ripple**: Adding `ON_CREDIT` to `InvoiceStatus` affects the sales service `create()` method (currently hardcodes `PAID`), the financial stats query (filters by `PAID`), and potentially the `QueryInvoicesDto` enum validation. All callers that filter by `PAID` need review.
- **Edge Cases with Electronic Invoices**: Electronic invoices (Factus) require immediate payment form/method codes. If a credit invoice is electronic, the Factus payload needs special handling — the `paymentForm` should map to credit (`'2'`) and a `dueDate` should be provided.
- **Credit Limit Enforcement**: Should the system block invoice creation when credit limit is exceeded? If yes, this adds validation in the `create()` flow. If no (just warning), the UX needs to reflect soft enforcement.
- **Existing Credit Invoices**: Invoices already created with `paymentType = Crédito` but status `PAID` will need data migration or the credit portfolio should treat them as paid-in-full (no balance due).
- **Concurrent Payment Recording**: If partial payments are allowed, concurrent payment recording against the same invoice needs transaction-level protection.

### Ready for Proposal

Yes — the exploration is complete. The orchestrator can proceed to `sdd-propose` with the following key decisions for the user:
1. Confirm Approach 3 (Hybrid)
2. Decide on credit limit enforcement (hard block or soft warning)
3. Decide on partial payments support (yes/no)
4. Decide what happens to existing credit invoices (migrate or exclude)
5. Confirm electronic invoice + credit interaction
