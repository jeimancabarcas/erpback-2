# supplier-management Specification

## Purpose

Defines the `municipalityCode` field requirements on supplier DTOs. This spec covers validation on create and update operations so that suppliers can carry the DIVIPOLA municipality code required by Factus support-document emission.

## Requirements

### Requirement: CreateSupplierDto requires municipalityCode

The `CreateSupplierDto` MUST include a `municipalityCode` field decorated with `@IsString()` and `@IsNotEmpty()`. The field is required when creating a supplier and MUST produce a 400 Bad Request response when omitted or empty.

The field's validation messages MUST be in Spanish.

#### Scenario: Create supplier with valid municipalityCode succeeds

- GIVEN a POST request to the supplier creation endpoint
- AND the request body includes `municipalityCode: "11001"` alongside all other required fields (`nit`, `name`, `address`, `phone`)
- WHEN the request is processed
- THEN the supplier MUST be created successfully (HTTP 201)
- AND the persisted supplier MUST have `municipalityCode` set to `"11001"`

#### Scenario: Create supplier without municipalityCode returns 400

- GIVEN a POST request to the supplier creation endpoint
- AND the request body includes all other required fields but omits `municipalityCode`
- WHEN the request is processed
- THEN the system MUST return HTTP 400 Bad Request
- AND the validation error message MUST indicate `municipalityCode` is required

#### Scenario: Create supplier with empty municipalityCode returns 400

- GIVEN a POST request to the supplier creation endpoint
- AND the request body includes `municipalityCode: ""` (empty string)
- WHEN the request is processed
- THEN the system MUST return HTTP 400 Bad Request
- AND the validation error message MUST indicate `municipalityCode` is required (not empty)

#### Scenario: municipalityCode must be a string

- GIVEN a POST request to the supplier creation endpoint
- AND the request body includes `municipalityCode: 11001` (number, not string)
- WHEN the request is processed
- THEN the system MUST return HTTP 400 Bad Request
- AND the validation error message MUST indicate `municipalityCode` must be a string

### Requirement: UpdateSupplierDto makes municipalityCode optional

The `UpdateSupplierDto` MUST inherit from `CreateSupplierDto` via `PartialType`, making `municipalityCode` optional on update. A supplier MAY be updated without providing or changing the `municipalityCode`.

#### Scenario: Update supplier without municipalityCode succeeds

- GIVEN an existing supplier with `municipalityCode: "11001"`
- AND a PATCH/PUT request to update the supplier's address only
- AND the request body does NOT include `municipalityCode`
- WHEN the request is processed
- THEN the update MUST succeed (HTTP 200)
- AND the supplier's `municipalityCode` MUST remain `"11001"` (unchanged)

#### Scenario: Update supplier with a new municipalityCode succeeds

- GIVEN an existing supplier with `municipalityCode: "11001"`
- AND a PATCH/PUT request that includes `municipalityCode: "05001"`
- WHEN the request is processed
- THEN the update MUST succeed (HTTP 200)
- AND the supplier's `municipalityCode` MUST be updated to `"05001"`

### Requirement: municipalityCode persists correctly to supplier entity

The `municipalityCode` value from the DTO MUST be persisted to the `suppliers` table's `municipality_code` column. The entity mapping MUST match the existing column definition (`type: 'varchar', nullable: true`), and a `null` database value MUST be allowed for existing suppliers that predate this change.

#### Scenario: Existing supplier with null municipalityCode remains valid

- GIVEN a supplier created before the DTO change, with `municipality_code` set to `NULL` in the database
- WHEN the supplier is loaded via the repository
- THEN `supplier.municipalityCode` MUST be `null`
- AND the supplier MUST NOT be rejected or throw errors on read
- AND attempting to emit a support document for this supplier MUST fail validation (blocked with `BadRequestException`) per the support-document-emission spec
