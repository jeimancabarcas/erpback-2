# Proposal: Remove Migrations + Seed Endpoint

## Intent

Dead migration files clutter the codebase and fail on run (columns already exist via `synchronize: true`). The CLI `seed.ts` script is fragile — drops the entire `public` schema, requires a separate connection, and has no API surface. Replace both with a proper authenticated seed endpoint inside the Settings module.

## Scope

### In Scope
- Delete 4 migration files + `data-source.ts` + `seed.ts`
- Remove `migration:run` and `seed` scripts from `package.json`
- Add `seed()` method to each settings service (taxes, payment-methods, payment-types)
- Create `POST /api/settings/seed` endpoint (JWT-guarded)
- Endpoint truncates the 3 settings tables, inserts DIAN master data, returns record counts

### Out of Scope
- Seed for other modules (inventory, customers, etc.)
- Production deployment or changing `synchronize: true`
- Soft-seed (upsert-only) — truncate-and-insert is fine for dev

## Capabilities

### New Capabilities
- `settings-seed`: Endpoint to seed DIAN master data (taxes, payment methods, payment types) by truncating and reinserting

### Modified Capabilities
None — no existing specs change behavior at the spec level.

## Approach

1. Add `async seed(queryRunner: QueryRunner): Promise<number>` to each service — truncates table via query runner, inserts seed data, returns count
2. Create `SeedController` with single `POST /settings/seed` endpoint, JWT-guarded
3. Controller opens a transaction, calls all 3 service seed methods in sequence, commits
4. Return `{ seeded: { taxes: N, paymentMethods: N, paymentTypes: N } }`
5. Delete all migration/data-source/seed files; remove npm scripts

## Affected Areas

| Area | Action |
|------|--------|
| `src/database/migrations/*.ts` (4 files) | Delete |
| `src/database/data-source.ts` | Delete |
| `src/database/seed.ts` | Delete |
| `package.json` | Remove 2 scripts |
| `services/taxes.service.ts` | Add `seed()` |
| `services/payment-methods.service.ts` | Add `seed()` |
| `services/payment-types.service.ts` | Add `seed()` |
| `controllers/seed.controller.ts` | New |
| `settings.module.ts` | Register SeedController |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Seed drops data mid-request | Low | Transaction wraps all 3; rollback on error |
| Junction table (`products_taxes`) orphaned | Low | `synchronize: true` recreates on restart |
| Dev-only endpoint called in prod | Med | Guard with `NODE_ENV !== 'production'` or leave behind JWT |

## Rollback Plan

Restore deleted files from git, revert `package.json` scripts, remove SeedController from module.

## Dependencies

None.

## Success Criteria

- [ ] `npm start` works without migration files
- [ ] `POST /api/settings/seed` returns 201 with record counts
- [ ] Seed data appears via existing GET endpoints
- [ ] All existing tests pass
