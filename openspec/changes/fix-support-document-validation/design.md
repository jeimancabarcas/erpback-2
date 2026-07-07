# SDD Design: fix-support-document-validation

## Summary

Three bugs in `emitSupportDocument` (purchase-orders service) plus missing DTO field and no municipality reference data block support-document emission. Fix: add `Municipality` entity + seed data, add `municipalityCode` to `CreateSupplierDto`, and patch the three bugs.

---

## 1. Data Flow (End-to-End)

```
[POST /purchase-orders/:id/emit-support-document]
  │
  ▼
PurchaseOrdersService.emitSupportDocument(id)
  │
  ├─ Load order with relations (supplier, items, products, taxes)
  ├─ Validate order.status === 'COMPLETED'
  ├─ Check no existing support document
  │
  ├─ [FIX 3] Validate supplier missing fields → throw BadRequestException
  │     │  checks: nit, dv, name, address, municipalityCode, legalOrganizationCode
  │     │  NEW: if any missing → throw immediately (was dead code)
  │     └─ Block exits here if supplier is incomplete
  │
  ├─ Build FactusSupportDocumentRequest payload
  │     ├─ [FIX 1] municipality_code: supplier.municipalityCode
  │     │     (no `?? ''` fallback — guaranteed non-null after validation)
  │     └─ [FIX 2] taxes: tax.percentage → (tax.percentage ?? 0).toFixed(2)
  │           (was tax.rate which is undefined — Tax entity has `percentage`)
  │
  ├─ Call IFactusInvoicingGateway.createSupportDocument(payload)
  └─ Save PurchaseOrderSupportDocument
```

**Municipality reference data flow (NEW):**

```
SeedService.seed()
  └─ TRUNCATE municipalities CASCADE
  └─ INSERT 10 Colombian municipalities (DIVIPOLA codes)
       ├─ 11001 Bogotá D.C.
       ├─ 05001 Medellín
       ├─ 76001 Cali
       ├─ 08001 Barranquilla
       ├─ 13001 Cartagena
       ├─ 54001 Cúcuta
       ├─ 68001 Bucaramanga
       ├─ 17001 Manizales
       ├─ 66001 Pereira
       └─ 52001 Pasto
```

**Supplier creation flow (CHANGED):**

```
POST /suppliers { nit, name, address, phone, email?, municipalityCode }
  │
  ▼
SuppliersService.create(CreateSupplierDto)
  │  ValidationPipe enforces:
  │   - @IsNotEmpty() municipalityCode
  │   - @IsString() municipalityCode
  │
  └─ Supplier entity saved with municipalityCode
```

---

## 2. File Changes

### 2.1 NEW: `src/modules/settings/entities/municipality.entity.ts`

```typescript
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('municipalities')
export class Municipality {
  @PrimaryColumn({ type: 'varchar', length: 5 })
  code: string; // DIVIPOLA code, e.g. "11001"

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g. "Bogotá D.C."

  @Column({ type: 'varchar', length: 100 })
  department: string; // e.g. "Bogotá D.C."
}
```

**Design decisions:**

- `code` is `PrimaryColumn` (not `PrimaryGeneratedColumn`) because DIVIPOLA codes are stable, known identifiers — no auto-generation needed.
- `varchar(5)` — Colombian DIVIPOLA codes are 5-digit strings (leading zeros matter, e.g. `"05001"`).
- No `@CreateDateColumn` / `@UpdateDateColumn` — read-only reference table, not user-mutable. Keeps it minimal.
- No relation to `Supplier` — the supplier stores the code as a plain string. Adding a FK would require migration and makes seed coupling tighter without benefit at this stage.

### 2.2 MODIFY: `src/modules/settings/settings.module.ts`

Change line 20 from:

```typescript
imports: [TypeOrmModule.forFeature([Tax, PaymentMethod, PaymentType])],
```

to:

```typescript
imports: [TypeOrmModule.forFeature([Tax, PaymentMethod, PaymentType, Municipality])],
```

Also add the import:

```typescript
import { Municipality } from './entities/municipality.entity';
```

### 2.3 MODIFY: `src/modules/settings/services/seed.service.ts`

**Add import:**

```typescript
import { Municipality } from '../entities/municipality.entity';
```

**Add truncate** (after `payment_types` truncate, before `categories` truncate):

```typescript
await em.query(`TRUNCATE TABLE "municipalities" CASCADE`);
```

**Add seed data** (after `paymentTypes` insert, before `categoryData`):

