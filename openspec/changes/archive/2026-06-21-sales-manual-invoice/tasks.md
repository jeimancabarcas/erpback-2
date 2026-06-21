# Tasks: sales-manual-invoice

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

| Field | Value |
|-------|-------|
| Estimated changed lines | 280–320 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

## Phase 1: Backend entity + migration (TDD)

- [x] 1.1 RED — Write failing entity test in [sales.service.spec.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.spec.ts)
- [x] 1.2 GREEN — Add `isElectronic` column to Invoice entity in [invoice.entity.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/entities/invoice.entity.ts)
- [x] 1.3 GREEN — Create the database migration in `src/database/migrations/1750000000000-AddIsElectronicToInvoice.ts`

## Phase 2: Backend service changes (TDD)

- [x] 2.1 RED — Write failing SalesService.create() tests in [sales.service.spec.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.spec.ts)
- [x] 2.2 GREEN — Add `isElectronic` to CreateInvoiceDto in [create-invoice.dto.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/dto/create-invoice.dto.ts)
- [x] 2.3 GREEN — Update SalesService.create() with branching logic in [sales.service.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.ts)
- [x] 2.4 GREEN — Add manual guard to `createCreditNote()` in [sales.service.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.ts)
- [x] 2.5 GREEN — Add manual guard to `createDebitNote()` in [sales.service.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.ts)
- [x] 2.6 REFACTOR — Update makeInvoice helper with `isElectronic` default in [sales.service.spec.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpbackend/src/modules/sales/sales.service.spec.ts)

## Phase 3: Frontend model + form toggle (TDD)

- [x] 3.1 RED — Write failing SaleFormMolecule toggle tests in [sale-form.component.spec.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpfrontend/src/app/components/molecules/sale-form/sale-form.component.spec.ts)
- [x] 3.2 GREEN — Add `isElectronic` to frontend Invoice model in [invoice.model.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpfrontend/src/app/models/invoice.model.ts)
- [x] 3.3 GREEN — Add `isManual` signal, toggle HTML, and `onSubmit` update in [sale-form.component.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpfrontend/src/app/components/molecules/sale-form/sale-form.component.ts)

## Phase 4: Frontend invoice list badge (TDD)

- [x] 4.1 RED — Write failing SalesPageComponent badge tests in [sales-page.component.spec.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpfrontend/src/app/components/pages/sales-page/sales-page.component.spec.ts)
- [x] 4.2 GREEN — Add MANUAL badge to template in [sales-page.component.ts](file:///c:/Users/jeima/Desktop/ERP%20Repositories/erpfrontend/src/app/components/pages/sales-page/sales-page.component.ts)

## Phase 5: Verification

- [x] 5.1 Run backend tests: `npm run test` in `erpbackend`
- [x] 5.2 Run frontend tests: `npm run test -- --watch=false` in `erpfrontend`
- [x] 5.3 Run backend build: `npm run build` in `erpbackend`
- [x] 5.4 Run frontend type check: `npx tsc --noEmit` in `erpfrontend`
