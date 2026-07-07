# Tasks: fix-support-document-validation

## Review Workload Forecast

| Field                   | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Estimated changed lines | ~283 (60 production + ~200 test + ~20 entity/seed) |
| 400-line budget risk    | Low                                                |
| Chained PRs recommended | No                                                 |
| Suggested split         | Single PR                                          |
| Delivery strategy       | single-pr                                          |
| Chain strategy          | size-exception                                     |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

**Review budget used**: ~283 of 1500 lines available (~19%). Well within budget.

---

## Implementation Order

All changes are in a single PR. Tasks are ordered by dependency — execute strictly in sequence.

---

### T1: Create `Municipality` Entity

**Files**: `src/modules/settings/entities/municipality.entity.ts` (NEW)

**Description**: Create the `Municipality` entity mapped to table `municipalities` with `@PrimaryColumn` on DIVIPOLA `code` (varchar(5)), `name` (varchar(100)), and `department` (varchar(100)).

**Acceptance criteria**:

- Entity has `@Entity('municipalities')` decorator
- `code` is `@PrimaryColumn({ type: 'varchar', length: 5 })` — no auto-generation
- `name` is `@Column({ type: 'varchar', length: 100 })`
- `department` is `@Column({ type: 'varchar', length: 100 })`
- No `@CreateDateColumn` or `@UpdateDateColumn` (read-only reference table)
- No FK relations to `Supplier` (code stored as plain string)

**Strict TDD steps**:

1. **RED**: Write failing test file `seed.service.spec.ts` that imports `Municipality` and verifies entity metadata (one test per field). These tests will fail until T2+T3 are done.
2. **GREEN**: Create the entity file.
3. **REFACTOR**: Clean up import formatting.

**Verification**: `npm run test` passes or entity compiles without TypeScript errors.

---

### T2: Register `Municipality` in `SettingsModule`

**Files**: `src/modules/settings/settings.module.ts` (MODIFY)

**Description**: Add `Municipality` to the `TypeOrmModule.forFeature([...])` array and add the import statement.

**Changes**:

- Add `import { Municipality } from './entities/municipality.entity';`
- Change `TypeOrmModule.forFeature([Tax, PaymentMethod, PaymentType])` to include `Municipality`

**Acceptance criteria**:

- `Municipality` entity is registered alongside `Tax`, `PaymentMethod`, `PaymentType`
- No TypeScript errors after import

**Verification**: `npm run build` compiles without errors.

---

### T3: Add Municipality Seed Data to `SeedService`

**Files**: `src/modules/settings/services/seed.service.ts` (MODIFY)

**Description**: Add municipality truncate + insert in `seed()`, update return type, and update return object.

**Changes**:

1. Add import: `import { Municipality } from '../entities/municipality.entity';`
2. Add `TRUNCATE TABLE "municipalities" CASCADE` after `payment_types` truncate (line 27)
3. Add `municipalityData` array with 10 Colombian municipalities after `paymentTypes` insert
4. Insert via `em.insert(Municipality, municipalityData)`
5. Update return type from `Promise<{taxes; paymentMethods; paymentTypes; categories; products}>` to include `municipalities: number`
6. Update return object to include `municipalities: municipalities.identifiers?.length || municipalityData.length`

**Seed data** (exact order matters):

```
11001 — Bogotá D.C. / Bogotá D.C.
05001 — Medellín / Antioquia
76001 — Cali / Valle del Cauca
08001 — Barranquilla / Atlántico
13001 — Cartagena / Bolívar
54001 — Cúcuta / Norte de Santander
68001 — Bucaramanga / Santander
17001 — Manizales / Caldas
66001 — Pereira / Risaralda
52001 — Pasto / Nariño
```

**Strict TDD steps**:

1. **RED** — Write seed service tests first (see T6 below — but the test file must come first per TDD). Write the test assertions that expect the new truncate call, 10 municipalities insert, and updated return count. These will fail against the current codebase.
2. **GREEN** — Implement the changes in `seed.service.ts`.
3. **REFACTOR** — Verify seed ordering: paymentTypes → municipalities → categories.

**Acceptance criteria**:

- Seed truncates `municipalities` table before insert
- 10 municipalities inserted with correct codes
- Seed ordering: after payment types, before categories
- Return value includes `municipalities: 10`
- Seed controller response includes `seeded.municipalities: 10`

**Verification**: Manual POST `/settings/seed` returns `{ seeded: { municipalities: 10, ... } }`; `npm run test` passes.

---

### T4: Add `municipalityCode` to `CreateSupplierDto`

**Files**: `src/modules/suppliers/dto/create-supplier.dto.ts` (MODIFY)

**Description**: Add `municipalityCode` field with `@IsString()` and `@IsNotEmpty()` decorators, after the `email` field.

**Changes**:

```typescript
@IsString({ message: 'El código de municipio debe ser una cadena de texto' })
@IsNotEmpty({ message: 'El código de municipio es obligatorio' })
municipalityCode: string;
```

**No change to `UpdateSupplierDto`** — inherits via `PartialType`, making `municipalityCode` optional on update automatically.

**Strict TDD steps**:

1. **RED** — Write supplier controller/service tests first (see T7 below). Test that POST `/suppliers` without `municipalityCode` returns 400. Test that POST with valid code succeeds. These will fail without the DTO change.
2. **GREEN** — Add the field to `CreateSupplierDto`.
3. **REFACTOR** — Ensure field is positioned after `email` (maintaining required-before-optional grouping convention).

**Acceptance criteria**:

- `CreateSupplierDto` has `municipalityCode: string` with `@IsString()` + `@IsNotEmpty()`
- Spanish validation messages
- POST `/suppliers` with missing/empty `municipalityCode` returns 400
- POST `/suppliers` with valid code (`"11001"`) returns 201
- PATCH `/suppliers/:id` without `municipalityCode` succeeds (optional on update)
- PATCH `/suppliers/:id` with new `municipalityCode` updates the field

**Verification**: `npm run test` passes; manual API tests via Postman.

---

### T5: Fix Three Bugs in `emitSupportDocument`

**Files**: `src/modules/purchase-orders/purchase-orders.service.ts` (MODIFY)

**Description**: Three targeted fixes in the `emitSupportDocument` method.

#### Fix 3 (throw on missing supplier fields — lines 261–272)

**Before**:

```typescript
// ...missingFields array populated...
// (no throw — blank line then comment for reference code)
```

**After** — Add throw block after missingFields population:

```typescript
if (missingFields.length > 0) {
  throw new BadRequestException(
    `El proveedor no tiene los campos requeridos para emitir documento soporte: ${missingFields.join(', ')}`,
  );
}
```

#### Fix 1 (remove `?? ''` fallback — line 307)

**Before**: `municipality_code: supplier.municipalityCode ?? '',`
**After**: `municipality_code: supplier.municipalityCode,`

(Guaranteed non-null because Fix 3 validates it above.)

#### Fix 2 (use `percentage` not `rate` — line ~317)

**Before**:

```typescript
taxes: (item.product.taxes || []).map((tax: any) => ({
  code: tax.code,
  rate: tax.rate,
})),
```

**After**:

```typescript
taxes: (item.product.taxes || []).map((tax: Tax) => ({
  code: tax.code,
  rate: (tax.percentage ?? 0).toFixed(2),
})),
```

Also add import at top of file:

```typescript
import { Tax } from '../settings/entities/tax.entity';
```

**Strict TDD steps**:

1. **RED** — Write purchase-orders service spec tests first (see T8 below). Test all three fix scenarios. These will fail before source changes.
2. **GREEN** — Apply all three fixes. Import `BadRequestException` (already imported at top).
3. **REFACTOR** — Verify that `supplier.municipalityCode` is type-narrowed to `string` after the `if (!supplier.municipalityCode)` guard. Replace `any` with `Tax` type parameter.

**Acceptance criteria**:

- `missingFields.length > 0` throws `BadRequestException` with descriptive Spanish message listing all missing fields
- `municipality_code` is sent as `supplier.municipalityCode` directly (no `?? ''` fallback)
- `tax.rate` is replaced with `(tax.percentage ?? 0).toFixed(2)`
- `Tax` import exists at top of file
- No TypeScript errors

**Verification**: `npm run test` passes; POST `/purchase-orders/:id/emit-support-document` works end-to-end with valid supplier.

---

### T6: Seed Service Spec (`seed.service.spec.ts`)

**Files**: `src/modules/settings/services/seed.service.spec.ts` (NEW)

**Description**: Write Jest tests for `SeedService.seed()` covering the new municipality seed data and updated return type.

**Test structure**:

```typescript
describe('SeedService', () => {
  describe('seed()', () => {
    it('should truncate municipalities table');
    it('should insert 10 municipalities');
    it('should insert Bogotá D.C. as first municipality');
    it('should return municipalities: 10 in result');
    it('should seed municipalities after payment types');
    it('should seed municipalities before inventory categories');
    it('should insert 5 taxes');
    it('should insert 6 payment methods');
    it('should insert 2 payment types');
    it('should insert 10 categories');
    it('should insert 30 products');
    it('should return correct counts in response');
  });
});
```

**Mock pattern**: Mock `EntityManager.transaction` with a callback that captures the `em.query` and `em.insert` calls. Verify truncate string contains `"municipalities"` and insert arguments include `Municipality` entity plus 10-item array.

**TDD**: Already written as RED in T1/T3. This task is the verification step — run tests and confirm green.