```typescript
const municipalityData = [
  { code: '11001', name: 'Bogotá D.C.', department: 'Bogotá D.C.' },
  { code: '05001', name: 'Medellín', department: 'Antioquia' },
  { code: '76001', name: 'Cali', department: 'Valle del Cauca' },
  { code: '08001', name: 'Barranquilla', department: 'Atlántico' },
  { code: '13001', name: 'Cartagena', department: 'Bolívar' },
  { code: '54001', name: 'Cúcuta', department: 'Norte de Santander' },
  { code: '68001', name: 'Bucaramanga', department: 'Santander' },
  { code: '17001', name: 'Manizales', department: 'Caldas' },
  { code: '66001', name: 'Pereira', department: 'Risaralda' },
  { code: '52001', name: 'Pasto', department: 'Nariño' },
];
const municipalities = await em.insert(Municipality, municipalityData);
```

**Update return type:**

```typescript
): Promise<{
  taxes: number;
  paymentMethods: number;
  paymentTypes: number;
  municipalities: number;   // NEW
  categories: number;
  products: number;
}>
```

**Update return object:**

```typescript
return {
  taxes: taxes.identifiers?.length || taxData.length,
  paymentMethods: paymentMethods.identifiers?.length || pmData.length,
  paymentTypes: paymentTypes.identifiers?.length || ptData.length,
  municipalities: municipalities.identifiers?.length || municipalityData.length,
  categories: categories.identifiers?.length || categoryData.length,
  products: products.identifiers?.length || productInserts.length,
};
```

**Design decisions:**

- Municipios seeded _after_ payment types (as specified) and _before_ categories — the existing truncate order is: taxes → payment_methods → payment_types → (products_taxes, products, categories). New truncate for municipalities goes right after payment_types truncate, and the insert right after paymentTypes insert, keeping the "settings entities first, then inventory" logical grouping.
- No FK from supplier to municipality — seed doesn't need to coordinate with supplier data.
- `municipalityData` is a simple const array — no runtime fetching from Factus `/tablas-de-referencia/municipios`. The 10 codes are the most-used Colombian cities; users can later add more via direct SQL or a future admin endpoint.

### 2.4 MODIFY: `src/modules/suppliers/dto/create-supplier.dto.ts`

Add after the `email` field:

```typescript
@IsString({ message: 'El código de municipio debe ser una cadena de texto' })
@IsNotEmpty({ message: 'El código de municipio es obligatorio' })
municipalityCode: string;
```

**No change to `update-supplier.dto.ts`** — it extends `PartialType(CreateSupplierDto)`, so `municipalityCode` becomes automatically optional on update (correct: you can update a supplier without changing the municipality).

**Design decisions:**

- `@IsNotEmpty()` not `@IsOptional()` — the user explicitly wants to block creation without a municipality code.
- No `@Length(5, 5)` or `@Matches(/^\d{5}$/)` — we validate format lightly to avoid over-constraining against DIVIPOLA changes. Factus will reject invalid codes anyway.
- `municipalityCode` is already in `Supplier` entity as `nullable: true` (varchar). The DTO change + validation pipe ensures new suppliers always have it. Existing suppliers may still have null — the `emitSupportDocument` missing-fields check will catch them.
- The `email` field uses `@IsOptional()` and stays optional; `municipalityCode` is required, so it goes after `email` to keep the required-before-optional field ordering convention.

### 2.5 MODIFY: `src/modules/purchase-orders/purchase-orders.service.ts`

Three targeted edits in `emitSupportDocument`:

#### Fix 3 (throw on missing fields) — replace lines 261–270

**Before** (lines 261–272, note the blank line 271 where a throw should be):

```typescript
// Validate supplier has all required Factus fields
const supplier = order.supplier;
const missingFields: string[] = [];
if (!supplier.nit) missingFields.push('NIT');
if (!supplier.dv) missingFields.push('dv');
if (!supplier.name) missingFields.push('name');
if (!supplier.address) missingFields.push('address');
if (!supplier.municipalityCode) missingFields.push('municipalityCode');
if (!supplier.legalOrganizationCode)
  missingFields.push('legalOrganizationCode');

// Generate reference code: DS-{orderNumber}-{timestamp}
```

**After:**

```typescript
// Validate supplier has all required Factus fields
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

// Generate reference code: DS-{orderNumber}-{timestamp}
```

#### Fix 1 (remove `?? ''`) — line 307

**Before:**

```typescript
municipality_code: supplier.municipalityCode ?? '',
```

**After:**

```typescript
municipality_code: supplier.municipalityCode,
```

