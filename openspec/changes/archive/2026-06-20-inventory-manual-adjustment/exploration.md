## Exploration: inventory-manual-adjustment

### Current State
1. **Frontend:**
   - **Catalog Page:** `inventory-products-page.component.ts` displays the product list and contains the trigger `openProductDialog(product)` to open the edit modal.
   - **Dialog Form:** `product-form.component.ts` (ProductFormMolecule) binds the product fields (including `currentStock` as a direct input) to the template form. Upon submission, it calls `ProductService.updateProduct(id, payload)` sending the whole object, including the updated `currentStock`.
   - **Movement History:** `inventory-page.component.ts` displays the historical list of movements in `MovementsTableMolecule`, which loads movements by calling `InventoryService.loadMovements()` from the endpoint `/inventory/movements`.
2. **Backend:**
   - **Endpoint:** `PATCH /inventory/products/:id` is mapped to `InventoryController.updateProduct`.
   - **Update Logic:** `InventoryService.updateProduct` fetches the product, overrides the columns with values from `UpdateProductDto` (which includes `currentStock`), and saves the entity. It does not perform any calculations or create logs.
   - **Calculations & Batches:** Stock is managed using FIFO batches in `InventoryBatch` (via `updateStock` for purchases and `consumeStock` for sales). However, manual updates to `currentStock` bypass these methods entirely, leading to batch-stock mismatch.
   - **Movements Compilation:** There is no movements table. `InventoryService.getMovements()` compiles movements dynamically in memory:
     - `In` movements are mapped from `InventoryBatch` records (if `purchaseOrderId` is null, the origin is `'Ajuste de Inventario'`).
     - `Out` movements are mapped from `InvoiceItem` records (sales invoices).
     - There is currently no representation for negative manual stock adjustments in the compiled movements.

### Affected Areas
- **Backend Service:** `erpbackend/src/modules/inventory/inventory.service.ts`
  - Modify `updateProduct()` to check for `currentStock` differences, perform adjustment calculations, and invoke appropriate batch logic.
  - Modify `createProduct()` to generate an initial batch if a product is created with an initial stock (fixing a pre-existing bug).
  - Modify `getMovements()` to compile negative manual adjustments correctly.
- **Frontend Dialog Component:** `erpfrontend/src/app/components/molecules/product-form/product-form.component.ts`
  - Sends the modified `currentStock` to the backend. The frontend does not need visual changes unless a reason/cost for adjustment is required, which isn't specified.

### Approaches
1. **Approach A: Introduce a Dedicated `InventoryMovement` Entity & Table**
   - *Description*: Create a new table `InventoryMovement` to store all stock changes (In, Out, Adjustments). Refactor sales, purchase-orders, and product updates to write to this table, and query it directly in `getMovements()`.
   - *Pros*: Standard clean database design; provides a central audit log.
   - *Cons*: High effort; requires refactoring multiple modules; existing data won't have movements without backfill migrations.
   - *Effort*: High

2. **Approach B: Reuse `InventoryBatch` for Manual Adjustments (FIFO-Aligned, Dynamic Compilation)**
   - *Description*:
     - In `updateProduct()`, calculate `diff = newStock - oldStock`.
     - If `diff > 0`: Create a new `InventoryBatch` with `initialQuantity = diff`, `remainingQuantity = diff`, `purchasePrice = product.averagePurchasePrice`, and `purchaseOrderId = null`.
     - If `diff < 0`: Call `consumeStock(product.id, Math.abs(diff))` (consuming FIFO-style) and create a tracking `InventoryBatch` with `initialQuantity = diff` (negative) and `remainingQuantity = 0` (so it isn't consumed).
     - In `getMovements()`, map batches with `initialQuantity < 0` to `Out` movements with origin `'Almacén Principal'` and destination `'Ajuste de Inventario'`.
   - *Pros*: Medium effort; zero database migrations/schema changes; completely localized to the inventory backend service; keeps FIFO cost and average price recalculations fully accurate.
   - *Cons*: Storing a negative `initialQuantity` in `InventoryBatch` is a semantic stretch, though technically supported.
   - *Effort*: Medium

3. **Approach C: Create a Separate `StockAdjustment` Table and Compile in `getMovements`**
   - *Description*: Create a dedicated `StockAdjustment` table for manual updates. Modify `getMovements()` to dynamically fetch and union records from `InventoryBatch`, `InvoiceItem`, and `StockAdjustment`.
   - *Pros*: Keeps adjustments separate; avoids negative quantities in `InventoryBatch`.
   - *Cons*: Requires database migrations; requires merging and sorting three different datasets in memory.
   - *Effort*: Medium

### Recommendation
**Approach B** is recommended. It is highly cohesive as all changes are contained within the `inventory` module. It maintains the current architecture where movements are dynamically compiled from source tables, avoiding the need for heavy migrations and refactoring in other modules (like sales and purchase-orders). It correctly implements the FIFO stock consumption for negative adjustments and updates the product's average cost seamlessly.

### Risks
- **Initial Stock Gotcha**: Currently, creating a product with an initial stock (`createProduct`) does not register a batch. If not fixed, consuming stock from a manually initialized product will fail due to "insufficient stock" in batches. We should fix this during implementation.
- **Concurrency**: Direct manual stock adjustments could conflict with concurrent sales or purchases. We should run the adjustment logic inside a database transaction with appropriate row locking if possible.

### Ready for Proposal
Yes. The next step is to create the formal proposal (`propose` phase) mapping these details.