**Verification**: `npm run test -- --testPathPattern=seed.service.spec` passes all tests.

---

### T7: Suppliers Controller/Service Spec

**Files**: `src/modules/suppliers/suppliers.controller.spec.ts` (MODIFY or NEW)
**Files**: `src/modules/suppliers/suppliers.service.spec.ts` (MODIFY or NEW)

**Description**: Add tests for `municipalityCode` validation on create and update.

Note: If no spec files exist yet for suppliers, create them. If `suppliers.controller.spec.ts` exists, extend it. Same for `suppliers.service.spec.ts`.

**Test cases for service**:

```typescript
describe('SuppliersService', () => {
  describe('create()', () => {
    it('should create supplier when municipalityCode is provided');
    // (DTO validation is handled by ValidationPipe — service test uses
    //  repository.create which accepts any fields. The 400 rejection
    //  is tested at controller level with ValidationPipe.)
  });

  describe('update()', () => {
    it('should update municipalityCode when provided');
    it('should not change municipalityCode when omitted');
  });
});
```

**Test cases for controller** (with ValidationPipe):

```typescript
describe('SuppliersController', () => {
  describe('POST /suppliers', () => {
    it('should return 400 when municipalityCode is missing');
    it('should return 400 when municipalityCode is empty string');
    it('should return 400 when municipalityCode is a number');
    it('should return 201 when municipalityCode is valid');
  });

  describe('PATCH /suppliers/:id', () => {
    it('should allow update without municipalityCode (optional)');
    it('should update municipalityCode when provided');
  });
});
```

**Verification**: `npm run test -- --testPathPattern=suppliers` passes.

---

### T8: Purchase Orders Service Spec

**Files**: `src/modules/purchase-orders/purchase-orders.service.spec.ts` (NEW)

**Description**: Write tests for `emitSupportDocument()` covering all three bug fixes plus existing guards.

**Mock setup**:

- Mock `PurchaseOrderRepository.findOne` to return an order with supplier, items, product, taxes
- Mock `SupportDocumentRepository.find` to return `[]`
- Mock `FactusGateway.createSupportDocument` to return success
- Use `Test.createTestingModule` with NestJS testing utilities

**Test cases**:

| #   | Test                                                                          | Bug fixed         |
| --- | ----------------------------------------------------------------------------- | ----------------- |
| 1   | throws `BadRequestException` when supplier lacks `municipalityCode`           | Fix 3             |
| 2   | throws `BadRequestException` when supplier lacks multiple fields (lists them) | Fix 3             |
| 3   | throws `BadRequestException` when supplier lacks NIT                          | Fix 3             |
| 4   | throws `BadRequestException` when supplier lacks dv                           | Fix 3             |
| 5   | sends `municipality_code` as supplier value (not empty string)                | Fix 1             |
| 6   | maps `tax.percentage` to `rate` with `toFixed(2)` producing `"19.00"`         | Fix 2             |
| 7   | produces `"0.00"` when `tax.percentage` is null/undefined                     | Fix 2             |
| 8   | happy path: emits support document when all fields valid                      | All               |
| 9   | throws `NotFoundException` when order does not exist                          | Guard (unchanged) |
| 10  | throws `ConflictException` when order is not COMPLETED                        | Guard (unchanged) |
| 11  | throws `ConflictException` when support document already exists               | Guard (unchanged) |
| 12  | throws `BadRequestException` when Factus API fails                            | Guard (unchanged) |

**Strict TDD**: This spec is written as RED before T5, then goes GREEN after T5 is implemented.

**Verification**: `npm run test -- --testPathPattern=purchase-orders.service.spec` passes all 12 tests.

---

### T9: Full Test Suite Validation

**Files**: None (run command only)

**Description**: Run the full test suite and confirm all tests pass.

**Steps**:

1. `npm run test` — verify all tests pass (seed service, suppliers, purchase orders, all pre-existing tests)
2. `npm run build` — verify TypeScript compilation
3. If any pre-existing tests fail, investigate and fix (but no pre-existing tests in these modules should be affected by the changes)

**Acceptance criteria**:

- `npm run test` exits with code 0
- All new tests pass
- All pre-existing tests pass (no regressions)
- `npm run build` succeeds

---

## Rollback Boundaries

Each task is reversible independently:

| Task  | Rollback                                                       |
| ----- | -------------------------------------------------------------- |
| T1    | Delete `municipality.entity.ts`                                |
| T2    | Remove `Municipality` from `forFeature` array                  |
| T3    | Remove seed code; revert return type                           |
| T4    | Remove `municipalityCode` field from DTO                       |
| T5    | Revert `purchase-orders.service.ts` to original (git checkout) |
| T6–T8 | Delete or revert spec files                                    |

Full rollback: `git revert <merge-commit>` for the single PR.
