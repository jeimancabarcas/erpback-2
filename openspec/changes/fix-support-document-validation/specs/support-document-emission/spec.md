# support-document-emission Specification

## Purpose

Defines the emission workflow for support documents (`documento soporte`) sent to the Factus API. This spec covers supplier field validation, payload construction for `municipality_code`, and tax rate mapping — ensuring the Factus `/v2/support-documents/validate` endpoint receives well-formed payloads that pass HTTP 422 validation.

## Requirements

### Requirement: Supplier field validation blocks emission

The system MUST validate that the purchase order's supplier has all required Factus fields before building the support-document payload. When one or more fields are null or undefined, emission MUST be blocked with a `BadRequestException` containing a descriptive message that lists every missing field by its Spanish label.

The required fields are: `nit`, `dv`, `name`, `address`, `municipalityCode`, and `legalOrganizationCode`.

#### Scenario: Supplier missing municipalityCode blocks emission

- GIVEN a COMPLETED purchase order with no existing support document
- AND the order's supplier has `municipalityCode` set to `null` (or undefined)
- WHEN `emitSupportDocument` is called
- THEN the system MUST throw `BadRequestException` with a message containing `"municipalityCode"`
- AND no HTTP call to the Factus API is made

#### Scenario: Supplier missing multiple fields

- GIVEN a COMPLETED purchase order with a supplier missing `dv`, `address`, and `legalOrganizationCode`
- WHEN `emitSupportDocument` is called
- THEN the system MUST throw `BadRequestException` with a message listing all three missing fields (`"dv, address, legalOrganizationCode"` or equivalent)
- AND the message MUST use Spanish labels ("dv", "address", "legalOrganizationCode") as stored in the validation logic

#### Scenario: Supplier with all fields proceeds to emission

- GIVEN a COMPLETED purchase order with a supplier that has non-null values for `nit`, `dv`, `name`, `address`, `municipalityCode`, and `legalOrganizationCode`
- AND no existing support document exists for this order
- WHEN `emitSupportDocument` is called
- THEN the validation block does not throw
- AND the Factus payload is constructed and sent

#### Scenario: Supplier validation runs before any other emission logic

- GIVEN a COMPLETED purchase order whose supplier lacks `municipalityCode`
- WHEN `emitSupportDocument` is called
- THEN the supplier validation MUST run before reference-code generation, total calculation, or payload construction
- AND no side effects (such as Factus API calls or database writes) occur

### Requirement: municipality_code sent as non-empty valid string

After supplier validation passes, the `municipality_code` field in the Factus provider payload MUST be set to `supplier.municipalityCode` directly, without the `?? ''` nullish-coalescing fallback. Because validation guarantees the field is non-null at this point, the value MUST be a truthy string.

#### Scenario: municipality_code is the supplier's actual code

- GIVEN the supplier has `municipalityCode` set to `"11001"`
- AND all other required supplier fields are valid
- WHEN the Factus payload provider is built
- THEN `provider.municipality_code` MUST be `"11001"`
- AND it MUST NOT be `""` (empty string)

#### Scenario: Empty-string fallback is removed

- GIVEN the source code for building the Factus provider payload
- WHEN the code is inspected
- THEN there MUST be no `?? ''` or `|| ''` fallback on the `municipalityCode` access
- AND the assignment MUST read `supplier.municipalityCode` directly

### Requirement: Tax rate derived from percentage field

The system MUST derive the Factus item tax `rate` field from the `Tax` entity's `percentage` property, formatted as a fixed-two-decimal string via `(tax.percentage ?? 0).toFixed(2)`. The system MUST NOT reference `tax.rate` (which does not exist on the `Tax` entity).

#### Scenario: Tax with defined percentage produces correct rate string

- GIVEN a purchase order item with a product that has a tax whose `percentage` is `19.0`
- AND the tax `code` is `"01"`
- WHEN the Factus payload items are built
- THEN the item's tax entry MUST have `rate: "19.00"`
- AND the tax entry MUST have `code: "01"`

#### Scenario: Tax with zero percentage

- GIVEN a product tax with `percentage` set to `0.0` and `code` `"03"` (IVA Exento)
- WHEN the Factus payload items are built
- THEN the item's tax entry MUST have `rate: "0.00"`

#### Scenario: Tax percentage is null or undefined

- GIVEN a product tax with `percentage` that is `null` or `undefined`
- WHEN the Factus payload items are built
- THEN the nullish-coalescing fallback `?? 0` MUST be applied
- AND the tax entry MUST have `rate: "0.00"`

#### Scenario: No reference to tax.rate in payload builder

- GIVEN the source code for mapping taxes in the support-document payload
- WHEN the code is inspected
- THEN there MUST be no reference to `tax.rate`
- AND the rate assignment MUST use `tax.percentage`

### Requirement: Order preconditions enforced before validation

The system MUST enforce these order-level preconditions before entering supplier validation, and they MUST remain unchanged: the order MUST exist, its status MUST be `COMPLETED`, and no prior support document MUST exist for the order.

#### Scenario: Non-COMPLETED order is rejected before supplier validation

- GIVEN a purchase order with status `PENDING`
- WHEN `emitSupportDocument` is called
- THEN the system MUST throw `ConflictException` with a message about COMPLETED requirement
- AND supplier validation MUST NOT execute

#### Scenario: Duplicate support document rejected before supplier validation

- GIVEN a COMPLETED purchase order that already has a support document in the database
- WHEN `emitSupportDocument` is called
- THEN the system MUST throw `ConflictException` with a message about existing support document
- AND supplier validation MUST NOT execute
