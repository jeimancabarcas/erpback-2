# SDD Proposal: fix-support-document-validation

## Problem Statement

POST `/v2/support-documents/validate` (invoked internally by `emitSupportDocument` in `purchase-orders.service.ts`) returns HTTP 422 from the Factus API with two errors whenever a supplier lacks a `municipalityCode` or when item taxes use the wrong field name. A third latent bug exists: the `missingFields` array is populated at lines 262–270 but never throws, meaning supplier validation is dead code.

These bugs block the support-document emission workflow for purchase orders, making it impossible to complete the purchase-to-payment lifecycle for COMPLETED orders.

## Root Causes

| #   | Symptom                                                                | Root Cause                                                                                                   | Location                             |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| 1   | `provider.municipality_code` is required (Factus rejects empty string) | `supplier.municipalityCode ?? ''` sends `""` for null/undefined values; Factus expects a valid DIVIPOLA code | `purchase-orders.service.ts:307`     |
| 2   | `items.0.taxes.0.rate` is required (Factus rejects undefined)          | `tax.rate` is undefined because the `Tax` entity has field `percentage`, not `rate`                          | `purchase-orders.service.ts:317`     |
| 3   | Supplier missing-field check never throws                              | `missingFields` array is populated but never inspected — no `throw` after the block                          | `purchase-orders.service.ts:262-270` |

## Root Causes Addressed

1. **`municipality_code` sent as empty string** — `supplier.municipalityCode ?? ''` silently replaces null with `""`, which Factus rejects. Fix: BLOCK emission — if `supplier.municipalityCode` is null/undefined, throw a clear `BadRequestException` listing the missing field. No default/fallback value.
2. **`tax.rate` is undefined** — the `Tax` entity stores `percentage` (a number), but the payload builder reads `tax.rate`. Fix: use `(tax.percentage ?? 0).toFixed(2)` to produce the required string rate.
3. **Dead-code supplier validation** — the `missingFields` array is populated but never acted upon. Fix: after gathering missing fields, throw `BadRequestException` with a descriptive message listing all missing supplier fields.
4. **Supplier DTO lacks `municipalityCode`** — the field is missing from `CreateSupplierDto`, so new suppliers cannot fill it. Fix: add `municipalityCode` with `@IsNotEmpty()` validation to both `CreateSupplierDto` and (via `PartialType`) `UpdateSupplierDto`.
5. **No municipality seed data** — no `Municipality` entity or seed records exist, so users have no reference for valid codes. Fix: create a `Municipality` entity and seed 10 major Colombian municipalities with DIVIPOLA codes compatible with Factus.

## Scope

### In Scope

1. **`CreateSupplierDto`** — add `municipalityCode` field with `@IsNotEmpty()`, `@IsString()` decorators
2. **`UpdateSupplierDto`** — inherits via `PartialType`, no explicit change needed
3. **`purchase-orders.service.ts`** — three fixes in `emitSupportDocument`:
   - Validate `missingFields` and throw `BadRequestException` if non-empty
   - Replace `supplier.municipalityCode ?? ''` with direct access (guaranteed non-null after validation)
   - Replace `tax.rate` with `(tax.percentage ?? 0).toFixed(2)`
4. **New `Municipality` entity** — fields: `code` (PK, DIVIPOLA), `name`, `department`
5. **`SeedService`** — add municipality seeding with 10 major Colombian municipalities
6. **`SettingsModule`** — register `Municipality` entity in TypeORM `forFeature`
7. **Tests** — update seed service spec for municipalities; add/update purchase-orders service spec for the three fixes; add/update suppliers controller/service spec for municipalityCode validation

### Out of Scope

- Migration files (project is not in production; seeding via SQL/entity inserts only)
- Changes to invoice or credit-note emission paths (only support documents affected)
- Frontend changes for municipality selection UI
- Municipality CRUD endpoints (entity + seed only)
- Changes to `FactusSupportDocumentRequest` interface or other Factus interfaces

## Affected Areas

| Module              | Files                                                                                                                        | Change Type                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **suppliers**       | `dto/create-supplier.dto.ts`, `dto/update-supplier.dto.ts`                                                                   | Add `municipalityCode` field with validation |
| **purchase-orders** | `purchase-orders.service.ts`                                                                                                 | Fix three bugs in `emitSupportDocument`      |
| **settings**        | `entities/municipality.entity.ts` (new), `settings.module.ts`, `services/seed.service.ts`                                    | New entity and seed data                     |
| **tests**           | `seed.service.spec.ts`, `purchase-orders.service.spec.ts` (new), `suppliers.controller.spec.ts`, `suppliers.service.spec.ts` | New/updated tests                            |

## Risks and Mitigations

| Risk                                                                                                                                         | Impact             | Likelihood | Mitigation                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Existing suppliers with null `municipalityCode` block support-document emission                                                              | Operational delay  | High       | Add admin endpoint or migration to backfill? _Deferred — user decision is to block and let operators fix supplier records_ |
| `(tax.percentage ?? 0).toFixed(2)` produces string with always 2 decimals; Factus may expect integer-like strings (e.g. `"19.00"` vs `"19"`) | Payment rejection  | Low        | `.toFixed(2)` matches Factus examples; verified with existing invoice adapter patterns                                     |
| Seed data DIVIPOLA codes mismatch Factus expected format                                                                                     | Validation failure | Low        | Codes verified against Factus documentation; same code family used in `sales.service.ts`                                   |
| `@IsNotEmpty()` on `municipalityCode` breaks existing API consumers                                                                          | API regression     | Medium     | Notify frontend team; the field was previously accepted as missing, now it's required                                      |

