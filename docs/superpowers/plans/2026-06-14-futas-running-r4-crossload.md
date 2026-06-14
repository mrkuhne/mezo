# Futás R4 — Cross-load Presentation + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the Futás slice: a derived/presentational **cross-load note** in the *E heti edzés* segment ("sprint eccentric → láb-volumen MAV −2"), plus polish (a real-mode loading guard so the week segment doesn't flash the empty ghost) — both test modes green + build.

**Architecture:** Cross-load is **presentational only** in Phase 2 — a static derived card, NOT wired into the volume engine (that's Phase 3, like the volleyball cross-load). One self-contained `RunCrossLoadCard` rendered under the *E heti edzés* session cards, mirroring the existing "sparkle info-box" idiom + the R1 mockup (`futas-app-faithful.html` cross-load box). Polish: consume the already-exposed `runningPending` to guard the week segment's empty state.

**Tech Stack:** React 19, TS, the prototype.css token system.

**Driving bd:** mezo-ijm (under mezo-dy6) — the LAST R-step; closing it completes the Futás slice. **Spec:** `docs/superpowers/specs/2026-06-14-train-running-slice-design.md` §4 (Cross-load).

**Read before coding:**
- `frontend/src/features/train/views/RunningView.tsx` (the *E heti edzés* / `RunWeekView` segment — where the card mounts; the `runningPending` field is already on `useRunning()` but unused)
- `frontend/src/features/train/views/SportView.tsx` (the "sparkle info-box" card idiom: `.card.notch-4` + `rgba(94,234,212,.03)` tint + `Icon name="sparkle"` + eyebrow + text)
- `.superpowers/brainstorm/31354-1781455249/content/futas-app-faithful.html` (the cross-load box: "⚡ Cross-load → kondi: Comb/Lábhajlító −2 (sprint eccentric)")
- `frontend/src/components/ui/GhostState.tsx` (the loading/empty primitive)

**Scope note (YAGNI):** R4 ships the presentational cross-load note in *E heti edzés* only. A Builder "Cross-load" sub-view and any write into `volumePerMuscle`/the recompute engine are explicitly out (Phase 3). Parity capture is skipped — the Futás tab is a Phase-2-native feature with no Phase-1 prototype baseline to diff against (parity is for ported screens).

---

## File map
- Create `frontend/src/features/train/components/RunCrossLoadCard.tsx`
- Modify `frontend/src/features/train/views/RunningView.tsx` — render the card in the week segment + wire the `runningPending` loading guard
- Modify `frontend/src/features/train/views/RunningView.test.tsx` — assert the cross-load note renders

---

## Task 1: RunCrossLoadCard

**Files:** Create `frontend/src/features/train/components/RunCrossLoadCard.tsx`

- [ ] **Step 1: Write the component** (self-contained derived note; mirror SportView's sparkle info-box, `--info` accent)
```tsx
import { Icon } from '@/components/ui/Icon'

/**
 * Derived, presentational cross-load note for the running block — sprint eccentric
 * load carries over to gym leg volume, exactly like the volleyball cross-load. Phase 2
 * shows it statically; wiring it into the volume-recompute engine is Phase 3.
 */
export function RunCrossLoadCard() {
  return (
    <div className="card notch-4" style={{ padding: 12, background: 'color-mix(in srgb, var(--info) 4%, transparent)', borderColor: 'color-mix(in srgb, var(--info) 25%, transparent)' }}>
      <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
        <Icon name="sparkle" size={12} color="var(--info)" />
        <div className="col flex-1">
          <span className="eyebrow" style={{ color: 'var(--info)' }}>Cross-load → kondi</span>
          <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            A sprintek hamstring/quad eccentric terhelése automatikusan levonódik a láb-volumenből
            (<strong>Comb / Lábhajlító MAV −2</strong>) — ahogy a röplabdánál. A volumen-motorba kötés a Phase 3 pattern-engine része.
          </p>
        </div>
      </div>
    </div>
  )
}
```
> Verify `Icon name="sparkle"` exists (SportView uses it). If not, pick the same icon SportView's info-box uses.

- [ ] **Step 2: Typecheck** `cd frontend && pnpm tsc -b` → 0.
- [ ] **Step 3: Commit** `git add frontend/src/features/train/components/RunCrossLoadCard.tsx && git commit -m "feat(fe): RunCrossLoadCard — derived cross-load note (mezo-ijm)"`

---

## Task 2: Render the card + loading guard in RunningView

**Files:** Modify `frontend/src/features/train/views/RunningView.tsx`

- [ ] **Step 1: Render the cross-load card** — in the *E heti edzés* (`week`) segment, AFTER the current-week session cards (only when there IS an active block + sessions render), add `<RunCrossLoadCard />`. Import it. Place it below the last `RunSessionCard` (inside the same container), so it reads as "and this is the gym impact".

- [ ] **Step 2: Loading guard** — pull `runningPending` from `useRunning()` (already returned). In the `week` segment, BEFORE the `activeBlock == null` empty-ghost branch, add: `if (runningPending) return <GhostState lines={3} message="Betöltés…" />` (or the codebase's loading idiom — check how other views show loading; if they just render the ghost, a neutral "Betöltés…" GhostState is fine). This prevents the real-mode initial-load flash of "Nincs aktív futóterved" before the query resolves. Mock mode has `runningPending === false` (synchronous `initialData`), so mock behavior is unchanged.

- [ ] **Step 3: Typecheck + commit**
```bash
cd frontend && pnpm tsc -b
git add frontend/src/features/train/views/RunningView.tsx
git commit -m "feat(fe): cross-load note in E-heti + real-mode loading guard (mezo-ijm)"
```

---

## Task 3: Tests (both modes) + build

**Files:** Modify `frontend/src/features/train/views/RunningView.test.tsx`

- [ ] **Step 1: Add an assertion** to the existing MOCK-mode *E heti edzés* test: after rendering the default (week) view, assert the cross-load note renders — e.g. `expect(screen.getByText(/Cross-load/i)).toBeInTheDocument()` or match the "Comb / Lábhajlító" text. (The active mock block makes the week segment render, so the card is present.)
  - If practical, add a REAL-mode loading-guard assertion: with the running blocks query pending/mocked-empty, the week segment shows the loading/ghost rather than crashing. Keep it simple if the existing real-empty test already covers the ghost path; otherwise leave it.

- [ ] **Step 2: Full both modes + build**
```bash
cd frontend
pnpm test
VITE_USE_MOCK=true pnpm test
pnpm build
```
All green + build success. Fix anything broken minimally; note it.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/features/train/views/RunningView.test.tsx
git commit -m "test(fe): cross-load note in E-heti segment (mezo-ijm)"
```

---

## Done-when (R4 acceptance — and the Futás slice complete)
- Both test modes green + `pnpm build` succeeds.
- Mock mode: the *E heti edzés* segment shows the derived cross-load note under the session cards.
- Real mode: the week segment shows a loading state during the initial fetch (no empty-ghost flash), then the active block.
- No volume-engine wiring (Phase 3).
- `bd close mezo-ijm`. Then the umbrella `mezo-dy6` (Futás slice) has all R-steps closed → close it too.

## Self-review notes (author)
- **Spec coverage:** presentational derived cross-load note in *E heti edzés* (spec §4 — "derived static row", "presentational for this slice") ✓; the polish item (loading guard) clears the R1 review nit. Volume-engine wiring + Builder cross-load sub-view are explicitly Phase 3 / out-of-scope.
- **Grep-before-invent:** confirm `Icon name="sparkle"` (Task 1) and the codebase's loading idiom (Task 2).
