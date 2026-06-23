# Tasks: default-manual-invoice

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 150–200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

## Phase 1: Backend entity + migration (TDD)

- [x] 1.1 RED — Update test defaults to reflect inverted isElectronic default in [sales.service.spec.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.spec.ts)
- [x] 1.2 GREEN — Change `isElectronic` column default from `true` to `false` and add `factusNumber` nullable column in [invoice.entity.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/entities/invoice.entity.ts)
- [x] 1.3 GREEN — Create migration to update default and add factus_number column in `src/database/migrations/1750000000001-UpdateInvoiceDefaults.ts`

## Phase 2: Backend service changes (TDD)

- [x] 2.1 RED — Write failing `emit()` tests in [sales.service.spec.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.spec.ts)
- [x] 2.2 GREEN — Change `createDto.isElectronic !== false` → `createDto.isElectronic === true` in [sales.service.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.ts)
- [x] 2.3 GREEN — Change `createDto.isElectronic ?? true` → `createDto.isElectronic ?? false` in [sales.service.ts](file:///C:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.ts)
- [x] 2.4 GREEN — Add `emit(id)` method in [sales.service.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.ts)

## Phase 3: Controller route (TDD)

- [x] 3.1 GREEN — Add `POST :id/emit` endpoint in [sales.controller.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.controller.ts)

## Phase 4: Verification

- [x] 4.1 Run backend tests: `npm run test`
- [x] 4.2 Run backend build: `npm run build`
