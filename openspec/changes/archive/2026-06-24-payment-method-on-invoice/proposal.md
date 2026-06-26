# Proposal: Payment Method & Type on Sales Invoices

## Intent

Eliminate hardcoded `paymentForm: '1'` (Contado) and `paymentMethodCode: '10'` (Efectivo) from four Factus payload sites in `SalesService`. Allow invoices to carry an explicit payment method and type, defaulting to current values when none is provided. The `PaymentMethod` (6 DIAN codes) and `PaymentType` (2 codes) entities, services, controllers, and seed data already exist — we wire them into the sales flow.

## Scope

### In Scope
- **Invoice entity**: Add `paymentMethodId` (FK → payment_methods, nullable) and `paymentTypeId` (FK → payment_types, nullable) with `@ManyToOne` + `@JoinColumn`
- **CreateInvoiceDto**: Add `@IsOptional() @IsUUID() paymentMethodId?` and `@IsOptional() @IsUUID() paymentTypeId?`
- **Sales module**: Import `SettingsModule` to inject `PaymentMethodsService` and `PaymentTypesService`
- **Sales service**: Inject services; look up payment method/type by ID, fall back to Efectivo (code `10`) / Contado (code `1`); replace 4 hardcoded Factus payload sites (create, emit, credit note, debit note)
- **Frontend**: Two dropdown selects in sale form; display names in invoice detail; add fields to `Invoice` model

### Out of Scope
- Changing payment method/type after invoice creation
- Payment validation rules (e.g., credit card requires installments)
- Factus code mapping (DIAN codes are already 1:1)
- Filtering invoices by payment config via `QueryInvoicesDto`

## Capabilities

### New Capabilities
- `invoice-payment-config`: Associate a payment method and payment type with a sales invoice at creation, defaulting to Efectivo/Contado when unspecified

### Modified Capabilities
- `sales-manual-invoice`: `Invoice` entity gains `paymentMethod` and `paymentType` relations with eager loading; `CreateInvoiceDto` gains two optional UUID fields; API responses include resolved payment method/type objects

## Approach

**Approach A — Foreign Key + Entity Relations**. Add nullable FK columns with `@ManyToOne`, matching the existing `customer` pattern. The `SettingsModule` is already a shared dependency for taxes (no new coupling risk). Create a private helper `resolvePaymentConfig(dto)` that:

1. Looks up `paymentMethodId` / `paymentTypeId` if provided, validates existence
2. Falls back to "Efectivo" (code `10`) / "Contado" (code `1`)
3. Returns entities for storage and their `.code` values for Factus payloads

Add `'paymentMethod'` and `'paymentType'` to `relations` arrays in `findAll()`/`findOne()` for eager resolution in responses.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/sales/entities/invoice.entity.ts` | Modified | +2 FK columns, +2 `@ManyToOne` relations, +2 imports |
| `src/modules/sales/dto/create-invoice.dto.ts` | Modified | +2 optional UUID fields |
| `src/modules/sales/sales.module.ts` | Modified | +`SettingsModule` import |
| `src/modules/sales/sales.service.ts` | Modified | Inject 2 services; replace 4 hardcoded `paymentForm`/`paymentMethodCode` |
| `erpfrontend/.../invoice.model.ts` | Modified | +`paymentMethodId?`, `paymentTypeId?`, +resolved objects |
| `erpfrontend/.../sale-form/` | Modified | +2 dropdown selects populated from settings endpoints |
| `erpfrontend/.../invoice-detail/` | Modified | Display payment method/type names |
| DB `invoices` table | Modified | +`payment_method_id`, +`payment_type_id` (nullable FK) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sales→Settings module coupling | Low | Settings already imported for taxes; no circular dependency |
| Existing invoices have NULL payment columns | Low | Nullable columns; fallback defaults applied at read time |
| Factus rejects unexpected payment codes | Low | Seed data uses exact DIAN codes; validated by existing suite |
| Frontend dropdown data not available | Low | `GET /settings/payment-methods` and `GET /settings/payment-types` already exist |

## Rollback Plan

1. Remove `SettingsModule` from `SalesModule.imports`
2. Revert 4 Factus payload sites to hardcoded `'1'`/`'10'`
3. Remove `paymentMethodId`/`paymentTypeId` from DTO, entity, and relations arrays
4. Run migration `down()` to drop FK columns
No data loss — all columns are nullable and additive.

## Dependencies

- `SettingsModule` exports `PaymentMethodsService` and `PaymentTypesService` (already in place)
- Seed data: 6 payment methods (codes 10, 42, 48, 49, 55, 79) and 2 payment types (codes 1, 2)

## Success Criteria

- [ ] Invoice creation accepts optional `paymentMethodId`/`paymentTypeId` and stores FKs
- [ ] When omitted, Factus payloads send `paymentForm: '1'` / `paymentMethodCode: '10'` (backward-compatible)
- [ ] When provided, Factus payloads send the selected method's `code` and type's `code`
- [ ] Zero hardcoded `'1'`/`'10'` literals remain in the 4 Factus payload sites
- [ ] Frontend sale form shows payment method/type dropdowns populated from settings
- [ ] All existing tests pass; new tests cover `resolvePaymentConfig`, DTO validation, and service integration
