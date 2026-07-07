# Archive Report: support-document-tax-adjustment

**Date:** 2026-07-07
**Status:** ✅ ARCHIVED WITH GAPS
**Artifact Store:** Hybrid (filesystem + Engram)

---

## Archive Status

**PASS** — Change archived with explicit exception approval for known gaps.

| Gate | Result | Notes |
| ------ | -------- | ------- |
| Proposal | ✅ Present (Observation #376 + filesystem) | |
| Spec | ✅ Present (Observation + filesystem, 2 domains) | |
| Design | ✅ Present (Observation #377 only; no filesystem `design.md`) | Partial archive — design exists in Engram |
| Tasks | ✅ Present (Observation #379 + filesystem) | No unchecked `- [ ]` checkboxes |
| Apply Progress | ✅ Present (Observation #380) | All code tasks (T1–T11) complete |
| Verify Report | ✅ Present (Observation #381 + filesystem) | PASS WITH GAPS |
| Sync Report | ✅ Present (Observation #382 + filesystem) | ✅ Synced |
| Spec Sync | ✅ Complete | Both domains synced to canonical |
| Task Completion Gate | ✅ Passed | No unchecked `- [ ]` boxes — T12/T13 deferred by user |
| Destructive Merge | ✅ N/A | Net-new promotion only |

---

## Artifacts Read

| Artifact | Origin | ID / Path |
| ---------- | -------- | ----------- |
| Proposal | Engram + filesystem | Obs #376 / `proposal.md` |
| Design | Engram only | Obs #377 |
| Tasks | Engram + filesystem | Obs #379 / `tasks.md` |
| Apply Progress | Engram only | Obs #380 |
| Verify Report | Engram + filesystem | Obs #381 / `verify-report.md` |
| Sync Report | Engram + filesystem | Obs #382 / `sync-report.md` |
| Config | filesystem | `openspec/config.yaml` |

---

## Domains Synced

| Domain | Action | Canonical Path | Requirements |
| -------- | -------- | --------------- | ------------- |
| purchase-orders | ADDED (net-new) | `openspec/specs/purchase-orders/spec.md` | 10 reqts, 43 scenarios, 4 NFRs |
| factus-integration | ADDED (net-new) | `openspec/specs/factus-integration/spec.md` | 4 reqts, 14 scenarios, 3 NFRs |

### Requirement Names

**purchase-orders** (ADDED):

1. Pre-tax Price in Support Document Emission
2. Adjustment Note Emission (Concept 2 — Total Annulment)
3. Adjustment Note Guards
4. Stock Reversal on Adjustment Note
5. Purchase Order Status on Adjustment
6. Factus Error Handling for Adjustment Notes
7. Adjustment Note Entities
8. Backend Controller Endpoints
9. Frontend Adjustment Note UI
10. Frontend Model and Service Extensions

**factus-integration** (ADDED):

1. Support Document Adjustment Note Types
2. Gateway Interface Methods
3. HTTP Adapter Endpoints
4. Numbering Range Resolution

---

## Same-Domain Collision Check

No active same-domain collisions found. The other 16 active changes do not touch `purchase-orders` or `factus-integration` domains.

---

## Task Completion Summary

| Category | Total | Complete | Remaining |
| ---------- | ------- | ---------- | ----------- |
| T1–T11 (Code implementation) | 11 | 11 ✅ | 0 |
| T12 (Controller spec tests) | 1 | 0 | 1 ⚠️ Deferred |
| T13 (Frontend tests) | 1 | 0 | 1 ⚠️ Deferred |

### Stale-Checkbox Reconciliation

Not applicable — `tasks.md` uses a numbered list format (no `- [ ]` checkboxes). All 11 code tasks (T1–T11) confirmed complete by apply-progress and verify-report. T12 and T13 are explicitly deferred by user/owner decision.

---

## Explicit Exceptions / Partial-Archive Approvals

The following exceptions were granted by the parent prompt to proceed with archiving:

1. **T12 (Controller spec tests) — DEFERRED**: The backend controller spec (`purchase-orders.controller.spec.ts`) was never written. The parent prompt explicitly states this is deferred by user decision. Verify report lists 4+ missing controller tests.

2. **T13 (Frontend tests) — DEFERRED**: Neither the frontend service spec nor the component spec were written. The parent prompt explicitly states this is deferred by user decision. Verify report lists expected test files.

3. **Design artifact — Missing from filesystem**: The `design.md` file is not present in the `openspec/changes/support-document-tax-adjustment/` directory. It exists in Engram memory (Observation #377). This gap is accepted as part of the hybrid artifact store where not all files were persisted to both backends during the design phase. The design content itself is complete and was verified.

---

## Verification Summary

| Metric | Result |
| -------- | -------- |
| Spec Requirements | ✅ 7/7 domains covered across 2 spec files |
| Tests Passing | ✅ 70/70 pass (5 test files) |
| Type Check | ✅ Pass (no errors in purchase-orders/factus modules) |
| Code Review | ✅ All files verified against design |
| Strict TDD | ⚠️ Code complete; T12/T13 test artifacts deferred |
| Overall Verdict | ⚠️ **PASS WITH GAPS** — Archived with explicit deferral approval |

---

## Residual Risks

| # | Risk | Severity | Mitigation |
| --- | ------ | ---------- | ------------ |
| 1 | **Missing controller tests (T12)** — No test coverage for `POST :id/adjustment-note` and `GET :id/adjustment-note/:noteId/pdf` endpoints (auth guard, validation, error responses) | MEDIUM | Manual verification in sandbox; follow-up PR recommended |
| 2 | **Missing frontend tests (T13)** — No test coverage for adjustment note UI (button visibility, emission flow, download flow, loading/error states) | MEDIUM | Manual QA in frontend environment; follow-up PR recommended |
| 3 | **Pre-tax fix may need monitoring** — The `priceBeforeTax` computation in `emitSupportDocument()` changed behavior for new documents only. Existing documents are unaffected | LOW | Verified in sandbox; same pattern used in sales |
| 4 | **Factus endpoint stability** — Adjustment note endpoints (`/v1/adjustment-notes/support-documents/validate`, `/v2/adjustment-notes/{number}/download-pdf`) are new; API behavior may evolve | LOW | Fallback numbering range (392) implemented; error handling propagates Factus messages |
| 5 | **Design artifact not on filesystem** — `design.md` exists only in Engram memory, not in the archived filesystem directory | LOW | Design is preserved in Engram (Observation #377); future engineers should check both stores |

---

## Archived Path

```
openspec/changes/support-document-tax-adjustment/
  → openspec/changes/archive/2026-07-07-support-document-tax-adjustment/
```

---

## Engram Memory Observation IDs

| Artifact | Observation ID |
| ---------- | --------------- |
| Proposal | #376 |
| Design | #377 |
| Tasks | #379 |
| Apply Progress | #380 |
| Verify Report | #381 |
| Sync Report | #382 |
| Archive Report | (this artifact) |

---

## Structured Status

```yaml
schemaName: spec-driven
changeName: support-document-tax-adjustment
artifactStore: hybrid
actionContext:
  mode: repo-local
  workspaceRoot: C:/Users/jeima/Desktop/ERP Repositories
  allowedEditRoots:
    - C:/Users/jeima/Desktop/ERP Repositories/erpbackend
    - C:/Users/jeima/Desktop/ERP Repositories/erpfrontend
archiveStatus: archived_with_gaps
exceptions:
  - T12 controller tests deferred by user decision
  - T13 frontend tests deferred by user decision
  - design.md missing from filesystem (present in Engram)
residualRisks:
  - Missing controller and frontend test coverage
  - Design artifact gap between hybrid stores
nextRecommended: none (change closed)
```
