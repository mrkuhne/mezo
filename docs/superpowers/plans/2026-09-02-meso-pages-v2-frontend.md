# Mesocycle pages v2 (frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the mesocycle subpages to the approved prototype: a compact status-first hub hero, a run page with a day mosaic and editable day pages, a new weekly review page (`Heti vizsgálat`) with per-muscle detail pages that absorb the Volumen provenance view, and the templates / report / compare pages in the same `current → ceiling · tier` language.

**Architecture:** Two pure helpers (`logic/mesoBands.ts` for run-time bands from `Mesocycle.volumePerMuscle` + `musclePriorities`; `logic/mesoWeek.ts` for weekly/muscle derivations from the volume arc) feed presentational Mozaik pages. New routes: `/train/mesocycles/:id/days/:day`, `/train/mesocycles/:id/week`, `/train/mesocycles/:id/week/:muscle`; `/train/mesocycles/:id/overview` redirects to `/week`. Existing data hooks are reused unchanged (`useTrain`, `useMesocycleVolumeArc`, `useMesoReport`, `useMesoTemplates`); no contract change.

**Tech Stack:** React 19, TanStack Query dual-mode hooks, Mozaik primitives, vitest/Testing Library, Playwright visual goldens.

**Prerequisite:** the wizard plan (`2026-09-02-meso-wizard-v2-frontend.md`) is merged — `WeeklyBandsCard`, `weeklyBands`, `mesoPlan`, `DayTile`, `ProgramDayView` exist.

## Global Constraints

- Visual truth: prototype pages `#panel` (hub hero), `#page-run`, `#page-week`, `#page-muscle`, `#page-day`, `#page-tpl`, `#page-report`, `#page-compare` in `docs/design_2.0/prototypes/src/meso-body.html`; px ×1.18; tile → own page (never expand in place); no red; `—` for missing data, never 0.
- Mozaik primitives only; `.rise` inside `EntranceGroup`; tokens in both `:root` blocks; the three prototype-CSS guard tests stay green.
- No in-cycle Fókusz change: the run page and `MesoExercises` lose the tier picker; the `PUT …/muscle-priorities` client stays only for the template editor.
- Honest states: real mode with no arc yet → skeleton (`role="status"`) then `GhostState`; a muscle with no landmark → omitted; previous block absent → "nincs előző blokk".
- Routes: keep `train/mesocycles/compare`, `train/mesocycles/new`, `…/templates/:id`, `…/:id/report` declared before `…/:id`; add the three new routes right after `…/:id`.
- Tests in both modes; `pnpm build`; docs (`train.md` §2 Mesociklus/Sablonok/Volumen paragraphs → new page set, §8, §10), CODEMAP, lint-docs; visual goldens: `train` and `train-gym` may shift (Heti reads the meso) — regenerate darwin locally with `pnpm test:visual:update`, linux via the `update-visual-baselines.yml` workflow; add `meso-hub`, `meso-week` goldens.
- Commits: `feat(train-fe): … (mezo-<id>)`.

---

### Task 0: bd issue + branch

- [ ] `bd create --title "Mesocycle pages v2: hub hero, run + day pages, Heti vizsgálat + izom-részlet (absorbs Volumen), templates/report/compare in band language" --type feature --priority 1 --parent mezo-d20 --description "Spec §Active-meso pages. Plan: docs/superpowers/plans/2026-09-02-meso-pages-v2-frontend.md"` → `bd update <id> --claim` → `git checkout main && git pull --rebase && git checkout -b feat/meso-pages-v2`.

---

### Task 1: `logic/mesoBands.ts` — run-time bands, phase chip, week dots, decider sentence

**Files:**
- Create: `frontend/src/features/train/logic/mesoBands.ts`
- Test: `frontend/src/features/train/logic/mesoBands.test.ts`

