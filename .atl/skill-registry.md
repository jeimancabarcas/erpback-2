# Skill Registry

Generated: 2026-06-23
Scope: user + project

## User Skills

| Skill | Trigger | Path |
|-------|---------|------|
| _shared | Shared SDD references. Not invokable. | `C:\Users\jeima\.config\opencode\skills\_shared\SKILL.md` |
| branch-pr | Creating, opening, or preparing PRs for review | `C:\Users\jeima\.config\opencode\skills\branch-pr\SKILL.md` |
| chained-pr | PRs over 400 lines, stacked PRs, review slices | `C:\Users\jeima\.config\opencode\skills\chained-pr\SKILL.md` |
| cognitive-doc-design | Writing guides, READMEs, RFCs, onboarding, architecture docs | `C:\Users\jeima\.config\opencode\skills\cognitive-doc-design\SKILL.md` |
| comment-writer | PR feedback, issue replies, reviews, Slack messages | `C:\Users\jeima\.config\opencode\skills\comment-writer\SKILL.md` |
| customize-opencode | Editing opencode's own configuration | `C:\Users\jeima\.config\opencode\skills\customize-opencode\SKILL.md` (built-in) |
| find-skills | Discovering and installing agent skills | `C:\Users\jeima\.agents\skills\find-skills\SKILL.md` |
| go-testing | Go tests, go test coverage, teatest, golden files | `C:\Users\jeima\.config\opencode\skills\go-testing\SKILL.md` |
| issue-creation | Creating GitHub issues, bug reports, feature requests | `C:\Users\jeima\.config\opencode\skills\issue-creation\SKILL.md` |
| judgment-day | Dual review, adversarial review, juzgar | `C:\Users\jeima\.config\opencode\skills\judgment-day\SKILL.md` |
| sdd-apply | Implement SDD tasks from specs and design | `C:\Users\jeima\.config\opencode\skills\sdd-apply\SKILL.md` |
| sdd-archive | Archive completed SDD changes | `C:\Users\jeima\.config\opencode\skills\sdd-archive\SKILL.md` |
| sdd-design | Create SDD technical design | `C:\Users\jeima\.config\opencode\skills\sdd-design\SKILL.md` |
| sdd-explore | Explore SDD ideas before committing | `C:\Users\jeima\.config\opencode\skills\sdd-explore\SKILL.md` |
| sdd-init | Initialize SDD context | `C:\Users\jeima\.config\opencode\skills\sdd-init\SKILL.md` |
| sdd-onboard | Walk through SDD workflow | `C:\Users\jeima\.config\opencode\skills\sdd-onboard\SKILL.md` |
| sdd-propose | Create SDD change proposal | `C:\Users\jeima\.config\opencode\skills\sdd-propose\SKILL.md` |
| sdd-spec | Write SDD delta specs | `C:\Users\jeima\.config\opencode\skills\sdd-spec\SKILL.md` |
| sdd-tasks | Break SDD change into implementation tasks | `C:\Users\jeima\.config\opencode\skills\sdd-tasks\SKILL.md` |
| sdd-verify | Verify SDD implementation | `C:\Users\jeima\.config\opencode\skills\sdd-verify\SKILL.md` |
| skill-creator | Create LLM-first skills | `C:\Users\jeima\.config\opencode\skills\skill-creator\SKILL.md` |
| skill-improver | Audit and improve LLM-first skills | `C:\Users\jeima\.config\opencode\skills\skill-improver\SKILL.md` |
| skill-registry | Index available skills | `C:\Users\jeima\.config\opencode\skills\skill-registry\SKILL.md` |
| work-unit-commits | Plan commits as reviewable work units | `C:\Users\jeima\.config\opencode\skills\work-unit-commits\SKILL.md` |

## Project Convention Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | CodeGraph usage instructions, project-level agent directives |
| `opencode.jsonc` | OpenCode MCP config (CodeGraph enabled) |
| `skills-lock.json` | Installed third-party skills (clean-architecture, clean-code, hexagonal-architecture, nestjs-best-practices, typeorm) |

## Project Skills

No project-local skill directories found under expected paths (`skills/`, `.opencode/skills/`, `.agents/skills/`).

## Notes

- SDD skills (`sdd-*`), `_shared`, and `skill-registry` are skipped from deduplication.
- Registry is an index — sub-agents read full SKILL.md files for execution.
- CodeGraph is available at `.codegraph/` — use `codegraph explore` for code search.
