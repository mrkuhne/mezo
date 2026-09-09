# Admin value dashboard — Slice 9: Docs + polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the living documentation in line with the shipped redesign (slices 0–8), preserve the approved design artifact, and close the epic's collected staleness (bd mezo-d6ny).

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` §Slices item 9. Epic **mezo-l096**. Docs follow the repo's 10-section feature-doc convention (see the `knowledge-base` skill / existing docs' structure).

## Rulings

- The approved direction mockup is committed verbatim as `docs/design_2.0/prototypes/admin-pulzus.html` (self-contained file; NOT wired into build.sh — it is a design-decision record, stated in a leading HTML comment; add one line to the prototypes README if one lists files).
- `admin-hub.md` and `admin-memory-explorer.md` are REWRITTEN for the current state (not patched sentence-by-sentence): new IA (Pulzus · Emberek · Funkciók · Költés · Memória · Meghívók + Nyers adatok tool), every new endpoint (alerts, features board/detail, feedback summary, users feedback + activity fields, memory global health, llm-usage day/model-token/prev-month extensions, ai-draft outcomes), the label-dictionary rule, the honesty rules, alert rule table with config keys. Keep the docs' English + their established section anatomy; endpoint tables must match the yml fragments exactly (verify each row against the contract files).
- Known staleness list to clear (from mezo-d6ny + final reviews): admin-memory-explorer.md four-views/inspector claims; admin-hub.md "Userek"//admin/usage claims; AdminAlertQuery javadoc naming only AdminAlertService; the slice-1 plan-era references stay as history (specs/plans are immutable records — do NOT edit spec/plan files).
- Verify-and-record: `/admin/usage` and legacy `me/*` redirects still work (route test already exists — cite it), codemap current, `bd close` for mezo-d6ny at the end.
- No production code changes except the one javadoc comment; if a doc claim can't be verified true, fix the DOC to match the code (never the reverse in this slice).

---

### Task 0: Branch + bd bookkeeping
- [ ] `bd create --title="admin slice 9: docs sweep + design artifact (epic close-out)" --type=task --priority=1` → `<ID>`; claim; branch `feat/admin-slice9-docs` off main after slice 8 merges.

### Task 1: Docs rewrite + artifact + javadoc

**Files:** rewrite `docs/features/admin-hub.md` + `docs/features/admin-memory-explorer.md`; copy the scratchpad mockup → `docs/design_2.0/prototypes/admin-pulzus.html` (+README line if applicable); `AdminAlertQuery` javadoc caller note; regenerate codemap if file lists changed.
- [ ] Rewrite both docs against the LIVE code/contracts (read the yml fragments + routes + pages as the source of truth; every endpoint row cross-checked). Include: the beta-goal→page mapping (which owner question each section answers), config keys (mezo.admin.alerts.*, artifact-feature-map, statement-timeout), honesty rules, the deep-link contract (?day/?feature/?view), telemetry/labels gates.
- [ ] Commit `docs(admin): rewrite admin-hub + memory-explorer for the value-dashboard redesign (<ID>)`.

### Task 2: Gates + ship
- [ ] `node scripts/lint-docs.mjs --errors-only` if such a gate exists (check scripts/); codemap check; FE quick run NOT needed (docs-only) but `pnpm vitest run src/app/adminRedirects.test.tsx` cited as redirect proof; ship per house flow; `bd close <ID> mezo-d6ny`.

## Self-review notes
- Spec item 9 coverage: feature docs ✔ prototype artifact ✔ codemap ✔ redirect verification ✔ staleness list ✔. Specs/plans untouched (immutable records).
