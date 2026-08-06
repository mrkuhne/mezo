# Structure lint — session/weekly rule checks with why-explanations — design

**Date:** 2026-08-06 · **Driving issue:** `mezo-oyhy.2` (child of the guided-meso-building epic) ·
**Status:** approved by Daniel (brainstorm 2026-08-06)

## Context

The zone-band children (`mezo-oyhy.1`, `.7`) cover VOLUME guidance. This child adds the
STRUCTURE half of the guided-building vision: soft, explained checks of how the week is
assembled — exercises per muscle per session, sets per exercise, frequency, weekly exercise
variety, session size, and push:pull / ham:quad balance. Market gap reference: Hevy-AI-style
imbalance flags combined with MacroFactor-style why-explanations, at build time
(`docs/research/comparisons/plan-builder-guidance-ux.md`). Rule base:
`docs/research/concepts/program-design-rules.md` (RP · Helms · Nippard · Ethier consensus
tables; the balance ratios come from structural-balance literature, NOT the three experts —
the UI copy says so).

## Decisions (brainstorm)

1. **Surface: a separate collapsible Struktúra card in the MesoEditor**, below
   `SetBudgetCard`. Rejected: merging into SetBudgetCard's warning block (mixes volume and
   structure concerns, card grows long); per-day inline flags on `DayBreakdownCard` (more
   components touched, v1 keeps locality simple).
2. **Balance rules ARE in v1, with wide tolerances** (push:pull silent inside 0.6–1.6;
   ham:quad flags only below 0.4). Their explanation notes the structural-balance-literature
   provenance.
