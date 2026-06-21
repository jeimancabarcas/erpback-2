# Proposal: Paginated Customer Selection in Sales Invoice Form

## Intent
Replace the memory-heavy customer selection dropdown (`<mat-select>`) in the sales invoice creation form with a paginated, searchable autocomplete component (`<mat-autocomplete>`) and an inline client creation shortcut. This resolves frontend responsiveness degradation and client-side loading limits when dealing with large customer lists.

## Scope

### In Scope
- **Frontend Autocomplete**: Replace `<mat-select>` with `<mat-autocomplete>` in `SaleFormMolecule`.
- **Search & Pagination**: Load initial 10 customer records; trigger search queries on keyboard input (debounced by 300ms, resets page to 1).
- **"Load More" Action**: Append a "Cargar más" option button at the bottom of the list when additional records are available.
- **Inline Dialog Integration**: Integrate option for inline creation using `CustomerDialogOrganism` and automatically select the newly created customer.
- **Backend Search parameter**: Expose `search` string parameter in `QueryCustomersDto`.
- **Backend OR Filter**: Update `CustomersService.findAll` to perform an `OR` query with `ILike` matching customer `name` and `documentNumber`.

### Out of Scope
- **Backend Scroll Pagination**: Infinite scroll pagination.
- **Frontend Virtual Scroll**: Virtualized viewport rendering (Approach 1 "Cargar más" button is preferred).
- **Bulk Customer Management**: Bulk importing/deleting customers from the invoice flow.

## Capabilities

### New Capabilities
- `sales-customer-paginated-select`: Frontend autocomplete pagination, search, and inline customer creation dialog workflow in `SaleFormMolecule`.

### Modified Capabilities
- `customer-management`: Backend customer query retrieval to support unified search filtering on name OR documentNumber.

## Approach
- **Frontend**: Add a reactive `FormControl` for searching. Fetch page 1 (limit: 10) on field focus or typing. When `meta.page < meta.lastPage`, append a custom `<mat-option disabled>` with a button labeled "Cargar más". Intercept click with `$event.stopPropagation()` to prevent dropdown dismissal. Add a fallback option "Crear nuevo cliente" to open the dialog.
- **Backend**: Bind `search` property in `QueryCustomersDto`. If `search` is populated, `CustomersService.findAll` executes a TypeORM `findAndCount` using an `OR` array condition matching both fields via `ILike`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.ts` | Modified | Replace `<mat-select>` with `<mat-autocomplete>` and page state. |
| `erpbackend/src/modules/customers/dto/query-customers.dto.ts` | Modified | Add optional `search` query parameter. |
| `erpbackend/src/modules/customers/customers.service.ts` | Modified | Update `findAll` to handle OR query using `ILike` when `search` parameter is provided. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Autocomplete list closes on "Cargar más" or "Crear" clicks | Medium | Use `$event.stopPropagation()` and `$event.preventDefault()` on button click handlers. |
| Race conditions on concurrent typing | Low | Debounce search inputs by 300ms using RxJS `switchMap` and `distinctUntilChanged`. |
| DB query slowdown with `ILike %search%` | Low | Verify indexes are present on `name` and `documentNumber` columns. |

## Rollback Plan
Revert code changes in git to restore the original `<mat-select>` customer selection in the frontend, and restore the original `findAll` method in the backend.

## Dependencies
- Existing `CustomerDialogOrganism` component in the frontend.

## Success Criteria
- [ ] Autocomplete loads a maximum of 10 items initially.
- [ ] Typing in search input filters list dynamically by name or ID.
- [ ] Clicking "Cargar más" appends next 10 items without closing autocomplete.
- [ ] Selecting "Crear nuevo cliente" opens dialog, saves customer, and auto-selects them.

---

## Finalized Decisions
1. **Status filtering**: Only active customers are returned in the autocomplete search list.
2. **"Crear nuevo cliente" permissions**: The inline creation shortcut is visible to all users who have access to invoice creation.
3. **Empty search state**: If no customer matches the query, show the option "No se encontraron clientes. ¿Crear nuevo?" directly inside the dropdown options list.
4. **Validation during invoice flow**: Upon successful inline customer creation, the new customer is automatically selected in the form control; no additional toast is required.