## Rollback Strategy

**Revert PR**: `git revert <merge-commit>` for the single PR. All changes are contained in one change set.

**Point fixes** (no full revert needed):

- If municipality seeding causes test flakiness: remove the seed data addition from `seed.service.ts` in isolation
- If DTO validation breaks supplier creation: temporarily remove `@IsNotEmpty()` from `municipalityCode` (making it `@IsOptional()`)

## Success Criteria

1. **POST /v2/support-documents/validate** returns HTTP 200 for a purchase order whose supplier has a valid `municipalityCode` and whose items have taxes with valid `percentage` values
2. `emitSupportDocument` throws `BadRequestException` with descriptive message when supplier lacks required fields (including `municipalityCode`)
3. `emitSupportDocument` sends correct `rate` string derived from `tax.percentage`
4. `CreateSupplierDto` rejects payloads without `municipalityCode` (returns 400)
5. `SeedService.seed()` inserts 10 municipalities into the database
6. All existing tests pass; new tests cover the three bug fixes and the new DTO field

## Implementation Approach

### Step 1: Municipality Entity and Seed Data

Create `src/modules/settings/entities/municipality.entity.ts`:

```typescript
@Entity('municipalities')
export class Municipality {
  @PrimaryColumn({ length: 5 })
  code: string; // DIVIPOLA code, e.g. "11001"

  @Column({ length: 100 })
  name: string; // e.g. "Bogotá D.C."

  @Column({ length: 100 })
  department: string; // e.g. "Bogotá D.C."
}
```

Register in `SettingsModule`:

```typescript
TypeOrmModule.forFeature([Tax, PaymentMethod, PaymentType, Municipality]);
```

Add seed data in `SeedService` (after payment types, before categories).

Update `SeedService` return type to include `municipalities: number`.

Update `SeedController` / seed service spec to expect the new count.

### Step 2: Supplier DTO

In `CreateSupplierDto`, add:

```typescript
@IsString({ message: 'El código de municipio debe ser una cadena de texto' })
@IsNotEmpty({ message: 'El código de municipio es obligatorio' })
municipalityCode: string;
```

`UpdateSupplierDto` inherits via `PartialType`, so `municipalityCode` becomes optional on update (correct behavior — you can update a supplier without changing the municipality).

### Step 3: Fix `emitSupportDocument`

In `purchase-orders.service.ts`:

**Fix 1 — Throw on missing supplier fields** (lines 262–270 → replace block):

```typescript
const supplier = order.supplier;
const missingFields: string[] = [];
if (!supplier.nit) missingFields.push('NIT');
if (!supplier.dv) missingFields.push('dv');
if (!supplier.name) missingFields.push('name');
if (!supplier.address) missingFields.push('address');
if (!supplier.municipalityCode) missingFields.push('municipalityCode');
if (!supplier.legalOrganizationCode)
  missingFields.push('legalOrganizationCode');

if (missingFields.length > 0) {
  throw new BadRequestException(
    `El proveedor no tiene los campos requeridos para emitir documento soporte: ${missingFields.join(', ')}`,
  );
}
```

**Fix 2 — Remove `?? ''` fallback** (line 307):

```typescript
// Before: municipality_code: supplier.municipalityCode ?? '',
// After:
municipality_code: supplier.municipalityCode,
```

(Guaranteed non-null after the validation above.)

**Fix 3 — Map `percentage` to `rate`** (line 317):

```typescript
// Before: rate: tax.rate,
// After:
rate: (tax.percentage ?? 0).toFixed(2),
```

### Step 4: Tests

**Seed service spec**: Add expectations for:

- New truncate: `TRUNCATE TABLE "municipalities" CASCADE`
- New insert: `Municipality` with `{ code: '11001', name: 'Bogotá D.C.', department: 'Bogotá D.C.' }`
- Updated return count: `municipalities: 10`

**Purchase-orders service spec**: New test file covering:

- `emitSupportDocument` throws `BadRequestException` when supplier lacks `municipalityCode`
- `emitSupportDocument` throws `BadRequestException` when supplier lacks other required fields
- `emitSupportDocument` sends correct `rate` from `tax.percentage`
- `emitSupportDocument` sends non-empty `municipality_code`
- Happy path: returns support document when all fields valid

**Suppliers spec**: Update/create tests for:

- `create` returns 400 when `municipalityCode` is missing
- `create` succeeds when `municipalityCode` is provided

## Estimated Changed Lines

| Area                                                               | Est. Lines |
| ------------------------------------------------------------------ | ---------- |
| New `Municipality` entity                                          | ~20        |
| Seed service + municipality data                                   | ~40        |
| Settings module registration                                       | ~3         |
| `CreateSupplierDto` update                                         | ~5         |
| `emitSupportDocument` fixes                                        | ~15        |
| Test updates (seed spec, suppliers spec, new purchase-orders spec) | ~200       |
| **Total**                                                          | **~283**   |

Well within the 1500-line review budget.

## Key Assumptions

1. DIVIPOLA codes (11001, 05001, etc.) are the correct municipality identifiers expected by Factus — confirmed via existing Factus usage in `sales.service.ts` (municipalityCode: `'68679'` — a sandbox code) and verified against Factus API documentation.
2. `(tax.percentage ?? 0).toFixed(2)` produces a valid Factus rate string — the Factus interface defines `rate: string` (not `number`), so `.toFixed(2)` is appropriate.
3. The `@IsNotEmpty()` validator on `municipalityCode` is the right constraint — the user explicitly rejected `@IsOptional()` with fallback.
4. No migration files are needed because the project is not in production — entities are synced via `synchronize: true` or manual database reset.
