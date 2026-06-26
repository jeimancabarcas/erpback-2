# Delta for customer-management

## ADDED Requirements

### Requirement: Customer Credit Fields

The Customer entity MUST include `creditLimit` (decimal, nullable), `currentBalance` (decimal, default 0), `paymentTermsDays` (integer, default 30), and `creditStatus` (enum GOOD|OVERDUE|BLOCKED, default GOOD).

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Default credit values | A new customer is created without credit data | The record is persisted | creditLimit=null, currentBalance=0, paymentTermsDays=30, creditStatus=GOOD |
| Credit limit assigned | An existing customer | PATCH updates creditLimit to 5000000 | The customer's creditLimit becomes 5000000 |
| Credit limit cleared | Customer with creditLimit 5000000 | PATCH sends creditLimit: null | The customer's creditLimit becomes null |

### Requirement: Credit Portfolio Query

`GET /customers/:id/credit` MUST return creditLimit, currentBalance, availableCredit (creditLimit − currentBalance), utilizationPercentage, and creditStatus.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Full portfolio returned | Customer with limit 5000000, balance 1000000, status GOOD | GET /customers/:id/credit | Response includes limit=5000000, balance=1000000, available=4000000, utilization=20%, status=GOOD |
| BLOCKED status shown | Customer has creditStatus=BLOCKED | GET /customers/:id/credit | Response includes creditStatus "BLOCKED" |
| No limit assigned | Customer with creditLimit=null | GET /customers/:id/credit | Response includes creditLimit=null, availableCredit=null, utilizationPercentage=null |

### Requirement: Credit Limit Management

`PATCH /customers/:id/credit` MUST accept `{ creditLimit: number | null }` and update the customer's credit limit. Non-numeric values MUST be rejected.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Limit updated | Customer with creditLimit 3000000 | PATCH /customers/:id/credit `{ creditLimit: 5000000 }` | creditLimit becomes 5000000 |
| Limit cleared | Customer with creditLimit 5000000 | PATCH /customers/:id/credit `{ creditLimit: null }` | creditLimit becomes null |
| Invalid value rejected | Customer with creditLimit 3000000 | PATCH /customers/:id/credit `{ creditLimit: "not-a-number" }` | 400 error returned |

### Requirement: Payment Recording

`POST /customers/:id/credit/payment` MUST create a `PaymentRecord` and reduce the customer's `currentBalance` by the payment amount. Partial payments are allowed. Payment amount MUST be positive and MUST NOT exceed `currentBalance`.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Payment reduces balance | Customer with balance 2000000 | POST payment of 500000 | PaymentRecord created, balance becomes 1500000 |
| Overpayment rejected | Customer with balance 500000 | POST payment of 1000000 | 400 error, balance unchanged |
| Partial payment accepted | Customer with balance 1000000 and invoice total 1200000 | POST payment of 500000 | PaymentRecord created, invoice stays ON_CREDIT |

### Requirement: Extended Customer Stats

`GET /customers/:id/stats` MUST include `creditLimit`, `currentBalance`, and `creditStatus` alongside existing `totalInvoiced` and `invoiceCount`.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Credit fields in stats | Customer with limit 5000000, balance 1000000, status GOOD | GET /customers/:id/stats | Response contains creditLimit, currentBalance, creditStatus, totalInvoiced, and invoiceCount |
| Stats aggregate correctly | Customer has PAID invoice (1M) and ON_CREDIT invoice (500K) | GET /customers/:id/stats | totalInvoiced=1500000, invoiceCount=2 |