3. **Tone: soft, never red, never force-opens.** All findings render as neutral
   (`--surface-2`) explanation rows — the MacroFactor principle (explain, don't scold).
   The card has no `defaultOpen` behavior.

## The rules (v1)

All thresholds live in exported constant tables in the logic module — one place to tune.
Plyo exercises are exempt from R1–R4 set/exercise math but count in R5 session size (they
are real session slots). Off-days (`isOffDay`) and empty days are skipped entirely.
Muscle → group mapping reuses `budgetGroup` from `setBudget.ts`.

| id | Rule | Threshold | Message intent (HU copy in §Copy) |
|---|---|---|---|
| `exercises-per-muscle` | exercises per muscle group per session | >3 flags; ham/traps >2 | few exercises done well beat variety (RP) |
| `sets-per-exercise` | working sets per exercise | compound outside 2–4, isolation outside 2–3 | 2 is a legit start; >4 is junk-volume territory |
| `frequency` | group's weekly sets all on one day | flags when weekly non-plyo sets ≥4 AND trained on exactly 1 day | ≥2×/week may speed gains up to ~30% |
| `variety` | distinct exercise names per group per week | >5 always; <2 only when weekly sets ≥6 | 2–5 distinct movements per muscle per week (RP) |
| `session-size` | exercises per training day (all kinds) | <5 or >9 | template consensus 5–9 (Nippard 6, Ethier 6+1-2) |
| `push-pull` | weekly push:pull working-set ratio | outside 0.6–1.6 (needs both sides >0) | ≈1:1 keeps shoulders honest (structural-balance lit.) |
| `ham-quad` | weekly ham:quad working-set ratio | <0.4, only when quad sets ≥6 | 0.6–0.8:1 target (structural-balance lit.) |

**Push/pull classification (muscle key → side):** push = `chest-*`, `chest`,
`shoulder-front`, `shoulder-side`, `shoulder` (legacy coarse, press-dominant), `triceps-*`,
`triceps`; pull = `back-*`, `back`, `lats`, `traps`, `rear-delt`, `shoulder-rear`,
`biceps-*`, `biceps`. Legs and core are neutral (excluded from the ratio). The map is an
exported constant next to the thresholds.

## Architecture

- **`frontend/src/features/train/logic/structureLint.ts`** — pure module:
  `export interface StructureFinding { rule: StructureRuleId; label: string; detail: string; day?: string }`
  (`label` = short HU headline, `detail` = the why-explanation, `day` set for session-scoped
  findings), `export function structureLint(days: MesoDay[]): StructureFinding[]`, plus the
  exported threshold/classification constants. Ordering: session-scoped findings first
  (week-day order), then weekly findings in the table order above.
- **`frontend/src/features/train/components/StructureLintCard.tsx`** — collapsible card,
  same collapse idiom as `SetBudgetCard`. Collapsed: eyebrow `Struktúra` + a count pill —
  `{n} észrevétel` (amber-wash pill) or `✓ rendben` (sage-wash pill) when clean. Expanded:
  one neutral `--surface-2` row per finding (`label` bold + `detail`), or the clean-state
  line. Presentational only — takes `findings: StructureFinding[]`.
- **`MesoEditor.tsx`** — computes `structureLint(days)` next to the existing `muscleBudgets`
  call, renders `<StructureLintCard findings={...} />` directly below `<SetBudgetCard …/>`.
  No other surface in v1.

## Copy (Hungarian, final — `label` → `detail`)

- `exercises-per-muscle` · `{Izom}: {n} gyakorlat egy edzésen ({nap}).` → `1–3 gyakorlat izmonként edzésenként a hatékony sáv — kevesebb gyakorlat jól csinálva többet ér, mint a variálás.`
- `sets-per-exercise` · `{Gyakorlat}: {n} szett ({nap}).` → alacsony: `2 szett alatt egy gyakorlat alig ad ingert — a 2 szett teljesen legitim kezdés.` · magas: `{max} szett fölött egy gyakorlaton a plusz szett már alig hoz — inkább új gyakorlat vagy másik nap.`
- `frequency` · `{Izom}: minden heti szett egy napon.` → `Ugyanez a volumen ≥2 napra elosztva akár ~30%-kal gyorsabb fejlődést hozhat.`
- `variety` · kevés: `{Izom}: 1 gyakorlat egész héten.` → `Heti 2–5 különböző gyakorlat izmonként fedi le a szögeket — egy másik variáció beférne.` · sok: `{Izom}: {n} különböző gyakorlat a héten.` → `5 fölött a variálás már a progressziót nehezíti — kevesebb mozdulat, jobban csinálva.`
- `session-size` · kicsi: `{Nap}: csak {n} gyakorlat.` → `A bevált sablonok 5–9 gyakorlattal dolgoznak edzésenként.` · nagy: `{Nap}: {n} gyakorlat.` → `9 fölött a session vége már fáradtan megy — oszd el, vagy húzd meg.`
- `push-pull` · `Push:pull arány {ratio}.` → `A ≈1:1 heti tolóerő-húzóerő arány védi a vállat (strukturális-balansz irodalom, nem RP-szabály).`
- `ham-quad` · `Ham:quad arány {ratio}.` → `A hátsó comb a quad-volumen ~0.6–0.8-szorosát kéri (strukturális-balansz irodalom).`
- Card collapsed pill: `{n} észrevétel` / `✓ rendben` · clean expanded line: `✓ A terv strukturálisan rendben — gyakorlat/izom, frekvencia és balansz a sávban.`

Ratios render with one decimal (`0.3`, `1.8`).

## Testing

- `structureLint.test.ts` — per rule: boundary cases (3 vs 4 exercises; 2/4/5 compound sets;
  1-day vs 2-day split at ≥4 sets; variety 1-with-6-sets vs 1-with-4-sets, 5 vs 6 names;
  4/5/9/10 exercises per day; ratio edges 0.6/1.6 silent–flag; ham:quad 0.4 gate + quad<6
  silence), plyo exemptions (R2 skip, R5 count), off-day skip, push/pull map spot checks,
  finding ordering.
- `StructureLintCard.test.tsx` — collapsed count pill vs ✓ pill, expanded rows, clean state,
  toggle.
- `MesoEditor.test.tsx` — the card renders below the budget card with findings from the
  edited days.
- Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` + `node scripts/lint-docs.mjs`
  (+ visual golden regen if the meso editor screen is a golden — check `tests/visual/visual.spec.ts`).

## Non-goals

- Session-length estimate (`mezo-oyhy.3`), rep-zone distribution (`mezo-oyhy.4`),
  generator integration (`mezo-oyhy.6`).
- No per-day inline lint flags on `DayBreakdownCard`, no GymPage/MuscleWeekSheet surface.
- No hard blocks anywhere — lint never prevents saving.
- No user-configurable thresholds (constants only).
