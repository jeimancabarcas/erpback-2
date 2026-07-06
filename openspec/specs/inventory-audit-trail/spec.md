# Inventory Audit Trail Specification

## Purpose
Dedicated audit trail for inventory movements recorded at mutation time, replacing on-the-fly 3-table aggregation from InventoryBatch, InvoiceItem, and CreditNoteItem.

## Requirements

### Requirement: Movement Schema
The system SHALL persist `InventoryMovement` rows capturing: timestamp, actor (userId), productId, quantity, type (In/Out), referenceType enum, referenceId, origin, destination.

#### Scenario: Record stock-in movement
- GIVEN a stock increase mutation (purchase, credit note return, manual increase)
- WHEN the transaction commits
- THEN an `InventoryMovement` row exists with type `In` and matching referenceType

#### Scenario: Record stock-out movement
- GIVEN a stock decrease mutation (sale, manual decrease)
- WHEN the transaction commits
- THEN an `InventoryMovement` row exists with type `Out` and matching referenceType

### Requirement: Mutation-Point Recording
The system MUST record an `InventoryMovement` row within the same transaction as each of the 5 stock mutation points.

| Mutation | referenceType | type |
|---|---|---|
| createProduct (currentStock > 0) | INITIAL_STOCK | In |
| updateStock (with purchaseOrderId) | PURCHASE_ORDER | In |
| consumeStock (sales invoice) | SALES_INVOICE | Out |
| restoreStock (credit note return) | CREDIT_NOTE | In |
| updateProduct (stock increase) | MANUAL_ADJUSTMENT | In |
| updateProduct (stock decrease) | MANUAL_ADJUSTMENT | Out |

#### Scenario: Rollback consistency
- GIVEN a mutation that creates an InventoryMovement
- WHEN the transaction fails and rolls back
- THEN neither the stock change nor the movement persists

### Requirement: Reference Type Enum
The `referenceType` column SHALL be restricted to: `PURCHASE_ORDER`, `SALES_INVOICE`, `CREDIT_NOTE`, `MANUAL_ADJUSTMENT`, `INITIAL_STOCK`.

#### Scenario: Invalid reference type rejected
- GIVEN a movement with an invalid referenceType value
- WHEN the insert is attempted
- THEN the system MUST reject the operation at the database level

### Requirement: Historical Backfill
The system MUST provide a TypeORM migration that backfills `InventoryMovement` rows from existing `InventoryBatch`, `InvoiceItem`, and `CreditNoteItem` data.

#### Scenario: Backfill batch purchase movements
- GIVEN `InventoryBatch` rows with a `purchaseOrderId`
- WHEN the backfill migration runs
- THEN matching `InventoryMovement` rows are created with referenceType `PURCHASE_ORDER`, type `In`

#### Scenario: Backfill manual adjustment movements
- GIVEN `InventoryBatch` rows without a `purchaseOrderId`
- WHEN the backfill migration runs
- THEN matching `InventoryMovement` rows are created with referenceType `MANUAL_ADJUSTMENT`

#### Scenario: Backfill invoice out movements
- GIVEN existing `InvoiceItem` rows
- WHEN the backfill migration runs
- THEN matching `InventoryMovement` rows are created with referenceType `SALES_INVOICE`, type `Out`

#### Scenario: Backfill credit note return movements
- GIVEN `CreditNoteItem` rows with `restored = true`
- WHEN the backfill migration runs
- THEN matching `InventoryMovement` rows are created with referenceType `CREDIT_NOTE`, type `In`

### Requirement: API Contract Preservation
The backfilled and newly recorded movements MUST match the existing `getMovements()` response shape for product name, quantity, date, type, origin, destination, and operator fields.

#### Scenario: Response compatibility
- GIVEN backfilled movements from old data
- WHEN queried via `getMovements()`
- THEN the response contains the same fields as the legacy aggregation (product name, quantity, date, type, origin, destination, operator)
