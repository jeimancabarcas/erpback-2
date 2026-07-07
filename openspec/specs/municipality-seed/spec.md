# municipality-seed Specification

## Purpose

Defines the `Municipality` entity and seed data for Colombian municipalities with valid DIVIPOLA codes. The seed data provides a reference for supplier `municipalityCode` values compatible with the Factus API.

## Requirements

### Requirement: Municipality entity

The system MUST have a `Municipality` entity mapped to the `municipalities` table with the following columns:

- `code` — primary column, `varchar(5)`, the DIVIPOLA municipality code (e.g., `"11001"`)
- `name` — `varchar(100)`, the municipality name (e.g., `"Bogotá D.C."`)
- `department` — `varchar(100)`, the department name (e.g., `"Bogotá D.C."`)

The entity MUST be registered in `SettingsModule`'s `TypeOrmModule.forFeature()`.

#### Scenario: Entity fields match specification

- GIVEN the `Municipality` entity is loaded
- WHEN the entity metadata is inspected
- THEN `code` MUST be a `@PrimaryColumn` with `length: 5`
- AND `name` MUST be a `@Column` with `length: 100`
- AND `department` MUST be a `@Column` with `length: 100`
- AND the table name MUST be `"municipalities"`

#### Scenario: Entity registered in SettingsModule

- GIVEN the `SettingsModule` configuration
- WHEN the module's `forFeature` array is inspected
- THEN `Municipality` MUST be listed alongside `Tax`, `PaymentMethod`, and `PaymentType`

### Requirement: Seed 10 Colombian municipalities

The `SeedService.seed()` method MUST insert 10 major Colombian municipalities into the `municipalities` table. The municipalities MUST include:

| code  | name         | department         |
| ----- | ------------ | ------------------ |
| 11001 | Bogotá D.C.  | Bogotá D.C.        |
| 05001 | Medellín     | Antioquia          |
| 76001 | Cali         | Valle del Cauca    |
| 08001 | Barranquilla | Atlántico          |
| 13001 | Cartagena    | Bolívar            |
| 54001 | Cúcuta       | Norte de Santander |
| 68001 | Bucaramanga  | Santander          |
| 17001 | Manizales    | Caldas             |
| 66001 | Pereira      | Risaralda          |
| 52001 | Pasto        | Nariño             |

#### Scenario: Seed inserts all 10 municipalities

- GIVEN the seed service is invoked on an empty or truncated database
- WHEN `seed()` completes successfully
- THEN the `municipalities` table MUST contain exactly 10 rows
- AND the row with `code = "11001"` MUST have `name = "Bogotá D.C."` and `department = "Bogotá D.C."`
- AND the row with `code = "05001"` MUST have `name = "Medellín"` and `department = "Antioquia"`

#### Scenario: Seed truncates municipalities before inserting

- GIVEN the `municipalities` table already contains rows from a prior seed run
- WHEN `seed()` is invoked
- THEN `TRUNCATE TABLE "municipalities" CASCADE` MUST be executed before inserts
- AND the resulting count MUST be exactly 10 (not 10 + prior count)

#### Scenario: Seed runs after payment types and before categories

- GIVEN the seed service's transaction block
- WHEN the ordering of seed operations is inspected
- THEN municipalities MUST be seeded after payment types
- AND before inventory categories (or in the correct position within the existing seeding pipeline)

### Requirement: Seed return type includes municipalities count

The return value of `SeedService.seed()` MUST include a `municipalities` property of type `number` reflecting the count of inserted municipality rows.

#### Scenario: Return value includes municipalities count

- GIVEN the seed service completes successfully
- WHEN the return value is inspected
- THEN the object MUST have a `municipalities` property
- AND `municipalities` MUST equal `10`

#### Scenario: Seed controller wraps municipalities count

- GIVEN the seed controller returns `{ seeded: result }`
- AND `result.municipalities` is `10`
- WHEN the seed endpoint response is inspected
- THEN the response body MUST include `seeded.municipalities: 10`
