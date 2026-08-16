# 0027 — retire retatrutide: generic medication domain, permanently empty, no add flow

- **Status:** Accepted
- **Date:** 2026-08-16
- **Driver:** mezo-lwmq

## Context

The Fuel "Gyógyszer" slice (`mezo-d94`, [ADR 0005](0005-pantry-item-supersedes-food-item-supplement-intake-fk.md))
shipped as a first-class `medication` + `medication_dose` aggregate, but was designed and built
around one specific drug — retatrutide — as a concrete, named example: seed data, page copy, a
companion tool scope (`get_medication(scope=reta)`), a system-prompt guard example, and pattern
pair keys (`reta-cycle-day~daily-kcal`, `reta-dose~daily-kcal`) all baked the brand name into the
frontend layer, the backend contract, and the LLM-facing strings.

The owner does not take retatrutide and has no plan to track any medication. Keeping the drug name
wired through seven+ layers of the app was pure risk: it leaked into companion prompts (the LLM
saw and could echo a specific Rx name), test fixtures, and documentation, for a domain nobody uses.
The retirement (mezo-lwmq, 7 tasks) generified every identifier, deleted the seed/demo data, and
turned the Gyógyszer tab into an honest permanently-empty state.

## Decision

1. **The domain becomes generic — no brand name anywhere in code.** `retaDay`/`RETA_*`/`RetaWeekStrip`/etc.
   renamed to `cycleDay` (API/DTO layer) and `medCycleDay` (frontend Today layer),
   `MedicationWeekStrip`/`MedCycleDayCell`/`MedCyclePhase`, CSS `--medcycle-d1..d7`/`.medcycle-*`.
   Pattern pair keys became `medication-cycle-day~daily-kcal` and `medication-dose~daily-kcal`
   (`MetricKey.MEDICATION_CYCLE_DAY`/`MEDICATION_DOSE_MG`). The companion tool's `scope=reta` became
   `scope=cycle` (`renderReta` → `renderCycle`); the drug name was dropped as an example from the
   four LLM system prompts that used it (`ChatService`, `BriefingGenerator`, `HeartbeatGenerator`,
   `WeeklySuggestionGenerator`) — the dose-advice prohibition itself is unchanged in all four. The
   generic entity/service/mapper/controller (`MedicationEntity`, `MedicationCycleService`,
   `MedicationController`, the `GET`/`PUT`/dose endpoints, `useMedication`/`useMedicationActions`)
   all remain — only names and data changed, not the machinery.

