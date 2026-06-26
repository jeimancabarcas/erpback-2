## Exploration: Payment Method & Payment Form on Sales Invoices

### Current State

The sales invoice system currently **hardcodes** payment method and payment form for all Factus (DIAN) electronic transactions:

- **Invoice creation** (`SalesService.create()`, line 240-248): Always sends `paymentForm: '1'` (Contado) and `paymentMethodCode: '10'` (Efectivo)
- **Invoice emission** (`SalesService.emit()`, line 442-453): Same hardcoded values
- **Credit notes** (`processCreditNoteWithHandler()`, line 902-908): Same hardcoded values
- **Debit notes** (`processDebitNoteWithHandler()`, line 1050-1056): Same hardcoded values

The `PaymentMethod` and `PaymentType` entities already exist in the `settings` module with proper DIAN-standard codes. The seed service creates 6 payment methods and 2 payment types. The `FactusPaymentDetail` interface in the Factus gateway already supports `paymentForm`, `paymentMethodCode`, `amount`, `referenceCode`, and `dueDate` — the adapter correctly maps them to snake_case. The infrastructure (entities, services, gateway interface) is ready. The gap is that the invoice entity has NO columns to store these fields, the DTOs don't accept them, and the service doesn't look them up.

### Affected Areas

#### Backend (erpbackend)

- `src/modules/sales/entities/invoice.entity.ts` — **Add columns**: `paymentMethodId` (uuid, FK → payment_methods), `paymentTypeId` (uuid, FK → payment_types). Add `@ManyToOne` relations with `@JoinColumn`.
- `src/modules/sales/dto/create-invoice.dto.ts` — **Add optional fields**: `paymentMethodId` (UUID) and `paymentTypeId` (UUID) with `@IsOptional()`, `@IsUUID()`.
- `src/modules/sales/sales.module.ts` — **Add import**: `SettingsModule` so PaymentMethodsService and PaymentTypesService are injectable.
- `src/modules/sales/sales.service.ts` — **4 injection sites + logic**:
  1. Inject `PaymentMethodsService` and `PaymentTypesService`
  2. In `create()`: validate provided payment method/type exist, store entity references on invoice, use their `code` values in Factus payload instead of hardcoded strings
  3. In `emit()`: read stored payment method/type from invoice, use codes in Factus payload
  4. In `processCreditNoteWithHandler()` and `processDebitNoteWithHandler()`: same approach for credit/debit note Factus payloads
  5. In `findAll()` and `findOne()`: add `'paymentMethod'` and `'paymentType'` to relations arrays for eager loading
- `src/modules/sales/sales.controller.ts` — No changes needed (DTO field additions are transparent)
- `src/modules/sales/dto/query-invoices.dto.ts` — **Optional**: add `paymentMethodId` filter if needed
- Database (via TypeORM `synchronize` or manual SQL) — Add `payment_method_id` and `payment_type_id` columns to `invoices` table

#### Frontend (erpfrontend)

- `src/app/models/invoice.model.ts` — **Add fields** to `Invoice`: `paymentMethodId?`, `paymentTypeId?`, `paymentMethod?: { id, name, code }`, `paymentType?: { id, name, code }`. **Add fields** to `CreateInvoiceDto`: `paymentMethodId?`, `paymentTypeId?`.
- `src/app/components/molecules/sale-form/sale-form.component.ts` — **Add form controls**: two `<ui-select>` dropdowns for payment method and payment type. Fetch available options from backend (or use hardcoded list). Default to "Efectivo" (code 10) / "Contado" (code 1) when not changed.
- `src/app/services/invoice.service.ts` — No changes needed (DTO typed upstream)
- `src/app/components/organisms/invoice-detail-dialog/` — **Display** payment method/type name in the invoice detail view

### Approaches

#### Approach A: Foreign Key + Entity Relations (Recommended)

Store `paymentMethodId` / `paymentTypeId` as foreign keys in the invoice table with `@ManyToOne` relations, eagerly load them in responses.

- **Pros**:
  - Standard NestJS/TypeORM pattern already used throughout the codebase (e.g., `customer` relation)
  - Referential integrity via foreign keys
  - Easy to join and display in API responses
  - Enables filtering invoices by payment method
  - Changes are additive — existing invoices get NULL (no migration pain)
- **Cons**:
  - Adds two extra joins per invoice load (but these are lightweight lookups on a small lookup table)
  - Tight coupling between Sales and Settings modules (but Settings module is already a shared dependency for taxes elsewhere)
- **Effort**: Medium

#### Approach B: Code-Only (Store Codes, Not IDs)

Store `paymentMethodCode` / `paymentTypeCode` as plain string columns in the invoice table, without FK relations.

- **Pros**:
  - Simpler — no module dependency, no joins
  - Avoids potential circular dependency risks
- **Cons**:
  - No referential integrity — codes can become stale or invalid
  - Forces frontend/API consumers to know DIAN codes to display names
  - Goes against existing codebase patterns (customer is FK, not just customer document number)
  - The Settings module is already used for taxes — adding payment lookup is consistent
- **Effort**: Low

#### Approach C: Hybrid — Store IDs + Denormalized Codes

Store both `paymentMethodId` / `paymentTypeId` (FK) PLUS `paymentMethodCode` / `paymentTypeCode` (denormalized strings).

- **Pros**:
  - Referential integrity + fast reads without joins
  - Codes survive if payment method is later deleted
- **Cons**:
  - Redundant data — increases maintenance burden
  - Over-engineering for a small domain (6 methods, 2 types)
- **Effort**: High (unnecessary complexity)

### Recommendation

**Approach A — Foreign Key + Entity Relations**. This follows the exact pattern already used for `customer` on the invoice entity. The Settings module already exports `PaymentMethodsService` and `PaymentTypesService`. The Sales module just needs to import SettingsModule and inject the services. The Factus payload already supports the structure — we just stop hardcoding and read the codes from the selected entities.

For backward compatibility with existing manual invoices (which have no payment info), both columns should be **nullable**. When creating an invoice without providing payment method/type, the defaults should be "Efectivo" (code '10') / "Contado" (code '1') to match current hardcoded behavior.

### Risks

- **Module coupling**: Adding `SettingsModule` to `SalesModule` imports creates a dependency. However, Settings module is already used as a shared dependency (taxes flow through `InvoiceItemTax`), so this is not a new risk.
- **Breaking existing API consumers**: Adding nullable optional fields to the DTO and response is backward-compatible. The `findAll`/`findOne` methods already use `relations` arrays — adding two more relations only changes response shape additively.
- **Factus codes must match DIAN**: The seed data uses correct DIAN codes (verified). If an admin modifies codes in the database after invoices are created, the stored FK still resolves to the correct entity. Historical invoices reference the entity, not the code — safe.
- **Frontend dropdown data**: Payment methods/types are not currently exposed via a dedicated API endpoint that the frontend consumes for dropdowns. The Settings module controllers serve admin CRUD pages. A lightweight `GET /settings/payment-methods?isActive=true` endpoint already exists via `PaymentMethodsController` — the frontend can call it. Alternatively, the frontend can hardcode the 6 methods + 2 types for now (they rarely change).

### Ready for Proposal

**Yes**. The scope is well-defined and bounded:
1. Invoice entity: 2 FK columns + 2 relations
2. DTO: 2 optional UUID fields
3. Service: inject settings services, use codes in 4 Factus payload sites
4. Frontend: 2 dropdowns in sale-form, display in detail view
5. Database: 2 new columns (null-safe, no migration of existing data needed)

This change is additive, backward-compatible, and the infrastructure (entities, services, gateway interface, seed data) is already in place.
