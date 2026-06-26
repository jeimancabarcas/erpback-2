# invoice-payment-config Specification

## Purpose

Associate a payment method and payment type with a sales invoice at creation time, defaulting to Efectivo/Contado when unspecified. The `PaymentMethod` and `PaymentType` entities already exist in `SettingsModule` — this capability wires them into the invoice flow.

## Requirements

### Requirement: Invoice Entity Payment FK Columns

The `Invoice` entity MUST expose `paymentMethodId` (nullable UUID FK → `payment_methods`) and `paymentTypeId` (nullable UUID FK → `payment_types`), each with a `@ManyToOne` relation, `@JoinColumn`, and eager loading.

#### Scenario: Columns created on migration

- GIVEN the `invoices` table exists without payment FK columns
- WHEN the migration `up()` runs
- THEN `payment_method_id` (UUID, nullable, FK) and `payment_type_id` (UUID, nullable, FK) are added

#### Scenario: Existing rows remain valid

- GIVEN pre-existing invoices with NULL payment columns
- WHEN the table is queried
- THEN no constraint violation occurs because both columns are nullable

### Requirement: CreateInvoiceDto Payment Fields

`CreateInvoiceDto` MUST accept optional `@IsUUID() paymentMethodId?: string` and `@IsUUID() paymentTypeId?: string`, validated with class-validator.

#### Scenario: DTO accepts both optional UUIDs

- GIVEN a POST body with `"paymentMethodId": "uuid-1"` and `"paymentTypeId": "uuid-2"`
- WHEN the DTO is deserialized
- THEN both fields are present and valid UUIDs

#### Scenario: DTO accepts omission of both fields

- GIVEN a POST body without `paymentMethodId` or `paymentTypeId`
- WHEN the DTO is deserialized
- THEN both fields are `undefined` and no validation error is raised

#### Scenario: Invalid UUID is rejected

- GIVEN a POST body with `"paymentMethodId": "not-a-uuid"`
- WHEN the validation pipe processes the DTO
- THEN a `400 Bad Request` is returned with a validation error

### Requirement: SettingsModule Integration

`SalesModule` MUST import `SettingsModule` to resolve `PaymentMethodsService` and `PaymentTypesService` in the DI container. `SalesService` MUST inject both services via constructor.

#### Scenario: Services are injectable

- GIVEN `SettingsModule` is imported by `SalesModule`
- WHEN the DI container resolves `SalesService`
- THEN `PaymentMethodsService` and `PaymentTypesService` are available without resolution errors

### Requirement: Payment Resolution with Fallback

`SalesService` MUST resolve payment config via a private helper `resolvePaymentConfig(dto)`. When `dto.paymentMethodId` / `dto.paymentTypeId` are provided, it MUST look them up and SHALL throw `NotFoundException` if not found. When omitted, it MUST fall back to the default Efectivo (code `'10'`) and Contado (code `'1'`).

#### Scenario: Specific payment method resolved

- GIVEN a DTO with a valid `paymentMethodId` for a Credit Card method (code `'55'`)
- WHEN `resolvePaymentConfig(dto)` is called
- THEN the method with that ID is returned

#### Scenario: Fallback to defaults when IDs are omitted

- GIVEN a DTO without `paymentMethodId` or `paymentTypeId`
- WHEN `resolvePaymentConfig(dto)` is called
- THEN it returns the default PaymentMethod (code `'10'`, Efectivo) and PaymentType (code `'1'`, Contado)

#### Scenario: Invalid payment method ID throws

- GIVEN a DTO with a non-existent `paymentMethodId`
- WHEN `resolvePaymentConfig(dto)` is called
- THEN a `NotFoundException` is thrown

### Requirement: Invoice Creation Stores Payment Config

The `SalesService.create()` method MUST store the resolved payment method ID and payment type ID on the created invoice entity.

#### Scenario: Invoice persisted with selected payment config

- GIVEN `resolvePaymentConfig` returns a Credit Card (`id: X`, code `'55'`) and Installments (`id: Y`, code `'2'`)
- WHEN the invoice is created and persisted
- THEN `invoice.paymentMethodId` equals `X`, `invoice.paymentTypeId` equals `Y`