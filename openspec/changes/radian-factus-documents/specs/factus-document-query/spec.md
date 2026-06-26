# Factus Document Query Specification

## Purpose

Provide a queryable read-through gateway to the Factus V2 API for listing and filtering electronic documents (bills and credit notes). Follows the existing hexagonal Ports & Adapters pattern segregated from `IFactusInvoicingGateway` per ISP.

## Requirements

### Requirement: IFactusQueryGateway Interface

The system MUST expose an `IFactusQueryGateway` interface with two methods:
- `listBills(filters: BillQueryFilters): Promise<PaginatedFactusResponse<FactusBill>>`
- `listCreditNotes(filters: CreditNoteQueryFilters): Promise<PaginatedFactusResponse<FactusCreditNote>>`

The injection token SHALL be `'IFactusQueryGateway'`.

#### Scenario: Interface contracts compile correctly

- GIVEN the application TypeScript build
- WHEN the `IFactusQueryGateway` interface is defined
- THEN the compiler MUST accept both method signatures without error

#### Scenario: Segregated interface prevents god-interface bloat

- GIVEN an `IFactusInvoicingGateway` already exists with create/destroy/PDF methods
- WHEN `IFactusQueryGateway` is defined as a separate interface
- THEN consumers MUST NOT be forced to depend on write methods they do not need

### Requirement: Query Filter DTOs

The system MUST define `BillQueryFilters` and `CreditNoteQueryFilters` with all optional fields: `identification`, `names`, `number`, `status` (`0` or `1`), `createdAtStart`, `createdAtEnd`, `page` (default `1`), `perPage` (default `10`).

#### Scenario: All filters are optional

- GIVEN a `BillQueryFilters` instance with no properties set
- WHEN the adapter builds the Factus query string
- THEN it MUST send only `page=1&filter[per_page]=10` as defaults

#### Scenario: Status filter accepts valid values

- GIVEN status `0`
- WHEN passed to the query gateway
- THEN the adapter MUST map it to `filter[status]=0` (meaning pending)

### Requirement: PaginatedFactusResponse Contract

The system MUST define `PaginatedFactusResponse<T>` with `{ data: T[], meta: { page: number, lastPage: number, limit: number, total: number } }`. The adapter MUST map Factus API's `{ data, current_page, last_page, per_page, total }` to this contract.

#### Scenario: Pagination metadata maps correctly

- GIVEN Factus response `{ data: [...], current_page: 2, last_page: 5, per_page: 10, total: 50 }`
- WHEN the adapter transforms it
- THEN `meta` SHALL equal `{ page: 2, lastPage: 5, limit: 10, total: 50 }`

#### Scenario: Empty data set returns empty array

- GIVEN Factus returns `{ data: [], current_page: 1, last_page: 0, per_page: 10, total: 0 }`
- WHEN the adapter maps the response
- THEN `data` MUST be an empty array and `meta.total` MUST be `0`

### Requirement: FactusHttpQueryAdapter Error Handling

The adapter MUST throw typed exceptions for non-2xx Factus responses. It MUST reuse `IFactusAuthGateway` for token retrieval and `ConfigService` for the base URL, following the same `makeGetRequest` pattern as `FactusHttpInvoicingAdapter`.

#### Scenario: Non-2xx response throws typed exception

- GIVEN Factus API returns HTTP 401 with `{ "error": "Token expirado" }`
- WHEN the adapter calls the query endpoint
- THEN it SHALL throw an error with message `HTTP 401: Token expirado`
- AND the caller SHALL receive a typed error, not raw JSON

#### Scenario: Auth token is fetched per-request

- GIVEN the `FactusHttpQueryAdapter` receives a query request
- WHEN `makeGetRequest` executes
- THEN it MUST call `authGateway.getAccessToken()` before each HTTP call

### Requirement: Filter Query String Mapping

The adapter MUST map filter DTOs to Factus API query string format: `filter[identification]=X&filter[names]=X&filter[number]=X&filter[status]=X&filter[created_at][start_date]=X&filter[created_at][end_date]=X&filter[per_page]=X&page=X`.

#### Scenario: All filters present

- GIVEN all filter fields are populated
- WHEN the adapter builds the query string
- THEN every `filter[...]` parameter SHALL appear in the URL

#### Scenario: Partial filters omit missing params

- GIVEN only `identification` and `names` are provided
- WHEN the adapter builds the query string
- THEN no `filter[number]`, `filter[status]`, or `filter[created_at]` params SHALL appear