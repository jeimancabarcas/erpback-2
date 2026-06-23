# Delta: Remove Migrations + Seed Endpoint

## ADDED Requirements

### Requirement: Settings Seed Endpoint

The system MUST expose `POST /api/settings/seed` guarded by `@UseGuards(JwtAuthGuard)`. The endpoint MUST execute within a single database transaction and return `201 Created` with `{ seeded: { taxes: number, paymentMethods: number, paymentTypes: number } }`.

#### Scenario: Happy path — full reseed

- GIVEN an authenticated request to POST /api/settings/seed
- WHEN the endpoint executes
- THEN the taxes, payment_methods, and payment_types tables are truncated and reseeded
- AND the response body contains record counts for each table
- AND GET /api/settings/taxes returns the seeded data

#### Scenario: Unauthenticated request

- GIVEN a request without a valid JWT token
- WHEN calling POST /api/settings/seed
- THEN the endpoint returns 401 Unauthorized

#### Scenario: Transaction rollback on failure

- GIVEN an authenticated request to POST /api/settings/seed
- WHEN the seed operation fails mid-execution (e.g., constraint violation)
- THEN the entire transaction is rolled back
- AND the previous data in all 3 tables remains intact

#### Scenario: Idempotent when called twice

- GIVEN tables already contain seeded data
- WHEN POST /api/settings/seed is called a second time
- THEN tables are truncated and reseeded successfully
- AND record counts match the expected values

#### Scenario: Tables don't exist yet (first startup)

- GIVEN the database has never been initialized
- WHEN POST /api/settings/seed is called after `synchronize: true` creates the tables
- THEN the truncate-and-insert succeeds
- AND all 13 records are inserted

### Requirement: Seed Data — Taxes

The system MUST insert these 5 records into the `taxes` table:

| name | code | percentage | type | isPurchase | isSell | sortOrder |
|------|------|-----------|------|------------|--------|-----------|
| IVA 19% | 01 | 19.00 | percentage | true | true | 1 |
| IVA 5% | 02 | 5.00 | percentage | true | true | 2 |
| IVA Exento | 03 | 0.00 | percentage | true | true | 3 |
| INC | 04 | 0.00 | percentage | true | true | 4 |
| ICA | 05 | 0.00 | percentage | false | true | 5 |

All records MUST have `isActive: true`.

### Requirement: Seed Data — Payment Methods

The system MUST insert these 6 records into the `payment_methods` table:

| name | code | description | sortOrder |
|------|------|-------------|-----------|
| Efectivo | 10 | Pago en efectivo | 1 |
| Consignación | 42 | Consignación bancaria | 2 |
| Tarjeta Débito | 48 | Pago con tarjeta débito | 3 |
| Tarjeta Crédito | 49 | Pago con tarjeta crédito | 4 |
| Transferencia | 55 | Transferencia bancaria | 5 |
| Cheque | 79 | Pago con cheque | 6 |

All records MUST have `isActive: true`.

### Requirement: Seed Data — Payment Types

The system MUST insert these 2 records into the `payment_types` table:

| name | code | description | sortOrder |
|------|------|-------------|-----------|
| Contado | 1 | Pago de contado | 1 |
| Crédito | 2 | Pago a crédito/plazo | 2 |

All records MUST have `isActive: true`.

## REMOVED Requirements

### Requirement: Migration Files

All 4 files in `src/database/migrations/` MUST be deleted.
(Reason: Schema is managed by `synchronize: true`. Dead migration files fail on run because columns already exist.)
(Migration: Remove the files. `synchronize: true` creates tables from entities.)

### Requirement: data-source.ts

`src/database/data-source.ts` MUST be deleted.
(Reason: No longer needed — TypeORM is configured via NestJS `TypeOrmModule.forRoot()`, not a standalone DataSource.)
(Migration: Remove the file.)

### Requirement: seed.ts

`src/database/seed.ts` MUST be deleted.
(Reason: Replaced by `POST /api/settings/seed`. The CLI script is fragile — it drops the entire `public` schema and requires a separate connection.)
(Migration: Use `POST /api/settings/seed` with a valid JWT token.)

### Requirement: npm scripts

The `migration:run` and `seed` entries in `package.json` scripts MUST be removed.
(Reason: Corresponding source files are deleted — scripts would fail with missing module errors.)
(Migration: Remove both entries from the `scripts` block.)