`supplier.municipalityCode` is guaranteed non-null at this point because the validation block above already checked it and would have thrown. TypeScript narrows the type to `string` after the guard.

#### Fix 2 (use `percentage` not `rate`) — line ~317

**Before:**

```typescript
taxes: (item.product.taxes || []).map((tax: any) => ({
  code: tax.code,
  rate: tax.rate,
})),
```

**After:**

```typescript
taxes: (item.product.taxes || []).map((tax: Tax) => ({
  code: tax.code,
  rate: (tax.percentage ?? 0).toFixed(2),
})),
```

Also add the `Tax` import at the top of the file:

```typescript
import { Tax } from '../settings/entities/tax.entity';
```

**Design decisions:**

- `(tax.percentage ?? 0).toFixed(2)` — produces a string like `"19.00"` or `"5.00"`. The Factus interface expects `rate: string`. `.toFixed(2)` always gives 2 decimal places, consistent with Factus examples.
- Replaced `any` with `Tax` — the relation `item.product.taxes` returns `Tax[]` (verified from entity definition). Using the proper type avoids accidental field-name bugs like this one.
- The nullish coalescing `tax.percentage ?? 0` is a safety net; `percentage` is `number` (non-nullable in the entity), but runtime data could theoretically have it unset.

---

## 3. Contracts (API Surface)

### 3.1 DTO Validation Changes

| Field                                | Before      | After                                     | Breaking?                                                                    |
| ------------------------------------ | ----------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `CreateSupplierDto.municipalityCode` | Not present | `@IsString()`, `@IsNotEmpty()` (required) | **Yes** — all supplier creation requests must now include `municipalityCode` |
| `UpdateSupplierDto.municipalityCode` | Not present | Inherited via `PartialType` (optional)    | No — optional on update                                                      |

### 3.2 Error Messages (New)

| Scenario                                         | HTTP | Message                                                                               |
| ------------------------------------------------ | ---- | ------------------------------------------------------------------------------------- |
| Supplier missing fields for support document     | 400  | `El proveedor no tiene los campos requeridos para emitir documento soporte: {fields}` |
| Create supplier without municipalityCode         | 400  | `El código de municipio es obligatorio`                                               |
| Create supplier with non-string municipalityCode | 400  | `El código de municipio debe ser una cadena de texto`                                 |

### 3.3 Seed Response (Updated)

```json
{
  "seeded": {
    "taxes": 5,
    "paymentMethods": 6,
    "paymentTypes": 2,
    "municipalities": 10,
    "categories": 10,
    "products": 30
  }
}
```

---

## 4. Database

### 4.1 New Table: `municipalities`

| Column       | Type           | Constraints   |
| ------------ | -------------- | ------------- |
| `code`       | `varchar(5)`   | `PRIMARY KEY` |
| `name`       | `varchar(100)` | `NOT NULL`    |
| `department` | `varchar(100)` | `NOT NULL`    |

### 4.2 Existing Table: `suppliers`

No schema change. The `municipality_code` column already exists as `varchar, nullable`. Existing rows with `NULL` will be caught by the new validation in `emitSupportDocument`.

### 4.3 Seed behavior

- `TRUNCATE TABLE "municipalities" CASCADE` — added before categories/products truncates (order: taxes → payment_methods → payment_types → municipalities → products_taxes → products → inventory_categories).
- Inserts 10 rows via `em.insert(Municipality, [...])`.

---

## 5. Tests

### 5.1 Seed Service Spec (`seed.service.spec.ts`) — NEW

Since no test files exist, this is greenfield. Test structure:

```typescript
describe('SeedService', () => {
  describe('seed()', () => {
    it('should truncate all tables in correct order');
    it('should insert 5 taxes');
    it('should insert 6 payment methods');
    it('should insert 2 payment types');
    it('should insert 10 municipalities'); // NEW
    it('should insert 10 categories');
    it('should insert 30 products');
    it('should return correct counts including municipalities: 10'); // NEW
    it('should seed IVA 19% tax first (id referenced by products_taxes)');
  });
});
```

Key assertions:

- `em.query` called with `TRUNCATE TABLE "municipalities" CASCADE`
- `em.insert` called with `Municipality` and a 10-item array
- First municipality is `{ code: '11001', name: 'Bogotá D.C.', department: 'Bogotá D.C.' }`
- Return value includes `municipalities: 10`

### 5.2 Purchase Orders Service Spec (`purchase-orders.service.spec.ts`) — NEW

