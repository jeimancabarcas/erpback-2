# Inventory Reversal

## Purpose

Define `restoreStock()` — the FIFO reverse of `consumeStock()` — for credit note return scenarios (A, D).

## Requirements

### Requirement: restoreStock FIFO Method

`InventoryService` MUST expose a `restoreStock(productId, quantity, manager?)` method that reverses `consumeStock()` in FIFO order.

#### Scenario: Restore to most recently consumed batch first

- GIVEN product P-001 has batch B1 (remainingQty: 7) consumed 3 units, and batch B2 (remainingQty: 5) consumed 5 units
- WHEN `restoreStock(P-001, 4)` is called
- THEN batch B2 gets remainingQty += 4 → 9 (LIFO for restore within FIFO system)
- AND `product.currentStock` increases by 4
- AND `recalculateAveragePrice()` is called
- AND the method returns the total restored cost

#### Scenario: Restore across multiple batches

- GIVEN batch B1 consumed 2, batch B2 consumed 5
- WHEN `restoreStock(P-001, 3)` is called
- THEN 3 units are restored to batch B2 (most recent consumption)

### Requirement: Transactional Guarantee

`restoreStock()` MUST participate in the caller's transaction when `manager` is provided. If no manager, it MUST create its own transaction.

#### Scenario: Rollback on failure

- GIVEN `restoreStock()` runs inside a credit note transaction
- WHEN a subsequent save fails after restoreStock succeeds
- THEN the stock restoration is rolled back

### Requirement: Idempotency (No Double Restoration)

The system MUST NOT call `restoreStock()` more than once for the same credit note item. The note item's `restored` flag (or credit note idempotency key) SHALL prevent double-consumption.

#### Scenario: Prevent duplicate restore

- GIVEN a credit note item already has restored its stock
- WHEN the same note is processed again
- THEN `restoreStock()` is skipped
