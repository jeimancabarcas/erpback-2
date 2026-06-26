# Finance Document Listing Specification

## Purpose

Expose REST endpoints that present paginated, filterable lists of electronic documents (bills and credit notes) to the frontend. Acts as a facade over the Factus query gateway, transforming wire formats and enforcing authentication.

## Requirements

### Requirement: JWT-Guarded REST Endpoints

The system MUST expose two endpoints under `FinanceController`:

| Method | Path | Query Params |
|--------|------|-------------|
| `GET` | `/finance/bills` | `identification?`, `names?`, `number?`, `status?`, `startDate?`, `endDate?`, `page?`, `perPage?` |
| `GET` | `/finance/credit-notes` | Same as above |

Both MUST be JWT-guarded using the project's existing `AuthGuard('jwt')`. Unauthenticated requests SHALL return HTTP 401.

#### Scenario: Authenticated bill listing

- GIVEN a valid JWT token
- WHEN `GET /finance/bills?page=1&perPage=10` is called
- THEN the endpoint MUST return HTTP 200 with `{ data: FactusBill[], meta: { total, page, lastPage, limit } }`

#### Scenario: Unauthenticated request rejected

- GIVEN no JWT token or an expired one
- WHEN any `/finance/*` endpoint is called
- THEN the response SHALL be HTTP 401

#### Scenario: Same query params for both endpoints

- GIVEN the same filter values
- WHEN calling `/finance/bills` and `/finance/credit-notes`
- THEN both SHALL accept the identical query parameter set

### Requirement: Parameter-to-Filter Transformation

`FinanceService` MUST transform HTTP query params into `BillQueryFilters` / `CreditNoteQueryFilters` objects. `startDate` and `endDate` map to `createdAtStart` and `createdAtEnd`. Omitted optional params MUST map to `undefined`.

#### Scenario: Query params with date range

- GIVEN `startDate=2025-01-01&endDate=2025-12-31`
- WHEN `FinanceService` builds filters
- THEN `createdAtStart` SHALL be `"2025-01-01"` and `createdAtEnd` SHALL be `"2025-12-31"`

#### Scenario: Empty param set resolves defaults

- GIVEN no query params
- WHEN `FinanceService` builds filters
- THEN `page` SHALL default to `1` and `perPage` to `10`

### Requirement: Response DTO Mapping

The service MUST map `FactusBill` and `FactusCreditNote` API response objects into `FinanceDocumentDto` for frontend consumption. Pagination metadata SHALL be preserved in the `meta` envelope.

#### Scenario: Bill fields mapped to DTO

- GIVEN a `FactusBill` with `number`, `referenceCode`, `createdAt`, `total`, `customer.names`, `status`
- WHEN mapped to `FinanceDocumentDto`
- THEN all those fields SHALL be present with the same values

#### Scenario: Paginated response envelope preserved

- GIVEN a Factus gateway returns `{ data: [...], meta: { total: 50, page: 2, lastPage: 5, limit: 10 } }`
- WHEN `FinanceController` responds
- THEN the HTTP response body MUST contain the same `data` and `meta` structure

### Requirement: Error Propagation

If the Factus query gateway throws, `FinanceService` MUST let the exception propagate. The controller SHALL NOT catch and swallow gateway errors.

#### Scenario: Gateway failure surfaces as HTTP error

- GIVEN the Factus API is unreachable
- WHEN `GET /finance/bills` is called
- THEN the controller SHALL return a 5xx HTTP error
- AND the response body SHALL include an error detail