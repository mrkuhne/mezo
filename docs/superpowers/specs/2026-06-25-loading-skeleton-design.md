# Universal Loading Skeleton — Design Spec

**Date:** 2026-06-25
**Status:** Approved (brainstorm) → ready for implementation plan
**Driving bd:** mezo-f2z

## 1. Problem

In **real mode** every dual-mode read hook returns an EMPTY value while its query is unresolved (`useDualQuery`'s "no static fallback in real mode" invariant), and most views consume only `data` — they drop the `isPending` flag the hook already computes. So during the ~1 s cold-load window a view renders its genuine EMPTY state and then flips to content:

- **Kamra** → "A kamra üres"
- **Receptek** → "Nincs egyező recept" + count `0`
- **Mai (Today)** → GhostState "tervezz mezociklust" CTA
- **GoalPlanner / ActiveWorkout** → `return null` (blank screen)

In **mock mode** there is no flash: `initialData` seeds the first render synchronously (`staleTime: Infinity`), so `isPending` is `false` from frame one. The flash is purely real-mode network latency.

**Goal:** replace the flash with an animated skeleton that previews the incoming layout, without disturbing mock-mode (and therefore Playwright/component-test) parity.

## 2. Decisions (locked in brainstorm)

| Decision | Choice |
|---|---|
| **Approach** | **Hybrid** — one universal `Skeleton` primitive + layout-aware skeletons on the main flash sites, generic fallback elsewhere. |
| **Animation** | **Light sweep** — a faint teal (`brand-glow`) gradient travels left→right across a `surface-2` block (new `@keyframes mezo-shimmer`). |
| **Scope** | **Main + training views** — 8 views get layout-aware skeletons; 2 blank-flash views get a generic skeleton stack. |
| **Reduced motion** | `prefers-reduced-motion` → static `surface-2` block, no sweep. |
| **Mode gating** | Keyed off `isPending`, which is already `false` in mock (synchronous seed) → skeleton appears **only in real mode**. No explicit `isMock` branch needed. |

## 3. The primitive — `src/components/ui/Skeleton.tsx`

A small, dependency-free presentational component. No data, no hooks — pure shape + shimmer.

```
type SkeletonVariant = 'line' | 'block' | 'card' | 'circle' | 'stat';

interface SkeletonProps {
  variant?: SkeletonVariant;   // default 'line'
  width?: string | number;     // CSS length; default per variant
  height?: string | number;    // CSS length; default per variant
  radius?: string | number;    // override border-radius
  className?: string;
  style?: React.CSSProperties;
}
```

- Renders a single `<div className="sk sk--{variant}">` carrying the shimmer; inline width/height/radius override the variant defaults.
- Variant defaults: `line` h≈11px r=7; `block` (caller sizes it) r=7; `card` (caller sizes a container) r=11; `circle` r=50%; `stat` ≈30×30 r=8.

**Two convenience composites** (same file or adjacent), for the most repeated shapes:
- `SkeletonText({ lines = 3, widths? })` → a vertical stack of `line` skeletons with tapering widths (mirrors today's `GhostState` shape, but animated).
- `SkeletonCard({ children })` → a `surface-1` card container (border + radius + padding) wrapping arbitrary skeleton children — the building block for card-list layouts.

**CSS — `src/styles/prototype.css`:**
```css
.sk { position: relative; overflow: hidden; border-radius: 7px; background: var(--surface-2); }
.sk::after {
  content: ''; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(94,234,212,.10), transparent);
  animation: mezo-shimmer 1.5s infinite;
}
@keyframes mezo-shimmer { 100% { transform: translateX(100%); } }
.sk--circle { border-radius: 50%; }
@media (prefers-reduced-motion: reduce) { .sk::after { display: none; } }
```
(The exact rgba/teal is `brand-glow` at low alpha; the `.sk--card`/`.sk--stat` container styling reuses the existing `surface-1` + soft-border tokens.)

## 4. Per-view skeletons

Each layout-aware view gets a sibling skeleton component that mirrors *its* real layout (header bar + the cards/rows/stats it will show), built from the primitives. The blank-flash views get a generic stack.

| View | File (today) | Skeleton |
|---|---|---|
| **Kamra** | `features/fuel/views/FuelKamraView.tsx` | layout-aware (header + ingredient/stash cards) |
| **Receptek** | `features/fuel/views/FuelRecipesView.tsx` | layout-aware (header + recipe cards) |
| **Mai** | `features/train/views/TrainTodayView.tsx` | layout-aware (today card + exercise rows) |
| **Gym** | `features/train/views/GymView.tsx` | layout-aware |
| **Sport** | `features/train/views/SportView.tsx` | layout-aware |
| **Exercises** | `features/train/views/ExercisesView.tsx` | layout-aware (list) |
| **Mezociklus-könyvtár** | `features/train/views/MesocycleLibraryView.tsx` | layout-aware (list) |
| **Célok** | `features/train/views/GoalsView.tsx` | layout-aware |
| **GoalPlanner** | `features/me/GoalPlanner.tsx` | generic (`SkeletonText`/`SkeletonCard` stack) — replaces `return null` |
| **ActiveWorkout** | `features/train/ActiveWorkoutScreen.tsx` | generic stack — replaces `return null` |

Each per-view skeleton lives next to its view (e.g. a `*Skeleton` component in the same file or a `<View>.skeleton.tsx` sibling) so the layout and its skeleton change together. **`RunningView` is the reference** (already branches on `pending` → a loading placeholder); it is left as-is or trivially upgraded to the new primitive for consistency.

## 5. Integration — surface `isPending`

`useDualQuery` already returns `{ data, isPending }`; the gap is that the feature hooks destructure only `data`. The change is **additive**: each affected hook also returns `isPending` (or a named alias like `pantryPending`), and the view branches on it.

- Hooks to extend: `usePantry`, `useRecipes`, and the hooks backing Gym/Sport/Exercises/Mesocycle/Goals. `useTrain` already surfaces `workoutPending`/`mesoPending` — reuse those; only widen where a specific view's flag is missing.
- View loading branch (canonical shape):
  ```tsx
  const { data, isPending } = useX();
  if (isPending) return <XSkeleton />;   // BEFORE the empty-state check
  if (isEmpty(data)) return <EmptyState />;
  return <Content data={data} />;
  ```
- The branch goes **before** the empty-state/`!activeMeso` check, so loading no longer renders as "empty".

## 6. Dual-mode correctness

- **Mock:** `isPending` is `false` on first render (synchronous `initialData`) → the skeleton branch is never taken → views render content immediately → **Playwright parity + component tests unchanged** (they run in mock mode and never see a skeleton frame).
- **Real:** `isPending` is `true` during the cold-load → skeleton renders → flips to content when the query resolves.
- No `isMock` check is introduced in the views; the `isPending` semantics already encode the mode difference. (`QueryProvider` still renders `null` until `bootstrapOwnerToken()` resolves in real mode — that pre-mount blank is out of scope here; the skeleton covers the per-view query window, which is the reported flash.)

## 7. Testing

- **Primitive:** component test for `Skeleton` — each variant renders the expected element/shape; `SkeletonText` renders N lines; `prefers-reduced-motion` removes the sweep (assert the static branch).
- **Views (both modes — the project's mandatory dual-mode gate):**
  - **Mock:** the view renders content with **no skeleton** in the DOM (the seed is synchronous) — guards parity.
  - **Real (pending):** with the query forced pending, the view renders the skeleton (not the empty state / not `null`).
- Existing view tests stay green (the loading branch is additive and inert in mock).
- `pnpm build` + `pnpm test` (both modes) green before merge.

## 8. File map

- **New:** `src/components/ui/Skeleton.tsx` (primitive + `SkeletonText` + `SkeletonCard`); 8 per-view skeleton components (co-located); skeleton test(s).
- **Modified:** `src/styles/prototype.css` (`@keyframes mezo-shimmer` + `.sk*` rules + reduced-motion); ~6-7 feature hooks (surface `isPending`); 10 views (loading branch).
- **Reference, unchanged:** `src/components/ui/GhostState.tsx` (stays for empty-state CTAs; the skeleton is for loading, not empty).

## 9. Build order (for the plan)

1. **Primitive + CSS + test** — `Skeleton`/`SkeletonText`/`SkeletonCard`, the `mezo-shimmer` keyframe, reduced-motion, component test. Self-contained, no view changes.
2. **Fuel slice** — surface `isPending` in `usePantry`/`useRecipes`; layout-aware `KamraSkeleton` + `RecipesSkeleton`; loading branches; dual-mode tests.
3. **Train slice** — surface `isPending` in the Gym/Sport/Exercises/Mesocycle/Goals hooks; their layout-aware skeletons + the `TrainTodayView` skeleton; loading branches; dual-mode tests.
4. **Blank-flash slice** — generic skeleton stacks for `GoalPlanner` + `ActiveWorkoutScreen` (replace `return null`); tests.

Each slice is independently shippable and testable.

## 10. Out of scope (YAGNI)

- The pre-mount `QueryProvider` blank (auth bootstrap) — separate concern.
- Mock-mode skeletons / artificial delays — would break parity for no user benefit.
- Replacing `GhostState` empty-states — they remain the empty/CTA affordance.
- Skeletons on views not listed in §4 (e.g. Insights, Me detail) — can adopt the primitive later; not in this PR.
