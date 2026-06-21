# Apply Progress: Paginated Customer Selection in Sales Invoice Form

**Change**: `sales-customer-select-paginated`
**Mode**: `Strict TDD` (TDD Cycle Evidence included)
**Status**: Ready for Verification

---

## TDD Cycle Evidence

| Task | RED Stage (Test First) | GREEN Stage (Passing Code) | REFACTOR Stage | Status |
|------|-------------------------|----------------------------|-----------------|--------|
| **1.1 - 1.3: Backend Core** | Checked in `customers.service.spec.ts` (asserts search query filters name/document and status=ACTIVE). Tests failed as expected. | Added optional `search` parameter in DTO and implemented fuzzy partial OR matching in `findAll()`. | Used TypeORM's `FindOptionsWhere` typed interface to fix ESLint any-unsafe lints. | **PASSED** |
| **2.1 - 2.6: Frontend Autocomplete** | Checked in `sale-form.component.spec.ts` (asserts debounced search, page appending, and inline customer dialog auto-selection). Tests failed as expected. | Replaced `<mat-select>` with `<mat-autocomplete>`, added local signals (`customersList`, `currentPage`, `hasMore`, etc.), and hooked customer creation. | Structured RxJS streams using `debounceTime` & `distinctUntilChanged` and formatted via Prettier. | **PASSED** |

---

## Completed Tasks

- [x] **1.1** RED: Write Jest unit tests in `erpbackend/src/modules/customers/customers.service.spec.ts` asserting customer search filters by name or document number and excludes inactive customers.
- [x] **1.2** GREEN: Add optional `@IsString() search` parameter to `QueryCustomersDto` in `erpbackend/src/modules/customers/dto/query-customers.dto.ts`.
- [x] **1.3** GREEN: Update `findAll()` in `erpbackend/src/modules/customers/customers.service.ts` to implement case-insensitive partial match (`ILike` OR condition) on `name` or `documentNumber`, filtering by `CustomerStatus.ACTIVE`.
- [x] **1.4** REFACTOR: Clean up database query parameters and ensure all backend lints pass.
- [x] **2.1** RED: Write Vitest tests in `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.spec.ts` asserting debounced search, paginated appending, and inline customer dialog trigger.
- [x] **2.2** GREEN: Add pagination state variables, loading indicator, and search control to `SaleFormMolecule` in `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.ts`.
- [x] **2.3** GREEN: Replace `<mat-select>` with `<mat-autocomplete>` in the HTML template of `SaleFormMolecule`.
- [x] **2.4** GREEN: Implement debounced search (300ms) that resets page state to 1.
- [x] **2.5** GREEN: Add "Cargar más" option with `$event.stopPropagation()` to append the next 10 items.
- [x] **2.6** GREEN: Connect `CustomerDialogOrganism` inline customer creation to auto-select the new customer.
- [x] **2.7** REFACTOR: Refactor component streams and clean up formatting.

---

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `erpbackend/src/modules/customers/dto/query-customers.dto.ts` | Modified | Added optional `search?: string` parameter with validator decorators. |
| `erpbackend/src/modules/customers/customers.service.ts` | Modified | Updated `findAll` to handle `search` parameter, query OR conditions for name/document, default to ACTIVE status. Fix raw query raw output casting eslint issues. |
| `erpbackend/src/modules/customers/customers.service.spec.ts` | Created | Added unit test suite asserting search behavior & custom status. |
| `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.ts` | Modified | Replaced customer selection with searchable, paginated autocomplete and loaded dialog on empty state. |
| `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.spec.ts` | Created | Added integration tests asserting debouncing search, page increment, and inline creation fallback behavior. |

---

## Deviations from Design
None — implementation matches design decisions and hybrid fallback selection patterns exactly.

## Issues Found
None — all tests compiled, run, and passed successfully.
