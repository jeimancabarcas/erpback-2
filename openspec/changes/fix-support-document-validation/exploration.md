# Exploration: Fix Support Document Validation Errors

## Problem

POST `/v2/support-documents/validate` returns HTTP 422:

```json
{
  "status": "Validation error",
  "message": "Error de validación",
  "data": {
    "errors": {
      "provider.municipality_code": [
        "El campo provider.municipality code es obligatorio."
      ],
      "items.0.taxes.0.rate": [
        "El campo porcentaje de impuesto es obligatorio."
      ]
    }
  }
}
```

## Root Causes

### Bug 1: `provider.municipality_code` sent as empty string

**Location**: `src/modules/purchase-orders/purchase-orders.service.ts:307`

```typescript
municipality_code: supplier.municipalityCode ?? '',
```

**Why it fails**: Factus requires a valid Colombian DIVIPOLA municipality code (e.g., `'68001'`). Empty string `''` is rejected.

**Contributing factors**:

1. `Supplier.municipalityCode` is nullable (`string | null`) in `supplier.entity.ts:32-33`.
2. `CreateSupplierDto` does NOT include `municipalityCode` at all (`create-supplier.dto.ts`) — it cannot be set via API.
3. Validation at lines 262-270 detects missing `municipalityCode` but **never throws** — the `missingFields` array is populated then silently discarded.

### Bug 2: `items.*.taxes.*.rate` sent as `undefined`

**Location**: `src/modules/purchase-orders/purchase-orders.service.ts:~312`

```typescript
taxes: (item.product.taxes || []).map((tax: any) => ({
  code: tax.code,
  rate: tax.rate,   // ← BUG: Tax entity has `percentage`, not `rate`
})),
```

**Why it fails**: The `Tax` entity (`settings/entities/tax.entity.ts`) has `percentage: number` (decimal), not `rate`. `tax.rate` is `undefined`, which Factus rejects.

### Bug 3: Dead validation code

**Location**: `src/modules/purchase-orders/purchase-orders.service.ts:261-270`

```typescript
const missingFields: string[] = [];
if (!supplier.nit) missingFields.push('NIT');
if (!supplier.dv) missingFields.push('dv');
if (!supplier.name) missingFields.push('name');
if (!supplier.address) missingFields.push('address');
if (!supplier.municipalityCode) missingFields.push('municipalityCode');
if (!supplier.legalOrganizationCode)
  missingFields.push('legalOrganizationCode');
// ← NO throw after populating missingFields
```

The missing fields are detected but the error is never raised. The payload is still sent to Factus with invalid data.

## Municipality Data Gap

- No municipality seed data exists anywhere in the codebase.
- Sales module hardcodes `'68679'` (a DIAN sandbox municipality) — see `sales.service.ts:781` and `electronic-bills.service.ts:50,314,329`.
- Suppliers have no way to set `municipalityCode` through the API (missing from DTO).
- Factus provides a municipality endpoint at `/tablas-de-referencia/municipios` with valid DIVIPOLA codes.

## Affected Files

| File                                                                  | Role                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/modules/purchase-orders/purchase-orders.service.ts`              | Contains all 3 bugs in `emitSupportDocument`              |
| `src/modules/settings/entities/tax.entity.ts`                         | Tax entity with `percentage` field (not `rate`)           |
| `src/modules/suppliers/entities/supplier.entity.ts`                   | Supplier entity with nullable `municipalityCode`          |
| `src/modules/suppliers/dto/create-supplier.dto.ts`                    | DTO lacks `municipalityCode` field                        |
| `src/modules/settings/services/seed.service.ts`                       | Seed service — no municipalities                          |
| `src/modules/factus/interfaces/factus-invoicing-gateway.interface.ts` | `FactusSupportDocumentProvider.municipality_code: string` |

## Factus API Reference

From [Factus docs](https://developers.factus.com.co/documentos-soporte/descripcion-de-campos/):

- `provider.municipality_code` — Required. Must be a valid municipality code from [available municipalities](https://developers.factus.com.co/tablas-de-referencia/municipios).
- `items.*.taxes.*.rate` — Required. Tax percentage as string, max 2 decimals. Code must be `01` (IVA) for support documents.

## Existing Pattern (Sales Module)

The sales module uses a hardcoded municipality `'68679'` for DIAN sandbox. This same approach (or a config-based fallback) would work for support documents.

## Scope Estimate

- **Bug fixes**: ~20 lines changed in `purchase-orders.service.ts`
- **DTO addition**: ~5 lines in `create-supplier.dto.ts`
- **Seed data**: New municipality seed entries (~20-30 municipalities for Colombia's major cities)
- **Tests**: New/updated tests for validation and municipality fallback
- **Total**: ~150 lines changed (within review budget)
