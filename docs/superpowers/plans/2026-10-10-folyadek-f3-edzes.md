# Folyadék F3 · Edzés — build plan (`mezo-n4wf5.3`)

> Owner OK on the prototype 2026-10-10 („maradjon a test, a terven a második, mehet az építés").
> Build target: `docs/design_2.0/prototypes/vilagos/edzes.js` (Artifact v38), every route arg and sheet in
> its side-panel notes. Canon: `docs/design_2.0/2026-10-09-folyadek-style-bible.md` (read the appendix).
> Exemplar of a converted page: `frontend/src/features/today/pages/NapKuldetesekPage.tsx`
> + `frontend/src/styles/folyadek-nap-*.css`. Kit: `frontend/src/shared/ui/folyadek/` (+ `folyadek-kit.css`).

## Owner decisions for this slice
- Edzés · Mai hero: the body silhouette (not the dumbbell).
- Terv / plan page week list: only today is a full day card; every other training day is one row.
- Removed as invented (do NOT build): technique sheet + alternatives on the exercise page, completion % on
  the closed-runs list, six-week chart and „Időpontok" on Terhelés, linked vessels on cross-load, mood chips
  on close, „mit kíméljünk" in the planner, struck-through original set counts, pre-save kcal number.

## Rules for every builder
1. **Match the prototype exactly**: same order, graphic, copy, states. Open it:
   `http://127.0.0.1:8731/klinikai-iranyok.html#w-edzes-<route>[.<arg>]` (server runs; never kill it).
   Port CSS **values** from the prototype's CSS block (computed styles, not screenshots — bible F1.12).
2. **Behaviour frozen**: no change to routes, hooks, API calls, mutations, state machines, navigation
   targets, aria semantics that tests rely on. Only markup + classes + presentational derivations. A graphic
   that needs data the page does not load may add a call to an EXISTING hook (named in the prototype
   comments / the audit); never a new endpoint. Demo route args of the prototype are states, not features.
3. **Kit first**: use `@/shared/ui/folyadek` and the Edzés shared pieces (`features/train/components/folyadek/`,
   CSS `folyadek-edzes-kozos.css`, prefix `.ex-`). Builders never edit the kit, `folyadek-kit.css`,
   `folyadek-edzes-kozos.css`, `prototype.css`, the app shell, or another area's files. Missing a generic
   piece → build it locally in your area with your prefix and LIST it in the report (the controller folds
   it into the kit).
4. **One stylesheet per area**, its own class prefix (table below). No new rule in `prototype.css`; do not
   delete old CSS (the controller removes it with a zero-usage proof afterwards).
5. **Old skin leaves the markup** of the files you own: glass cards (`.glass`, `GlassCard`, `.tg-*`…), Titanium
   / clay icons outside the sprite ids, rings, Boop. Icons: `Bub` / kit icon props with existing sprite ids.
   MuscleChip and BodyMap graphics are KEPT (owner).
6. **Tests**: every test of your files that asserts old structure is rewritten to assert the new one — never
   deleted, never skipped. Run only your own files: `cd frontend && CI=true pnpm exec vitest run <paths>`
   (mock mode) and again with `VITE_USE_MOCK=false`. Never run the full suite, the build or the layout specs
   (the controller does; parallel full runs corrupt each other). `pnpm exec tsc -b --noEmit` may show other
   builders' errors — fix only yours.
7. **Not yours**: anything used by the in-workout flow (slice F4) — `ActiveWorkoutPage`, `WorkoutReviewPage`,
   `WorkoutCard`, `WorkoutBriefing`, `WorkoutCeremony`, `WorkoutSummary`, `WorkoutDock`, `WorkoutMenuGlass`,
   `WorkoutRecordsGlass`, `FinishConfirmGlass`, `FeedbackModal`, `SetEditSheet`, `SetStepper`,
   `ExerciseScopeSheet`, `ExerciseReview`, `MedalToast`, `MedalChip`, `SportCeremony`, `MuscleChip`, `BodyMap`.
   Components of other domains stay in their look (bible F2.12).
8. **Copy**: the prototype's wording (plain Hungarian; field-name rule bible §2.3). Where the prototype
   rewrote a live string, tests follow. Grep `src` and `tests` for the old words of any shared sheet title
   you change (F2.6).
9. Loading / empty / error / not-found faces as drawn. 320 px must not overflow; 44 px hit areas come from
   the kit.
10. No commit, no push. Report: files changed, kit gaps (local pieces to fold), tests run with counts,
    deviations from the prototype with the reason, anything left.

## Areas (parallel after the foundation)

| Area | CSS file · prefix | Prototype routes / sheets | Files owned |
|---|---|---|---|
| 0 Foundation | `folyadek-kit.css`, `folyadek-edzes-kozos.css` · `.ex-` | helpers at the top of `edzes.js` | kit additions; `features/train/components/folyadek/*`; `InfoButton` |
| A Mai | `folyadek-edzes-mai.css` · `.em-` | `mai.*`; sheets `why udv custom` | `TrainTodayPage`, `TrainTodaySkeleton`, `TodaySessionCard`, `DoneBar`, `ReadinessCard`, `DayStrip`, `SkippedBlock`, `SkipReasonSheet`, `RecoveryDurationRow`, `ComebackPill`, `WelcomeBackSheet`, `MorningTrainingCard`, `CustomWorkoutSheet` |
| B Terhelés | `folyadek-edzes-terheles.css` · `.et-` | `terheles.* terkep.* jelek.* mozgas.*`; sheets `info grp` | `TrainWeekPage`, `GymPage`, `TrainWeekMapPage`, `TrainWeekJelekPage`, `TrainWeekMozgasPage`, `TrainWeekSkeleton` |
| C Sport + Futás | `folyadek-edzes-sport.css` · `.es-` | `sport.* sportlog.* futas.* futasterv.*`; sheets `sportlog runlog sportev kcal blkmenu` | `SportPage`, `SportSkeleton`, `SportLogPage` (not its ceremony), `SportSessionCard`, `CrossLoadRow`, `SportEventSheet`, `SportLogSheet`, `SportScheduleSheet`, `GymScheduleSheet`, `RunLogSheet`, `RunningPage`, `RunSessionCard`, `RunCrossLoadCard`, `RunWeekStrip`, `RunningBlockBuilderPage`, `RunWeekEditor`, `WeekdayGrid`, `CompactStepper` |
| D Terv | `folyadek-edzes-terv.css` · `.ep-` | `terv.* run.* nap.* het.* izom.* konyvtar.* futamok.*`; sheets `close start tinfo` | `MesoTervPage`, `MesoTervSkeleton`, `MesoWeekDays`, `MesoDayCard`, `MesocycleBuilderPage`, `MesocycleSkeleton`, `MesoDayPage`, `MesoWeekPage`, `MesoMusclePage`, `DerivationSteps`, `MesoKonyvtarPage`, `MesoFutamokPage`, `MesoFutamokSkeleton`, `MesoCloseSheet`, `MesoStartSheet` |
| E Nap-szerkesztő + saját edzés | `folyadek-edzes-napszerk.css` · `.ee-` | `napszerk.* sajat.*`; sheet `xpick` | `MesoDayEditPage`, `MesoExercises`, `MesoEditor`, `MesoEditorHero`, `DayBreakdownCard`, `WeeklyBandsCard`, `PeakFitCard`, `StructureLintCard`, `ExerciseAccordionRow`, `CustomWorkoutBuilderPage`, `ExerciseRecipeRow`, `ExercisePickerSheet`, `ExerciseImage`, `VideoDemo` (picker face only) |
| F Sablon-szerkesztő + új terv | `folyadek-edzes-sablon.css` · `.ew-` | `sablonszerk.* ujterv.*` | `MesoTemplateEditorPage`, `MesoWeekEditor`, `MesoDayEditor`, `ExerciseCard`, `DayStripTile`, `DayLoadPanel`, `WeekLoadPanel`, `LoadTile`, `ZoneBar`, `MesocyclePlannerPage`, `wizard/*`, `MusclePriorityPicker` |
| G Riport, sablonok, gyakorlatok | `folyadek-edzes-riport.css` · `.er-` | `riport.* osszevetes.* sablonok.* sablon.* exercises.* exercise.* medals.*`; sheets `cat video tinfo` | `MesoReportPage`, `MesoComparePage`, `MesoTemplatesPage`, `MesoTemplatesSkeleton`, `MesoTemplateStoryPage`, `ExercisesPage`, `ExercisesSkeleton`, `ExerciseStoryPage`, `StrengthCurve`, `MedalsPage`, `CatalogExerciseSheet`, `VideoUrlSheet` |

## Controller, after the builders
Fold local pieces into the kit (one recipe per thing) → delete the old Edzés skin from `prototype.css` with
the zero-usage proof (F1.13) → structure guard tests → full gates (both modes, layout specs, build) → runtime
pass at 390 / 320 / reduced motion against the prototype → docs (train.md, index, roadmap, bible F3.x,
HANDOFF) → codemap, lint-docs → merge, deploy, live check.

## Kész, ha…
The acceptance list on `mezo-n4wf5.3` (`bd show mezo-n4wf5.3`).
