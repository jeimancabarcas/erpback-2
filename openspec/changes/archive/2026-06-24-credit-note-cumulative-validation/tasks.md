# Tasks: Credit Note Cumulative Validation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180-220 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: RED — Write Failing Tests

- [x] 1.1 Write test: cumulative amount exceeds invoice total (60%+50%→400) in `sales.service.spec.ts`
- [x] 1.2 Write test: single 110% note also rejected in `sales.service.spec.ts`
- [x] 1.3 Write test: amount within limits (60%+40%) passes in `sales.service.spec.ts`
- [x] 1.4 Write test: cumulative qty per product exceeds item limit for A/D in `sales.service.spec.ts`
- [x] 1.5 Write test: qty check skipped for scenario B (discount) and C (price correction) in `sales.service.spec.ts`
- [x] 1.6 Write test: concurrent 60%+60% — second fails in `sales.service.spec.ts`

## Phase 2: GREEN — Implement Validation Method

- [x] 2.1 Add `validateCumulativeLimits(invoice, dto, manager)` to `sales.service.ts` — amount SUM query + new note amount computation from DTO items
- [x] 2.2 Add per-product quantity SUM logic for scenarios A/D (`correctionConceptCode` in `'1','5','2'`) in `sales.service.ts`
- [x] 2.3 Insert `await this.validateCumulativeLimits(invoice, dto, queryRunner.manager)` in `processCreditNoteWithHandler()` before `handler.execute()` (line 728)

## Phase 3: VERIFY — Full Suite

- [x] 3.1 Run `npm run test` — all existing + new tests pass
- [x] 3.2 Run `npm run build` — type check passes
- [x] 3.3 Run `npm run lint` — no lint errors (only pre-existing project-wide `no-unsafe-*` false-positives)
