# Tasks: Paginated Customer Selection in Sales Invoice Form

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 150-250 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend search, autocomplete UI, and dialog | Single PR | Standard deployment for small surgical change |

## Phase 1: Backend Core (TDD)

- [x] 1.1 RED: Write Jest unit tests in `erpbackend/src/modules/customers/customers.service.spec.ts` asserting customer search filters by name or document number and excludes inactive customers.
- [x] 1.2 GREEN: Add optional `@IsString() search` parameter to `QueryCustomersDto` in `erpbackend/src/modules/customers/dto/query-customers.dto.ts`.
- [x] 1.3 GREEN: Update `findAll()` in `erpbackend/src/modules/customers/customers.service.ts` to implement case-insensitive partial match (`ILike` OR condition) on `name` or `documentNumber`, filtering by `CustomerStatus.ACTIVE`.
- [x] 1.4 REFACTOR: Clean up database query parameters and ensure all backend lints pass.

## Phase 2: Frontend Autocomplete Integration (TDD)

- [x] 2.1 RED: Write Vitest tests in `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.spec.ts` asserting debounced search, paginated appending, and inline customer dialog trigger.
- [x] 2.2 GREEN: Add pagination state variables, loading indicator, and search control to `SaleFormMolecule` in `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.ts`.
- [x] 2.3 GREEN: Replace `<mat-select>` with `<mat-autocomplete>` in the HTML template of `SaleFormMolecule`.
- [x] 2.4 GREEN: Implement debounced search (300ms) that resets page state to 1.
- [x] 2.5 GREEN: Add "Cargar más" option with `$event.stopPropagation()` to append the next 10 items.
- [x] 2.6 GREEN: Connect `CustomerDialogOrganism` inline customer creation to auto-select the new customer.
- [x] 2.7 REFACTOR: Refactor component streams and clean up formatting.

## Phase 3: Verification / Testing

- [x] 3.1 Verify Vitest tests for the autocomplete flow in the frontend.
- [x] 3.2 Verify Jest tests in backend via `npm run test`.
- [x] 3.3 Verify builds for both backend and frontend applications.