```typescript
describe('PurchaseOrdersService', () => {
  describe('emitSupportDocument()', () => {
    // Happy path
    it('should emit a support document when all fields are valid');

    // Fix 3 tests: validation throws
    it('should throw BadRequestException when supplier lacks municipalityCode');
    it(
      'should throw BadRequestException when supplier lacks multiple fields (list them)',
    );
    it('should throw BadRequestException when supplier lacks NIT');
    it('should throw BadRequestException when supplier lacks dv');

    // Fix 1 tests: municipality_code sent correctly
    it(
      'should send municipality_code as the supplier value (not empty string)',
    );

    // Fix 2 tests: tax.percentage → rate
    it('should map tax.percentage to rate with toFixed(2)');
    it('should produce "19.00" for percentage 19');
    it(
      'should produce "0.00" when tax.percentage is null/undefined (edge case)',
    );

    // Existing guards
    it('should throw NotFoundException when order does not exist');
    it('should throw ConflictException when order is not COMPLETED');
    it('should throw ConflictException when support document already exists');
    it('should throw BadRequestException when Factus API fails');
  });
});
```

Mock pattern:

- Mock `purchaseOrderRepository.findOne` to return an order with supplier, items, product, taxes.
- Mock `supportDocumentRepository.find` to return `[]` (no existing doc).
- Mock `factusGateway.createSupportDocument` to return a success response.
- For validation tests, omit specific supplier fields from the mock order.
- For tax tests, set `tax.percentage` on the mock tax objects.

### 5.3 Suppliers Controller/Service Spec — NEW

```typescript
describe('SuppliersController (or SuppliersService)', () => {
  describe('create()', () => {
    it('should return 400 when municipalityCode is missing');
    it('should return 400 when municipalityCode is empty string');
    it('should create supplier when municipalityCode is provided');
    it('should still reject when NIT is missing (existing validation)');
  });

  describe('update()', () => {
    it(
      'should allow updating supplier without municipalityCode (PartialType auto-optional)',
    );
    it('should update municipalityCode when provided');
  });
});
```

---

## 6. Rollout

### Order of operations (single PR)

1. Create `Municipality` entity
2. Register in `SettingsModule`
3. Add seed data to `SeedService` (truncate + insert + return type)
4. Add `municipalityCode` to `CreateSupplierDto`
5. Apply three fixes to `purchase-orders.service.ts`
6. Add/update tests

All changes are contained and independent enough to review together. The PR is small (~60 lines of production code + ~150 lines of test code).

### Rollback

- `git revert <merge-commit>` reverses all changes atomically.
- Point-fix rollbacks:
  - If DTO validation breaks supplier creation: change `@IsNotEmpty()` to `@IsOptional()` on `municipalityCode`.
  - If seed municipality truncate cascades unexpectedly: remove the truncate line.
  - If `toFixed(2)` format is wrong: change to `String(tax.percentage)` or raw `tax.percentage`.

### Risk: existing suppliers with null `municipalityCode`

After deployment, `emitSupportDocument` will throw `BadRequestException` for orders whose supplier lacks `municipalityCode`. Operators must update those suppliers (via PATCH `/suppliers/:id`) with a valid code before they can emit support documents. This is the accepted behavior per the proposal — blocking is intentional.

### Risk: `@IsNotEmpty()` breaks existing API consumers

Any client creating suppliers must now include `municipalityCode`. The frontend team must be notified before deploy. Mitigation: the change is in a single DTO field; adding a municipality dropdown to the supplier form is straightforward.

---

## 7. Decision Log

| Decision                                                                    | Rationale                                                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Municipality` uses `@PrimaryColumn`, not `@PrimaryGeneratedColumn('uuid')` | DIVIPOLA codes are stable external identifiers; no need for surrogate keys                                                |
| No FK from `Supplier` to `Municipality`                                     | Keeps entity decoupled; avoids migration complexity; the code is still validated by Factus                                |
| `municipalityCode` is required on create, optional on update                | `PartialType` inheritance makes this natural; suppliers can be updated without re-sending municipality                    |
| `toFixed(2)` for tax rate                                                   | Factus expects `rate: string`; `.toFixed(2)` matches their format and other adapter patterns in the codebase              |
| Seed truncates municipalities with CASCADE                                  | No FKs depend on municipalities, but CASCADE is defensive against future relations                                        |
| No municipality CRUD endpoints                                              | Out of scope per proposal; entity exists for seed data and type registration only                                         |
| `tax.rate` → `(tax.percentage ?? 0).toFixed(2)` with safety fallback        | `percentage` is non-nullable in the entity, but runtime edge cases (incomplete seeds, partial loads) are cheaply defended |
