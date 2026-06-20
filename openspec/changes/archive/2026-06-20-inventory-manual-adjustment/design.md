# Design: Manual Inventory Adjustment

## Technical Approach

Introduce manual inventory adjustments by allowing the frontend to send an `adjustmentReason` when modifying stock values. The backend will execute the adjustment within a database transaction, comparing the new and old stock values, and applying FIFO consumption for negative adjustments or creating new costed batches for positive adjustments. Compiled movements will dynamically show manual adjustments as origin and destination `'Ajuste de inventario'`.

## Architecture Decisions

### Decision: Schema Update for InventoryBatch

* **Choice**: Add a nullable `adjustmentReason` (TEXT/varchar) column to the `inventory_batches` table.
* **Alternatives considered**: Creating a separate `inventory_adjustments` audit table.
* **Rationale**: Storing the reason directly on the batch ensures traceability of the specific FIFO adjustment without adding database joins, simplifying dynamic movement compilation.

### Decision: Concurrency Control during Adjustments

* **Choice**: Wrap the adjustment in a transaction using `pessimistic_write` lock on the `Product` entity.
* **Alternatives considered**: Optimistic locking via `@VersionColumn`.
* **Rationale**: Product entities currently lack a version column. A pessimistic write lock prevents concurrent requests from double-spending batches or generating racing stock recalculations during the FIFO consumption loop.

### Decision: Negative Adjustment Stock Representation

* **Choice**: Save a tracking batch in the database with negative `initialQuantity` (`-diff`), `remainingQuantity = 0`, and `adjustmentReason`.
* **Alternatives considered**: Only updating the remaining stock of existing batches without saving a negative batch.
* **Rationale**: Saving a negative batch with `remainingQuantity = 0` provides an audit log of the adjustment event, facilitating the dynamic compilation of negative movements.

---

## Data Flow

```
[Frontend Form] ──(currentStock, adjustmentReason)──→ [InventoryController.updateProduct]
                                                                  │
                                                          (Transaction Start)
                                                                  │
                                                        [Get Product with Lock]
                                                                  │
                                                          Calculate Diff
                                                             /      \
                                                           /          \
                                                     (diff > 0)     (diff < 0)
                                                         /              \
                                          [Create Positive Batch]   [Validate Stock]
                                        [price = avgPurchasePrice]        │
                                                         \          [consumeStock FIFO]
                                                          \         [Create Negative Batch]
                                                           \              /
                                                            \            /
                                                    [Recalculate Average Price]
                                                                  │
                                                         [Save Product/Batch]
                                                                  │
                                                           (Transaction Commit)
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `erpbackend/src/modules/inventory/entities/inventory-batch.entity.ts` | Modify | Add nullable `adjustmentReason: string` column. |
| `erpbackend/src/modules/inventory/dto/update-product.dto.ts` | Modify | Add optional validation fields for `adjustmentReason`. |
| `erpbackend/src/modules/inventory/inventory.service.ts` | Modify | Implement transactional adjustments in `updateProduct()`, fix `createProduct()` initial stock batch creation, and update `getMovements()` compilation. |
| `erpfrontend/src/app/models/product.model.ts` | Modify | Update `UpdateProductDto` to include `adjustmentReason`. |
| `erpfrontend/src/app/components/molecules/product-form/product-form.component.ts` | Modify | Track `originalStock` on init, render mandatory reason input when stock changes, block submission without reason, and include reason in payload. |

---

## Interfaces / Contracts

### Backend Update DTO
```typescript
// erpbackend/src/modules/inventory/dto/update-product.dto.ts
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsString({ message: 'El motivo del ajuste debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo del ajuste no puede estar vacío' })
  adjustmentReason?: string;
}
```

### Frontend Model
```typescript
// erpfrontend/src/app/models/product.model.ts
export interface UpdateProductDto {
  name?: string;
  sku?: string;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  categoryId?: string | null;
  sellingPrice?: number;
  adjustmentReason?: string;
}
```

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (Backend) | Initial stock batch registration on `createProduct()` | Mock product save, verify batch is created with `initialQuantity = stock`, `purchasePrice = 0`, and `adjustmentReason = 'Stock Inicial'`. |
| Unit (Backend) | Positive manual adjustment | Mock `updateProduct()` with positive diff, verify creation of new batch at product's `averagePurchasePrice` with reason. |
| Unit (Backend) | Negative manual adjustment | Mock `updateProduct()` with negative diff, verify FIFO consumption, negative tracking batch creation, and validation failure (insufficient stock). |
| Unit (Frontend) | Validation in product form | Edit product stock, verify validation error is shown and save button is disabled until reason is entered. |

---

## Migration / Rollout

A database migration is required to add `adjustment_reason` to `inventory_batches` table:
```sql
ALTER TABLE "inventory_batches" ADD COLUMN "adjustment_reason" text;
```

---

## Open Questions

- [ ] Should negative adjustment tracking batches use `0` as purchase price or the average purchase price? (Current design uses `averagePurchasePrice` for audit consistency).
