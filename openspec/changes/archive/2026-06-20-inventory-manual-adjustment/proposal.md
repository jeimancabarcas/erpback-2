# Proposal: Manual Inventory Adjustment

## Intent

Resolve stock mismatches between physical inventory and the FIFO batch tracking by enabling manual stock adjustments that update total stock, consume/create FIFO batches, log reasons, and reflect correctly in movement history.

## Scope

### In Scope
- Capture and send optional `adjustmentReason` from frontend when stock changes in edit mode.
- Add optional `adjustmentReason` to backend update product DTO.
- Add nullable `adjustmentReason` to `InventoryBatch` entity.
- Create initial FIFO batch when creating a product with initial stock (fixing the "Initial Stock Gotcha").
- Calculate stock differences in `updateProduct()`:
  - **Positive diff**: Create new batch at product's average purchase price.
  - **Negative diff**: Validate batch stock capacity (never go negative), consume FIFO batches, and record negative tracking batch.
- Include adjustments in compiled movements (origin and destination as `'Ajuste de inventario'`).

### Out of Scope
- Multi-warehouse inventory support.
- Automatic stock-taking or barcode integrations.

## Capabilities

### New Capabilities
- `inventory-manual-adjustment`: Register, validate, and log manual stock adjustments with reason and average cost.

### Modified Capabilities
- `inventory-management`: Update product stock via FIFO, recalculate average cost, fix initial batch registration.

## Approach

1. **Database Schema**: Add `adjustmentReason` column (nullable string) to `InventoryBatch` table.
2. **Product Creation**: In `createProduct()`, if `currentStock > 0`, create a batch with `purchasePrice = 0` (or `sellingPrice`), `initialQuantity = currentStock`, and `adjustmentReason = 'Stock Inicial'`.
3. **Product Update**: In `updateProduct()`:
   - Compute `diff = newStock - oldStock`.
   - If `diff > 0`: Create new batch with `initialQuantity = diff`, `remainingQuantity = diff`, `purchasePrice = averagePurchasePrice`, and `adjustmentReason = reason`.
   - If `diff < 0`: Verify total batch stock >= `abs(diff)`. Consume FIFO-style, and save a tracking batch with `initialQuantity = diff` (negative value), `remainingQuantity = 0`, `purchasePrice = averagePurchasePrice`, and `adjustmentReason = reason`.
   - Recalculate average purchase price.
4. **Movements**: In `getMovements()`:
   - Map negative batches as `Out` movements.
   - Map positive manual adjustment batches as `In` movements.
   - Set both `origin` and `destination` to `'Ajuste de inventario'` for manual adjustments.
5. **Frontend**: Track `originalStock` on init. If changed in edit mode, show a required field for `adjustmentReason` and pass it in payload.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `erpfrontend/.../product-form.component.ts` | Modified | Capture `adjustmentReason` when `currentStock` changes and send in payload. |
| `erpbackend/.../inventory-batch.entity.ts` | Modified | Add `adjustmentReason` column. |
| `erpbackend/.../update-product.dto.ts` | Modified | Add optional `adjustmentReason`. |
| `erpbackend/.../inventory.service.ts` | Modified | Implement initial batch, diff calculation, FIFO consumption, and movements integration. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Concurrency anomalies | Medium | Run adjustments inside a database transaction with optimistic locking on Product. |
| Negative batch stock | Low | Validate batch stock capacity before executing negative adjustments. |

## Rollback Plan

- Revert frontend and backend Git commits.
- Run database migration down to drop `adjustmentReason` from `inventory_batches`.

## Dependencies

- None

## Success Criteria

- [ ] Creating product with stock creates an initial batch.
- [ ] Positive adjustments create a batch at average cost with reason.
- [ ] Negative adjustments consume FIFO batches, create negative tracking batch with reason, and fail if insufficient stock.
- [ ] Movements list manual adjustments with origin/destination = `'Ajuste de inventario'`.
