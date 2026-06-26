# Exploration: Radian Factus Documents (Finance Module)

**Change:** `radian-factus-documents`
**Date:** 2026-06-24
**Scope:** Backend (NestJS/TypeORM) — new finance module + Factus query adapter

---

## 1. Current State

### 1.1 No Finance Module Exists

The backend has **10 feature modules** under `src/modules/`:

| Module | Exists? | Purpose |
|--------|---------|---------|
| auth | ✅ | JWT authentication |
| users | ✅ | User management |
| inventory | ✅ | Products, categories, batches |
| suppliers | ✅ | Supplier CRUD |
| purchase-orders | ✅ | Purchase orders |
| customers | ✅ | Customer CRUD |
| sales | ✅ | Invoices, credit/debit notes, electronic emissions |
| factus | ✅ | Factus API integration (auth + invoicing adapters) |
| pdf-generation | ✅ | PDF generation (pdfkit) |
| settings | ✅ | Taxes, payment methods/types |
| **finance** | ❌ | **Does not exist** |

Closest module is `sales`, which handles invoice creation, credit/debit notes, and electronic emission tracking. The `factus` module is the integration layer for the Factus API.

### 1.2 Factus Module — Current Architecture

The Factus module follows a **clean Ports & Adapters (Hexagonal) pattern**:

```
src/modules/factus/
├── factus.module.ts
├── interfaces/
│   ├── factus-auth-gateway.interface.ts      ← IFactusAuthGateway port
│   └── factus-invoicing-gateway.interface.ts  ← IFactusInvoicingGateway port
└── adapters/
    ├── factus-http-auth.adapter.ts            ← auth adapter (OAuth2)
    └── factus-http-invoicing.adapter.ts        ← invoicing adapter (CRUD + PDF)
```

**Module registration** (from `factus.module.ts`):
```typescript
@Module({
  imports: [ConfigModule],
  providers: [
    { provide: 'IFactusAuthGateway', useClass: FactusHttpAuthAdapter },
    { provide: 'IFactusInvoicingGateway', useClass: FactusHttpInvoicingAdapter },
  ],
  exports: ['IFactusAuthGateway', 'IFactusInvoicingGateway'],
})
export class FactusModule {}
```

**Key insight:** The `IFactusAuthGateway` is exported and available for injection by any module that imports `FactusModule` — this means a new query adapter or finance module can reuse the same token-based auth.

### 1.3 Factus HTTP Client Implementation Details

**Auth mechanism** (`factus-http-auth.adapter.ts`):
- OAuth2 password grant via `/oauth/token`
- Credentials from env: `FACTUS_CLIENT_ID`, `FACTUS_CLIENT_SECRET`, `FACTUS_USERNAME`, `FACTUS_PASSWORD`
- Token cached with 60-second safety margin before expiry
- Returns Bearer token

**HTTP approach:** Uses native `fetch()` — NOT NestJS HttpModule/HttpService. Each adapter calls `this.authGateway.getAccessToken()` to get a fresh token.

**Private helper methods in `FactusHttpInvoicingAdapter`:**
- `makeGetRequest(endpoint)` — token-injected GET
- `makePostRequest(endpoint, payload)` — token-injected POST
- `makeDeleteRequest(endpoint)` — token-injected DELETE
- `getActiveNumberingRangeId(documentType)` — helper for numbering ranges

**Currently implemented Factus V2 endpoints:**

| Method | Endpoint | Purpose | In adapter? |
|--------|----------|---------|-------------|
| POST | `/v2/bills/validate` | Create & validate invoice | ✅ `createInvoice()` |
| DELETE | `/v2/bills/destroy/reference/{code}` | Destroy pending invoice | ✅ `destroyInvoice()` |
| POST | `/v2/credit-notes/validate` | Create & validate credit note | ✅ `createCreditNote()` |
| POST | `/v2/debit-notes/validate` | Create & validate debit note | ✅ `createDebitNote()` |
| GET | `/v2/bills/{number}/download-pdf` | Download DIAN invoice PDF | ✅ `downloadInvoicePdf()` |
| GET | `/v2/adjustment-notes/{number}/download-pdf` | Download adjustment note PDF | ✅ `downloadAdjustmentNotePdf()` |
| GET | `/v2/numbering-ranges` | List numbering ranges | ✅ (private helper) |

