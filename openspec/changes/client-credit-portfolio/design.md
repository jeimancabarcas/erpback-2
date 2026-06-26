# Design: Client Credit Portfolio

## Technical Approach

Hybrid: credit fields directly on Customer, `PaymentRecord` table for audit trail, `ON_CREDIT` in `InvoiceStatus` for state machine. Invoices with `paymentType = Crédito (code '2')` get `ON_CREDIT` instead of `PAID`. `currentBalance` on Customer is denormalized — updated atomically inside payment recording transactions. Soft limit warning only (no hard block). Existing credit invoices remain `PAID` (paid-in-full).

## Architecture Decisions

### Credit Fields — On Customer vs Separate Entity

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| Inline on Customer | Direct reads, no join, single profile per customer | **Chosen** |
| Separate `CustomerCredit` entity | Cleaner separation, versioned history possible | Rejects: unnecessary join overhead for reads |

### Payment Recording — Lightweight vs Full Module

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| `PaymentRecord` entity + balance update in TX | Audit trail, partial payments, atomic update | **Chosen** |
| Invoice-level status only | No audit, no partial payments | Rejects: no accounting trail |
| Full `CreditPayment` module | Over-engineered for current scope (no interest/dunning) | Rejects: deferred |

### Balance Strategy — Computed vs Denormalized

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| Denormalized `currentBalance` on Customer | Fast reads, needs atomic TX update | **Chosen** — zero consistency gap (same TX as payment) |
| Computed from invoices + payments live | Always consistent, expensive on every read | Rejects: slower reads, more joins |

## Data Flow

**Credit invoice creation**: `POST /invoices (paymentTypeId=Crédito)` → `SalesService.create()` checks `paymentType.code == '2'` → sets `status = ON_CREDIT` instead of `PAID` → persists invoice.

**Payment recording**: `POST /customers/:id/credit/payment {invoiceId, amount}` → TX: create `PaymentRecord` → decrement `Customer.currentBalance` → sum payments for invoice → if `sum >= invoice.totalAmount`, set invoice `status = PAID` → COMMIT.

**State machine**: `DRAFT → ON_CREDIT → PAID` (credit path), `DRAFT → PAID` (cash path). `CANCELLED` from any non-PAID state.

## InvoiceStatus.PAID Impact

| Location | Usage | Action |
|----------|-------|--------|
| `sales.service.ts:281` create() | Sets `status: PAID` | **Conditional**: use `ON_CREDIT` when `paymentType == Crédito` |
| `sales.service.ts:665,673` getFinancialStats() | Filters `WHERE status = PAID` | **No change**: ON_CREDIT invoices are unpaid, correctly excluded |
| `QueryInvoicesDto.ts:16` | `@IsEnum(InvoiceStatus)` | **No change**: auto-validates new value |
| Frontend sales-page component | Badge colors + filter dropdown | **Add**: `ON_CREDIT` badge style + filter option |
| Frontend invoice-detail-dialog | Status display | **Add**: `ON_CREDIT` display case |

## File Changes — Backend

| File | Action | Description |
|------|--------|-------------|
| `entities/customer.entity.ts` | Modify | Add `creditLimit`, `currentBalance`, `paymentTermsDays`, `creditStatus` (enum) |
| `entities/payment-record.entity.ts` | Create | `id`, `invoiceId` FK, `customerId` FK, `amount`, `paymentDate`, `notes` |
| `dto/customer-credit.dto.ts` | Create | `creditLimit`, `paymentTermsDays` |
| `dto/record-payment.dto.ts` | Create | `invoiceId`, `amount`, `notes?` |
| `dto/credit-portfolio-response.dto.ts` | Create | `creditLimit`, `currentBalance`, `availableCredit`, `utilizationPercent`, `creditStatus`, `paymentTermsDays` |
| `dto/payment-record.dto.ts` | Create | Response shape for payment records |
| `customers-credit.service.ts` | Create | `getCreditPortfolio()`, `setCreditLimit()`, `recordPayment()`, `getPaymentHistory()` |
| `customers.service.ts` | Modify | Extend `getStats()` with credit portfolio summary |
| `customers.controller.ts` | Modify | Add `PATCH :id/credit`, `GET :id/credit`, `POST :id/credit/payment`, `GET :id/credit/payments` |
| `customers.module.ts` | Modify | Register `PaymentRecord` entity, `CustomersCreditService` |
| `sales/entities/invoice.entity.ts` | Modify | Add `ON_CREDIT` to `InvoiceStatus` enum |
| `sales/sales.service.ts` | Modify | `create()` conditional status on `paymentType.code === '2'` |