**Interfaces:**
```ts
export interface RunBand { group: string; label: string; tier: MuscleTier; current: number; ceiling: number; mev: number; mav: number; mrv: number; pct: number; step: 'up' | 'hold' | 'cap' }
export function runBands(meso: Mesocycle): RunBand[]                 // from meso.volumePerMuscle (VolumeProfile.current) + musclePriorities; ceiling via ceilingSets; step: maintain→'hold', current>=ceiling→'cap', else 'up'; sorted ceiling desc
export type Phase = 'Rámpa' | 'Csúcs' | 'Deload'
export function phaseChip(meso: Mesocycle): Phase                     // phaseCurve[currentWeek-1]: 'Deload'→Deload, 'MRV'→Csúcs, else Rámpa
export interface WeekDot { week: number; state: 'done' | 'now' | 'future'; deload: boolean }
export function weekDots(meso: Mesocycle): WeekDot[]
export function deciderSentence(meso: Mesocycle): string | null     // from meso.volumeRecompute?.changes: first change with reason → e.g. `A ${label} ${reasonHu} — ${changeHu}.`; null when none
export function nextRolloverChips(meso: Mesocycle): { label: string; text: string; tone: 'sage' | 'mut' }[]  // per band: up → `${label} +2` sage, hold/cap → `${label} tart` mut
```

- [ ] **Step 1: Failing test**
```ts
import { describe, expect, it } from 'vitest'
import { deciderSentence, nextRolloverChips, phaseChip, runBands, weekDots } from './mesoBands'
import type { Mesocycle } from '@/data/types'

const src = { baseline: { name: 'RP', mev: 10, mav: 16, mrv: 22 }, adjustments: [], confidence: 0.5, rationale: '', userOverride: null } as never
const meso = {
  id: 'm1', status: 'active', title: 'T', shortTitle: 'T', goal: '', startDate: '2026-09-01', endDate: '2026-10-12', weeks: 6, currentWeek: 3,
  split: 'Upper / Lower · 4×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
  musclePriorities: { back: 'emphasize', calf: 'maintain' },
  volumePerMuscle: {
    back: { mev: 10, mav: 16, mrv: 22, current: 16, source: src },
    chest: { mev: 8, mav: 14, mrv: 20, current: 10, source: src },
    calf: { mev: 6, mav: 10, mrv: 16, current: 6, source: src },
  },
  volumeRecompute: { lastRun: '', nextRun: '', trigger: '', changes: [{ muscle: 'chest', change: 'hold', reason: 'grind' }] },
} as unknown as Mesocycle

describe('mesoBands', () => {
  it('derives current → ceiling per group with tier and step', () => {
    const rows = runBands(meso)
    expect(rows[0]).toMatchObject({ group: 'back', current: 16, ceiling: 22, tier: 'emphasize', step: 'up' })
    expect(rows.find((r) => r.group === 'chest')).toMatchObject({ current: 10, ceiling: 14, tier: 'grow' })
    expect(rows.find((r) => r.group === 'calf')).toMatchObject({ current: 6, ceiling: 6, tier: 'maintain', step: 'hold' })
  })
  it('phase chip and week dots follow the curve and the current week', () => {
    expect(phaseChip(meso)).toBe('Rámpa')
    expect(phaseChip({ ...meso, currentWeek: 5 } as Mesocycle)).toBe('Csúcs')
    expect(weekDots(meso).map((d) => d.state)).toEqual(['done', 'done', 'now', 'future', 'future', 'future'])
    expect(weekDots(meso)[5].deload).toBe(true)
  })
  it('turns the recompute change into a Hungarian sentence and the next-rollover chips', () => {
    expect(deciderSentence(meso)).toContain('Mell')
    expect(nextRolloverChips(meso)).toEqual(expect.arrayContaining([{ label: 'Hát', text: 'Hát +2', tone: 'sage' }, { label: 'Vádli', text: 'Vádli tart', tone: 'mut' }]))
  })
})
```

