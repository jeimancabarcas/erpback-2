# Design: Remove Migrations + Seed Endpoint

## Technical Approach

Replace dead migration files and the fragile CLI `seed.ts` with a dedicated `SeedService` + `SeedController` inside the Settings module. The endpoint truncates 3 DIAN master-data tables inside a single transaction and reinserts seed data — no schema drops, no external connections.

## Architecture Decisions

### SeedService (dedicated) vs seed() method on each service

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Add `seed()` to TaxesService, PaymentMethodsService, PaymentTypesService | Spreads truncation/seed logic across 3 files; each service needs QueryRunner injected | ❌ Rejected |
| **Dedicated `SeedService`** | Centralized transaction coordination; easy to add more entities; services stay focused on CRUD | ✅ **Chosen** |

**Rationale**: The existing services follow a pure read-only CRUD pattern (`findAll`, `findOne`). Adding truncate-and-insert logic to them violates single responsibility. A dedicated `SeedService` keeps seed logic cohesive and the existing services clean.

### Transaction management: `EntityManager.transaction()` vs manual `QueryRunner`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Manual `QueryRunner` (connect/start/commit/rollback/release) | More boilerplate, easy to forget cleanup | ❌ Rejected |
| **`EntityManager.transaction(cb)`** | Automatic rollback on error, cleaner code | ✅ **Chosen** |

### Route: `/settings/seed` (no `/api` prefix)

Existing controllers use `@Controller('settings/taxes')` → maps to `/settings/taxes`. There is no global prefix in `main.ts`. The seed endpoint follows the same convention: **`POST /settings/seed`**.

## Data Flow

```
Client ──POST /settings/seed──→ SeedController.seed()
                                    │
                          SeedService.seed()
                             │
                EntityManager.transaction()
                  ├─ TRUNCATE "taxes" CASCADE
                  ├─ TRUNCATE "payment_methods" CASCADE
                  ├─ TRUNCATE "payment_types" CASCADE
                  ├─ INSERT 5 taxes
                  ├─ INSERT 6 payment methods
                  ├─ INSERT 2 payment types
                  └─ COMMIT (or ROLLBACK on error)
                             │
                  Return { taxes, paymentMethods, paymentTypes }
                             │
                  ← 201 { seeded: { taxes: 5, ... } }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/database/migrations/1750000000000-AddIsElectronicToInvoice.ts` | Delete | Dead migration — `synchronize: true` manages schema |
| `src/database/migrations/1750000000001-UpdateInvoiceDefaults.ts` | Delete | Same reason |
| `src/database/migrations/1750000000002-AddSequentialNumberAndEmissionTable.ts` | Delete | Same reason |
| `src/database/migrations/1750000000003-SeedDianMasterData.ts` | Delete | Replaced by seed endpoint |
| `src/database/data-source.ts` | Delete | No longer needed — TypeORM configured via `TypeOrmModule.forRootAsync` |
| `src/database/seed.ts` | Delete | Replaced by `POST /settings/seed` |
| `src/modules/settings/services/seed.service.ts` | **Create** | Dedicated SeedService with transaction |
| `src/modules/settings/controllers/seed.controller.ts` | **Create** | Single `POST` endpoint, JWT-guarded |
| `src/modules/settings/settings.module.ts` | Modify | Register SeedService + SeedController |
| `package.json` | Modify | Remove `migration:run` and `seed` scripts |

## Interfaces / Contracts

```typescript
// SeedService
@Injectable()
class SeedService {
  seed(): Promise<SeedResult>
}

interface SeedResult {
  taxes: number;        // rows inserted
  paymentMethods: number;
  paymentTypes: number;
}

// SeedController
@Controller('settings')
@UseGuards(JwtAuthGuard)
class SeedController {
  @Post('seed')
  seed(): Promise<{ seeded: SeedResult }>
}
```

### SeedService — key implementation details

```typescript
async seed(): Promise<SeedResult> {
  return this.entityManager.transaction(async (em) => {
    // Order matters: payment_types has FK references in invoices
    await em.query(`TRUNCATE TABLE "taxes" CASCADE`);
    await em.query(`TRUNCATE TABLE "payment_methods" CASCADE`);
    await em.query(`TRUNCATE TABLE "payment_types" CASCADE`);

    // No explicit IDs — @PrimaryGeneratedColumn('uuid') auto-generates
    await em.insert(Tax, [
      { name: 'IVA 19%', code: '01', percentage: 19.00, type: TaxType.PERCENTAGE,
        isPurchase: true, isSell: true, isActive: true, sortOrder: 1 },
      // ... 4 more
    ]);
    // PaymentMethods (6), PaymentTypes (2) — same pattern

    return {
      taxes: resultTaxes.raw?.length || 5,
      paymentMethods: resultPaymentMethods.raw?.length || 6,
      paymentTypes: resultPaymentTypes.raw?.length || 2,
    };
  });
}
```

**Why `TRUNCATE` over `DELETE`**: `TRUNCATE` resets the table instantly, uses less transaction log, and is the right semantic for "wipe and reload". `CASCADE` handles any FK references (e.g., `payment_types` referenced by invoices).

**Why no explicit UUIDs**: Let TypeORM's `@PrimaryGeneratedColumn('uuid')` handle generation — cleaner, no dependency on `uuid-ossp` extension, and avoids hardcoding IDs that may collide.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | SeedService — seed returns correct counts | Mock `EntityManager.transaction` to capture the callback, verify TRUNCATE + INSERT calls |
| Integration | `POST /settings/seed` returns 201 + data | Use `supertest` + `TestingModule` with real DB or testcontainers |
| Integration | Data is queryable via GET after seed | Chain POST → GET /settings/taxes and verify 5 items |
| Security | Unauthenticated request returns 401 | Call without JWT header, expect 401 |

## Migration / Rollout

**No data migration required.** The existing `seed.ts` drops the entire `public` schema — anything currently running is already in a dev state. The new endpoint is purely additive. If rollback is needed, restore deleted files from git, revert `package.json`, and remove SeedController from the module.

## Open Questions

- [ ] The spec says `POST /api/settings/seed` but existing controllers have no `/api` prefix — confirm actual route should be `POST /settings/seed` to match codebase convention
- [ ] A `SeedController` doesn't extend the existing controller group for taxes/payment-methods/payment-types — is its route prefix `settings` correct, or should it be nested differently?
- [ ] Remove `ts-node` and `typeorm` dev deps from `package.json` if they were only used for migration/seed scripts?
