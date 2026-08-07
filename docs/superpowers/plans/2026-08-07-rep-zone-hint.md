# Rep-Zone Distribution Hint Implementation Plan (mezo-oyhy.4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** structureLint rule 9 (`rep-zone`): flag a muscle group whose weekly sets sit ≥80% in one rep zone (heavy 5–10 / moderate 10–20 / light 20–30), with skew exceptions (shoulder→light, ham/glute→heavy), rendered by the existing Struktúra card.

**Architecture:** Logic-only change in `structureLint.ts` (+ its test); no UI/component change (`StructureLintCard` renders findings generically). Spec: `docs/superpowers/specs/2026-08-07-rep-zone-hint-design.md`.

**Tech Stack:** TypeScript + Vitest. All under `frontend/`.

## Global Constraints

- Imports deep + absolute `@/*`; Hungarian copy EXACTLY as given; code/comments/commits English; commits carry `(mezo-oyhy.4)`.
- Working dir: `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/train-today-single-workout-3c56c2`, branch `feat/rep-zone-hint` (already checked out — do NOT create branches).
- Focused tests only per task; NEVER `./mvnw`, never `pnpm dev`; full gate once, in Task 2.
- Rule invariants: plyo excluded; zone from the rep RANGE (`repMax ≤ 10` heavy, `repMin ≥ 20` light, else moderate); gate ≥6 weekly non-plyo sets; trigger dominant share ≥0.8; exception pairs silent; weekly finding (no `day`), appended AFTER the ham-quad rule.
- The repo pre-commit hook may force-add a root-level `issues.jsonl`; after every commit check `git show --stat HEAD` and fix with `git rm --cached issues.jsonl -q && git commit --amend --no-edit --no-verify` if present.

---

### Task 1: rule 9 in `structureLint.ts`

**Files:**
- Modify: `frontend/src/features/train/logic/structureLint.ts`
- Modify: `frontend/src/features/train/logic/structureLint.test.ts` (new describe + the clean-week fixture rebalance)

**Interfaces:**
- Produces: `StructureRuleId` gains `'rep-zone'`; exported constants `REP_ZONE_MONO_SHARE = 0.8`, `REP_ZONE_MIN_WEEKLY_SETS = 6`, `REP_ZONE_SKEW_OK: Record<string, RepZone>`, `export type RepZone = 'heavy' | 'moderate' | 'light'`, `export function repZoneOf(repMin: number, repMax: number): RepZone`.

- [ ] **Step 1: Rebalance the clean-week fixture (required by the new rule)**

In `structureLint.test.ts`, the `cleanWeek()` builder's `Csü` day currently creates its six exercises with the default 8–10 rep range (all heavy-zone) — under rule 9 chest/back/quad would legitimately mono-flag. Give ALL six `Csü` exercises `repMin: 12, repMax: 15`, e.g.:

```ts
  day('Csü', [
    ex('chest-mid', 3, { name: 'B1', repMin: 12, repMax: 15 }), ex('back-mid', 3, { name: 'B2', repMin: 12, repMax: 15 }), ex('quad', 3, { name: 'B3', repMin: 12, repMax: 15 }),
    ex('ham', 3, { name: 'B4', repMin: 12, repMax: 15 }), ex('triceps-long', 3, { name: 'B5', repMin: 12, repMax: 15 }), ex('back-wide', 3, { name: 'B6', repMin: 12, repMax: 15 }),
  ]),
```

(Verified side-effect-free: every gated group splits 50/50 or 33/67 heavy/moderate — under the 0.8 trigger; R2 set counts unchanged; the Csü session estimate moves to ~68 min — still inside 45–90; R6/R7 unaffected — sets, not reps.)

- [ ] **Step 2: Write the failing tests**

Append to `structureLint.test.ts`:

