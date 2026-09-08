# Admin value dashboard — Slice 5: Emberek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Emberek section: tester cards with 90-day heat strips + status/feedback chips and a clickable summary strip on `/admin/users`, and summary-first detail tabs (per-domain activity, feature adoption with "never discovered", a new Visszajelzések tab).

**Architecture:** One small backend addition (Task 1): the users-list rows gain `activityByDay` (90-int array, all domains summed, one grouped query) and `feedbackUp/feedbackDown` (30d), plus a new `GET /api/admin/users/{id}/feedback` op (per-user, per-surface up/down + down-reasons + recall totals; companion-gated). Everything else is frontend on existing data (`AdminUserDetailResponse` already carries per-domain 90d series and 30d feature usage/cost).

**Tech Stack:** as previous slices.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` §2. Epic **mezo-l096**.

## Global Constraints

Same as slice 3/4 (owner gate first, reportZone bucketing, native-SQL discipline incl. `is_deleted = false` on message_feedback, companion-off honest nulls, both-mode FE tests, focused local tests only, Hungarian + featureLabel discipline, honest null states, no emojis, `.ad-*` CSS). Branch `feat/admin-slice5-emberek` off main AFTER slice 4 merges.

## Rulings

- **Status buckets:** aktív = activity within 2 days; csendesedik = 3–7 days; lemorzsolódott = 7+ days; "még nem aktív" = null lastActivityAt. One shared pure fn (`testerStatus(lastActivityAt, now)`) unit-tested; the Pulzus quiet-tester tile is NOT rewired in this slice (keeps its own threshold).
- **Card heat strip:** `activityByDay` summed across domains server-side (90 ints, oldest→newest, reportZone days); intensity buckets client-side like the existing `.ad-heat` idiom.
- **Detail Funkciók tab v1:** adoption list from the existing `featureUsage30d` counts (HU labels, sorted desc) + "Ezeket még nem találta meg" section = FEATURE union (domain keys + AI slugs seen installation-wide via the board endpoint's row keys, non-system) minus the user's used keys. Per-user first-use/habit flags deferred (bd note) — no fake data.
- **Feedback per user:** the new endpoint returns per artifact-kind (mapped to HU surface names client-side via a small SURFACE_LABELS addition to labels.ts) up/down + reasons, plus that user's recall feedback totals. Balance chips on cards use the list row's new 30d totals.
- **The old users table stays** as "Táblázat nézet" toggle (chip) on the list page — cards are the default view.

---

### Task 0: Branch + bd bookkeeping
- [ ] `bd create --title="admin slice 5: Emberek — tester cards, summary strip, detail tabs, per-user feedback" --type=task --priority=1` → `<ID>`; claim; branch.

### Task 1: Backend — list extensions + per-user feedback endpoint

**Files:** `api/feature/admin-insights/admin-insights.yml` (+regen), `AdminUserService`, `AdminInsightsQuery` (or `AdminFeatureQuery`) additions, controller, ITs (`AdminUsersIT` extension + `AdminUserFeedbackIT` + companion-off case), FE regen.

**Interfaces:**
- `AdminUserResponse` gains `activityByDay: int[] (90, oldest→newest)`, `feedbackUp: int`, `feedbackDown: int` (30d, message_feedback by created_by, live state).
- New op `getAdminUserFeedback(id)` → `AdminUserFeedbackResponse { surfaces: {kind, up, down, reasons: {reason,count}[]}[] | null, recall: {useful,irrelevant,suppress} | null }` (both null companion-off; empty arrays when on but no votes).
- Queries: one grouped native query per-user-per-day activity across the feature-map tables + llm-independent? NO — reuse the per-domain series machinery `AdminUserService.detail` already uses, summed; do NOT invent a new inventory. For the list (≤ dozens of users) one query per feature-map table grouped by (created_by, day) then merged in the service is acceptable at beta scale (document).
- ITs: activityByDay length 90 + a seeded day lands at the right index (reportZone edge); feedback totals per user isolated (another user's votes never leak); per-user endpoint reasons histogram; companion-off nulls; non-owner 403.
- [ ] TDD, focused ITs, commit `feat(admin): user list activity/feedback extensions + per-user feedback endpoint (<ID>)`. Then FE data layer additions (hook `useAdminUserFeedback(id, isOwner)`, mock seeds with realistic 90-int arrays + MSW) as a second commit `feat(admin): user feedback data layer (<ID>)`.

### Task 2: Emberek list UI — cards + summary strip

**Files:** `AdminUsersPage.tsx` rebuild (+test), new `components/TesterCard.tsx` (+test), `lib/adminViz.ts` `testerStatus` (+test), CSS.

- [ ] Summary strip: 4 clickable cells (Aktív · Csendesedik · Lemorzsolódott · Még nem aktív) filtering the card grid; counts from `testerStatus`. Cards (sp4 each, owner excluded from churn chips but shown): avatar+name, 90-day `.ad-heat` strip, "utoljára: X napja / még nem aktív", 30d cost, feedback balance (▲n ▼m, muted when 0/0), status chip. Sort chips: kockázat (default: quiet first) · költség. "Táblázat nézet" toggle renders the existing table (keep its tests). Card click → detail.
- [ ] TDD per established idiom; both modes; commit `feat(admin): Emberek tester cards + summary strip (<ID>)`.

### Task 3: Detail tabs rework

**Files:** `AdminUserDetailPage.tsx` (+test), labels.ts `SURFACE_LABELS` (7 artifact kinds → HU: chat_message: Beszélgetés, feed_message: Üzenőfal, weekly_suggestion: Heti javaslat, weekly_review: Heti értékelés, memoir: Memoár, prediction: Előrejelzés, day_review: Napi értékelés) + labels test, CSS.

- [ ] *Aktivitás* tab: replace the summed HeatStrip with per-domain heat strips (one row per domain with HU label, from the existing per-domain-keyed activitySeries) + first/last seen line.
- [ ] *Funkciók* tab: adoption list per ruling + "Ezeket még nem találta meg" muted section (board row keys via `useAdminFeatureBoard`, non-system, minus used).
- [ ] NEW *Visszajelzések* tab (6th tab): surfaces list (HU surface names, ▲/▼ counts, reasons with FEEDBACK_REASON_LABELS), recall ratio line ("a felidézett emlékek X%-a volt hasznos"), companion-off → "ki van kapcsolva" tile; empty → "Még nem adott visszajelzést."
- [ ] TDD; both modes; commit `feat(admin): Emberek detail — per-domain activity, adoption, feedback tab (<ID>)`.

### Task 4: Gates + visual check + ship
- [ ] Full admin FE both modes, build, codemap, focused backend ITs re-run; controller browser check (cards grid + detail tabs); ship per house flow; `bd close <ID>`; bd note for the deferred per-user habit flags.

## Self-review notes
- Spec §2 coverage: summary strip ✔ cards ✔ per-domain heat ✔ adoption+never-discovered ✔ feedback tab ✔; per-user habit flag deferred honestly; Pulzus quiet tile untouched (its own logic).
- Names bind: `TesterCard`, `testerStatus`, `useAdminUserFeedback`, `SURFACE_LABELS`.
