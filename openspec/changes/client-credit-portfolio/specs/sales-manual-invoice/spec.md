# Delta for sales-manual-invoice

## ADDED Requirements

### Requirement: ON_CREDIT Invoice Status

The `InvoiceStatus` enum MUST include `ON_CREDIT` as a valid value alongside `DRAFT`, `PAID`, and `CANCELLED`.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Enum value exists | The InvoiceStatus enum is loaded | A developer inspects its values | ON_CREDIT is present |
| Database migration | The invoices table uses an enum type | Migration up executes | ON_CREDIT is added to the database enum type without data loss |
| Migration rollback | The invoices table has ON_CREDIT values | Migration down executes | The enum reverts cleanly, existing rows with ON_CREDIT are handled |

### Requirement: Credit Payment Sets ON_CREDIT Status

When `SalesService.create()` receives `paymentTypeId = '2'` (Crédito), the invoice MUST be persisted with status `ON_CREDIT` instead of `PAID`. This MUST apply regardless of the `isElectronic` flag.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Credit invoice is ON_CREDIT | Customer and products exist, paymentTypeId='2' | Invoice is created via SalesService.create() | Invoice.status is ON_CREDIT, not PAID |
| Cash invoice still PAID | Customer and products exist, paymentTypeId='1' (Efectivo) | Invoice is created via SalesService.create() | Invoice.status is PAID |
| Manual credit invoice | isElectronic=false AND paymentTypeId='2' | Invoice is created | Invoice.status is ON_CREDIT, Factus submission is skipped |
| Electronic credit invoice | isElectronic=true AND paymentTypeId='2' | Invoice is created | Invoice.status is ON_CREDIT, Factus submission proceeds normally |

### Requirement: Payment Transitions ON_CREDIT to PAID

An invoice with status `ON_CREDIT` MUST transition to `PAID` when the sum of all recorded `PaymentRecord.amount` entries equals or exceeds the invoice's `totalAmount`. The transition MUST occur atomically within the payment recording transaction.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Full payment transitions | ON_CREDIT invoice total=1000000, no prior payments | POST payment of 1000000 | Invoice.status becomes PAID |
| Full payment via accumulation | ON_CREDIT invoice total=1000000, prior payments=600000 | POST payment of 400000 | Invoice.status becomes PAID |
| Partial payment stays ON_CREDIT | ON_CREDIT invoice total=1000000, prior payments=300000 | POST payment of 200000 | Invoice.status stays ON_CREDIT, PaymentRecord saved |

### Requirement: PAID Filter Audit

All queries that filter or aggregate by `InvoiceStatus.PAID` MUST also account for `InvoiceStatus.ON_CREDIT` when the intent is to capture completed, active, or billed credit transactions. Each query's context determines whether ON_CREDIT should be included or excluded.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Stats include ON_CREDIT | Customer has one PAID and one ON_CREDIT invoice | GET /customers/:id/stats | Both invoices counted in totalInvoiced and invoiceCount |
| List filter excludes ON_CREDIT by default | User queries invoice list without status filter | GET /sales/invoices | Both PAID and ON_CREDIT invoices appear in results |