```ts
describe('rep-zone (R9, mezo-oyhy.4)', () => {
  // Zone refresher: repMax ≤ 10 → heavy; repMin ≥ 20 → light; else moderate.
  const heavy = { repMin: 5, repMax: 8 }
  const light = { repMin: 20, repMax: 25 }

  it('rebalanced clean week stays silent', () => {
    expect(structureLint(cleanWeek()).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
  })
  it('classification boundaries: repMax 10 is heavy, repMin 20 is light, 8-12 is moderate', () => {
    // chest 6 sets: 3 heavy (8-10) + 3 moderate (8-12) → 50% — silent
    const mixed = [day('Hét', [ex('chest-mid', 3), ex('chest-upper', 3, { name: 'M', repMin: 8, repMax: 12 })])]
    expect(structureLint(mixed).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    // chest 6 sets all repMax 10 → 100% heavy — flags
    const mono = [day('Hét', [ex('chest-mid', 3), ex('chest-upper', 3, { name: 'M2' })])]
    const found = structureLint(mono).filter((f) => f.rule === 'rep-zone')
    expect(found).toHaveLength(1)
    expect(found[0].label).toBe('Mell: a heti szettek 100%-a nehéz zónában.')
    expect(found[0].day).toBeUndefined()
  })
  it('gate: 5 mono sets silent, 6 flag', () => {
    const five = [day('Hét', [ex('chest-mid', 5)])]
    expect(structureLint(five).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    const six = [day('Hét', [ex('chest-mid', 6)])]
    expect(structureLint(six).filter((f) => f.rule === 'rep-zone')).toHaveLength(1)
  })
  it('mono threshold: 79% silent, 80% flags', () => {
    // 15 heavy + 4 moderate = 19 sets → 78.9% — silent
    const below = [day('Hét', [ex('chest-mid', 15), ex('chest-upper', 4, { name: 'M', repMin: 8, repMax: 12 })])]
    expect(structureLint(below).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    // 16 heavy + 4 moderate = 20 → 80% — flags
    const at = [day('Hét', [ex('chest-mid', 16), ex('chest-upper', 4, { name: 'M', repMin: 8, repMax: 12 })])]
    expect(structureLint(at).filter((f) => f.rule === 'rep-zone')).toHaveLength(1)
  })
  it('skew exceptions: shoulder-light and ham-heavy silent; shoulder-heavy flags', () => {
    const shoulderLight = [day('Hét', [ex('shoulder-side', 6, { ...light, type: 'isolation', workingSets: 3 }), ex('shoulder-rear', 3, { name: 'S2', ...light, type: 'isolation' })])]
    expect(structureLint(shoulderLight).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    const hamHeavy = [day('Hét', [ex('ham', 6, heavy)])]
    expect(structureLint(hamHeavy).filter((f) => f.rule === 'rep-zone')).toHaveLength(0)
    const shoulderHeavy = [day('Hét', [ex('shoulder-side', 6, heavy)])]
    expect(structureLint(shoulderHeavy).filter((f) => f.rule === 'rep-zone')).toHaveLength(1)
  })
  it('plyo sets never count toward the zone mix', () => {
    const w = [day('Hét', [ex('quad', 5), ex('quad', 6, { name: 'P', type: 'plyo', repMin: 5, repMax: 5 })])]
    expect(structureLint(w).filter((f) => f.rule === 'rep-zone')).toHaveLength(0) // 5 < gate
  })
})
```

(Heads-up on incidental findings: these small fixtures also trip R5/R8 etc. — every assertion above filters by rule, so they are immune. In the `skew exceptions` first fixture, note `ex('shoulder-side', 6, {...light, workingSets: 3})` — the third argument OVERRIDES workingSets to 3; the `6` positional is superseded. If that reads confusingly, write `ex('shoulder-side', 3, { ...light, type: 'isolation' })` plus a second 3-set rear-delt exercise so the group totals 6 — the intent is: shoulder group, 6 weekly sets, 100% light, and no R1/R2 side-fires.)

- [ ] **Step 3: Run tests to verify the new describe fails**

Run: `cd frontend && pnpm vitest run src/features/train/logic/structureLint.test.ts`
Expected: the `rep-zone` describe FAILS (no such rule); all pre-existing tests PASS (the fixture rebalance must not break them — if it does, STOP and re-check the rebalance).

- [ ] **Step 4: Implement**

In `structureLint.ts`:

4a. Union: append `| 'rep-zone'` to `StructureRuleId`.

4b. Constants (next to the other thresholds):