## File Changes — Frontend

| File | Action | Description |
|------|--------|-------------|
| `models/customer.model.ts` | Modify | Add credit fields to `Customer`; add `CreditPortfolio`, `RecordPaymentDto`, `PaymentRecord` interfaces |
| `models/invoice.model.ts` | Modify | Add `ON_CREDIT` to `InvoiceStatus` type |
| `services/customer.service.ts` | Modify | Add `getCustomerCredit()`, `setCustomerCredit()`, `recordPayment()`, `getPaymentHistory()` |
| `organisms/credit-portfolio/` | Create | Portfolio display: limit, balance, utilization bar, credit status badge |
| `molecules/record-payment-form/` | Create | Payment form: invoice dropdown, amount, notes, validation |
| `organisms/payment-history-table/` | Create | Paginated payment records table |
| `pages/sales-customer-detail-page/` | Modify | Add credit portfolio section between stats molecule and invoices table |
| `organisms/invoice-detail-dialog/` | Modify | Add ON_CREDIT badge |
| `pages/sales-page/sales-page.component.ts` | Modify | Add ON_CREDIT filter + badge style |

## Interfaces / Contracts

```typescript
// Backend DTOs (mirrors existing class-validator pattern)
class CustomerCreditDto {
  @IsNumber() @Min(0) creditLimit: number;
  @IsNumber() @Min(1) @Max(365) paymentTermsDays: number;
}

class RecordPaymentDto {
  @IsUUID() invoiceId: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() notes?: string;
}

// Frontend types
type InvoiceStatus = 'DRAFT' | 'PAID' | 'CANCELLED' | 'ON_CREDIT';

interface CreditPortfolio {
  creditLimit: number;
  currentBalance: number;
  availableCredit: number;
  utilizationPercent: number;
  creditStatus: 'GOOD' | 'OVERDUE' | 'BLOCKED';
  paymentTermsDays: number;
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `CustomersCreditService` | Mock repos, test portfolio calc, payment recording, limit setting |
| Unit | `SalesService.create()` | Verify `ON_CREDIT` set when `paymentType.code = '2'` |
| Unit | Payment → PAID transition | Verify status flips when sum payments >= total |
| Unit | `getStats()` extension | Verify portfolio summary in response |
| Frontend | `CreditPortfolioOrganism` | Component test with mock data |
| Frontend | `RecordPaymentFormMolecule` | Validation + submission tests |

## Migration / Rollout

**Migration 1** — Customer columns: `credit_limit DECIMAL(12,2)`, `current_balance DECIMAL(12,2) DEFAULT 0`, `payment_terms_days INT DEFAULT 30`, `credit_status VARCHAR(10) DEFAULT 'GOOD'`.

**Migration 2** — Invoice enum: `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'ON_CREDIT'` (PostgreSQL).

**Migration 3** — `payment_records` table: `id UUID PK DEFAULT gen_random_uuid()`, `invoice_id UUID NOT NULL REFERENCES invoices(id)`, `customer_id UUID NOT NULL REFERENCES customers(id)`, `amount DECIMAL(12,2) NOT NULL`, `payment_date TIMESTAMP DEFAULT NOW()`, `notes TEXT`, `created_at TIMESTAMP`, `updated_at TIMESTAMP`. Indexes on `(customer_id, payment_date)` and `(invoice_id)`.

Existing credit invoices: no migration — remain PAID.

## Open Questions

None — scope, approach, and boundary decisions resolved in proposal.
