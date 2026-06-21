# Tasks: Inventory Movements Origin and Operator

## Phase 1: Backend Infrastructure (TypeORM Entity & Controller)
- [x] 1.1 Add ManyToOne relation to `User` and `userId` field to `InventoryBatch` in `erpbackend/src/modules/inventory/entities/inventory-batch.entity.ts`.
- [x] 1.2 Update `createProduct` and `updateProduct` endpoints in `erpbackend/src/modules/inventory/inventory.controller.ts` to receive `@Req() req: any` and pass `req.user` to the service.

## Phase 2: Backend Core Logic & Test Updates
- [x] 2.1 Update `createProduct()` in `erpbackend/src/modules/inventory/inventory.service.ts` to assign `user` on initial stock batch creation.
- [x] 2.2 Update `updateProduct()` in `erpbackend/src/modules/inventory/inventory.service.ts` to assign `user` on positive and negative adjustment batches.
- [x] 2.3 Update `getMovements()` in `erpbackend/src/modules/inventory/inventory.service.ts` to include the `user` relation and map the `operator` field (`batch.user ? batch.user.email : 'Sistema'`).
- [x] 2.4 Update unit tests in `erpbackend/src/modules/inventory/inventory.service.spec.ts` to handle updated service signatures and verify operator tracking.

## Phase 3: Frontend Integration
- [x] 3.1 Update `Movement` interface in `erpfrontend/src/app/services/inventory.service.ts` to include optional `operator?: string`.
- [x] 3.2 Add `'origin'`, `'destination'`, and `'operator'` to `displayedColumns` in `erpfrontend/src/app/components/molecules/movements-table/movements-table.component.ts`.
- [x] 3.3 Add `<ng-container>` blocks for `origin`, `destination`, and `operator` in the component template.

## Phase 4: Verification & Testing
- [x] 4.1 Run backend Jest tests and ensure all pass.
- [x] 4.2 Run frontend Vitest tests and ensure all pass.
