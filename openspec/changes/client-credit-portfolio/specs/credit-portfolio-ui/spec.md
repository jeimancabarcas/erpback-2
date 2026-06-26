# Credit Portfolio UI Specification

## Purpose

Define the frontend components and user interactions for displaying and managing the customer credit portfolio on the customer detail page. This domain covers the UI layer only — all data originates from the backend customer credit endpoints.

## Requirements

### Requirement: Credit Portfolio Section

The customer detail page MUST display a credit portfolio section positioned between the customer stats and the invoice history table. The section MUST show creditLimit, currentBalance, availableCredit, utilizationPercentage, and creditStatus.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Section renders with data | Customer detail page loads, API returns credit portfolio | The page renders | Section displays limit, balance, available amount, utilization %, and status badge |
| No credit limit assigned | Customer has no creditLimit | The page renders | Section shows "No credit limit assigned" or a similar neutral state |
| Utilization at 100% | Customer balance equals creditLimit | The page renders | Utilization percentage shows 100% |

### Requirement: Record Payment Interface

The customer detail page MUST provide a "Record Payment" action that opens a form/dialog to record a payment against the customer's credit balance. The form MUST include an amount field and MAY include a notes field.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Payment dialog opens | Credit portfolio section is visible | User clicks "Record Payment" | A form appears with an amount field |
| Payment submitted | Form has a valid positive amount | User submits the form | POST to /customers/:id/credit/payment succeeds, portfolio refreshes with updated balance |
| Validation error | Form has an amount exceeding the balance | User submits the form | Error message displayed, balance unchanged |

### Requirement: Credit Limit Warning

The UI MUST display a soft warning banner when the customer's `currentBalance` exceeds their `creditLimit`.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| Warning on exceed | Customer balance=6000000, limit=5000000 | Detail page loads | An amber warning banner is visible above the credit portfolio section |
| No warning when healthy | Customer balance=3000000, limit=5000000 | Detail page loads | No warning banner is shown |
| Warning disappears after payment | Warning visible, then a payment reduces balance below limit | Portfolio refreshes after payment | Warning banner is no longer rendered |

### Requirement: Invoice Credit Status

Invoices with status ON_CREDIT MUST display a distinguishable visual indicator (e.g., a badge or chip) in the invoice history list, different from PAID and CANCELLED.

| Scenario | GIVEN | WHEN | THEN |
|---|---|---|---|
| ON_CREDIT badge visible | Invoice list includes an ON_CREDIT invoice | The list renders | The invoice shows a distinct "ON CREDIT" badge or status indicator |
| No badge for PAID | Invoice list includes a PAID invoice | The list renders | PAID invoice shows its usual PAID indicator, not the ON_CREDIT badge |
