# Tasks: Remove Migrations + Seed Endpoint

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250-350 |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
800-line budget risk: Low

## Phase 1: Cleanup — Migration Infrastructure

- [x] 1.1 Delete `src/database/migrations/*.ts` (4 files)
- [x] 1.2 Delete `src/database/data-source.ts`
- [x] 1.3 Delete `src/database/seed.ts`
- [x] 1.4 Remove `migration:run` and `seed` scripts from `package.json`

## Phase 2: Core Implementation

- [x] 2.1 Create `src/modules/settings/services/seed.service.ts` — `@InjectEntityManager()` + `em.transaction()` truncates CASCADE + inserts DIAN data; returns `{ taxes, paymentMethods, paymentTypes }`
- [x] 2.2 Create `src/modules/settings/controllers/seed.controller.ts` — `@Controller('settings')` + `@UseGuards(JwtAuthGuard)` + `@Post('seed')` → `{ seeded: SeedResult }`
- [x] 2.3 Register `SeedService` in providers and `SeedController` in controllers within `settings.module.ts`

## Phase 3: Testing

- [x] 3.1 Unit test: `SeedService` — mock `EntityManager.transaction`, verify truncate + insert calls and returned counts
- [x] 3.2 Controller test: `POST /settings/seed` → 201 with `{ seeded: { taxes: 5, paymentMethods: 6, paymentTypes: 2 } }` (unit, service mocked)
- [x] 3.3 Auth test: Guard metadata verified via `Reflect.getMetadata` — `JwtAuthGuard` applied at controller level

## Phase 4: Verification & Cleanup

- [x] 4.1 Run `npm test` — all 11 suites pass, 85 tests
- [ ] 4.2 Verify `npm run start:dev` starts clean (requires running server)
- [ ] 4.3 Verify `POST /settings/seed` → seed data appears via `GET /settings/taxes` (requires running DB)
