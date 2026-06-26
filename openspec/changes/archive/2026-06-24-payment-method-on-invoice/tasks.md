# Tasks: Payment Method & Type on Sales Invoices

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

## Phase 1: Foundation

- [x] 1.1 Add `findByCode(code)` to `PaymentMethodsService` + unit test (mock repo, assert entity returned / `NotFoundException`)
- [x] 1.2 Add `findByCode(code)` to `PaymentTypesService` + unit test (same pattern)
- [x] 1.3 Import `SettingsModule` in `SalesModule.imports`; verify DI resolution of both services in test

## Phase 2: Entity + DTO

- [x] 2.1 Add `paymentMethodId`/`paymentTypeId` FK columns + `@ManyToOne(() => PaymentMethod, { eager: true })` + `@JoinColumn({ name: 'payment_method_id' })` to `Invoice` entity (same for PaymentType)
- [x] 2.2 Add `@IsOptional() @IsUUID('all') paymentMethodId?: string` and `paymentTypeId?: string` to `CreateInvoiceDto` + validation test (valid UUIDs pass, invalid rejected, omission ok)
- [x] 2.3 Unit test entity relations: create invoice with payment IDs via mock, verify FK values stored and relations resolve

## Phase 3: Service Logic

- [ ] 3.1 Inject `PaymentMethodsService` + `PaymentTypesService` into `SalesService` constructor
- [ ] 3.2 Implement `resolvePaymentConfig(dto)`: lookup by ID or fallback to code `'10'` (Efectivo) / `'1'` (Contado); `NotFoundException` on invalid ID + unit tests for all three paths
- [ ] 3.3 Wire resolved payment IDs onto `savedInvoice.paymentMethodId` / `savedInvoice.paymentTypeId` during `create()`
- [ ] 3.4 Replace `paymentForm: '1'` / `paymentMethodCode: '10'` in `create()` Factus payload with resolved codes from `resolvePaymentConfig(dto)`
- [ ] 3.5 Same replacement in `emit()` Factus payload (use `invoice.paymentMethod.code` / `invoice.paymentType.code`)
- [ ] 3.6 Same replacement in `processCreditNoteWithHandler()` Factus payload (use invoice's stored payment codes)
- [ ] 3.7 Same replacement in `processDebitNoteWithHandler()` Factus payload (use invoice's stored payment codes)
- [ ] 3.8 Add `'paymentMethod'` + `'paymentType'` to `findAll()` and `findOne()` relations arrays

## Phase 4: Testing

- [ ] 4.1 E2E: create invoice with `paymentMethodId` + `paymentTypeId` → verify response includes `paymentMethod`/`paymentType` objects with `id`, `name`, `code`
- [ ] 4.2 E2E: create invoice without payment fields → verify default codes (`'1'`/`'10'`) in Factus payload
- [ ] 4.3 Integration: create invoice with/without payment IDs → assert DB columns `payment_method_id` / `payment_type_id` are stored correctly