- [ ] **Step 2: Implement** with `BUDGET_GROUP_LABELS` for labels, `ceilingSets` from `logic/mesoPlan.ts`, `tierOf`. `deciderSentence`: map `change` (`hold|up|deload|…` — read the real vocabulary in `VolumeProgressionService`/`VolumeDecider` via `grep -n '"hold"\|"ramp"\|"deload"\|START\|HOLD' backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeDecider.java` and the FE fixture `data/train/train.ts` `volumeRecompute.changes`) to: hold+grind → `A ${label} a múlt héten grindelt (RIR-rés), ezért most tartjuk a ${current} szettet — a rámpa folytatódik, amint visszaáll a tempó.`; ramp → `Produktív hét: a ${label} +2 szettet kap.`; deload → `Deload hét: a ${label} fél volumenen pihen.`; else `${label}: ${change}.`

- [ ] **Step 3: Run green, commit** `feat(train-fe): mesoBands — run-time current→ceiling bands, phase chip, week dots, decider sentence (mezo-<id>)`.

---

### Task 2: Hub hero + tiles (`MesocycleLibraryPage`, `ActiveMesoCard`)

**Files:**
- Rewrite: `frontend/src/features/train/components/ActiveMesoCard.tsx` (props stay `{ meso, onOpen }`)
- Modify: `frontend/src/features/train/pages/MesocycleLibraryPage.tsx` (tiles :107-140), `frontend/src/styles/prototype.css` (`.mz-wdots`, `.mz-phchip`, `.mz-mband` — Mozaik section)
- Modify tests: `MesocycleLibraryPage.test.tsx` (hero copy), `ActiveMesoCard` test if any

