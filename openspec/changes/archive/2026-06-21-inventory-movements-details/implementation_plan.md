# Implementation Plan: Movement Origin and Operator Details

This plan introduces tracking for the origin, destination, and operator (user email) of inventory movements. In the movements history table of the inventory summary, users will be able to see who performed manual adjustments and where the stock originated from or was dispatched to.

## User Review Required

> [!NOTE]
> Database changes: We will add a `user_id` column to the `inventory_batches` table using TypeORM's auto-synchronization in development. In production, this column will default to NULL for existing batches, which will safely display as "Sistema" or "Compra".

## Proposed Changes

### Backend (erpbackend)

---

#### [MODIFY] [inventory-batch.entity.ts](file:///C:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/inventory/entities/inventory-batch.entity.ts)
- Import `User` entity.
- Add `ManyToOne` relation to `User` as `user` with `@JoinColumn({ name: 'user_id' })`.
- Add `userId` string field (nullable).

#### [MODIFY] [inventory.controller.ts](file:///C:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/inventory/inventory.controller.ts)
- Import `@Req` decorator from `@nestjs/common`.
- Update `createProduct` and `updateProduct` endpoints to accept `@Req() req: any`.
- Extract the authenticated user (`req.user`) and pass it to the service.

#### [MODIFY] [inventory.service.ts](file:///C:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/inventory/inventory.service.ts)
- Update `createProduct()` to accept `user?: User` and save it on the initial stock batch.
- Update `updateProduct()` to accept `user?: User` and save it on both positive adjustment batches and negative tracking batches.
- Update `getMovements()` to fetch the `user` relation for batches and include the `operator` field (`batch.user ? batch.user.email : 'Sistema'`).
- Map operator as `'Sistema'` for sales/invoice movements.

#### [MODIFY] [inventory.service.spec.ts](file:///C:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/inventory/inventory.service.spec.ts)
- Update existing tests to reflect the new controller/service signatures.
- Add unit tests verifying that user information is correctly associated with batches during creation/adjustment and correctly mapped in the movements history.

---

### Frontend (erpfrontend)

---

#### [MODIFY] [inventory.service.ts](file:///C:/Users/jeima/Desktop/ERP%20Repositories/erpfrontend/src/app/services/inventory.service.ts)
- Add optional `operator?: string` field to the `Movement` interface.

#### [MODIFY] [movements-table.component.ts](file:///C:/Users/jeima/Desktop/ERP%20Repositories/erpfrontend/src/app/components/molecules/movements-table/movements-table.component.ts)
- Update `displayedColumns` to include `'origin'`, `'destination'`, and `'operator'`.
- Add `<ng-container>` blocks for `origin`, `destination`, and `operator` columns in the template.

---

## Verification Plan

### Automated Tests
- Run backend tests: `npx jest`
- Run frontend tests: `npm run test -- --watch=false`

### Manual Verification
- Log in, perform a manual adjustment (increase/decrease stock) with a reason.
- Navigate to the inventory summary and verify that the movements history table now displays:
  - **Origen** (e.g. "Ajuste de inventario")
  - **Destino** (e.g. "Ajuste de inventario")
  - **Usuario** (e.g. the email of the logged-in user)
  - **Fecha**, **Cantidad**, **Tipo**, and **Producto** as before.
