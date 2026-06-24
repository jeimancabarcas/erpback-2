# Delta for credit-note-scenarios

## ADDED Requirements

### Requirement: Cumulative Amount Validation

The system MUST reject a credit note when `SUM(all existing credit note amounts for the same invoice) + new note amount > invoice.totalAmount`. Applies to ALL scenarios (A, B, C, D).

#### Scenario: 60% + 50% amount exceeds invoice total

- GIVEN invoice INV-001 has totalAmount $1000 and one existing credit note for $600
- WHEN a second credit note for $500 is created
- THEN the system returns `400 Bad Request`

#### Scenario: 60% + 40% amount within limit

- GIVEN invoice INV-001 has totalAmount $1000 and one existing credit note for $600
- WHEN a second credit note for $400 is created
- THEN the credit note is accepted

#### Scenario: Single 110% note also rejected

- GIVEN invoice INV-001 has totalAmount $1000 and no existing credit notes
- WHEN a single credit note for $1100 is created
- THEN the system returns `400 Bad Request`

### Requirement: Cumulative Quantity Validation per Product

The system MUST reject a credit note in scenarios A (partial return) and D (total annulment) when `SUM(all existing credit note item quantities per productId for the same invoice) + new note quantity > original invoice item quantity`. MUST NOT apply to scenarios B (discount) or C (price correction).

#### Scenario: Partial return after another return exceeds item quantity

- GIVEN invoice item P-001 has quantity 10 and an existing credit note returned 6 units of P-001
- WHEN a Scenario A credit note requests 5 more units of P-001
- THEN the system returns `400 Bad Request`

#### Scenario: Discount scenario bypasses quantity check

- GIVEN invoice item P-001 has quantity 10 and existing credit notes sum to 9 units returned via Scenario A
- WHEN a Scenario B (discount) credit note for P-001 with quantity 2 is created
- THEN the quantity check is skipped (amount validation still applies)

#### Scenario: Price correction with zero quantity passes

- GIVEN invoice item P-001 has quantity 10
- WHEN a Scenario C (price correction) credit note has quantity 0 for P-001
- THEN the quantity validation is skipped

### Requirement: Transactional Race Condition Guard

The cumulative sum queries MUST execute inside the same database transaction as the credit note creation to prevent concurrent requests from both validating against stale sums.

#### Scenario: Two concurrent 60%+ notes — only one succeeds

- GIVEN invoice INV-001 has totalAmount $1000 and zero existing credit notes
- WHEN two concurrent requests each attempt a $600 credit note
- THEN exactly one succeeds and the other returns `400 Bad Request`

## MODIFIED Requirements

*(No existing requirements modified. Cumulative validation is a new cross-cutting layer.)*
