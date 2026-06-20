# Tasks: Inventory Manual Adjustment

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 150-250 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full Implementation | PR 1 | Base branch: main; all backend/frontend changes & tests |

## Phase 1: Infrastructure / Foundation

- [x] 1.1 Add nullable `adjustmentReason` to `InventoryBatch` in `erpbackend/src/modules/inventory/entities/inventory-batch.entity.ts`.
- [x] 1.2 Run schema sync or migration to add column `adjustment_reason` (text) to `inventory_batches` table.
- [x] 1.3 Add optional `adjustmentReason` validations to `UpdateProductDto` in `erpbackend/src/modules/inventory/dto/update-product.dto.ts`.

## Phase 2: Backend Core

- [x] 2.1 Update `createProduct()` in `erpbackend/src/modules/inventory/inventory.service.ts` to create initial batch if stock > 0.
- [x] 2.2 Add transaction with `pessimistic_write` lock on Product in `updateProduct()` in `erpbackend/src/modules/inventory/inventory.service.ts`.
- [x] 2.3 Calculate stock diff in `updateProduct()`; for positive diff, create Average Purchase Price batch with reason.
- [x] 2.4 Handle negative diff: validate batch stock capacity, consume via FIFO (`consumeStock`), and save negative tracking batch.
- [x] 2.5 Recalculate average purchase price in `updateProduct()` and save product changes.
- [x] 2.6 Map positive/negative manual adjustment batches as In/Out movements with origin/destination `'Ajuste de inventario'` in `getMovements()`.

## Phase 3: Frontend Integration

- [x] 3.1 Update `UpdateProductDto` in `erpfrontend/src/app/models/product.model.ts` to include optional `adjustmentReason: string`.
- [x] 3.2 Track `originalStock` on init in `erpfrontend/src/app/components/molecules/product-form/product-form.component.ts`.
- [x] 3.3 Add required `adjustmentReason` input field in template when stock changes and block form submission.
- [x] 3.4 Include the entered `adjustmentReason` in the save product payload in `product-form.component.ts`.

## Phase 4: Verification / Testing

- [x] 4.1 Write unit tests in `erpbackend/src/modules/inventory/inventory.service.spec.ts` for initial stock, positive and negative adjustments.
- [x] 4.2 Write unit tests in `erpfrontend/src/app/components/molecules/product-form/product-form.component.spec.ts` for adjustment validation.
