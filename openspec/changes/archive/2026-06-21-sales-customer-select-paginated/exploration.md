## Exploration: Implement paginated customer selection in the sales invoice form

### Current State
- The frontend sales invoice creation form (`SaleFormMolecule` inside `erpfrontend`) uses a standard `<mat-select>` element that lists all customers in memory.
- At startup, the form triggers `this.customerService.loadCustomers({ limit: 100 })` to fetch up to 100 customers. This is not paginated or filtered dynamically, and lacks search capability or an inline creation path.
- The NestJS backend `CustomersController` and `CustomersService` (`erpbackend`) support pagination (`page`, `limit`) and filtering (`name`, `documentNumber`) through `QueryCustomersDto`. However, the current TypeORM query combines filtering parameters using `AND`, making unified search (name OR ID) difficult without client-side sniffing or backend enhancements.

### Affected Areas
- `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.ts` — Change the customer selection element from `<mat-select>` to a search input with `<mat-autocomplete>`. Manage pagination state, "Load More" triggers, and bind the action to open the client creation dialog.
- `erpbackend/src/modules/customers/dto/query-customers.dto.ts` — Add an optional `search` parameter for a unified name/ID query.
- `erpbackend/src/modules/customers/customers.service.ts` — Update `findAll` to handle the `search` parameter and perform a TypeORM `OR` query across `name` and `documentNumber`.

### Approaches

#### 1. Custom scrolling + Load More (Cargar más) button inside Mat-Autocomplete
- **Description**: Bind a FormControl to a text input. Filter customers by loading page 1 from the backend API on click or keyup. Append a custom `<mat-option disabled>` at the bottom of the autocomplete list displaying a "Cargar más" button when `hasMore` is true. Clicking this button increments the page, fetches the next 10 items, and appends them to the signal.
- **Pros**:
  - Extremely reliable and simple to implement in Angular Material.
  - Gives the user explicit control over fetching more data.
  - Zero external dependencies or complex DOM hacks.
  - Easily handles button clicks with `$event.stopPropagation()` to prevent autocomplete selection and closing of the dropdown list.
- **Cons**:
  - Requires manual pagination logic (page counter, appending results to a signal) in the component.
- **Effort**: Low/Medium

#### 2. Scroll-listener based Infinite Scroll in Mat-Autocomplete
- **Description**: Add a scroll listener to the autocomplete panel overlay. When the scroll reaches the bottom (e.g. scrollHeight - scrollTop <= clientHeight + threshold), automatically trigger loading of the next page and append items.
- **Pros**:
  - Modern, hands-free user experience (infinite scroll).
- **Cons**:
  - Complex to implement in Angular. Since the panel is lazily rendered in a portal overlay, accessing the DOM element or scroll events requires subscribing to the autocomplete trigger's panel opened events and finding the overlay element.
  - Prone to duplicate API calls if scroll events are not strictly debounced.
- **Effort**: Medium/High

### Recommendation
**Approach 1 (Custom scrolling + Load More button)** is recommended. It is robust, straightforward to implement, fits perfectly within Angular Material's autocomplete overlay structure, and avoids potential UI/UX bugs associated with infinite scroll list updates in lazy panels.

For the backend, it is recommended to add a unified `search` query parameter to the `QueryCustomersDto` and `CustomersService.findAll` to search both `name` OR `documentNumber` with `ILike`. This avoids parsing/sniffing logic in the frontend and provides a cleaner API.

For quick customer creation: Add a fallback option "Crear nuevo cliente" at the bottom of the list when no search results match or as a general addition. Selecting this will open `CustomerDialogOrganism` using `MatDialog`. If the creation is successful, select and auto-populate the new customer.

### Risks
- **Autocomplete Dropdown Closing**: Clicking the "Cargar más" button or the "Crear nuevo cliente" option inside the dropdown could accidentally close the overlay panel. This is mitigated by using `$event.stopPropagation()` and `$event.preventDefault()` on click events.
- **Search Debounce and Page Reset**: Typing in the search input must correctly reset the page back to 1 and discard the previously loaded pages to prevent mixed search results. This requires proper RXJS pipe configuration (e.g., `debounceTime(300)` and `distinctUntilChanged()`).

### Ready for Proposal
Yes — the codebase and requirements are clear. The orchestrator can proceed to the `sdd-propose` phase.
