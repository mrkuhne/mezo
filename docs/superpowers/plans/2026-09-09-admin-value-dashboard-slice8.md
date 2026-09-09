# Admin value dashboard — Slice 8: App-side capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the value-measurement gaps the owner approved: persist accept/edit/discard outcomes for the two big AI generators (meal draft, meso plan), extend 👍/👎 to meal-coach prose and recipe-breakdown results, and light up the admin scorecard's `acceptedShare`.

**Architecture:** A tiny `ai_draft_outcome` owned table in the **llmlog** slice (rides existing meal→llmlog / train→llmlog / admin→llmlog edges — recon-verified zero cycle risk) + one idempotent endpoint `POST /api/ai-drafts/{draftId}/outcome`. Generator responses gain a backend-minted `draftId` (additive contract fields). The FE reports outcomes fire-and-forget (telemetry transport attitude, own contract op) from MealComposer and MesocyclePlannerPage. Feedback widening follows the established CK-swap recipe; artifact ids reuse the persisted meal/recipe ids. `AdminFeatureService` replaces the `acceptedShare: null` placeholder with `(accepted+edited)/total` per feature.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` §6. Epic **mezo-l096**.

## Global Constraints

All prior gates (owner-facing endpoints owner-gated where admin; USER-facing additions must be tiny — the entry chunk's precache limit is strained; contract-drift + codemap + both-mode FE tests; focused local tests only; Liquibase changeSet in `1.0.0_master.yml` with SQL script file per house naming; OwnedEntity base; archunit-store untouched; no meal/train↔each-other imports — outcome writes go through llmlog). USER-facing copy is Hungarian and unobtrusive (no new dialogs — signals are silent). Branch `feat/admin-slice8-capture` off main AFTER slice 7 merges.

## Rulings

- **Table:** `ai_draft_outcome` (llmlog slice): `id, created_by, created_at, is_deleted (OwnedEntity), feature varchar, draft_id uuid unique-per-owner, outcome varchar CHECK (accepted|edited|discarded)`. Upsert semantics per (owner, draft_id): a later `accepted/edited` REPLACES an earlier `discarded` and vice versa (last signal wins — the composer can be reopened).
- **Draft id minting:** `MealAiDraftResponse` and the meso-plan generate response gain `draftId: uuid` (required in response, backend-minted). No content hashes.
- **One outcome endpoint:** `POST /api/ai-drafts/{draftId}/outcome` body `{feature: string, outcome: accepted|edited|discarded}` → 204; owned (JWT), upsert; no GET (admin reads via repository). Rejects unknown feature slugs? No — free slug, admin joins by slug (document).
- **Meal semantics:** accept moment = successful `logMeal` with AI provenance → FE sends `edited` if the user changed the AI-provided lines before saving, else `accepted` (the composer holds both states); discard = composer unmount/close with an unsaved AI draft present. Escape/back share the close path — that IS the discard signal (documented).
- **Meso semantics:** accepted = successful `createTemplate` from a generated proposal (start is irrelevant); `edited` if the wizard state diverged from the generated proposal before save (compare against the stored generated snapshot in wizard state); discard = leaving the planner (goBack/unmount) or `regenerate` while an unsaved generated proposal exists (regenerate also mints a new draftId).
- **Mock mode:** the outcome client is a silent no-op (isMockMode), same attitude as telemetryClient; failures swallowed; NOT apiFetch's 401-logout path — but unlike telemetry this is a normal owned endpoint, so use apiFetch with catch-all swallow (401 during logout race must not crash — wrap).
- **Feedback kinds:** `meal_coach` (artifact id = meal id; prose regenerations share the id — version-conflation accepted and documented) and `recipe_breakdown` (artifact id = recipe id; chips mount ONLY when prose is present). CharacterFeedbackService confirmed non-overlapping (recon).
- **artifactFeatureMap** gains `meal_coach: meal_coach, recipe_breakdown: recipe_breakdown` (yml defaults) so the Funkciók scorecard's helped column lights up for both automatically.
- **acceptedShare** = (accepted+edited)/total outcomes per feature over the period, null when 0 outcomes; the detail page's "még nem mérjük" line switches to the real % automatically (it already renders non-null values — verify).
- **FeedbackChips import**: keep importing from features/insights (existing cross-feature smell, least invasive — recon).

---

### Task 0: Branch + bd bookkeeping
- [ ] `bd create --title="admin slice 8: app-side capture — draft outcomes + feedback extension + acceptedShare" --type=task --priority=1` → `<ID>`; claim; branch.

### Task 1: Backend — outcome table + endpoint + draftId minting

**Files:** migration SQL + master.yml entry; `feature/llmlog` entity/repository/service/controller for the outcome (+ its contract fragment `api/feature/ai-drafts/ai-drafts.yml` appended to merge.yml — or fold the op into an existing llmlog-owned fragment if one fits better, implementer judgment with the merge.yml precedent); `meal.yml` + `train.yml` response additions (draftId) + `MealAiDraftService`/`MesoPlanGeneratorService` minting; ITs (upsert semantics incl. last-signal-wins; ownership isolation; 401 anonymous; meal/meso responses carry draftId).
- [ ] TDD focused ITs; commit `feat(api): ai draft outcomes — table, endpoint, minted draft ids (<ID>)`.

### Task 2: Backend — acceptedShare wiring + feedback kind widening

**Files:** `AdminFeatureService` (:230 placeholder → real aggregate via a small grouped query on ai_draft_outcome, period-scoped), AdminFeatureBoardIT case (accepted 2 + edited 1 + discarded 1 → 0.75; zero outcomes → null); CK-swap migration for `message_feedback` kinds + `companion-feedback.yml` regex ×2 + `AdminProperties` artifactFeatureMap yml defaults + AdminPropertiesTest; feedback ITs extended for the two new kinds (upsert per kind).
- [ ] TDD; commit `feat(admin): acceptedShare from draft outcomes; meal_coach + recipe_breakdown feedback kinds (<ID>)`.

### Task 3: FE — outcome signals + feedback mounts

**Files:** new `frontend/src/data/aidraft/outcomeClient.ts` (fire-and-forget, mock no-op, tests for the swallow behavior), `MealComposer.tsx` (+`LogFlowPage` close path) accept/edited/discard signals with the draftId from the draft response (fuel hooks pass it through), `MesocyclePlannerPage.tsx` + wizardState (generated-snapshot diff → edited; regenerate/goBack discard; createTemplate accept), `feedbackTypes.ts` union + `MealScoreSheet.tsx` and `RecipeScoreSheet.tsx` FeedbackChips mounts (one useFeedback per sheet, recipe chips only with prose), mock seeds/MSW for the new endpoint + kinds.
- [ ] TDD: outcome client unit tests (mock no-op, error swallow); composer tests (accept-clean → accepted, accept-after-edit → edited, close-with-draft → discarded — use the existing composer test harness); planner tests (the three signals); sheet tests (chips render + vote flows in both modes). USER-facing suites: run the touched feature dirs both modes (`pnpm vitest run src/features/fuel src/features/train src/data`) — NEVER the full suite. Keep bundle additions tiny (no new deps).
- [ ] Commit `feat(app): draft outcome signals + coach/recipe feedback chips (<ID>)`.

### Task 4: Gates + visual check + ship
- [ ] Focused backend ITs re-run; FE both modes for fuel/train/admin/data + build; codemap; controller browser check (mock: composer discard/accept flow signals no-op silently — verify no UI regression; MealScoreSheet chips visible; admin scorecard mock shows an acceptedShare% for meal_draft once the mock seeds carry outcomes); ship per house flow; `bd close <ID>`.

## Self-review notes
- Spec §6 coverage: outcome capture ✔ feedback extension ✔ admin mapping+summary already shipped (slice 3) — the two new kinds join via config ✔ acceptedShare ✔; "edited vs accepted-as-is" captured for both generators (spec said "where cheap" — the composer/wizard state makes it cheap).
- Names bind: `ai_draft_outcome`, `POST /api/ai-drafts/{draftId}/outcome`, `draftId`, `outcomeClient`, kinds `meal_coach|recipe_breakdown`.
- Cycle-safety: llmlog placement recon-verified; meal/train touch only their own + llmlog.
