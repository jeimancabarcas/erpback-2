# Delta for Inventory Management

## ADDED Requirements

### Requirement: Movement Recording on Stock Mutations
All stock mutation points (`createProduct`, `updateProduct` with stock change, `updateStock`, `consumeStock`, `restoreStock`) MUST record an `InventoryMovement` row within the same transaction, referencing the Inventory Audit Trail capability.

#### Scenario: Product creation with initial stock
- GIVEN product creation with `currentStock > 0`
- WHEN the createProduct transaction commits
- THEN an InventoryMovement row exists with referenceType `INITIAL_STOCK`, type `In`, quantity equal to `currentStock`

#### Scenario: Stock increase adjustment
- GIVEN a product updated with higher `currentStock` (diff > 0)
- WHEN the updateProduct transaction commits
- THEN an InventoryMovement row exists with referenceType `MANUAL_ADJUSTMENT`, type `In`

#### Scenario: Stock decrease adjustment
- GIVEN a product updated with lower `currentStock` (diff < 0)
- WHEN the updateProduct transaction commits
- THEN an InventoryMovement row exists with referenceType `MANUAL_ADJUSTMENT`, type `Out`

#### Scenario: Purchase order stock-in
- GIVEN `updateStock()` called with `purchaseOrderId` and quantity N
- WHEN the transaction commits
- THEN an InventoryMovement row exists with referenceType `PURCHASE_ORDER`, type `In`, quantity N

#### Scenario: Sale consumption
- GIVEN `consumeStock()` called with quantity N from a sales invoice
- WHEN the transaction commits
- THEN an InventoryMovement row exists with referenceType `SALES_INVOICE`, type `Out`, quantity N

#### Scenario: Credit note restoration
- GIVEN `restoreStock()` called with quantity N from a credit note
- WHEN the transaction commits
- THEN an InventoryMovement row exists with referenceType `CREDIT_NOTE`, type `In`, quantity N

### Requirement: Movement Querying from Audit Table
The `getMovements()` endpoint MUST query the `InventoryMovement` table with DB-level filtering, sorting, and pagination, replacing the legacy 3-table in-memory aggregation. The API response shape (`PaginatedResult` with `data` and `meta`) MUST remain unchanged.

#### Scenario: Query all movements
- GIVEN existing InventoryMovement rows
- WHEN `getMovements()` is called without filters
- THEN all movements are returned with DB-level pagination and sorting

#### Scenario: Filter by type
- GIVEN movements with type `In` and `Out`
- WHEN `getMovements({ type: 'In' })` is called
- THEN only rows with type `In` are returned (DB WHERE clause)

#### Scenario: Filter by user
- GIVEN movements from multiple users
- WHEN `getMovements({ userId: 'abc' })` is called
- THEN only rows with `userId = 'abc'` are returned (DB WHERE clause)

#### Scenario: Pagination with page and limit
- GIVEN 100 movements in the table
- WHEN `getMovements({ page: 2, limit: 10 })` is called
- THEN movements 11-20 are returned with `total: 100`, `lastPage: 10`, `page: 2`

#### Scenario: Sorting by date descending
- GIVEN movements from different dates
- WHEN `getMovements({ sortBy: 'date', order: 'DESC' })` is called
- THEN movements are ordered by date descending (DB ORDER BY)

### Requirement: Backward Compatibility During Transition
The system MUST support a feature flag (`USE_AUDIT_TABLE`) that controls whether `getMovements()` reads from the new `InventoryMovement` table or falls back to legacy 3-table aggregation. The flag defaults to `false` and is removed after validation.

#### Scenario: Legacy fallback with flag off
- GIVEN `USE_AUDIT_TABLE = false`
- WHEN `getMovements()` is called
- THEN the legacy 3-table aggregation path is used

#### Scenario: New table with flag on
- GIVEN `USE_AUDIT_TABLE = true`
- WHEN `getMovements()` is called
- THEN the new `InventoryMovement` table is queried directly

## REMOVED Requirements

### Requirement: In-Memory 3-Table Aggregation
(Reason: Replaced by dedicated `InventoryMovement` table with DB-level querying. Legacy code kept behind feature flag, then removed after validation.)
(Migration: `getMovements()` reads from `InventoryMovement` table instead of merging `InventoryBatch`, `InvoiceItem`, and `CreditNoteItem` in memory.)
