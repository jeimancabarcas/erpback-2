# Customer Management Specification

## Purpose
Define the backend querying and filtering behavior for customer records.

## Requirements

### Requirement: Unified Search
The customer query backend API MUST accept an optional `search` query parameter.

#### Scenario: Query customers with search parameter
- GIVEN the customer list endpoint
- WHEN a GET request is made with the parameter `search=Alice`
- THEN the API MUST process the search string and filter the results accordingly

### Requirement: Search Filtering Fields
If `search` is provided, the query MUST filter customer records by `name` OR `documentNumber` using a case-insensitive partial match (`ILike`).

#### Scenario: Partial name match
- GIVEN customer records exist with name "Alice Smith" and document number "12345"
- WHEN a GET request is made with `search=alice`
- THEN the results MUST include "Alice Smith"

#### Scenario: Partial document number match
- GIVEN customer records exist with name "Bob Jones" and document number "987654"
- WHEN a GET request is made with `search=876`
- THEN the results MUST include "Bob Jones"

### Requirement: Active Status Filter
The customer query API MUST only return customer records where `isActive` is true.

#### Scenario: Inactive customers excluded
- GIVEN an active customer "Active User" and an inactive customer "Inactive User"
- WHEN a GET request is made to query customers
- THEN the results MUST include "Active User"
- AND the results MUST NOT include "Inactive User"