2. **The Gyógyszer tab is permanently empty, with deliberately NO add-medication flow.** The
   startup demo seed (`MedicationDemoLoader`) is deleted. `FuelMedicationPage` renders one honest
   empty state (`data-testid="medication-empty"`, "Nincs aktív gyógyszer") when
   `medication.id === ''`, with no dose-logging affordance surfaced. There is no
   `POST /api/medication` in the contract and no "+ Add medication" sheet was built — **YAGNI**:
   the owner does not plan to track medication, and a create-flow with no user is speculative
   surface area (auth screens, validation, a sheet, tests) for a need that does not exist. If it is
   ever needed, that is a separate spec + bd issue: `POST /api/medication`, a create sheet, and
   tests — not built here. The populated branch of `FuelMedicationPage` (medication
   card, `MedicationCycleBar`, `LogDoseSheet`) is kept as generic, tested-via-fixture machinery —
   unreachable in production, but not deleted, since the domain design itself is sound and cheap to
   keep alive (`frontend/src/test/fixtures/medication.ts`'s `medicationFixture` drives those tests).

3. **A one-off physical DELETE, not soft-delete, for the pre-existing medication rows.** The
   migration `202608151210_mezo-lwmq_delete_medication_rows.sql` runs
   `DELETE FROM medication_dose; DELETE FROM medication;` against the pre-existing rows — a
   deliberate, explicit exception to the project's standing soft-delete convention
   (`is_deleted` + `@SQLRestriction`/`@SQLDelete`, see `docs/references/liquibase_conventions.md`).
   The point of retiring the drug name is that no trace of it should remain in the database; a
   soft-deleted row would still carry the medication name and cadence at rest. Normal application
   delete paths (`MedicationService`) are unchanged and still soft-delete — this is a one-time,
   migration-level exception for the retirement itself, not a new convention. The companion pattern
   rows referencing the old pair keys were preserved by renaming in place
   (`202608151200_mezo-lwmq_rename_medication_pattern_keys.sql`) rather than deleted, since
   orphaning them would have reset the nightly Pearson correlation job's history to zero.

4. **The `rx-terms` clinical-guard dictionary in `application.yml` is left untouched.** It lists
   the drug names (`retatrutid`, `reta`, `tirzepatid`, `mounjaro`, `szemaglutid`, `ozempic`,
   `wegovy`) the deterministic `ClinicalOutputCheck` advisor scans for alongside a dose-change verb
   before blocking a companion answer. This is a **safety mechanism's vocabulary**, not user data —
   it exists to guard against the companion ever giving dosing advice on ANY GLP-1-family drug,
   independent of whether the owner currently tracks one. Removing the terms would weaken a safety
   guard for zero benefit (it names no user, stores no user data, and the guard needs to recognize
   these terms whether or not medication is being tracked). Explicit owner decision, confirmed
   during this retirement, to keep the list as-is.

5. **The frozen specs/plans/mockups that named the drug are left untouched.** `docs/superpowers/specs/2026-06-26-fuel-medication-design.md`,
   the fuel-completion-roadmap plan, and `gyogyszer-a-szellos.html` all predate this retirement and
   record the design as it stood when the Gyógyszer slice was built — per the project's own
   `docs/README.md` taxonomy, `superpowers/specs`/`superpowers/plans` are point-in-time artifacts,
   never rewritten after the fact (git is the history of what changed since). The **living** docs
   (`docs/features/*.md`, `docs/references/companion_tool_conventions.md`,
   `docs/guides/companion-hogyan-mukodik.md`, `docs/milestones/roadmap.md`) were updated in the same
   change to describe the app as it is now.

## Consequences

- **Easier:** no drug-branded identifier survives anywhere the companion's system prompt or a
  frontend string could echo it back; the domain reads as generic "medication cycle" tracking
  end-to-end, which is what the design always should have been for a single-user app whose owner
  may or may not ever track a drug.
- **Harder / accepted cost:** re-adding a real medication now requires a small follow-up (a
  `POST /api/medication` endpoint + an add-medication sheet) that does not exist today — a
  deliberate, scoped gap, not an oversight.
- **Must maintain:** the `rx-terms` list is now the ONLY place in the codebase allowed to name a
  specific drug outside test fixtures/migrations/this ADR — future contributors should not
  "clean it up" thinking it's leftover branding; it's live safety-guard configuration.
- The two migrations (`202608151200`/`202608151210_mezo-lwmq_*.sql`) are irreversible by nature —
  the physical DELETE has no down-migration; this was accepted because the point of the change was
  to make the deleted data un-recoverable in the live database (the frozen specs remain if anyone
  needs to know what was deleted).

## Alternatives considered

- **Keep the drug name, just don't show it in the UI.** Rejected — the name still would have
  ridden through companion prompts and the pattern catalog, defeating the point.
- **Soft-delete the medication rows like every other domain.** Rejected — a soft-deleted row still
  carries the drug name and dose history in the live DB; the whole point of the retirement was for
  no trace to remain. See Decision 3.
- **Build the add-medication flow now, in case it's needed later.** Rejected as YAGNI — the owner
  has no plan to track medication; building the create path, its validation, and its tests for a
  hypothetical future need would be speculative work with no current user, moved to a follow-up bd
  issue if the need ever materializes.
- **Also scrub `rx-terms` in `application.yml`.** Rejected — it's a safety guard's vocabulary, not
  user-identifying data, and the guard should protect against advice on ANY GLP-1-family drug
  regardless of what the owner currently tracks. See Decision 4.
- **Rewrite the frozen specs/plans/mockup to match the new reality.** Rejected — violates the
  project's own docs taxonomy (`docs/README.md`): specs/plans are point-in-time design artifacts,
  not living docs; git already records what changed and why.
