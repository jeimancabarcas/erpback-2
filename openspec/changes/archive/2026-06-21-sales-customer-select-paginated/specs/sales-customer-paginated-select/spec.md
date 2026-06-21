# Sales Customer Paginated Select Specification

## Purpose
Define the behavior of the paginated, searchable customer select component in the sales invoice form.

## Requirements

### Requirement: Initial Load
When the customer select component is focused or activated, it MUST load a maximum of 10 customer records initially.

#### Scenario: Initial activation loads 10 customers
- GIVEN the sales invoice form is open
- WHEN the user focuses the customer select input
- THEN the system MUST request the first page of customers with a limit of 10
- AND the dropdown MUST display at most 10 active customers

### Requirement: Search Input
The component MUST query the backend dynamically when the user types in the input. The search query MUST be debounced by 300ms. Typing resets the page index to 1 and replaces the items list.

#### Scenario: User searches for a customer
- GIVEN the customer select dropdown is open
- WHEN the user types "Juan" into the input
- THEN the system MUST wait for a 300ms debounce period
- AND the system MUST fetch the first page of customers matching "Juan" (limit: 10)
- AND the dropdown MUST replace the existing list with the matching customers

### Requirement: Pagination
If more customer records are available, a "Cargar más" button option MUST be appended to the bottom of the list. Clicking it increments the page, fetches the next 10, and appends them to the list without closing the dropdown.

#### Scenario: Loading more customers
- GIVEN the customer select dropdown is open with 10 records loaded
- AND there are more than 10 records matching the current search
- WHEN the user clicks the "Cargar más" button
- THEN the dropdown MUST NOT close
- AND the system MUST fetch the next page of 10 customers
- AND the fetched customers MUST be appended to the existing list

### Requirement: Inline Creation
If a search query returns no results, the dropdown MUST show an option reading "No se encontraron clientes. ¿Crear nuevo?". Selecting this option MUST open the customer creation dialog. Upon successful creation, the new customer MUST be automatically selected in the select component.

#### Scenario: No results inline creation workflow
- GIVEN the user has entered "NonExistentCustomer" in the search input
- AND the query returns 0 results
- WHEN the user clicks "No se encontraron clientes. ¿Crear nuevo?" in the dropdown
- THEN the customer creation dialog MUST open
- AND WHEN the user successfully creates a customer named "New Customer"
- THEN the dialog MUST close
- AND "New Customer" MUST be automatically selected in the sales customer input field