- [ ] **Step 1: `ActiveMesoCard`** = prototype hub hero: `button.mz-hero.rise` (whole card is the `onOpen` target, `aria-label="Aktív mezociklus megnyitása"`): `ClayIcon i-meso 44`, eyebrow `Aktív · {currentWeek}/{weeks} hét`, big title, `.mz-phchip` `{phaseChip(meso)}`, chevron; `.mz-wdots` from `weekDots` (`done` sage · `now` gold pulse via existing `nowpulse` keyframe if present in prototype.css, else static · `future` muted · `deload` striped); line `W{currentWeek} · a csúcs a W{index of 'MRV'+1} · utána deload` + right `Ma · {todayDayLabel} · {today's day type}` (from `meso.days` and `DAY_ORDER[new Date().getDay()…]` — reuse the existing today-resolution helper used by `TrainTodayPage`, grep `todayKey|dayOfWeek` in `features/train/logic`); chips row from `runBands` (`★` prefix on emphasize): `Hát 16→22 ▲`, `Mell 10 · tart`, `Vádli 6`. Remove `PhaseCurveBars`/`MetaStat` from the card (keep the components if others use them).
- [ ] **Step 2: Hub tiles** — first tile becomes `wash="coral" icon="i-heti" eyebrow="Heti vizsgálat" line={`W${active.currentWeek} · ${runBands(active).reduce((s,r)=>s+r.current,0)} szett`} onClick={() => navigate(`/train/mesocycles/${active.id}/week`)}` (present only with an active run, like today's Volumen tile). `Történet`, `Sablonok`, `Új blokk` unchanged (`Új blokk` line `3 lépés · AI ›`).
- [ ] **Step 3: Tests** — update the hero assertions (`Aktív · 3/6 hét`, phase chip text, a `16→22`-style chip), the first tile name `Heti vizsgálat`, keep the Történet/compare cases. Run both modes; commit `feat(train-fe): hub hero status-first (week dots, phase chip, band chips) + Heti vizsgálat tile (mezo-<id>)`.

---

### Task 3: Run page + day page (`MesocycleBuilderPage` rewrite, new `MesoDayPage`)

**Files:**
- Rewrite: `frontend/src/features/train/pages/MesocycleBuilderPage.tsx`
- Create: `frontend/src/features/train/pages/MesoDayPage.tsx`
- Modify: `frontend/src/features/train/components/MesoExercises.tsx` (remove the Fókusz `<details>`/`MusclePriorityPicker` block and the `PUT muscle-priorities` call; expose a single-day mode prop `day?: string`), `frontend/src/app/router.tsx` (add `{ path: 'train/mesocycles/:id/days/:day', element: <MesoDayPage /> }` after the `:id` route)
- Tests: `MesocycleBuilderPage.test.tsx` (rewrite), `MesoDayPage.test.tsx` (new), `train.nav.test.tsx` (`:98` builder pin — keep "full-screen, no sub-nav")

- [ ] **Step 1: `MesocycleBuilderPage`** (prototype `#page-run`): `MozaikPage tone="coral"` · `PageHead label="‹ Mezociklus"` · `PageHero icon="i-meso" name={meso.title} sub={`Aktív · ${currentWeek}/${weeks} hét · ${phaseChip} · vége ${huMonthDay(endDate)}`}` · body in `EntranceGroup`:
  1. card `A blokk íve`: `.mz-wdots` + line `W1 · W2 · **W3 · most** · W4 · W5 csúcs · deload`.
  2. `.mz-coach` with `deciderSentence(meso)` (omit when null).
  3. `Mosaic`: `Tile wash="coral" icon="i-heti" eyebrow="Heti vizsgálat"` with a mini bar cluster (5 thin `<b>` bars from `runBands` heights `current/22`) + line `{total} szett · {up} rámpázik · {hold} tart` → `/week`; `Tile wash="sage" eyebrow="Hétfőn jön"` (non-navigating, `onClick` absent) with `nextRolloverChips` chips + line `a heti görgetés hajnalban fut`.
  4. eyebrow `A heted · koppints egy napra a szerkesztéshez` + `Mosaic` of `DayTile`s for `meso.days.filter(d => d.type !== 'Rest')`, `status` = `'now'` for today's day token, `'done'` for earlier-this-week days whose instance is completed if available from `useTrain()` (`completed` list) else omit → `navigate(`/train/mesocycles/${id}/days/${encodeURIComponent(day)}`)`. Sets/minutes per tile from the day's exercises (`countsForVolume`, `workingSets`).
  5. footer `CtaGhost` `Meso lezárása` → `MesoCloseSheet` (unchanged). Planned run: `CtaPrimary` `Aktiválás` (existing `activateMesocycle`). Archived → `<Navigate to=…/report replace>` (unchanged).
- [ ] **Step 2: `MesoDayPage`** (prototype `#page-day`, run flavour): resolves `meso` + `day` from params; `MozaikPage tone` by day type; `PageHead label="‹ A blokkod"` (`useBackNav(`/train/mesocycles/${id}`)`); `PageHero big={dayLetter} name={`${type} nap`} sub={`${sets} szett · ~${minutes} perc · ${currentWeek}. hét · a szerkesztés a következő edzéstől él`}`; `StatStrip` of per-muscle cells (`daySessionBreakdown`), dashed cell when over cap; then `<MesoExercises meso={meso} day={day} />` restricted to that day (the existing component owns the `PUT …/days/{dayId}/exercises` save path — add the `day` prop so it renders one day's editor and hides the day tabs). Unknown day → `GhostState` `Ez a nap nincs a blokkban.`
- [ ] **Step 3: Tests** — builder: hero sub, week dots count = weeks, coach sentence when `volumeRecompute` has a change, 2 tiles, day tiles for non-rest days, tapping `Hét` tile navigates to `/train/mesocycles/<id>/days/H%C3%A9t` (use `createMemoryRouter`), no `Fókusz` text anywhere; day page: hero, per-muscle cells, `MesoExercises` renders only that day (its exercises visible, another day's not), back lands on the builder. Both modes. Commit `feat(train-fe): run page status-first + day mosaic; MesoDayPage; no in-cycle Fókusz (mezo-<id>)`.

---

### Task 4: `logic/mesoWeek.ts` + `MesoWeekPage` + `MesoMusclePage` (absorbs Volumen)

**Files:**
- Create: `frontend/src/features/train/logic/mesoWeek.ts`, `frontend/src/features/train/pages/MesoWeekPage.tsx`, `frontend/src/features/train/pages/MesoMusclePage.tsx`, `frontend/src/features/train/components/DerivationSteps.tsx` (extracted from `MesoVolume`'s 01/02/03 derivation body — read `MesoVolume.tsx` and `VolumeBar.tsx` first; move, don't rewrite)
- Delete: `frontend/src/features/train/pages/MesoOverviewPage.tsx` + test; `MesoVolume.tsx` if its only consumers were the overview + builder (grep first); keep `VolumeBar`
- Modify: `router.tsx` (`train/mesocycles/:id/week` → `MesoWeekPage`, `train/mesocycles/:id/week/:muscle` → `MesoMusclePage`, `train/mesocycles/:id/overview` → `<Navigate to="../week" replace />` — use a tiny `RedirectToWeek` component that reads `id`), `prototype.css` (`.mz-wtile`, `.mz-wspark`, `.mz-dsteps`/`.mz-dstep`/`.mz-dnum`/`.mz-dcells` — px ×1.18 from the prototype)
- Tests: `mesoWeek.test.ts`, `MesoWeekPage.test.tsx`, `MesoMusclePage.test.tsx`, `train.nav.test.tsx` (overview redirect)

**Interfaces (`mesoWeek.ts`):**
```ts
export interface WeekSummary { total: number; prev: number | null; delta: number | null; up: number; hold: number }
export function weekSummary(arc: MesoVolumeArc, bands: RunBand[]): WeekSummary   // total = Σ planned of currentWeek; prev = Σ planned of currentWeek-1 (null when week 1)
export interface MuscleWeekTile { group: string; label: string; region: string; tier: MuscleTier; current: number; ceiling: number; mev: number; mav: number; mrv: number; prev: number | null; series: { week: number; planned: number; actual: number | null; isCurrent: boolean; deload: boolean }[]; status: string; statusTone: 'sage' | 'gold' | 'mut' }
export function muscleTiles(arc: MesoVolumeArc, meso: Mesocycle): MuscleWeekTile[]  // join arc.muscles (planned series) with runBands; status: maintain→'MV-n tart · nem rámpázik'(mut) | current>=ceiling→'plafonon'(gold) | hold change→'= tartás · grind a múlt héten'(gold) | else `▲ +2 e héten · ${ceiling-current} a plafonig`(sage)
export function whereItWorks(meso: Mesocycle, group: string): { day: string; type: string; sets: number; exercises: { name: string; sets: number }[] }[]
export function previousBlock(archived: Mesocycle[], group: string): { start: number; peak: number; ceiling: number; title: string } | null  // most recent archived run with volumePerMuscle[group]: start = mev, peak = current, ceiling = mrv (honest: arc not fetched; label 'utolsó ismert')
```

- [ ] **Step 1: Failing `mesoWeek.test.ts`** covering: `weekSummary` totals/delta for a 6-week arc at week 3 (delta = W3−W2 planned) and `prev: null` at week 1; `muscleTiles` joins arc+bands and picks the four status variants; `whereItWorks` lists the two Upper days with back exercises and sets; `previousBlock` picks the latest archived run and returns null when none.
- [ ] **Step 2: Implement** using `mesoVolumeArcMock` shapes (`data/train/mesoArcHooks.ts`) as the fixture source in tests.
- [ ] **Step 3: `MesoWeekPage`** (`#page-week`): `useTrain()` for `meso`, `useMesocycleVolumeArc(id)`; real-mode pending → `MesocycleSkeleton`-style `role="status"`; no arc → `GhostState` `A heti vizsgálat a blokk első edzése után jelenik meg.`; `MozaikPage tone="coral"` · `PageHead label="‹ A blokkod"` · `PageHero icon="i-meso" big={total} name={`Heti vizsgálat · ${currentWeek}. hét`} sub={delta==null ? 'szett ezen a héten' : `szett ezen a héten · ${delta>=0?'+':''}${delta} a múlt héthez képest`}` · `StatStrip` (`total / szett · W{n}`, `+delta / vs. W{n-1}` or `— / első hét`, `up / rámpázik`, `hold / tart`) · live banner (`Élő rendszer · a következő görgetés hétfő hajnal` + chips from `nextRolloverChips`) · `Mosaic` of `.mz-wtile` buttons (pill + tier chip, `.mz-wnums` `{current} → {ceiling} plafon` nowrap, `VolumeBar`-style band with `mev/mav/mrv` ticks and a dim marker at `prev` + a live marker at `current`, `.mz-wspark` 6 bars from `series` (current gold, deload striped, future faded), status line) → `navigate(`…/week/${group}`)` · coach card (peak-week sentence: first emphasize tile's `series[4].planned` vs ceiling) · principle `Koppints egy izomra a részletekért…`.
- [ ] **Step 4: `MesoMusclePage`** (`#page-muscle`): tone by group's region (`coral|gold|rose|sage|lav`), `PageHead label="‹ Heti vizsgálat"`, hero pill + big `{current} → {ceiling}` + name `{Tier} · {rule}` + sub `{week}. hét · {freq}×/hét · {step}`; `StatStrip` (`most / plafon / e héten / ×hét`); band card (`VolumeBar` with MV-less caps `MEV/MAV/MRV`, prev dim + now live); arc card (`.mz-wspark` at 40px height + week labels `W1…W5 · csúcs · deload` + the numbers line); coach sentence; `Ezen a héten · hol dolgozik` rows from `whereItWorks` (day pill + `${type} nap · ${sets} szett` + exercise chips `${name} ${sets}×`); `Honnan a sáv · levezetés` = `DerivationSteps` (4 numbered discs: Baseline cells `MEV/MAV/MRV`, Fókusz-sáv cells `indul/plafon/+2`, Rád szabva rows from `VolumeProfile.source.adjustments` (icon + text + effect chip; empty → `nincs igazítás — a baseline érvényes`), Eredő cells `W1…Wn` from the arc (current `hot`) + `+2 hétfőn`/`= hétfőn` cell; confidence bar from `source.confidence` + `🔧 Felülír` button wired to the existing override path if one exists in `MesoVolume`, else a disabled button with title `hamarosan`); `Előző blokk` card from `previousBlock` or `nincs előző blokk`. Muscle not in arc → `GhostState`.
- [ ] **Step 5: Tests** — week page: hero total, delta line, 4 stat cells, N tiles = arc muscles with landmarks, first tile is the emphasized one, no `%`; tapping a tile navigates; real-mode pending skeleton + ghost. Muscle page: hero numbers, 5 section eyebrows (`A sáv · hol tartasz`, `A blokk íve · W1 → deload`, `Ezen a héten · hol dolgozik`, `Honnan a sáv · levezetés`, `Előző blokk`), derivation has 4 numbered steps, `Rád szabva` shows `nincs igazítás` when the source has no adjustments, previous-block ghost when none. Nav test: `/overview` redirects to `/week`. Commit `feat(train-fe): Heti vizsgálat + izom-részlet pages (absorb Volumen), overview redirect (mezo-<id>)`.

---

### Task 5: Templates, report, compare in the band language

**Files:**
- Modify: `frontend/src/features/train/components/MesoTemplateCard.tsx` (chips: `{n} nap · {split label}`, `★ {emphasized labels}`, `{weeks-1} + 1 deload`; legacy templates (goalPreset not `hypertrophy` or `phaseCurve` without `Deload`) get a muted `régi modell` chip + `indításkor az új modellre konvertálódik` note), `MesoReportPage.tsx` (add after the stat strip: a `Ezt akartad` quote card when `report`'s run has `notes` — read `meso.notes` from `useTrain()`; and a `Izmonként · indulás → elért csúcs / plafon` card from `report.volume` arcs: per muscle `W1 planned → max planned / mrv` with a bar), `frontend/src/features/train/logic/mesoCompare.ts` (+ `peakVolumeRows(a, b)`: per union muscle `{ label, aPeak, aCeiling, bPeak }` and `focusDiff(runA, runB)`: tier chips per side), `MesoComparePage.tsx` (new `Fókusz-különbség` card with two chip rows + `Csúcs-volumen · szet/hét` table replacing the per-week back table)
- Tests: extend `MesoTemplateCard`/`MesoTemplatesPage.test.tsx`, `MesoReportPage.test.tsx` (quote present when notes, absent otherwise; bands card rows), `mesoCompare.test.ts` (new helpers), `MesoComparePage.test.tsx`

- [ ] **Step 1: failing tests** for `peakVolumeRows` (union of muscles, `–` for a side without the muscle, peak = max planned) and `focusDiff` (emphasize/maintain chips per run; legacy run → `régi modell · címke` chip).
- [ ] **Step 2: implement helpers + UI**, keep `MesoTemplatesPage`'s plain DS head (`train.nav.test.tsx:84-90` pins it).
- [ ] **Step 3: run both modes; commit** `feat(train-fe): templates/report/compare in the band language (mezo-<id>)`.

---

### Task 6: Docs, CODEMAP, visual goldens, PR

- [ ] **Step 1: `train.md`** — §2: replace the `Mesociklus`/`Volumen` paragraphs (:95-122) with the new page set (hub hero, run page, day page, Heti vizsgálat, izom-részlet, templates chips, report/compare additions, the overview redirect); §8 test list; §10 file map (add `MesoDayPage`, `MesoWeekPage`, `MesoMusclePage`, `DerivationSteps`, `logic/mesoBands`, `logic/mesoWeek`; remove `MesoOverviewPage`, `MesoVolume` if deleted). Note the "Rád szabva" layer renders real `source.adjustments` (empty today for engine-seeded runs) — no fabricated personalisation.
- [ ] **Step 2: Visual goldens** — add to `frontend/tests/visual/visual.spec.ts` `SCREENS`: `meso-hub` (`/train/mesocycles`), `meso-week` (`/train/mesocycles/<mock active id>/week`); run `pnpm test:visual:update` locally (darwin) and commit the darwin PNGs; trigger `update-visual-baselines.yml` after the PR opens for linux.
- [ ] **Step 3: Gates**
```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs && node scripts/gen-codemap.mjs --check
cd frontend && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build && pnpm test:visual
```
- [ ] **Step 4: Commit, push, PR, CI, merge, close**
```bash
git add -A docs frontend/tests && git commit -m "docs(train): mesocycle pages v2 + goldens; CODEMAP (mezo-<id>)"
git push -u origin feat/meso-pages-v2
gh pr create --fill --title "feat(train-fe): mesocycle pages v2 — hub, run/day, Heti vizsgálat + izom-részlet, report/compare (mezo-<id>)" --body "Spec: docs/superpowers/specs/2026-09-01-mesocycle-wizard-redesign-design.md · Plan: docs/superpowers/plans/2026-09-02-meso-pages-v2-frontend.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
git checkout main && git pull --rebase && git merge --no-ff feat/meso-pages-v2 -m "Merge feat/meso-pages-v2: mesocycle pages v2 (mezo-<id>)" && git push && git branch -d feat/meso-pages-v2
bd close <id> && bd dolt push
```

---

## Self-review

- **Spec coverage:** hub hero (Task 2) ✓; run page status-first + day mosaic + editable day page, no in-cycle Fókusz (Task 3) ✓; Heti vizsgálat + muscle detail absorbing Volumen with every datum (band, arc, decision, where-it-works, 4-step derivation with confidence/override, previous block) + `/overview` redirect (Task 4) ✓; templates tiles/chips + legacy conversion note, report quote + start→peak/ceiling, compare focus diff + peak table (Task 5) ✓; docs/CODEMAP/goldens (Task 6) ✓.
- **Placeholder scan:** every task names files, props, copy and test cases; the two "grep first" notes (`VolumeDecider` change vocabulary, today-key helper) point at exact files.
- **Type consistency:** `RunBand` (Task 1) is consumed by hub chips, run tiles and `muscleTiles` (Task 4) ✓; `DayTile` props reused from the wizard plan ✓; `MuscleTier`/`ceilingSets` shared with `logic/mesoPlan.ts` ✓; routes use the `day` token URL-encoded consistently in Task 3 tests ✓.