```ts
// Weekly rep-zone mix (RP: ~25% heavy 5–10 · 50% moderate 10–20 · 25% light 20–30).
// Flags only a MONO-zone week: dominant zone ≥ 80% of a group's sets, gated at 6.
export const REP_ZONE_MONO_SHARE = 0.8
export const REP_ZONE_MIN_WEEKLY_SETS = 6
export type RepZone = 'heavy' | 'moderate' | 'light'
/** Deliberate skews that stay silent (RP: side/rear delts light, hip-hinge heavy). */
export const REP_ZONE_SKEW_OK: Record<string, RepZone> = { shoulder: 'light', ham: 'heavy', glute: 'heavy' }

/** Zone of a rep range: repMax ≤ 10 heavy, repMin ≥ 20 light, else moderate. */
export function repZoneOf(repMin: number, repMax: number): RepZone {
  if (repMax <= 10) return 'heavy'
  if (repMin >= 20) return 'light'
  return 'moderate'
}

const REP_ZONE_LABELS: Record<RepZone, string> = { heavy: 'nehéz', moderate: 'közepes', light: 'könnyű' }
```

4c. Accumulator — in the day loop's non-plyo exercise branch (where `weeklySets`/`weeklyNames` are bumped), add a per-group per-zone counter:

```ts
  const weeklyZones = new Map<string, Record<RepZone, number>>()
```

(declared with the other weekly accumulators) and inside the loop:

```ts
      let zones = weeklyZones.get(group)
      if (!zones) { zones = { heavy: 0, moderate: 0, light: 0 }; weeklyZones.set(group, zones) }
      zones[repZoneOf(ex.repMin, ex.repMax)] += ex.workingSets
```

4d. Weekly rule — AFTER the ham-quad (R7) block:

```ts
  // R9 — rep-zone mono-diet (weekly; skew exceptions per REP_ZONE_SKEW_OK)
  for (const [group, zones] of weeklyZones) {
    const total = zones.heavy + zones.moderate + zones.light
    if (total < REP_ZONE_MIN_WEEKLY_SETS) continue
    const dominant = (Object.keys(zones) as RepZone[]).reduce((a, b) => (zones[a] >= zones[b] ? a : b))
    const share = zones[dominant] / total
    if (share < REP_ZONE_MONO_SHARE) continue
    if (REP_ZONE_SKEW_OK[group] === dominant) continue
    weekly.push({
      rule: 'rep-zone',
      label: `${groupLabel(group)}: a heti szettek ${Math.round(share * 100)}%-a ${REP_ZONE_LABELS[dominant]} zónában.`,
      detail: 'Az arany arány ~25% nehéz (5–10) · 50% közepes (10–20) · 25% könnyű (20–30 rep) — vegyíts a hiányzó zónákból.',
    })
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/train/logic/structureLint.test.ts src/features/train/components/StructureLintCard.test.tsx src/features/train/components/MesoEditor.test.tsx`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/logic/structureLint.ts frontend/src/features/train/logic/structureLint.test.ts
git commit -m "feat(train): rep-zone mono-diet lint rule (mezo-oyhy.4)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```

---

### Task 2: docs + full gate

**Files:**
- Modify: `docs/features/train.md`

- [ ] **Step 1: Update `docs/features/train.md`**

In the §4 structure-lint bullet, extend the rule list with: rep-zone mono-diet (dominant zone ≥80% of a group's ≥6 weekly sets; zones from the rep range — heavy ≤10 / light ≥20 / else moderate; skew exceptions shoulder→light, ham/glute→heavy per `REP_ZONE_SKEW_OK`). Add the spec pointer `docs/superpowers/specs/2026-08-07-rep-zone-hint-design.md` and bd `mezo-oyhy.4`. Living doc, in place, no changelog.

Run: `node scripts/lint-docs.mjs` — train.md clean (other docs' pre-existing flags: report, don't fix).

- [ ] **Step 2: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build clean, full suite green BOTH modes. NOTE: the mock seed may gain a rep-zone finding on the Struktúra card count pill — if a test asserts an exact finding COUNT for the mock seed, verify the new count is legitimate before touching the assertion, and report it. Unrelated red → stop and report.

- [ ] **Step 3: Commit**

```bash
git add docs/features/train.md
git commit -m "docs(train): rep-zone lint rule in train.md §4 (mezo-oyhy.4)"
git show --stat HEAD   # no root issues.jsonl (Global Constraints)
```
