# mezo — Roadmap & Milestone Log

High-level "where are we" timeline. Update this whenever a phase/slice ships or the direction shifts.
Detail lives elsewhere (`decisions/`, `infrastructure/`, `superpowers/`); this is the index over time.

## Phases

- **Phase 1 — Frontend (mock data):** ✅ done. React 19 + Vite + Tailwind v4, Hungarian UI, 6 vertical slices on a mock data layer.
- **Phase 2 — Core data backend:** 🔄 in progress. Java / Spring Boot 4 + PostgreSQL behind the same `src/data/hooks.ts` boundary.
  - Slice A (foundation + auth + biometrics + TanStack Query): ✅ done
  - Slice B (Train): ✅ done
  - Slice C (Fuel): 🟢 core shipped — Pantry (mezo-9xu), Recipes (mezo-lns), Meal-logging (mezo-arb), **Medication/Gyógyszer (mezo-d94)** closed/backend-backed. Remaining work is a **phased completion plan** ([`fuel-completion-roadmap`](../superpowers/plans/2026-06-26-fuel-completion-roadmap.md), epic `mezo-6r1`): P0 decisions → P1 water → P2 Stack/Protocol → ✅ P3 **Gyógyszer tab + `medication` domain (first-class) + derived retaDay broadcast** (shipped mezo-d94) → P4 weekly-plan → P5 timeline → P6 import → P7 meal-scoring → P8 Phase-3 AI. Stock tracking parked (mezo-6nu).
  - Slice D (Insights seed) → E (People): ⏳ remaining
- **Phase 3 — AI brain:** 🔜 later. Spring AI, pgvector, RAG, pattern/companion pipeline.

## Cross-cutting tracks

- **Deployment / infra (learning track):** 🔄 planned — self-managed k3s + ArgoCD + pgAdmin on a single Hetzner VPS.
  Driver `mezo-ht3`. See [ADR 0001](../decisions/0001-deploy-on-k3s-argocd-learning-track.md) and
  [deployment architecture](../infrastructure/deployment-k3s-argocd.md). Goal doubles as hands-on practice
  with the stack Daniel's clients use.

## Milestone log

| Date | Milestone |
|---|---|
| 2026-06-13 | Deploy direction decided: self-managed k3s + ArgoCD + pgAdmin (learning track). ADR 0001 + infra doc written. `docs/` decision/infra/milestone structure established. |
| 2026-06-14 | Deploy steps 0-2 done: Hetzner VPS hardened + Tailscale, k3s installed, full mezo (Postgres + backend + frontend) live on k8s at `https://46.225.112.172.sslip.io/` with Let's Encrypt HTTPS. `k8s/` manifests + Dockerfiles committed. Pending: pgAdmin (step 3), ArgoCD/GitOps (step 4). |
| 2026-06-24 | Slice C (Fuel) core shipped: Pantry (`pantry_item`, mezo-9xu) + 146-item catalog (mezo-zza), Recipes (`recipe`/`recipe_ingredient`, mezo-lns), Meal-logging (`meal`/`meal_item` + `/api/fuel/day/{date}`, mezo-arb) — backends + dual-mode FE, green both modes. Remaining Fuel (Stack/Protocol, weekly-plan, meal-scoring) Phase-3-deferred. |
| 2026-06-25 | Progression P1 (domain foundation) — curve, 3 tables (`skill_progress`/`level_up_event`/`perk_unlock`), entities/repos, perk catalog; triggers/HTTP deferred to P2 (`mezo-8e4`). |
| 2026-06-26 | Fuel polish (mezo-ksh/dh6/8xy/cki) + stock UI parked behind a flag (mezo-6nu). **Fuel completion roadmap** authored (`fuel-completion-roadmap.md`, epic `mezo-6r1`, phases P0–P8, dependency-ordered + deterministic-first); duplicate epic mezo-4ag closed. |
| 2026-06-26 | Fuel **P3 — Medication / Gyógyszer (mezo-d94)** shipped: `medication` + `medication_dose` tables as a **first-class** domain (NOT a pantry row), `/api/medication` + `…/{id}/dose` endpoints, server-derived 7-day Reta cycle (`MedicationCycleService`, retaDay from the dose log), the `/fuel/gyogyszer` tab + `LogDoseSheet`, and the **derived `retaDay` broadcast** via `useTodayScenario()` (every Reta surface reads it). Backend + dual-mode FE, green both modes. Supersedes the spec's earlier "Reta in pantry" P0b idea. |
| 2026-06-27 | Progression **P3b — SPORT path** (`mezo-lmox`, child of `mezo-8e4`) shipped: `sport_session` generalized into a 3-kind modality (the existing `sport` column became the `volleyball\|cross\|trx` discriminator via `ck_sport_session_sport`, + a `rounds` effort column), `ProgressionService.applySport` granting per-kind athletic XP, and a switch-gated `levelUp` on `SportSessionResponse` (mirrors gym finish + run log). Two baton refactors rode along: the streak **robustness rate lifted out of `gym()` into a shared `mezo.progression.robustness` node**, and `RunSignalCalculator` hardened to an ownership-scoped log load. Backend + dual-mode FE green (657/657 FE both modes). FE cross/TRX log-sheet + `LevelUpScreen` deferred to P5. Also fixed a time-of-day-flaky medication test (`mezo-yc9z`). |
