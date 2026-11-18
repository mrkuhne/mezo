# Volume engine & training-style programme — hand-over after S1 (2026-11-18)

For the sessions that build the next slices. Epic `mezo-r36n9`; S1 issue `mezo-r36n9.65`. Read this first, then the
slice's own spec section.

## What S1 shipped

The set count on a run's exercise is now the amount the workout prescribes; the per-muscle hidden target and the
distribution that re-spread it are gone. Each muscle group has a tier band (Tartás / Építés / Hangsúly) from the
landmark table; `muscle_group_volume_log` is **derived** from the plan; every calendar week a per-exercise
`meso_week_proposal` is decided from last week's real signals (sets done, grind, workload, joint pain, check-in
soreness, a cutting goal) and **applied automatically**; a deload is a week whose restore is identity-keyed, visible,
cap-aware and consumed once; the kímélő step-back works on amounts; a one-time runner converted runs in flight; the
goal guard reads the band. Key classes (all `feature/train/service/` unless noted): `VolumeBands`, `SetSlots`,
`VolumeDecider`, `VolumeLedger`, `WeeklySignalReader`, `WeekProposalService`, `RecoveryReturnService`,
`VolumeArcService` (interim planned line), `EnergyBalancePort` (+ `feature/goal/engine/service/TrainEnergyBalanceAdapter`),
`feature/train/VolumeAmountMigrationRunner` + `LegacySetDistribution` (delete later), `config/VolumeProperties`.
Nothing in the API contract changed in S1; no web UI changed.

## Where things are

- Volume spec: `docs/superpowers/specs/2026-11-17-train-volume-engine-v2-design.md` — **§12 "As built" is the truth where it
  differs from §1–§11** (restore shape, `deload_restore` lines, model-1 guard, `lastRun` rule, soreness 7, interim arc).
- Style & techniques spec: `docs/superpowers/specs/2026-11-17-train-style-and-techniques-design.md` (§7 slices, §11 resolutions).
- S1 plan: `docs/superpowers/plans/2026-11-17-volume-engine-v2-s1-core.md`.
- Living doc: `docs/features/train.md` §4 `#### Volume engine v2`, §9 "Volume engine v2 … traps", §10.
- Owner-facing page: `docs/boop-handbook/07-edzes/05-heti-volumen.md` (keep it true when a slice changes behaviour).

## The remaining slices

| Slice | bd id | Depends on | Parallel with |
|---|---|---|---|
| Volume engine v2 — S2: bands and the evaluator | `mezo-r36n9.77` | S1 | T1 |
| Volume engine v2 — S3: the weekly proposal's API and manual mode | `mezo-r36n9.78` | S1, **after T1** (both touch `SetRecommendationService`) | — (after T1) |
| Train style & techniques — T1: style and progression | `mezo-r36n9.79` | S1 | S2 |
| Train style & techniques — T2: the technique model | `mezo-r36n9.80` | T1, S3 | — |
| Train style & techniques — T3: the planner and the challenge | `mezo-r36n9.81` | T2 | — |
| Train style & techniques — T4: AI refinement | `mezo-r36n9.82` | T3 | — |
| Boop Edzés: block builder + weekly review | `mezo-r36n9.83` | S2 + S3 (+ T1 for the style field) | T2–T4 |
| Boop Edzés: technique and challenge in the player | `mezo-r36n9.84` | T3 | — |

Chain: **S2 ‖ T1 → S3 → T2 → T3 → T4**; the builder/review slice after S2+S3, the player slice after T3.

## Hot spots — one session writes at a time

`api/feature/train/train.yml` and `api/openapi.yml` (contract-first, drift-checked) · the Liquibase `1.1.0` master
(`1.1.0_master.yml`, one plain-SQL changeset per script file) · `backend/src/test/java/.../support/ResetDatabase.java`
(TRUNCATE list) · `SetRecommendationService` · `WeekProposalService` · `VolumeProperties` and the `mezo.volume` block of
`application.yml`. Agree who holds each before starting; rebase and regenerate `docs/CODEMAP.md` after every merge
(an auto-merge silently drops codemap entries).

## Working rules that cost time in S1

- **One Maven process per working tree.** A second build while the suite runs corrupts both. Background runs inherit the
  cwd and outlive their timeout.
- **Testcontainers flag:** `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=<Class>`; the fixed-DB
  mode races and fakes failures. Focused ITs miss `ArchitectureTest` and the codemap check — run both before merging.
- **ArchUnit:** raw generic exceptions (`IllegalStateException` …) outside techcore are forbidden (use an exhaustive
  switch or a `SystemRuntimeErrorException`); layer subpackages are enforced and there is **no `runner` layer** (the
  migration runner sits in `feature/train/`, its helper in `service/`).
- **Liquibase:** plain SQL, **one changeset per file**, registered in the master; never a bare `?` in jsonb SQL (a JDBC
  placeholder that kills every IT context — use `jsonb_exists()`); changesets are immutable.
- **`TrainPopulator` builds model-2 runs**; a legacy-path test must set `volume_model = 1` itself. A derived ledger
  overwrites hand-seeded `muscle_group_volume_log` rows on the next sync.
- **Proposal ITs live in `feature/train/service/`** (`WeekProposalAutoIT` …) because `build`/`apply` are package-private.
- The weekly engine must never block `getToday` (try/catch in `VolumeProgressionService.rolloverIfDue`).
- Frontend tests in both modes (`CI=true`, mock and `VITE_USE_MOCK=false`); unset `VITE_USE_MOCK` means mock twice.

## Deferred-findings issues (all under `mezo-r36n9`, priority 3)

`mezo-r36n9.68` RESUME sibling (`lastRun` ahead of the calendar) · `.69` lock order save-to-plan vs week-opening `getToday` ·
`.70` one shared reader of counting exercises by muscle group · `.71` Boop/web band statements vs derived rows (Boop
session) · `.72` arc planned line after a mid-run deload (folded into S2) · `.73` delete the migration runner +
`LegacySetDistribution` · `.74` S2 cleanup (`volumePerMuscle`, `weekOneStart`/`ceiling`, `mezo.volume.step`) · `.75` S3 notes
(manual-mode restore, week after a mid-block deload) · `.76` hardening (energy-balance adapter, under-restore, missing tests).

## Owner-facing gate order — every slice

1. **Plan → owner OK** (brainstorm/recon first when the slice is new; the spec for these two programmes already exists).
2. **Build** to the approved plan; **review** (independent, with the deferred-findings list above); **ship** (gates,
   merge `--no-ff`, push, deploy watch, production check, Notion sync).
3. **Any new phone screen:** a simulator spike in Xcode + the iOS Simulator, **owner OK before code**. No web UI work for these programmes.
4. Talk to the owner in **Hungarian business language, no jargon**, with the situation / the problem / two or three
   options in a table / your recommendation (CLAUDE.md §Communication). Keep the Notion "Boop" space true in the same session.