**NOT implemented (needed for Radian):**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/v2/bills?filter[...]` | List/search invoices |
| GET | `/v2/credit-notes?filter[...]` | List/search credit notes |
| GET | `/v2/debit-notes?filter[...]` | NOT a documented endpoint — need to clarify |
| GET | `/v2/support-documents?filter[...]` | List support documents |
| GET | `/v2/adjustment-notes?filter[...]` | List adjustment notes |
| GET | `/v2/reception/*` | Reception endpoints (DIAN→Factus) |

**Critical note:** The Factus documentation only mentions `/v2/bills`, `/v2/credit-notes`, `/v2/support-documents`, and `/v2/adjustment-notes` as list endpoints. There is no explicit `/v2/debit-notes` list endpoint in the docs — debit notes are represented as a type of adjustment note. The API docs mention an `adjustment-notes` endpoint that seems to cover both credit and debit notes. This needs **clarification** during proposal/spec phase.

### 1.4 Existing Database Entities (Sales Module)

The sales module has well-structured entities that track local copies of DIAN documents after emission:

**`Invoice` entity** (`invoices` table):
- `factusReferenceCode` — the reference code used with Factus API
- `isElectronic` — boolean discriminator
- `emission` — OneToOne to `InvoiceElectronicEmission`

**`InvoiceElectronicEmission` entity** (`invoice_electronic_emissions` table):
- Tracks the response from Factus after creating an electronic invoice
- Fields: `number` (DIAN number), `cude`, `qrUrl`, `publicUrl`, `isValidated`, `validatedAt`
- JSONB fields for `numberingRange`, `items`, `taxes`, `totals`, `links`
- **This is a "sent-document" record, not a "received-document" record**

**`CreditNote` entity** (`credit_notes` table):
- Fields: `referenceCode`, `noteNumber`, `cude`, `qrUrl`, `publicUrl`
- Linked to `Invoice` via `invoiceId`

**`DebitNote` entity** (`debit_notes` table):
- Same structure as CreditNote
- Linked to `Invoice` via `invoiceId`

**No "Radian" or "received documents" tables exist.** The current entities represent documents **we sent to DIAN**, not documents **we received from DIAN** (Radian concept).

### 1.5 Frontend Finance Module

The frontend already has a **finance page** with:

| Component | Path |
|-----------|------|
| Finance page (container) | `components/pages/finance-page/finance-page.component.ts` |
| Invoicing view | `components/pages/finance-page/finance-invoicing-view/` |
| Adjustments view | `components/pages/finance-page/finance-adjustments-view/` |
| Finance service | `services/finance.service.ts` |
| Finance model | `models/finance.model.ts` |

The `FinanceService` is currently **mock-only**:
- Invoices are hardcoded `signal<FinanceInvoice[]>` with mock data
- Adjustments are fetched from backend via `SalesNoteService.getNotes()` → real data
- The invoices list currently shows zero actual data
- The `FinanceInvoice` model already has an `isElectronic` field and `electronicId` field — ready for real data

### 1.6 Environment Configuration

From `.env`:
```
FACTUS_API_URL=https://api-sandbox.factus.com.co
FACTUS_USERNAME=sandboxv2@factus.com.co
FACTUS_PASSWORD=sandbox2026%
FACTUS_CLIENT_ID=a1b72e6b-2ea7-491e-a62e-9c515489c331
FACTUS_CLIENT_SECRET=eBJIUicpUQGvUEDtrDi8MSU8ZfdQMhFtG6G4iw0h
```

Credentials are sandbox only. Auth uses OAuth2 password grant. The `FACTUS_API_URL` includes no trailing version — adapter appends `/v2/...` paths.

---

## 2. Affected Areas

| Area | Path | How Affected |
|------|------|--------------|
| Factus interfaces | `src/modules/factus/interfaces/` | New `IFactusQueryGateway` interface with DTOs for list/search queries and paginated responses |
| Factus adapters | `src/modules/factus/adapters/` | New `FactusHttpQueryAdapter` implementing query gateway |
| Factus module | `src/modules/factus/factus.module.ts` | Register and export new query gateway provider |
| **Finance module (NEW)** | `src/modules/finance/` | New module with controller, service, DTOs for Radian document listing |
| App module | `src/app.module.ts` | Register FinanceModule in imports (no new entities needed for v1) |
| Frontend finance service | `erpfrontend/src/app/services/finance.service.ts` | Replace mock data with real HTTP calls to finance endpoints |
| Frontend finance model | `erpfrontend/src/app/models/finance.model.ts` | May need minor additions for filtering/pagination metadata |

**NOT affected** (no changes needed to existing code):
- `SalesService` / `SalesController` — these handle document creation, not listing from Factus
- Existing entities — only new entities if we choose to persist Radian documents locally
- Auth/auth module — JWT guards reuse pattern from sales controller

---

## 3. Approaches

### Approach A: New `IFactusQueryGateway` + Finance Module (Recommended)

Create a new gateway interface specifically for querying/list operations, following the existing Ports & Adapters pattern.

**What gets built:**
1. `IFactusQueryGateway` interface — methods: `listBills()`, `listCreditNotes()`, `listAdjustmentNotes()`, `listSupportDocuments()`, `listReceptionDocuments()`
2. `FactusQueryFiltersDto` — typed filter parameters (identification, names, status, date range, pagination)
3. `FactusPaginatedResponse<T>` — generic paginated response interface
4. `FactusHttpQueryAdapter` — implements query gateway using same auth + fetch pattern
5. `FinanceModule` — new NestJS module
6. `FinanceController` — REST endpoints: `GET /finance/bills`, `GET /finance/credit-notes`, etc.
7. `FinanceService` — maps Factus DTOs to finance response models, applies business logic
8. Frontend: Replace mock invoice data with real `GET /finance/bills` calls

| Pros | Cons |
|------|------|
| Follows ISP (Interface Segregation) — query operations don't pollute invoicing interface | More files to create (new interface + adapter + module) |
| Reuses existing auth gateway (token caching, refresh) | Requires mapping layer between Factus snake_case and internal camelCase |
| Clean separation: Factus module stays a "plugin", Finance module is the "feature" | |
| Easy to test — mock IFactusQueryGateway in unit tests | |
| Extensible — can later add `IFactusReceptionGateway` for DIAN reception endpoints | |
| Follows existing architecture patterns exactly | |

| Effort |
|--------|
| **Medium** — ~12-15 new files across backend + frontend, but patterns are well-established |

### Approach B: Add List Methods to `IFactusInvoicingGateway`

Add `listBills()`, `listCreditNotes()`, etc. directly to the existing invoicing interface and adapter.

| Pros | Cons |
|------|------|
| Fewer files — no new interface or adapter | Violates ISP — mixes query and command responsibilities |
| Faster to implement | IFactusInvoicingGateway becomes a "god interface" |
| Finance module just calls the gateway | Makes testing harder — must mock entire gateway for query-only tests |
| | Breaks the existing pattern boundary |

| Effort |
|--------|
| **Low** — ~6-8 files, but architectural debt |

### Approach C: Direct HTTP in Finance Module

Finance module calls Factus API directly with its own HTTP client (bypassing the Factus module entirely).

| Pros | Cons |
|------|------|
| Finance module is fully independent | Duplicates auth logic (token acquisition, caching, refresh) |
| No changes to Factus module at all | Violates DRY — two copies of fetch + auth code |
| | Harder to maintain — auth changes need two places updated |
| | No interface for testing — hard to mock |

| Effort |
|--------|
| **Low for v1, High long-term** — quick to build, expensive to maintain |

---

## 4. Recommendation

### **Approach A: New `IFactusQueryGateway` + Finance Module**

This is the only approach that respects the existing architecture while following NestJS best practices:

1. **Clean Architecture compliance**: The Factus module remains a pure adapter layer. Finance is a feature module that depends on an abstraction (the query gateway).

2. **Interface Segregation (ISP)**: Query operations are a different concern from invoicing operations. They should be in separate interfaces per the Dependency Rule.

3. **Reuses existing infrastructure**: The `IFactusAuthGateway` token management is already working and exported. The `makeGetRequest` pattern in the invoicing adapter can be replicated or shared via a base class.

4. **Testability**: The `IFactusQueryGateway` interface allows easy mocking. FinanceService tests can verify mapping logic without network calls.

5. **Extensibility**: Future needs (DIAN reception, document status polling, webhooks) can each get their own gateway interface without bloating existing ones.

### Architecture Diagram (Approach A)

```
┌─────────────────────────────────────────────────────┐
│                     Finance Module                    │
│  FinanceController (JWT-guarded REST endpoints)       │
│       │                                               │
│       ▼                                               │
│  FinanceService                                       │
│    - Maps Factus DTOs → Finance response models       │
│    - Applies business filters/aggregations             │
│    - Composes responses for frontend                  │
│       │                                               │
│       ▼                                               │
│  IFactusQueryGateway (injection token)                │
└──────────────────────────┬──────────────────────────┘
                           │ implements
┌──────────────────────────▼──────────────────────────┐
│                    Factus Module                      │
│  FactusHttpQueryAdapter                               │
│    - Uses IFactusAuthGateway for Bearer token         │
│    - Calls GET /v2/bills, /v2/credit-notes, etc.     │
│    - Deserializes snake_case → camelCase             │
│                                                       │
│  IFactusAuthGateway (already exists)                  │
│    - OAuth2 token management                          │
└─────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Factus API V2   │
                  │  (sandbox/prod)  │
                  └─────────────────┘
```

---

## 5. Risks

1. **API endpoint mismatch**: The Factus documentation does not have a dedicated `/v2/debit-notes` list endpoint. Debit notes may be returned via `/v2/adjustment-notes` with a type discriminator. This needs **API testing/verification** before implementation. If the adjustment-notes endpoint returns both credit and debit notes, the gateway interface should reflect this reality — not mirror the assumed 4 separate endpoints.

2. **Pagination model differences**: Factus uses a pagination model with `total, per_page, current_page, last_page, from, to, links`. The backend uses `{ data, meta: { total, page, lastPage, limit } }`. A mapping layer is needed. Mismatches in how `page` is 1-indexed vs. 0-indexed must be verified.

3. **Rate limiting / performance**: The Factus sandbox API may have rate limits. Listing documents with many filters could be slow. Consider caching strategies or pagination enforcement (never fetch all pages at once).

4. **Auth token scope**: The current OAuth2 token might be scoped only to invoicing operations. Query endpoints may require different scopes or permissions — this needs verification against the Factus sandbox.

5. **No local persistence (v1 scope)**: The current plan fetches and proxies Factus data in real-time. If Factus API is down, the finance module returns errors. Future iterations may need a sync/cache layer (store Factus documents locally for offline availability).

6. **Cross-module dependency**: FinanceModule depends on FactusModule (for the query gateway). This is correct per the Dependency Rule, but the circular dependency guard must be verified — FactusModule must NOT depend on FinanceModule.

7. **Frontend migration**: The frontend `FinanceService` currently uses Angular signals with mock data. Replacing with HTTP observables requires careful migration to avoid breaking the reactive computed metrics (`this.metrics`).

---

## 6. Key Findings Summary

| Finding | Value |
|---------|-------|
| `finance` module exists in backend | **false** |
| Factus client supports GET list operations | **false** — only POST validate + GET PDF |
| Existing Factus list endpoints coded | **NONE** — all unimplemented |
| `IFactusAuthGateway` exported and reusable | **true** — available for injection |
| Factus HTTP pattern (fetch, not HttpModule) | **true** — native fetch with Bearer token |
| "Radian" / "received documents" DB tables | **false** — none exist |
| Frontend finance page exists | **true** — but mock data only |
| Frontend finance model has `isElectronic`, `electronicId` | **true** — ready for real data |
| Debit note list endpoint exists in Factus docs | **UNCERTAIN** — may be under `/v2/adjustment-notes` |
| Existing `InvoiceElectronicEmission` tracks DIAN registration | **true** — but for our sent docs, not Radian docs |

## 7. Needed Endpoints (Backend to Build)

| Priority | Backend Endpoint | Purpose | Factus API Called |
|----------|-----------------|---------|-------------------|
| P0 | `GET /finance/bills` | List electronic invoices from Factus | `GET /v2/bills?filter[...]` |
| P0 | `GET /finance/credit-notes` | List credit notes from Factus | `GET /v2/credit-notes?filter[...]` |
| P1 | `GET /finance/adjustment-notes` | List adjustment notes (credit+debit) | `GET /v2/adjustment-notes?filter[...]` |
| P2 | `GET /finance/support-documents` | List support documents | `GET /v2/support-documents?filter[...]` |
| P3 | `GET /finance/receptions` | List documents received from DIAN | `GET /v2/reception/*` (needs clarification) |

**Filter parameters** (common across all endpoints):
- `identification` — customer NIT/CC
- `names` — customer name search
- `number` — document number
- `status` — 1=validated (DIAN accepted), 0=pending
- `created_at[start_date]` / `created_at[end_date]` — date range
- `per_page` — items per page
- `page` — page number

## 8. Ready for Proposal

**Yes** — The codebase is well-understood, the architecture pattern is clear, and the integration path is straightforward.

**What the orchestrator should tell the user:**
1. The finance module doesn't exist yet — it needs to be created from scratch
2. The Factus module already has the auth plumbing ready (token caching, env config) — we just need to add a query interface
3. The recommended architecture follows the existing Ports & Adapters pattern: a new `IFactusQueryGateway` + `FinanceModule`
4. The debit note list endpoint needs API verification — it may live under `/v2/adjustment-notes`, not a dedicated endpoint
5. The frontend finance page already exists with real adjustment-note data; it just needs invoices connected to real backend endpoints
6. No database schema changes needed for v1 — this is a read-through proxy to Factus API
7. Approximate scope: ~12 new backend files + ~3 frontend file changes
