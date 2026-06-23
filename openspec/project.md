# erpbackend — Project Overview

## Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.7 |
| Runtime | Node.js (via NestJS) |
| Framework | NestJS 11.x |
| ORM | TypeORM 0.3.x |
| Database | PostgreSQL 15 (Alpine in Docker) |
| Auth | Passport + JWT (bcrypt, passport-jwt) |
| Validation | class-validator + class-transformer |
| PDF | pdfkit |
| External API | Factus API (Colombian electronic invoicing) |
| Config | @nestjs/config (dotenv) |
| Container | Docker Compose (PostgreSQL + pgAdmin4) |

## Build & Dev

| Tool | Command |
|------|---------|
| Build | `nest build` |
| Start | `nest start` / `nest start --watch` |
| Format | `npm run format` (Prettier) |
| Lint | `npm run lint` (ESLint flat config) |
| Type Check | `npm run build` (tsc via NestJS) |

## Architecture

- **Pattern**: Module-per-feature with NestJS conventions
- **Modules**: auth, users, inventory, suppliers, purchase-orders, customers, sales, factus, pdf-generation
- **Structure**: Each module has entities/, dto/, services, and controllers
- **Shared**: common/dto/, common/helpers/, common/interfaces/
- **Database**: TypeORM with PostgreSQL, entities registered in AppModule
- **CodeGraph**: Indexed at `.codegraph/` — use `codegraph explore` before grep for code search

## Module Overview

| Module | Purpose |
|--------|---------|
| Auth | JWT authentication, Passport strategies |
| Users | User management |
| Inventory | Products, categories, batches, stock adjustments |
| Suppliers | Supplier management |
| Purchase Orders | Purchase orders with items |
| Customers | Customer management |
| Sales | Invoices, credit/debit notes, invoice items |
| Factus | Electronic invoicing integration (Factus API) |
| PDF Generation | PDF document generation (pdfkit) |

## Testing

| Layer | Tool | Command |
|-------|------|---------|
| Unit | Jest + ts-jest | `npm test` |
| Integration | Jest + supertest | `npm run test:e2e` |
| E2E | Jest + supertest | `npm run test:e2e` |
| Coverage | Jest built-in | `npm run test:cov` |

## Installed Skills

The project uses these agent skills (from `skills-lock.json`):
- clean-architecture, clean-code, hexagonal-architecture
- nestjs-best-practices, typeorm

## SDD Status

- SDD initialized: yes
- Active changes: sales-manual-invoice (in verify/archive phase)
- Archived changes: 6 completed changes
- Specs defined: 8 domains with spec.md files
- Strict TDD: enabled
- Artifact store mode: hybrid (openspec files + Engram)

## Risks & Notes

- **Naming**: package.json name is `erpbackend2`, directory is `erpbackend` — config uses `erpbackend`.
- **Security**: JWT secret in `.env` is placeholder (`super-secret-key-change-me`). Factus sandbox credentials present. DB sync mode `synchronize: true` — dev only.
- **TypeScript**: `noImplicitAny: false` — consider enabling for stricter checks.
- **Docker**: DB_PORT 5433 mapped to PostgreSQL 5432 (non-standard external port).
