# Today Daypart-Faces Implementation Plan (mezo-mvb4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-compose the Today (`/today`, „Ma") screen into three sleep-anchored daypart faces behind a pill navigator, rendered in one shared card language, with the quest/habit/ritual cards merged into a single todo card and the four context blocks (check-in strip, quick stats, fuel timeline, briefing) dissolved into uniform rows.

**Architecture:** Two new pure logic modules (`dayFace.ts` derives the three windows from the sleep anchor; `todayItems.ts` normalizes six data sources onto one `TodayItem` shape, buckets by face, dedupes, partitions open/done). Two new domain-free `shared/ui` primitives (`ItemCard`, `ItemRow`) extracted from Train's existing `.todaycard`. Four Today-local components (`DayFaceStrip`, `FaceHeroCard`, `TodoCard`, `DoneFold`) plus three face compositions. `TodayPage` becomes a thin composition root whose face selection is derived from `?dp=`. Frontend only — zero backend, zero API-contract change.

**Tech Stack:** React 19 · TypeScript · Vite · Tailwind v4 + `frontend/src/styles/prototype.css` · TanStack Query · React Router · Vitest + React Testing Library · Playwright (visual goldens).

**Driving spec:** [`docs/superpowers/specs/2026-07-29-today-daypart-redesign-design.md`](../specs/2026-07-29-today-daypart-redesign-design.md)
**Reference mockup:** [`docs/superpowers/specs/2026-07-29-today-daypart-redesign-mockup.html`](../specs/2026-07-29-today-daypart-redesign-mockup.html)

## Global Constraints

- **Read [`docs/references/frontend_conventions.md`](../../references/frontend_conventions.md) before writing any `frontend/src` code.** It is a non-negotiable house standard.
- **Four layers:** `app/` · `features/<domain>/{pages,components,sheets,logic}/` · `shared/{ui,lib,hooks}/` · `data/`. Imports are deep + absolute via `@/*`; **no barrels except `data/hooks.ts`**; no relative `../`; tests colocated.
- **`shared/ui` is domain-free** — a file there must not import `@/data/*`.
- **Every feature imports data hooks from `@/data/hooks` only.**
- **UI copy is Hungarian. Code, comments and commit messages are English.**
- **Commit subjects carry the driving bd id**, e.g. `feat(today): add DayFaceStrip (mezo-j7u4)`.
- **Gate after every task:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — **both modes must be green**. Never leave a task with a red gate.
- **ADR 0010 stands:** a CTA never self-completes a DERIVED quest/habit — it opens or performs the underlying log.
- **The `.todaycard` CSS class family keeps its current names.** `ItemCard` renders the exact same markup and classes Train's `TodaySessionCard` renders today — the extraction must be a pure move, so the `train-light`/`train-dark` visual goldens pass **unchanged**.
- **Never delete `frontend/src/features/today/logic/dayArc.ts`** — `features/ritual/components/DayStoryStep.tsx` imports `buildArcPoints`/`pointXY` from it. Only the `DayArc.tsx` *component* goes.
- **Local-date correctness:** every date read/write uses `localDateString()` from `@/shared/lib/dates`, never UTC slicing.
- Run `git add`/`git commit` at the end of every task. Do **not** push or open a PR until the slice's final task passes its gate.

---

## File Structure

**New — `frontend/src/shared/ui/`**
| File | Responsibility |
|---|---|
| `ItemCard.tsx` | The one full-size session/item card: icon shield, eyebrow (tag · time), display title, `.metapill` facts, full-width CTA, `DoneBar` when logged. Domain-free. |
| `ItemRow.tsx` | The compact variant: 34 px shield, title + subtitle, right-hand time **or** action pill. Domain-free. |

**New — `frontend/src/features/today/logic/`**
| File | Responsibility |
|---|---|
| `dayFace.ts` | Pure sleep-anchored daypart windows: `dayFace`, `faceWindows`, `faceOf`. |
| `todayItems.ts` | Pure normalization of six sources onto `TodayItem[]`, face bucketing, dedup, open/done partitioning. |

**New — `frontend/src/features/today/components/`**
| File | Responsibility |
|---|---|
| `DayFaceStrip.tsx` | The three-pill navigator (`role="tablist"`), each pill with its open-item counter. |
| `FaceHeroCard.tsx` | Chain hero: progress bar + promoted next step + remaining steps as pills. |
| `TodoCard.tsx` | The merged todo card: one progress bar, group labels, uniform rows. |
| `DoneFold.tsx` | Collapsed `✓ Kész · N tétel · +XP` summary at the foot of each face. |
| `FaceMorning.tsx` / `FaceDay.tsx` / `FaceEvening.tsx` | The three face compositions. |

**Modified**
| File | Change |
|---|---|
| `features/train/components/TodaySessionCard.tsx` | Becomes a thin wrapper over `shared/ui/ItemCard`. |
| `features/today/pages/TodayPage.tsx` | Composition root: hooks + `?dp=` face selection + the three faces. |
| `features/today/components/{BriefingCard,RitualCard,WindDownBanner,IntentionBanner}.tsx` | Re-dressed onto `ItemCard` / the creed chip. |
| `styles/prototype.css` | New `.itemrow*`, `.dfs*`, `.tdc*`, `.fhc*`, `.donefold*` families; deleted `.dayarc`/`.arc-*`, `.beats`/`.beat`, `.scard`, `.zonediv`, `.np-hero*`. |

**Deleted (component + colocated test)**
`features/today/components/`: `DayArc.tsx`, `ZoneDivider.tsx`, `CheckInStrip.tsx`, `QuickStatsRow.tsx`, `FuelTimelinePreview.tsx`, `WorkoutTeaser.tsx`, `VolleyballCard.tsx`, `RoutineCard.tsx`, `TodayQuestsCard.tsx` · `shared/ui/QuickStat.tsx`.

---

# Slice S1 — The language (bd `mezo-jyua`)

Goal: the `.todaycard` visual language becomes two domain-free `shared/ui` primitives. **Train Mai must not change by one pixel.**

### Task 1: Extract `ItemCard` into `shared/ui`

**Files:**
- Create: `frontend/src/shared/ui/ItemCard.tsx`
- Create: `frontend/src/shared/ui/ItemCard.test.tsx`
- Modify: `frontend/src/features/train/components/TodaySessionCard.tsx` (whole file)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ItemCard`, `ItemTone`, `ItemCardProps` from `@/shared/ui/ItemCard`. `ItemTone = 'gym' | 'sport' | 'cross' | 'trx' | 'run' | 'body' | 'mind' | 'fuel'`.

**Context:** `TodaySessionCard.tsx` currently owns this markup. Read it first — the extraction must preserve every class name and every conditional exactly. The existing tone values come from `SessionTone` in `@/features/train/logic/sportKinds`; `ItemTone` is a superset adding `body`/`mind`/`fuel` for the Today domains.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/ui/ItemCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ItemCard } from '@/shared/ui/ItemCard'

describe('ItemCard', () => {
  test('renders eyebrow tag, time, title and one metapill per truthy fact', () => {
    const { container } = render(
      <ItemCard tone="gym" emoji="🏋️" tag="GYM" time="17:00" title="Pull Day"
        facts={['5 gyakorlat', null, '~78 perc', false]} logged={false} />,
    )
    expect(screen.getByText('GYM')).toBeInTheDocument()
    expect(screen.getByText('17:00')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pull Day' })).toBeInTheDocument()
    expect(container.querySelectorAll('.metapill')).toHaveLength(2)
    expect(container.querySelector('.todaycard-gym')).toBeTruthy()
  })

  test('without ctaLabel the card is read-only — no button', () => {
    render(<ItemCard tone="run" emoji="🏃" tag="FUTÁS" title="6 km" facts={[]} logged={false} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('with ctaLabel + onLog renders the CTA and fires it', async () => {
    const onLog = vi.fn()
    render(<ItemCard tone="run" emoji="🏃" tag="FUTÁS" title="6 km" facts={[]}
      logged={false} ctaLabel="Naplózd a futást" onLog={onLog} />)
    screen.getByRole('button', { name: /Naplózd a futást/ }).click()
    expect(onLog).toHaveBeenCalledOnce()
  })

  test('logged swaps the shield to a check, adds MEGVAN and renders the DoneBar instead of pills/CTA', () => {
    const { container } = render(
      <ItemCard tone="sport" emoji="🏐" tag="RÖPI" time="18:00" title="Röplabda"
        facts={['90 perc']} logged loggedSummary="RPE 7 · 90p" loggedDetail="18:05-kor logolva"
        stateLabel="MA" ctaLabel="Logold" onLog={() => {}} />,
    )
    expect(screen.getByText(/RÖPI · MEGVAN/)).toBeInTheDocument()
    expect(screen.getByText('RPE 7 · 90p')).toBeInTheDocument()
    expect(screen.getByText('18:05-kor logolva')).toBeInTheDocument()
    expect(container.querySelectorAll('.metapill')).toHaveLength(0)
    expect(container.querySelector('.todaycard-cta')).toBeNull()
    expect(container.querySelector('.todaycard.logged')).toBeTruthy()
  })

  test('stateLabel renders while open and is suppressed once logged', () => {
    const { rerender, container } = render(
      <ItemCard tone="gym" emoji="🏋️" tag="GYM" title="Pull Day" facts={[]} logged={false} stateLabel="TERVEZETT" />,
    )
    expect(container.querySelector('.todaycard-state')?.textContent).toBe('TERVEZETT')
    rerender(<ItemCard tone="gym" emoji="🏋️" tag="GYM" title="Pull Day" facts={[]} logged loggedSummary="Kész" stateLabel="TERVEZETT" />)
    expect(container.querySelector('.todaycard-state')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/shared/ui/ItemCard.test.tsx`
Expected: FAIL — cannot resolve `@/shared/ui/ItemCard`.

- [ ] **Step 3: Create `ItemCard.tsx`**

Create `frontend/src/shared/ui/ItemCard.tsx`:

```tsx
// ============================================================
// Mezo · ItemCard — the app's one full-size item card (mezo-jyua).
// Extracted verbatim from the Train `TodaySessionCard` (mezo-9bbc) so Today
// and Train render the SAME card, not two similar ones: modality-gradient
// surface + 44px icon shield, eyebrow (tag · time), display title, `.metapill`
// facts, then a full-width CTA — or, once logged, a `DoneBar` and a
// check-swapped shield. Without `ctaLabel` the card is read-only.
// Domain-free by house rule: presentation props only, no `@/data/*` import.
// The `.todaycard*` class family is intentionally kept under its original
// names — the extraction is a pure move, proven by the unchanged Train goldens.
// ============================================================
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import { DoneBar } from '@/features/train/components/DoneBar'

/** Modality tones. The first five mirror Train's `SessionTone`; the last three are
 *  the Today domains (habit chain / mind & ritual / fuel). */
export type ItemTone = 'gym' | 'sport' | 'cross' | 'trx' | 'run' | 'body' | 'mind' | 'fuel'

export interface ItemCardProps {
  /** Drives `--tc-accent`/`--tc-wash` and the type-tag variant. */
  tone: ItemTone
  /** Icon-shield glyph. */
  emoji: string
  /** Uppercase type word shown in the eyebrow tag (`FUTÁS`, `RÖPI`…). */
  tag: string
  /** Item time; omitted from the eyebrow when absent. */
  time?: string | null
  title: string
  /** One `.metapill` per fact; falsy entries drop out. */
  facts: readonly (string | null | undefined | false)[]
  logged: boolean
  /** `DoneBar` summary of the logged effort. */
  loggedSummary?: string
  /** `DoneBar` detail line; omitted when unknown. */
  loggedDetail?: string | null
  /** `MOST`/`MA`/`ELMARADT`/`TERVEZETT`; suppressed while logged. */
  stateLabel?: string | null
  /** Not-yet-logged CTA copy. Absent ⇒ read-only card. */
  ctaLabel?: string
  /** Opens the log surface (from the CTA, or from the DoneBar once logged). */
  onLog?: () => void
  /** Extra content rendered between the head and the pills (e.g. a hero's progress bar). */
  children?: React.ReactNode
}

export function ItemCard({
  tone, emoji, tag, time, title, facts,
  logged, loggedSummary, loggedDetail, stateLabel, ctaLabel, onLog, children,
}: ItemCardProps) {
  const pills = facts.filter(Boolean) as string[]
  const interactive = Boolean(ctaLabel && onLog)
  return (
    <section className={cn('todaycard', `todaycard-${tone}`, logged && 'logged')}>
      <div className="todaycard-top">
        <span className="todaycard-icon" aria-hidden="true">
          {logged ? <Icon name="check" size={20} /> : emoji}
        </span>
        <div className="todaycard-head">
          <span className={cn('typetag', `typetag-${tone}`)}>
            {tag}{logged ? ' · MEGVAN' : null}
          </span>
          {!logged && time ? <span className="todaycard-time">{time}</span> : null}
          <h3 className="todaycard-title">{title}</h3>
        </div>
        {!logged && stateLabel ? <span className="todaycard-state">{stateLabel}</span> : null}
      </div>

      {children}

      {logged ? (
        <DoneBar
          summary={loggedSummary ?? ''}
          detail={loggedDetail}
          onClick={interactive ? onLog : undefined}
          ariaLabel={interactive ? `${title} — logolt session megnyitása` : undefined}
        />
      ) : (
        <>
          {pills.length > 0 && (
            <div className="todaycard-pills">
              {pills.map((p) => <span key={p} className="metapill">{p}</span>)}
            </div>
          )}
          {interactive && (
            <button type="button" className="todaycard-cta np-press" onClick={onLog}>
              <Icon name="plus" size={12} /><span>{ctaLabel}</span>
            </button>
          )}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Add the three new tone variants to the CSS**

In `frontend/src/styles/prototype.css`, immediately after the existing `.todaycard-run` rule (search for `.todaycard-run {`), add:

```css
.todaycard-body { --tc-accent: var(--sage-deep); --tc-wash: var(--wash-sage); }
.todaycard-mind { --tc-accent: var(--lav-deep);  --tc-wash: var(--wash-lav); }
.todaycard-fuel { --tc-accent: var(--amber-deep); --tc-wash: var(--wash-amber); }
```

And next to the existing `.typetag-run` rule:

```css
.typetag-body { background: var(--wash-sage); color: var(--sage-deep); }
.typetag-mind { background: var(--wash-lav); color: var(--lav-deep); }
.typetag-fuel { background: var(--wash-amber); color: var(--amber-deep); }
```

`--wash-sage`, `--wash-lav` and `--wash-amber` already exist (Napív S6 Fuel block). Verify with `grep -n "\-\-wash-sage\|--wash-lav\|--wash-amber" src/styles/prototype.css` before adding; if any is missing, define it as `color-mix(in srgb, var(--sage) 12%, transparent)` (respectively `--lav`, `--amber`) in the Napív `:root` block.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/shared/ui/ItemCard.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Rebuild `TodaySessionCard` on top of `ItemCard`**

Replace the whole body of `frontend/src/features/train/components/TodaySessionCard.tsx` with:

```tsx
// ============================================================
// Mezo · TodaySessionCard — one scheduled session of the selected day on
// Train's Mai. Since mezo-jyua this is a thin wrapper over the shared
// `ItemCard`: the card language moved to `shared/ui` so Today and Train
// render the same card. Kept as a named seam so Train's call sites keep
// their session vocabulary (`SessionTone`) instead of the broader `ItemTone`.
// ============================================================
import { ItemCard } from '@/shared/ui/ItemCard'
import type { SessionTone } from '@/features/train/logic/sportKinds'

interface TodaySessionCardProps {
  tone: SessionTone
  emoji: string
  tag: string
  time?: string | null
  title: string
  facts: readonly (string | null | undefined | false)[]
  logged: boolean
  loggedSummary?: string
  loggedDetail?: string | null
  stateLabel?: string | null
  ctaLabel?: string
  onLog?: () => void
}

export function TodaySessionCard(props: TodaySessionCardProps) {
  return <ItemCard {...props} />
}
```

- [ ] **Step 7: Run the full gate — the Train tests must be untouched**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS in both modes. If any Train test fails, the extraction changed markup — diff `ItemCard.tsx` against the original `TodaySessionCard.tsx` and fix; do **not** amend the tests.

- [ ] **Step 8: Verify the Train visual goldens are unchanged**

```bash
cd frontend && pnpm test:visual --grep "train"
```
Expected: PASS with no diffs. **If a `train-*` golden differs, the extraction is wrong — fix the component, never regenerate the golden in this task.**

- [ ] **Step 9: Commit**

```bash
git add frontend/src/shared/ui/ItemCard.tsx frontend/src/shared/ui/ItemCard.test.tsx \
        frontend/src/features/train/components/TodaySessionCard.tsx frontend/src/styles/prototype.css
git commit -m "refactor(ui): extract the shared ItemCard from Train's TodaySessionCard (mezo-jyua)"
```

---

### Task 2: Add the `ItemRow` compact variant

**Files:**
- Create: `frontend/src/shared/ui/ItemRow.tsx`
- Create: `frontend/src/shared/ui/ItemRow.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `ItemTone` from `@/shared/ui/ItemCard`.
- Produces: `ItemRow` from `@/shared/ui/ItemRow` with props `{ tone, emoji, title, subtitle?, time?, actionLabel?, onAction?, done?, ariaLabel? }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/ui/ItemRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ItemRow } from '@/shared/ui/ItemRow'

describe('ItemRow', () => {
  test('renders title, subtitle and the trailing time when no action is given', () => {
    const { container } = render(
      <ItemRow tone="gym" emoji="🏋️" title="Pull Day" subtitle="Gym · MAV · ~78 perc" time="17:00" />,
    )
    expect(screen.getByText('Pull Day')).toBeInTheDocument()
    expect(screen.getByText('Gym · MAV · ~78 perc')).toBeInTheDocument()
    expect(screen.getByText('17:00')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.itemrow-gym')).toBeTruthy()
  })

  test('an actionLabel + onAction renders a real button that fires', () => {
    const onAction = vi.fn()
    render(<ItemRow tone="mind" emoji="📖" title="Olvass 10 percet" actionLabel="Naplózz" onAction={onAction} />)
    screen.getByRole('button', { name: 'Naplózz' }).click()
    expect(onAction).toHaveBeenCalledOnce()
  })

  test('an actionLabel WITHOUT onAction is inert copy, not a button', () => {
    render(<ItemRow tone="mind" emoji="🌙" title="Napzárás" actionLabel="Még vár" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Még vár')).toBeInTheDocument()
  })

  test('done dims the row and swaps the shield glyph for a check', () => {
    const { container } = render(<ItemRow tone="body" emoji="⚖️" title="Reggeli súlymérés" done />)
    expect(container.querySelector('.itemrow.is-done')).toBeTruthy()
    expect(container.querySelector('.itemrow-ic')?.textContent).toBe('✓')
  })

  test('the whole row is a button when onAction is given without an actionLabel', () => {
    const onAction = vi.fn()
    render(<ItemRow tone="gym" emoji="🏋️" title="Pull Day" time="17:00" onAction={onAction} ariaLabel="Pull Day megnyitása" />)
    screen.getByRole('button', { name: 'Pull Day megnyitása' }).click()
    expect(onAction).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/shared/ui/ItemRow.test.tsx`
Expected: FAIL — cannot resolve `@/shared/ui/ItemRow`.

- [ ] **Step 3: Create `ItemRow.tsx`**

```tsx
// ============================================================
// Mezo · ItemRow — the compact sibling of `ItemCard` (mezo-jyua): a 34px icon
// shield, title + optional subtitle, and either a trailing time or a trailing
// action pill. Three interaction shapes, in priority order:
//   • actionLabel + onAction  → a pill button (the row itself is inert)
//   • onAction only           → the WHOLE row is the button (needs `ariaLabel`)
//   • neither                 → a plain, read-only row
// An `actionLabel` without `onAction` renders as inert copy (e.g. „Még vár"),
// never a dead button. Domain-free: presentation props only.
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { ItemTone } from '@/shared/ui/ItemCard'

export interface ItemRowProps {
  tone: ItemTone
  emoji: string
  title: string
  subtitle?: string | null
  /** Trailing HH:mm; hidden when an action pill is shown. */
  time?: string | null
  actionLabel?: string
  onAction?: () => void
  done?: boolean
  /** Required when the whole row is the button (onAction without actionLabel). */
  ariaLabel?: string
}

export function ItemRow({
  tone, emoji, title, subtitle, time, actionLabel, onAction, done, ariaLabel,
}: ItemRowProps) {
  const pill = Boolean(actionLabel && onAction)
  const rowIsButton = Boolean(onAction) && !pill
  const body = (
    <>
      <span className="itemrow-ic" aria-hidden="true">{done ? '✓' : emoji}</span>
      <span className="itemrow-tx">
        <span className="itemrow-t1">{title}</span>
        {subtitle ? <span className="itemrow-t2">{subtitle}</span> : null}
      </span>
      {pill ? (
        <button type="button" className="itemrow-act np-press" onClick={onAction}>{actionLabel}</button>
      ) : actionLabel ? (
        <span className="itemrow-act is-inert">{actionLabel}</span>
      ) : time ? (
        <span className="itemrow-tm">{time}</span>
      ) : null}
    </>
  )
  const cls = cn('itemrow', `itemrow-${tone}`, done && 'is-done')
  return rowIsButton
    ? <button type="button" className={cn(cls, 'np-press')} onClick={onAction} aria-label={ariaLabel}>{body}</button>
    : <div className={cls}>{body}</div>
}
```

- [ ] **Step 4: Add the `.itemrow` CSS family**

Append to `frontend/src/styles/prototype.css`, directly after the `.donebar` block (search for `button.donebar {`):

```css
/* ===== ItemRow — the compact ItemCard sibling (mezo-jyua) ===== */
.itemrow { --ir-a: var(--coral-deep); display: flex; align-items: center; gap: 11px; width: 100%;
  padding: 11px 13px; border-radius: 18px; background: var(--surface); box-shadow: var(--np-shadow-row);
  margin: 0 24px 8px; border: 0; font-family: inherit; text-align: left; }
.itemrow-gym   { --ir-a: var(--tag-gym); }
.itemrow-sport { --ir-a: var(--tag-sport); }
.itemrow-cross { --ir-a: var(--tag-cross); }
.itemrow-trx   { --ir-a: var(--tag-trx); }
.itemrow-run   { --ir-a: var(--tag-run); }
.itemrow-body  { --ir-a: var(--sage-deep); }
.itemrow-mind  { --ir-a: var(--lav-deep); }
.itemrow-fuel  { --ir-a: var(--amber-deep); }
.itemrow-ic { flex: none; width: 34px; height: 34px; border-radius: 12px; display: inline-flex;
  align-items: center; justify-content: center; font-size: 15px;
  background: color-mix(in srgb, var(--ir-a) 13%, var(--surface)); }
.itemrow-tx { flex: 1; min-width: 0; display: block; }
.itemrow-t1 { display: block; font-size: 13.5px; font-weight: 800; color: var(--ink); line-height: 1.25; }
.itemrow-t2 { display: block; font-size: 10.5px; font-weight: 700; color: var(--sub); margin-top: 2px; }
.itemrow-tm { flex: none; font-size: 11.5px; font-weight: 800; color: var(--ir-a); font-variant-numeric: tabular-nums; }
.itemrow-act { flex: none; border-radius: 11px; padding: 8px 12px; font-size: 11px; font-weight: 800;
  font-family: inherit; cursor: pointer; color: var(--ir-a); border: 0;
  background: color-mix(in srgb, var(--ir-a) 11%, var(--surface)); }
.itemrow-act.is-inert { cursor: default; color: var(--faint); background: var(--warm); }
.itemrow.is-done { background: transparent; box-shadow: none; }
.itemrow.is-done .itemrow-t1 { color: var(--sub); }
.itemrow.is-done .itemrow-ic { background: var(--sage-deep); color: var(--surface); }
button.itemrow { cursor: pointer; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/shared/ui/ItemRow.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS in both modes.

- [ ] **Step 7: Commit and close the slice**

```bash
git add frontend/src/shared/ui/ItemRow.tsx frontend/src/shared/ui/ItemRow.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(ui): add the compact ItemRow primitive (mezo-jyua)"
bd close mezo-jyua
```

---

# Slice S2 — The brain (bd `mezo-ly8c`)

Goal: two pure, fully unit-tested modules. **No UI changes in this slice** — nothing imports them yet.

### Task 3: `dayFace.ts` — the sleep-anchored daypart windows

**Files:**
- Create: `frontend/src/features/today/logic/dayFace.ts`
- Create: `frontend/src/features/today/logic/dayFace.test.ts`

**Interfaces:**
- Consumes: `AnchorTimes` (`{ bedTime: string; wakeTime: string }`) from `@/features/today/logic/windDown`.
- Produces:
  - `type DayFace = 'reggel' | 'nap' | 'este'`
  - `const DAY_FACES: readonly DayFace[]` — always `['reggel', 'nap', 'este']`
  - `const FACE_LABEL: Record<DayFace, string>` — `{ reggel: 'Reggel', nap: 'Nap', este: 'Este' }`
  - `const FACE_EMOJI: Record<DayFace, string>` — `{ reggel: '🌅', nap: '☀️', este: '🌙' }`
  - `faceWindows(goal: AnchorTimes): Record<DayFace, { start: number; end: number }>` — minute-of-day, `[start, end)`, wrap-aware
  - `dayFace(now: Date, goal: AnchorTimes): DayFace`
  - `faceOf(hhmm: string, goal: AnchorTimes): DayFace`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/today/logic/dayFace.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { dayFace, faceOf, faceWindows, DAY_FACES } from '@/features/today/logic/dayFace'

const GOAL = { wakeTime: '06:30', bedTime: '22:30' }
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2026, 4, 21)
  d.setHours(h, m, 0, 0)
  return d
}

describe('faceWindows', () => {
  test('tiles the circle from the sleep anchor: 06:00 / 11:30 / 18:30', () => {
    const w = faceWindows(GOAL)
    expect(w.reggel).toEqual({ start: 360, end: 690 })   // 06:00 – 11:30
    expect(w.nap).toEqual({ start: 690, end: 1110 })     // 11:30 – 18:30
    expect(w.este).toEqual({ start: 1110, end: 360 })    // 18:30 – 06:00 (wraps)
  })

  test('a past-midnight bed still produces three ordered windows', () => {
    const w = faceWindows({ wakeTime: '08:00', bedTime: '00:30' })
    expect(w.reggel).toEqual({ start: 450, end: 780 })   // 07:30 – 13:00
    expect(w.nap).toEqual({ start: 780, end: 1230 })     // 13:00 – 20:30
    expect(w.este).toEqual({ start: 1230, end: 450 })    // 20:30 – 07:30 (wraps)
  })
})

describe('dayFace', () => {
  test.each([
    ['05:59', 'este'], ['06:00', 'reggel'], ['09:12', 'reggel'], ['11:29', 'reggel'],
    ['11:30', 'nap'], ['13:42', 'nap'], ['18:29', 'nap'],
    ['18:30', 'este'], ['21:05', 'este'], ['23:59', 'este'], ['02:00', 'este'],
  ] as const)('%s → %s', (t, expected) => {
    expect(dayFace(at(t), GOAL)).toBe(expected)
  })

  test('never returns undefined for any minute of the day', () => {
    for (let m = 0; m < 1440; m++) {
      const d = new Date(2026, 4, 21)
      d.setHours(Math.floor(m / 60), m % 60, 0, 0)
      expect(DAY_FACES).toContain(dayFace(d, GOAL))
    }
  })

  test('a degenerate anchor (2h awake) still resolves every minute to a face', () => {
    const tiny = { wakeTime: '06:00', bedTime: '08:00' }
    for (let m = 0; m < 1440; m += 7) {
      const d = new Date(2026, 4, 21)
      d.setHours(Math.floor(m / 60), m % 60, 0, 0)
      expect(DAY_FACES).toContain(dayFace(d, tiny))
    }
  })
})

describe('faceOf', () => {
  test.each([
    ['06:30', 'reggel'], ['14:00', 'nap'], ['17:00', 'nap'], ['20:00', 'este'], ['21:15', 'este'],
  ] as const)('a %s item belongs to %s', (t, expected) => {
    expect(faceOf(t, GOAL)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/today/logic/dayFace.test.ts`
Expected: FAIL — cannot resolve `@/features/today/logic/dayFace`.

- [ ] **Step 3: Implement `dayFace.ts`**

```ts
// ============================================================
// Mezo · dayFace — the three sleep-anchored daypart windows behind Today's
// face navigator (mezo-ly8c). Derived from the SAME wake/bed anchor that
// drives `windDown.ts` and the Napzárás window, so the app has one clock and
// no drift. `MORNING_LEAD_MIN` is deliberately the exact minute at which
// `windDownPhase`'s `night` ends, so the day closes a circle:
//   night → reggel → nap → este (dim → winddown) → night
// All math is minute-of-day and wrap-aware (a past-midnight bed works).
// ============================================================
import { MORNING_LEAD_MIN, type AnchorTimes } from '@/features/today/logic/windDown'

export type DayFace = 'reggel' | 'nap' | 'este'
export const DAY_FACES: readonly DayFace[] = ['reggel', 'nap', 'este'] as const
export const FACE_LABEL: Record<DayFace, string> = { reggel: 'Reggel', nap: 'Nap', este: 'Este' }
export const FACE_EMOJI: Record<DayFace, string> = { reggel: '🌅', nap: '☀️', este: '🌙' }

/** How long the morning face runs past wake-up. */
export const MORNING_SPAN_MIN = 300
/** How long before bed the evening face opens. */
export const EVENING_LEAD_MIN = 240

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const wrap = (m: number) => ((m % 1440) + 1440) % 1440
/** Half-open [start, end) containment on the circular 24h clock. */
const inWindow = (n: number, start: number, end: number) =>
  start <= end ? n >= start && n < end : n >= start || n < end

export function faceWindows(goal: AnchorTimes): Record<DayFace, { start: number; end: number }> {
  const morningStart = wrap(toMin(goal.wakeTime) - MORNING_LEAD_MIN)
  const morningEnd = wrap(toMin(goal.wakeTime) + MORNING_SPAN_MIN)
  const eveningStart = wrap(toMin(goal.bedTime) - EVENING_LEAD_MIN)
  // Degenerate-anchor guard: with a very short waking day the evening window can open
  // before the morning one closes. The morning face keeps its full span and the day
  // face collapses to zero length rather than inverting — `dayFace` then simply never
  // returns 'nap', but every minute still resolves to a face.
  const napEnd = inWindow(eveningStart, morningStart, morningEnd) ? morningEnd : eveningStart
  return {
    reggel: { start: morningStart, end: morningEnd },
    nap: { start: morningEnd, end: napEnd },
    este: { start: napEnd, end: morningStart },
  }
}

/** The face a given minute-of-day belongs to. Evening is the fallback: it owns the
 *  night, and it is the only window guaranteed non-empty for any anchor. */
function faceForMinute(n: number, goal: AnchorTimes): DayFace {
  const w = faceWindows(goal)
  if (inWindow(n, w.reggel.start, w.reggel.end)) return 'reggel'
  if (w.nap.start !== w.nap.end && inWindow(n, w.nap.start, w.nap.end)) return 'nap'
  return 'este'
}

export function dayFace(now: Date, goal: AnchorTimes): DayFace {
  return faceForMinute(now.getHours() * 60 + now.getMinutes(), goal)
}

/** Which face an item anchored to `hhmm` belongs to. */
export function faceOf(hhmm: string, goal: AnchorTimes): DayFace {
  return faceForMinute(toMin(hhmm), goal)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/today/logic/dayFace.test.ts`
Expected: PASS. If `faceWindows` assertions fail, check that `MORNING_LEAD_MIN` is exported from `windDown.ts` (it is — `export const MORNING_LEAD_MIN = 30`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/logic/dayFace.ts frontend/src/features/today/logic/dayFace.test.ts
git commit -m "feat(today): add the sleep-anchored dayFace window logic (mezo-ly8c)"
```

---

### Task 4: `todayItems.ts` — the `TodayItem` shape, quests and habits

**Files:**
- Create: `frontend/src/features/today/logic/todayItems.ts`
- Create: `frontend/src/features/today/logic/todayItems.test.ts`

**Interfaces:**
- Consumes: `DayFace`, `faceOf` from `@/features/today/logic/dayFace`; `DailyQuest`, `HabitItem`, `CheckinSlot`, `FuelSlot` from `@/data/types`; `AnchorTimes` from `@/features/today/logic/windDown`.
- Produces:
  - `type ItemStatus = 'open' | 'done' | 'missed'`
  - `type ItemSource = 'quest' | 'habit' | 'checkin' | 'fuel' | 'session' | 'ritual'`
  - `type ItemAction` (discriminated union, see code)
  - `interface TodayItem`
  - `interface TodayItemsInput`
  - `buildTodayItems(input: TodayItemsInput): TodayItem[]`
  - `itemsForFace(items: TodayItem[], face: DayFace): { open: TodayItem[]; done: TodayItem[] }`
  - `openCountByFace(items: TodayItem[]): Record<DayFace, number>`

**Context:** The action union deliberately carries the raw domain object rather than a route or a callback — `TodayPage` dispatches it through the existing `questAction`/`habitAction` mappings, which keeps this module pure and free of navigation concerns.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/today/logic/todayItems.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { buildTodayItems, itemsForFace, openCountByFace } from '@/features/today/logic/todayItems'
import type { DailyQuest, HabitItem } from '@/data/types'

const GOAL = { wakeTime: '06:30', bedTime: '22:30' }

const quest = (over: Partial<DailyQuest> = {}): DailyQuest => ({
  id: 'q1', questDate: '2026-05-21', slot: 'BODY', skillKey: 'recovery',
  title: 'Olvass ma legalább 10 percet', why: '', targetLabel: '', metric: 'reading_minutes',
  xp: 15, status: 'offered', completionMode: 'DERIVED', ...over,
})

const habit = (over: Partial<HabitItem> = {}): HabitItem => ({
  key: 'morning_sunlight', chain: 'MORNING', position: 2, title: 'Reggeli napfény',
  why: '', anchorCopy: 'ébredés után', mode: 'MANUAL', status: 'pending', xp: 5, ...over,
})

const EMPTY = { quests: [], habits: [], checkins: [], fuelSlots: [], sessions: [], ritual: null, goal: GOAL }

describe('buildTodayItems — quests', () => {
  test('an offered quest is a day-wide open item on every face', () => {
    const items = buildTodayItems({ ...EMPTY, quests: [quest()] })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ source: 'quest', face: 'all', status: 'open', group: 'Napi küldetések' })
    expect(itemsForFace(items, 'reggel').open).toHaveLength(1)
    expect(itemsForFace(items, 'este').open).toHaveLength(1)
  })

  test('a completed quest is done, an expired quest is missed', () => {
    const items = buildTodayItems({
      ...EMPTY,
      quests: [quest({ id: 'a', status: 'completed' }), quest({ id: 'b', status: 'expired' })],
    })
    expect(items.find(i => i.id.endsWith('a'))?.status).toBe('done')
    expect(items.find(i => i.id.endsWith('b'))?.status).toBe('missed')
  })
})

describe('buildTodayItems — habits', () => {
  test('a MORNING habit lands on reggel and an EVENING habit on este', () => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit(), habit({ key: 'wind_down', chain: 'EVENING', title: 'Wind-down' })],
    })
    expect(items.find(i => i.title === 'Reggeli napfény')?.face).toBe('reggel')
    expect(items.find(i => i.title === 'Wind-down')?.face).toBe('este')
  })

  test('habit status maps 1:1 onto item status', () => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit({ key: 'a', status: 'done' }), habit({ key: 'b', status: 'missed' }), habit({ key: 'c', status: 'pending' })],
    })
    expect(items.map(i => i.status).sort()).toEqual(['done', 'missed', 'open'])
  })

  test('the group label names the chain', () => {
    const items = buildTodayItems({ ...EMPTY, habits: [habit(), habit({ key: 'x', chain: 'EVENING' })] })
    expect(items.find(i => i.face === 'reggel')?.group).toBe('Reggeli rutin')
    expect(items.find(i => i.face === 'este')?.group).toBe('Esti rutin')
  })
})

describe('buildTodayItems — dedup', () => {
  test.each([
    ['morning_weigh_in', 'weight_logged'],
    ['morning_workout', 'gym_session_done'],
    ['wake_on_time', 'sleep_target'],
    ['protein_breakfast', 'protein_target'],
  ])('a %s habit absorbs the %s quest — one row, both rewards', (key, metric) => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit({ key, title: 'Reggeli súlymérés', xp: 10 })],
      quests: [quest({ metric, xp: 15 })],
    })
    expect(items).toHaveLength(1)
    expect(items[0].source).toBe('habit')
    expect(items[0].xp).toBe(25)
  })

  test('an unpaired quest and an unpaired habit both survive', () => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit({ key: 'morning_sunlight' })],
      quests: [quest({ metric: 'water_target' })],
    })
    expect(items).toHaveLength(2)
  })

  test('a gym_session_done quest is dropped when the day already has a session item', () => {
    const items = buildTodayItems({
      ...EMPTY,
      quests: [quest({ metric: 'gym_session_done' })],
      sessions: [{ id: 's1', tone: 'gym', emoji: '🏋️', tag: 'GYM', title: 'Pull Day', time: '17:00', facts: [], logged: false }],
    })
    expect(items.filter(i => i.source === 'quest')).toHaveLength(0)
    expect(items.filter(i => i.source === 'session')).toHaveLength(1)
  })
})

describe('itemsForFace / openCountByFace', () => {
  test('done items are partitioned out of the open list', () => {
    const items = buildTodayItems({
      ...EMPTY,
      habits: [habit({ key: 'a', status: 'done' }), habit({ key: 'b', status: 'pending' })],
    })
    const { open, done } = itemsForFace(items, 'reggel')
    expect(open).toHaveLength(1)
    expect(done).toHaveLength(1)
  })

  test('a missed item counts as neither open nor done', () => {
    const items = buildTodayItems({ ...EMPTY, habits: [habit({ key: 'a', status: 'missed' })] })
    const { open, done } = itemsForFace(items, 'reggel')
    expect(open).toHaveLength(0)
    expect(done).toHaveLength(0)
  })

  test('day-wide open items are counted on every face', () => {
    const items = buildTodayItems({ ...EMPTY, quests: [quest()], habits: [habit()] })
    expect(openCountByFace(items)).toEqual({ reggel: 2, nap: 1, este: 1 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/today/logic/todayItems.test.ts`
Expected: FAIL — cannot resolve `@/features/today/logic/todayItems`.

- [ ] **Step 3: Implement `todayItems.ts` (quests, habits, sessions, dedup, partitioning)**

```ts
// ============================================================
// Mezo · todayItems — the single normalizer behind Today's faces (mezo-ly8c).
// Six sources (daily quests, habit chains, check-ins, fuel slots, train
// sessions, ritual/wind-down) collapse onto ONE `TodayItem` shape, get bucketed
// by daypart face, deduplicated and partitioned into open/done. This is what
// kills the duplication the old screen had — the morning weigh-in was a quest
// AND a habit row, the workout was a hero AND a quest AND a habit row.
// Pure: no hooks, no navigation. The action union carries the raw domain object
// so `TodayPage` can dispatch it through the existing questAction/habitAction
// mappings without this module knowing about routes or sheets.
// ============================================================
import { faceOf, type DayFace, DAY_FACES } from '@/features/today/logic/dayFace'
import type { AnchorTimes } from '@/features/today/logic/windDown'
import type { CheckinSlot, DailyQuest, FuelSlot, HabitItem, RitualDay } from '@/data/types'
import type { ItemTone } from '@/shared/ui/ItemCard'

export type ItemStatus = 'open' | 'done' | 'missed'
export type ItemSource = 'quest' | 'habit' | 'checkin' | 'fuel' | 'session' | 'ritual'

export type ItemAction =
  | { kind: 'quest'; quest: DailyQuest; label: string }
  | { kind: 'habit'; habit: HabitItem; label: string }
  | { kind: 'checkin'; slotIdx: number; label: string }
  | { kind: 'nav'; to: string; label: string }

export interface TodayItem {
  /** Stable within a day: `${source}:${naturalKey}`. */
  id: string
  source: ItemSource
  /** `'all'` = day-wide (open quests) — rendered on every face. */
  face: DayFace | 'all'
  status: ItemStatus
  tone: ItemTone
  emoji: string
  /** Uppercase eyebrow word for `ItemCard`; unused by `ItemRow`. */
  tag: string
  title: string
  subtitle: string | null
  /** HH:mm when clock-anchored. */
  time: string | null
  /** Total XP the row is worth (a deduped row sums both rewards). */
  xp: number | null
  /** Group heading inside `TodoCard`. */
  group: string
  action: ItemAction | null
}

/** A train session already shaped for `ItemCard` by the caller (TodayPage reads
 *  `useToday()`); kept structural so this module never imports Train types. */
export interface SessionItemInput {
  id: string
  tone: ItemTone
  emoji: string
  tag: string
  title: string
  time: string | null
  facts: (string | null | undefined | false)[]
  logged: boolean
  loggedSummary?: string
}

export interface TodayItemsInput {
  quests: DailyQuest[]
  habits: HabitItem[]
  checkins: CheckinSlot[]
  fuelSlots: FuelSlot[]
  sessions: SessionItemInput[]
  ritual: RitualDay | null
  goal: AnchorTimes
}

/** Habit key ↔ quest metric pairs describing the SAME act. The habit row wins (it
 *  carries the anchor copy and the chain position) and absorbs the quest's XP; the
 *  quest still completes through its own server-side evaluation. */
const DEDUP_PAIRS: Record<string, string> = {
  morning_weigh_in: 'weight_logged',
  morning_workout: 'gym_session_done',
  wake_on_time: 'sleep_target',
  protein_breakfast: 'protein_target',
}

const QUEST_STATUS: Record<string, ItemStatus> = { offered: 'open', completed: 'done', expired: 'missed' }
const HABIT_STATUS: Record<string, ItemStatus> = { pending: 'open', done: 'done', missed: 'missed' }

const CHAIN_GROUP = { MORNING: 'Reggeli rutin', EVENING: 'Esti rutin' } as const
const CHAIN_FACE: Record<'MORNING' | 'EVENING', DayFace> = { MORNING: 'reggel', EVENING: 'este' }

export function buildTodayItems(input: TodayItemsInput): TodayItem[] {
  const { quests, habits, sessions } = input
  const items: TodayItem[] = []

  // ── sessions first: they own the face hero, and a quest describing the same
  //    workout must not repeat it as a row.
  for (const s of sessions) {
    items.push({
      id: `session:${s.id}`,
      source: 'session',
      face: s.time ? faceOf(s.time, input.goal) : 'nap',
      status: s.logged ? 'done' : 'open',
      tone: s.tone, emoji: s.emoji, tag: s.tag, title: s.title,
      subtitle: s.facts.filter(Boolean).join(' · ') || null,
      time: s.time, xp: null, group: 'Edzés', action: null,
    })
  }
  const hasSession = sessions.length > 0

  // ── habits: chain-bucketed, and the absorbing side of every dedup pair.
  const absorbedMetrics = new Set<string>()
  for (const h of habits) {
    const paired = DEDUP_PAIRS[h.key]
    const twin = paired ? quests.find((q) => q.metric === paired) : undefined
    if (twin) absorbedMetrics.add(paired)
    items.push({
      id: `habit:${h.key}`,
      source: 'habit',
      face: CHAIN_FACE[h.chain],
      status: HABIT_STATUS[h.status] ?? 'open',
      tone: h.chain === 'MORNING' ? 'body' : 'mind',
      emoji: h.chain === 'MORNING' ? '🌅' : '🌙',
      tag: CHAIN_GROUP[h.chain].toUpperCase(),
      title: h.title,
      subtitle: h.anchorCopy || null,
      time: null,
      xp: h.xp + (twin?.xp ?? 0),
      group: CHAIN_GROUP[h.chain],
      action: { kind: 'habit', habit: h, label: h.mode === 'MANUAL' ? 'Pipa' : 'Logolás' },
    })
  }

  // ── quests: day-wide, minus the ones absorbed above or already shown as a session.
  for (const q of quests) {
    if (absorbedMetrics.has(q.metric)) continue
    if (hasSession && q.metric === 'gym_session_done') continue
    items.push({
      id: `quest:${q.id}`,
      source: 'quest',
      face: 'all',
      status: QUEST_STATUS[q.status] ?? 'open',
      tone: 'mind', emoji: '⚡', tag: 'KÜLDETÉS',
      title: q.title,
      subtitle: q.targetLabel || null,
      time: null,
      xp: q.xp,
      group: 'Napi küldetések',
      action: { kind: 'quest', quest: q, label: 'Naplózz' },
    })
  }

  return items
}

export function itemsForFace(items: TodayItem[], face: DayFace): { open: TodayItem[]; done: TodayItem[] } {
  const mine = items.filter((i) => i.face === face || i.face === 'all')
  return {
    open: mine.filter((i) => i.status === 'open'),
    done: mine.filter((i) => i.status === 'done'),
  }
}

export function openCountByFace(items: TodayItem[]): Record<DayFace, number> {
  const out = { reggel: 0, nap: 0, este: 0 } as Record<DayFace, number>
  for (const f of DAY_FACES) out[f] = itemsForFace(items, f).open.length
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/today/logic/todayItems.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/logic/todayItems.ts frontend/src/features/today/logic/todayItems.test.ts
git commit -m "feat(today): normalize quests, habits and sessions onto TodayItem (mezo-ly8c)"
```

---

### Task 5: `todayItems.ts` — check-ins, fuel slots and the ritual item

**Files:**
- Modify: `frontend/src/features/today/logic/todayItems.ts`
- Modify: `frontend/src/features/today/logic/todayItems.test.ts`

**Interfaces:**
- Consumes: everything Task 4 produced.
- Produces: no new exports — `buildTodayItems` now also emits `checkin`, `fuel` and `ritual` items.

- [ ] **Step 1: Add the failing tests**

Append to `frontend/src/features/today/logic/todayItems.test.ts`:

```ts
import type { CheckinSlot, FuelSlot, RitualDay } from '@/data/types'

const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
  ({ time, state, values: null, note: null })

describe('buildTodayItems — check-ins', () => {
  test('each slot lands on the face its clock time belongs to', () => {
    const items = buildTodayItems({
      ...EMPTY,
      checkins: [slot('06:30', 'done'), slot('10:00', 'now'), slot('14:00', 'pending'), slot('20:00', 'pending')],
    })
    const byTime = Object.fromEntries(items.map(i => [i.time, i.face]))
    expect(byTime).toEqual({ '06:30': 'reggel', '10:00': 'reggel', '14:00': 'nap', '20:00': 'este' })
  })

  test('the slot index survives onto the action so the sheet can be opened', () => {
    const items = buildTodayItems({ ...EMPTY, checkins: [slot('06:30', 'done'), slot('14:00', 'now')] })
    const nap = items.find(i => i.time === '14:00')
    expect(nap?.action).toEqual({ kind: 'checkin', slotIdx: 1, label: 'Koppints' })
  })

  test('a done slot is done and a skipped slot is missed', () => {
    const items = buildTodayItems({ ...EMPTY, checkins: [slot('06:30', 'done'), slot('10:00', 'skipped')] })
    expect(items.map(i => i.status)).toEqual(['done', 'missed'])
  })
})

describe('buildTodayItems — fuel slots', () => {
  const fuel = (time: string, state: FuelSlot['state'], label: string): FuelSlot =>
    ({ time, kind: 'meal', label, state })

  test('slots bucket by their own clock time and carry the meal name when present', () => {
    const items = buildTodayItems({
      ...EMPTY,
      fuelSlots: [fuel('08:00', 'done', 'Reggeli'), fuel('21:15', 'pending', 'Esti stack')],
    })
    expect(items.find(i => i.time === '08:00')).toMatchObject({ face: 'reggel', status: 'done', group: 'Fuel' })
    expect(items.find(i => i.time === '21:15')).toMatchObject({ face: 'este', status: 'open' })
  })

  test('a missed fuel slot is missed, not open', () => {
    const items = buildTodayItems({ ...EMPTY, fuelSlots: [fuel('13:00', 'missed', 'Ebéd')] })
    expect(items[0].status).toBe('missed')
  })
})

describe('buildTodayItems — ritual', () => {
  const RITUAL: RitualDay = {
    date: '2026-05-21', closed: false, closedAt: null,
    window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
  }

  test('an unclosed ritual is an open evening item anchored to opensAt', () => {
    const items = buildTodayItems({ ...EMPTY, ritual: RITUAL })
    expect(items[0]).toMatchObject({
      source: 'ritual', face: 'este', status: 'open', time: '21:15', group: 'Napzárás',
    })
    expect(items[0].action).toEqual({ kind: 'nav', to: '/ritual', label: 'Zárjuk le' })
  })

  test('a closed ritual is done', () => {
    const items = buildTodayItems({ ...EMPTY, ritual: { ...RITUAL, closed: true, closedAt: '2026-05-21T21:40:00Z' } })
    expect(items[0].status).toBe('done')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/today/logic/todayItems.test.ts`
Expected: FAIL — the new describe blocks find zero items.

- [ ] **Step 3: Extend `buildTodayItems`**

In `frontend/src/features/today/logic/todayItems.ts`, add these constants next to `QUEST_STATUS`/`HABIT_STATUS`:

```ts
const CHECKIN_STATUS: Record<string, ItemStatus> = { done: 'done', skipped: 'missed', now: 'open', pending: 'open' }
const FUEL_STATUS: Record<string, ItemStatus> = { done: 'done', missed: 'missed', now: 'open', pending: 'open' }
```

Then insert these three blocks in `buildTodayItems`, after the quest loop and before `return items`:

```ts
  // ── check-ins: one row per canonical slot, bucketed by its own clock time. The
  //    array index is carried onto the action — CheckInSheet is opened by index.
  input.checkins.forEach((c, slotIdx) => {
    items.push({
      id: `checkin:${c.time}`,
      source: 'checkin',
      face: faceOf(c.time, input.goal),
      status: CHECKIN_STATUS[c.state] ?? 'open',
      tone: 'mind', emoji: '💗', tag: 'CHECK-IN',
      title: 'Hogy vagy?',
      subtitle: c.time,
      time: c.time,
      xp: null,
      group: 'Check-in',
      action: { kind: 'checkin', slotIdx, label: 'Koppints' },
    })
  })

  // ── fuel: the day's plan slots, each on its own face.
  for (const f of input.fuelSlots) {
    items.push({
      id: `fuel:${f.time}`,
      source: 'fuel',
      face: faceOf(f.time, input.goal),
      status: FUEL_STATUS[f.state] ?? 'open',
      tone: 'fuel', emoji: '🍶', tag: 'FUEL',
      title: f.mealName || f.label,
      subtitle: f.mealName ? f.label : null,
      time: f.time,
      xp: null,
      group: 'Fuel',
      action: { kind: 'nav', to: '/fuel', label: 'Logold' },
    })
  }

  // ── ritual: the evening close, anchored to its own window opening.
  if (input.ritual) {
    items.push({
      id: 'ritual:day',
      source: 'ritual',
      face: 'este',
      status: input.ritual.closed ? 'done' : 'open',
      tone: 'mind', emoji: '🌙', tag: 'NAPZÁRÁS',
      title: 'Napzárás',
      subtitle: `villanyoltás ${input.ritual.window.bedTime}`,
      time: input.ritual.window.opensAt,
      xp: null,
      group: 'Napzárás',
      action: { kind: 'nav', to: '/ritual', label: 'Zárjuk le' },
    })
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/today/logic/todayItems.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Run the full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS in both modes.

- [ ] **Step 6: Commit and close the slice**

```bash
git add frontend/src/features/today/logic/todayItems.ts frontend/src/features/today/logic/todayItems.test.ts
git commit -m "feat(today): fold check-ins, fuel slots and the ritual into TodayItem (mezo-ly8c)"
bd close mezo-ly8c
```

---

# Slice S3 — The faces (bd `mezo-j7u4`)

Goal: the screen is actually rebuilt. Ten components and five CSS families disappear.

### Task 6: `DayFaceStrip` — the three-pill navigator

**Files:**
- Create: `frontend/src/features/today/components/DayFaceStrip.tsx`
- Create: `frontend/src/features/today/components/DayFaceStrip.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `DayFace`, `DAY_FACES`, `FACE_LABEL`, `FACE_EMOJI` from `@/features/today/logic/dayFace`.
- Produces: `DayFaceStrip` with props `{ selected: DayFace; current: DayFace; counts: Record<DayFace, number>; doneCounts: Record<DayFace, number>; onSelect: (f: DayFace) => void }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { DayFaceStrip } from '@/features/today/components/DayFaceStrip'

const COUNTS = { reggel: 3, nap: 2, este: 4 }
const DONE = { reggel: 5, nap: 0, este: 0 }

describe('DayFaceStrip', () => {
  test('renders one tab per face inside a tablist', () => {
    render(<DayFaceStrip selected="reggel" current="reggel" counts={COUNTS} doneCounts={DONE} onSelect={() => {}} />)
    expect(screen.getByRole('tablist', { name: 'Napszakok' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  test('only the selected face has aria-selected', () => {
    render(<DayFaceStrip selected="este" current="reggel" counts={COUNTS} doneCounts={DONE} onSelect={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true'])
  })

  test('the spoken label carries the label, the open count and whether it is now', () => {
    render(<DayFaceStrip selected="reggel" current="nap" counts={COUNTS} doneCounts={DONE} onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Reggel · 3 nyitott tétel' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nap · most · 2 nyitott tétel' })).toBeInTheDocument()
  })

  test('a face with no open items but some done reads as complete', () => {
    render(<DayFaceStrip selected="reggel" current="reggel" counts={{ reggel: 0, nap: 2, este: 4 }}
      doneCounts={{ reggel: 5, nap: 0, este: 0 }} onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Reggel · most · kész' })).toBeInTheDocument()
  })

  test('tapping a tab reports its face', () => {
    const onSelect = vi.fn()
    render(<DayFaceStrip selected="reggel" current="reggel" counts={COUNTS} doneCounts={DONE} onSelect={onSelect} />)
    screen.getAllByRole('tab')[2].click()
    expect(onSelect).toHaveBeenCalledWith('este')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/today/components/DayFaceStrip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `DayFaceStrip.tsx`**

```tsx
// ============================================================
// Mezo · DayFaceStrip — Today's daypart navigator (mezo-j7u4). One pill per
// face; the pill's own counter is the day-progress indicator that replaced
// `DayArc`. The current face is highlighted even when another one is selected,
// so „hol tartok" and „mit nézek" never blur together.
// Presentational: it receives pre-derived counts and reports selections.
// ============================================================
import { cn } from '@/shared/lib/cn'
import { DAY_FACES, FACE_EMOJI, FACE_LABEL, type DayFace } from '@/features/today/logic/dayFace'

/** Spoken state of a pill — the visual counter in words. */
function spokenState(open: number, done: number): string {
  if (open > 0) return `${open} nyitott tétel`
  return done > 0 ? 'kész' : 'nincs teendő'
}

export function DayFaceStrip({
  selected, current, counts, doneCounts, onSelect,
}: {
  selected: DayFace
  /** The face the clock is actually in — styled distinctly from `selected`. */
  current: DayFace
  counts: Record<DayFace, number>
  doneCounts: Record<DayFace, number>
  onSelect: (face: DayFace) => void
}) {
  return (
    <div className="dfs" role="tablist" aria-label="Napszakok">
      {DAY_FACES.map((face) => {
        const open = counts[face]
        const done = doneCounts[face]
        const isNow = face === current
        return (
          <button
            key={face}
            type="button"
            role="tab"
            aria-selected={face === selected}
            className={cn('dfs-pill', 'np-press', isNow && 'now', face === selected && 'sel')}
            onClick={() => onSelect(face)}
            // The label REPLACES the pill's content as its accessible name, so the
            // counter has to be spoken here; the emoji stays decorative.
            aria-label={`${FACE_LABEL[face]}${isNow ? ' · most' : ''} · ${spokenState(open, done)}`}
          >
            <span className="dfs-e" aria-hidden="true">{FACE_EMOJI[face]}</span>
            <span className="dfs-l">{FACE_LABEL[face]}</span>
            <span className="dfs-c" aria-hidden="true">
              {open > 0 ? `${open} tétel` : done > 0 ? '✓ kész' : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Add the `.dfs` CSS family**

Append to `frontend/src/styles/prototype.css`, after the `.itemrow` block:

```css
/* ===== DayFaceStrip — Today's daypart navigator (mezo-j7u4) ===== */
.dfs { display: flex; gap: 8px; padding: 6px 24px 12px; }
.dfs-pill { flex: 1; border-radius: 16px; padding: 10px 6px 9px; text-align: center;
  background: var(--surface); box-shadow: var(--np-shadow-row); border: 1.5px solid transparent;
  font-family: inherit; cursor: pointer; transition: background .26s var(--np-ease-ios), border-color .26s var(--np-ease-ios); }
.dfs-e { display: block; font-size: 15px; }
.dfs-l { display: block; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  color: var(--faint); margin-top: 3px; }
.dfs-c { display: block; font-size: 9.5px; font-weight: 800; color: var(--sage-deep); margin-top: 2px;
  font-variant-numeric: tabular-nums; }
.dfs-pill.now { border-color: var(--coral); }
.dfs-pill.now .dfs-l { color: var(--coral-deep); }
.dfs-pill.sel { background: var(--ink); border-color: var(--ink); }
.dfs-pill.sel .dfs-l { color: color-mix(in srgb, var(--surface) 72%, transparent); }
.dfs-pill.sel .dfs-c { color: color-mix(in srgb, var(--surface) 82%, transparent); }
.dfs-pill.sel.now { box-shadow: 0 0 0 2px var(--coral); }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/today/components/DayFaceStrip.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/components/DayFaceStrip.tsx \
        frontend/src/features/today/components/DayFaceStrip.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(today): add the DayFaceStrip daypart navigator (mezo-j7u4)"
```

---

### Task 7: `TodoCard` — the merged todo card

**Files:**
- Create: `frontend/src/features/today/components/TodoCard.tsx`
- Create: `frontend/src/features/today/components/TodoCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `TodayItem` from `@/features/today/logic/todayItems`.
- Produces: `TodoCard` with props `{ items: TodayItem[]; doneCount: number; xp: number; onAct: (item: TodayItem) => void }`.

**Context:** This replaces `TodayQuestsCard` + `RoutineCard` + the standalone `RitualCard`/`CheckInStrip` sections. Rows are grouped by `item.group`, preserving the order in which groups first appear in `items`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { TodoCard } from '@/features/today/components/TodoCard'
import type { TodayItem } from '@/features/today/logic/todayItems'

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:a', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: 'Reggeli napfény', subtitle: 'ébredés után', time: null, xp: 5,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Pipa' }, ...over,
})

describe('TodoCard', () => {
  test('groups rows under their group heading, in first-appearance order', () => {
    const { container } = render(
      <TodoCard doneCount={2} xp={48} onAct={() => {}} items={[
        item({ id: 'a', group: 'Reggeli rutin' }),
        item({ id: 'b', group: 'Napi küldetések', source: 'quest' }),
        item({ id: 'c', group: 'Reggeli rutin' }),
      ]} />,
    )
    const groups = [...container.querySelectorAll('.tdc-grp')].map(g => g.textContent)
    expect(groups).toEqual(['Reggeli rutin · 2', 'Napi küldetések · 1'])
  })

  test('the header shows done/total and the XP total', () => {
    render(<TodoCard doneCount={6} xp={48} onAct={() => {}} items={[item(), item({ id: 'b' })]} />)
    expect(screen.getByText('6 / 8 kész')).toBeInTheDocument()
    expect(screen.getByText('+48 XP')).toBeInTheDocument()
  })

  test('the progress bar width matches done/total', () => {
    const { container } = render(<TodoCard doneCount={1} xp={0} onAct={() => {}} items={[item(), item({ id: 'b' }), item({ id: 'c' })]} />)
    expect(container.querySelector<HTMLElement>('.tdc-bar i')?.style.width).toBe('25%')
  })

  test('a row action fires onAct with its own item', () => {
    const onAct = vi.fn()
    const target = item({ id: 'z', title: 'Gombakávé' })
    render(<TodoCard doneCount={0} xp={0} onAct={onAct} items={[item(), target]} />)
    within(screen.getByText('Gombakávé').closest('.itemrow')!).getByRole('button').click()
    expect(onAct).toHaveBeenCalledWith(target)
  })

  test('a row without an action renders no button', () => {
    render(<TodoCard doneCount={0} xp={0} onAct={() => {}} items={[item({ action: null })]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('renders nothing when there are no items', () => {
    const { container } = render(<TodoCard doneCount={0} xp={0} onAct={() => {}} items={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/today/components/TodoCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TodoCard.tsx`**

```tsx
// ============================================================
// Mezo · TodoCard — the ONE actionable card of a face (mezo-j7u4). It replaced
// three separate cards (TodayQuestsCard + RoutineCard + the standalone ritual
// and check-in sections): a single progress bar, small-caps group headings and
// uniform `ItemRow`s. Grouping preserves the order in which each group first
// appears in `items`, which is the order `buildTodayItems` emits them.
// Ghosts (renders null) on an empty face.
// ============================================================
import { ItemRow } from '@/shared/ui/ItemRow'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function TodoCard({
  items, doneCount, xp, onAct,
}: {
  /** The face's OPEN items — done ones live in `DoneFold`. */
  items: TodayItem[]
  /** Completed items on this face, for the header ratio + bar. */
  doneCount: number
  xp: number
  onAct: (item: TodayItem) => void
}) {
  if (items.length === 0) return null

  const total = items.length + doneCount
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100)

  // Group in first-appearance order — a Map preserves insertion order.
  const groups = new Map<string, TodayItem[]>()
  for (const it of items) {
    const bucket = groups.get(it.group)
    if (bucket) bucket.push(it)
    else groups.set(it.group, [it])
  }

  return (
    <div className="tdc">
      <div className="tdc-hd">
        <span className="tdc-hd-l">⚡ {doneCount} / {total} kész</span>
        <span className="tdc-hd-r">+{xp} XP</span>
      </div>
      <div className="tdc-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      {[...groups].map(([group, rows]) => (
        <div key={group}>
          <div className="tdc-grp">{group} · {rows.length}</div>
          {rows.map((it) => (
            <ItemRow
              key={it.id}
              tone={it.tone}
              emoji={it.emoji}
              title={it.title}
              subtitle={it.subtitle}
              time={it.time}
              actionLabel={it.action?.label}
              onAction={it.action ? () => onAct(it) : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Add the `.tdc` CSS family**

Append to `frontend/src/styles/prototype.css`, after the `.dfs` block:

```css
/* ===== TodoCard — the merged actionable card of a face (mezo-j7u4) ===== */
.tdc { margin: 0 24px 12px; padding: 14px 6px 8px; border-radius: 24px; background: var(--surface);
  box-shadow: var(--np-shadow-row); }
.tdc-hd { display: flex; align-items: center; padding: 0 10px; margin-bottom: 9px; }
.tdc-hd-l { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--faint); }
.tdc-hd-r { margin-left: auto; font-size: 11px; font-weight: 800; color: var(--sage-deep);
  font-variant-numeric: tabular-nums; }
.tdc-bar { height: 5px; border-radius: 999px; background: var(--warm); overflow: hidden; margin: 0 10px 12px; }
.tdc-bar i { display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--coral), var(--amber)); }
.tdc-grp { font-size: 9.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  color: var(--faint); margin: 10px 10px 6px; }
/* Inside the card the rows lose the standalone row's outer margin + shadow. */
.tdc .itemrow { margin: 0 4px 4px; box-shadow: none; background: transparent; padding: 9px; }
.tdc .itemrow.is-done { background: transparent; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/today/components/TodoCard.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/components/TodoCard.tsx \
        frontend/src/features/today/components/TodoCard.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(today): add the merged TodoCard (mezo-j7u4)"
```

---

### Task 8: `FaceHeroCard` and `DoneFold`

**Files:**
- Create: `frontend/src/features/today/components/FaceHeroCard.tsx`
- Create: `frontend/src/features/today/components/FaceHeroCard.test.tsx`
- Create: `frontend/src/features/today/components/DoneFold.tsx`
- Create: `frontend/src/features/today/components/DoneFold.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `ItemCard` from `@/shared/ui/ItemCard`; `TodayItem` from `@/features/today/logic/todayItems`.
- Produces:
  - `FaceHeroCard` with props `{ tone, emoji, tag, title, done, total, next: TodayItem | null, rest: string[], onAct: (item: TodayItem) => void }`
  - `DoneFold` with props `{ items: TodayItem[]; xp: number }`

- [ ] **Step 1: Write the failing tests**

`FaceHeroCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { FaceHeroCard } from '@/features/today/components/FaceHeroCard'
import type { TodayItem } from '@/features/today/logic/todayItems'

const NEXT: TodayItem = {
  id: 'habit:pushups', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: '50 fekvőtámasz', subtitle: 'napfény után', time: null, xp: 10,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Pipa' },
}

describe('FaceHeroCard', () => {
  test('shows the chain ratio as the title and draws the progress bar', () => {
    const { container } = render(
      <FaceHeroCard tone="body" emoji="🌅" tag="REGGELI RUTIN" title="Indul a lánc"
        done={3} total={8} next={NEXT} rest={['Gombakávé']} onAct={() => {}} />,
    )
    expect(screen.getByRole('heading', { name: 'Indul a lánc' })).toBeInTheDocument()
    expect(container.querySelector<HTMLElement>('.fhc-bar i')?.style.width).toBe('37.5%')
  })

  test('promotes the next step with its own action', () => {
    const onAct = vi.fn()
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={NEXT} rest={[]} onAct={onAct} />)
    expect(screen.getByText('50 fekvőtámasz')).toBeInTheDocument()
    expect(screen.getByText('napfény után · +10 XP')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Pipa' }).click()
    expect(onAct).toHaveBeenCalledWith(NEXT)
  })

  test('renders the remaining steps as metapills', () => {
    const { container } = render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="T" done={3} total={8}
      next={NEXT} rest={['Gombakávé', 'Fehérjés reggeli']} onAct={() => {}} />)
    expect(container.querySelectorAll('.metapill')).toHaveLength(2)
  })

  test('without a next step there is no promoted row and no button', () => {
    render(<FaceHeroCard tone="body" emoji="🌅" tag="R" title="Kész a lánc" done={8} total={8}
      next={null} rest={[]} onAct={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
```

`DoneFold.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { DoneFold } from '@/features/today/components/DoneFold'
import type { TodayItem } from '@/features/today/logic/todayItems'

const done = (id: string, title: string): TodayItem => ({
  id, source: 'habit', face: 'reggel', status: 'done', tone: 'body', emoji: '🌅', tag: 'R',
  title, subtitle: null, time: null, xp: 10, group: 'Reggeli rutin', action: null,
})

describe('DoneFold', () => {
  test('renders nothing when nothing is done', () => {
    const { container } = render(<DoneFold items={[]} xp={0} />)
    expect(container.firstChild).toBeNull()
  })

  test('summarises count and XP, collapsed by default', () => {
    render(<DoneFold items={[done('a', 'Ébredés időben'), done('b', 'Reggeli napfény')]} xp={40} />)
    expect(screen.getByRole('button', { name: /2 tétel/ })).toBeInTheDocument()
    expect(screen.queryByText('Ébredés időben')).toBeNull()
  })

  test('expands to list the done items and collapses again', () => {
    render(<DoneFold items={[done('a', 'Ébredés időben')]} xp={10} />)
    const toggle = screen.getByRole('button')
    toggle.click()
    expect(screen.getByText('Ébredés időben')).toBeInTheDocument()
    toggle.click()
    expect(screen.queryByText('Ébredés időben')).toBeNull()
  })
})
```

- [ ] **Step 2: Run both tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/today/components/FaceHeroCard.test.tsx src/features/today/components/DoneFold.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `FaceHeroCard.tsx`**

```tsx
// ============================================================
// Mezo · FaceHeroCard — a face's chain hero (mezo-j7u4): the shared `ItemCard`
// carrying a progress bar and the chain's NEXT step promoted into its own row
// with that step's action. The remaining steps stay as quiet `.metapill`s, so
// the card answers „mi a következő" without hiding what comes after.
// ============================================================
import { ItemCard, type ItemTone } from '@/shared/ui/ItemCard'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function FaceHeroCard({
  tone, emoji, tag, title, done, total, next, rest, onAct,
}: {
  tone: ItemTone
  emoji: string
  tag: string
  title: string
  done: number
  total: number
  /** The chain's first open step, promoted; null when the chain is finished. */
  next: TodayItem | null
  /** Titles of the steps after `next`. */
  rest: string[]
  onAct: (item: TodayItem) => void
}) {
  const pct = total === 0 ? 0 : (done / total) * 100
  return (
    <ItemCard
      tone={tone} emoji={emoji} tag={tag} title={title}
      stateLabel={`${done} / ${total}`}
      facts={rest}
      logged={false}
    >
      <div className="fhc-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      {next && (
        <div className="fhc-next">
          <span className="fhc-next-tx">
            <b>{next.title}</b>
            <s>{[next.subtitle, next.xp ? `+${next.xp} XP` : null].filter(Boolean).join(' · ')}</s>
          </span>
          {next.action && (
            <button type="button" className="fhc-next-go np-press" onClick={() => onAct(next)}>
              {next.action.label}
            </button>
          )}
        </div>
      )}
    </ItemCard>
  )
}
```

- [ ] **Step 4: Implement `DoneFold.tsx`**

```tsx
// ============================================================
// Mezo · DoneFold — the collapsed „✓ Kész" summary at the foot of every face
// (mezo-j7u4). Completed items leave the open list entirely and land here, so
// the face always reads as „what is left", never as a mixed pile. Ghosts when
// nothing is done yet.
// ============================================================
import { useState } from 'react'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function DoneFold({ items, xp }: { items: TodayItem[]; xp: number }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="donefold">
      <button type="button" className="donefold-hd np-press" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="donefold-t">✓ Kész ma</span>
        <span className="donefold-c">{items.length} tétel · +{xp} XP</span>
        <span className="donefold-ch" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && items.map((it) => (
        <ItemRow key={it.id} tone={it.tone} emoji={it.emoji} title={it.title} subtitle={it.subtitle} done />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Add the `.fhc` and `.donefold` CSS**

Append to `frontend/src/styles/prototype.css`, after the `.tdc` block:

```css
/* ===== FaceHeroCard extras (mezo-j7u4) ===== */
.fhc-bar { height: 5px; border-radius: 999px; background: rgba(255,255,255,.72); margin-top: 12px; overflow: hidden; }
.fhc-bar i { display: block; height: 100%; border-radius: 999px; background: var(--tc-accent); }
.fhc-next { display: flex; align-items: center; gap: 9px; margin-top: 12px; padding: 11px 12px;
  border-radius: 15px; background: rgba(255,255,255,.80); }
:root[data-theme="dark"] .fhc-next { background: rgba(255,255,255,.07); }
.fhc-next-tx { flex: 1; min-width: 0; }
.fhc-next-tx b { display: block; font-size: 13px; font-weight: 800; color: var(--ink); }
.fhc-next-tx s { display: block; text-decoration: none; font-size: 10.5px; font-weight: 700;
  color: var(--sub); margin-top: 1px; }
.fhc-next-go { flex: none; border-radius: 12px; padding: 9px 14px; font-size: 11.5px; font-weight: 800;
  font-family: inherit; cursor: pointer; border: 0; color: var(--surface); background: var(--tc-accent); }

/* ===== DoneFold (mezo-j7u4) ===== */
.donefold { margin: 4px 24px 12px; }
.donefold-hd { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 14px;
  border-radius: 16px; border: 1.5px dashed var(--line); background: transparent; font-family: inherit;
  font-size: 11.5px; font-weight: 800; color: var(--sub); cursor: pointer; }
.donefold-c { margin-left: auto; color: var(--sage-deep); font-variant-numeric: tabular-nums; }
.donefold-ch { color: var(--faint); }
.donefold .itemrow { margin: 6px 0 0; }
```

- [ ] **Step 6: Run both tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/today/components/FaceHeroCard.test.tsx src/features/today/components/DoneFold.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today/components/FaceHeroCard.tsx \
        frontend/src/features/today/components/FaceHeroCard.test.tsx \
        frontend/src/features/today/components/DoneFold.tsx \
        frontend/src/features/today/components/DoneFold.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(today): add FaceHeroCard and DoneFold (mezo-j7u4)"
```

---

### Task 9: Re-dress `BriefingCard`, `RitualCard`, `WindDownBanner` and `IntentionBanner`

**Files:**
- Modify: `frontend/src/features/today/components/BriefingCard.tsx`
- Modify: `frontend/src/features/today/components/BriefingCard.test.tsx`
- Modify: `frontend/src/features/today/components/RitualCard.tsx`
- Modify: `frontend/src/features/today/components/RitualCard.test.tsx`
- Modify: `frontend/src/features/today/components/WindDownBanner.tsx`
- Modify: `frontend/src/features/today/components/IntentionBanner.tsx`
- Modify: `frontend/src/features/today/components/IntentionBanner.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `ItemCard` from `@/shared/ui/ItemCard`.
- Produces: same component names and props as today, except `IntentionBanner` gains a required `variant` prop: `'chip' | 'reflect'`.

**Context:** Read each component first. Behavior, data and copy must not change — only the markup they render. Every existing test in these files must keep passing except where this task explicitly rewrites an assertion about markup.

- [ ] **Step 1: Re-dress `BriefingCard`**

Replace its outer `div.card` wrapper with an `ItemCard`:

```tsx
<ItemCard
  tone="mind"
  emoji="✨"
  tag={briefing.eyebrow || 'Mezo · reggeli briefing'}
  title=""
  facts={facts}
  logged={false}
>
  {/* the existing collapsed/expanded body, unchanged */}
</ItemCard>
```

Rules:
- `title=""` — the briefing's prose is the body, not a display title. `ItemCard` renders an empty `<h3>`; add `{title ? <h3 …>{title}</h3> : null}` to `ItemCard` so an empty title renders nothing, and add an `ItemCard` test asserting that.
- `facts` is the caller-supplied array; `TodayPage` will pass `['alvás 7.2h', 'súly 78.6', 'Reta D3']` in Task 10. Add a `facts?: readonly (...)[]` prop to `BriefingCard` defaulting to `[]`.
- The `bővebben`/`összecsuk` toggle, the `.brief-clamp` clamp, the refs row and the „Demo tartalom" label all stay exactly as they are.
- Update `BriefingCard.test.tsx`'s markup assertions (`.card` → `.todaycard`); keep every behavioral assertion.

- [ ] **Step 2: Re-dress `RitualCard`**

Keep the three derived states and the `?ritual=` override untouched. Render:
- **done** → `<ItemCard tone="mind" emoji="🌙" tag="NAPZÁRÁS" title="Napzárás kész" facts={[]} logged loggedSummary="Kész" />`
- **open** → `<ItemCard tone="mind" emoji="🌙" tag="NAPZÁRÁS" time={opensAt} title="Zárjuk le a napot" facts={['5 felvonás', `villanyoltás ${bedTime}`]} logged={false} stateLabel="MOST" ctaLabel="Zárjuk le a napot ✨" onLog={() => navigate('/ritual')} />`
- **waiting** → the same card with `stateLabel="Még vár"` and **no** `ctaLabel`/`onLog` (read-only). The soft-gate promise (ADR 0010) is preserved by the `TodoCard` row, which still links to `/ritual`.

Swap the `Link` for `useNavigate` since `ItemCard`'s CTA is a button. Update `RitualCard.test.tsx`'s markup assertions; keep every state-branch and override-precedence assertion.

- [ ] **Step 3: Re-dress `WindDownBanner`**

Keep `windDownPhase` gating, the 30 s tick, the `wind_down` habit check and the level-up plumbing verbatim. Replace the `.wdb` markup for the `dim` and `winddown` phases with:

```tsx
<ItemCard tone="mind" emoji={phase === 'dim' ? '🕯️' : '🌙'} tag="ESTI LEÁLLÁS"
  title={phase === 'dim' ? 'Tompítsd a fényeket' : 'Kapcsolj le'}
  stateLabel={pill}
  facts={tips}
  logged={windDownHabit?.status === 'done'}
  loggedSummary="Leállás megvolt"
  ctaLabel={windDownHabit && windDownHabit.status !== 'done' ? 'Pipa' : undefined}
  onLog={windDownHabit && windDownHabit.status !== 'done' ? doCheck : undefined}
/>
```

where `tips` is the existing tip copy flattened to plain strings (`['💡 30 lux alá', '🔶 Meleg, sárga fény', '❄️ Hűtsd a szobát ~18 °C']` for `dim`; `['📵 Képernyők le', '🕯️ Fények tompítva']` for `winddown`). **The `night` phase's `.wdb-night` row is unchanged** — it is a literal-dark surface belonging to the night layer, not to the card language. Delete the now-unused `.wdb`, `.wdb-hd`, `.wdb-eye`, `.wdb-pill`, `.wdb-title`, `.wdb-list`, `.wdb-tip`, `.wdb-tip-ic`, `.wdb-foot`, `.wdb-stat`, `.wdb-done`, `.wdb-hab*`, `.wdb-pipa` CSS rules; **keep every `.wdb-night*` rule.**

- [ ] **Step 4: Split `IntentionBanner` into a chip and a reflect row**

Add a required `variant` prop:
- `variant="chip"` (morning + day faces) → a one-line creed chip: `✦` + the creed in italics + a `+ Mai fókusz` button (or `+ Vezérelv megírása` when there is no creed). Both open the existing sheets. Ghosts (`null`) exactly as today when `isPending && !creed && foci.length === 0`.
- `variant="reflect"` (evening face) → only the reflection block: the question + the three options, or the `✓ …` done line. Ghosts when there are no foci or no creed.

The `.intent-creed`/`.intent-foci`/`.intent-cap` full-card markup is deleted; the sheets (`IntentionSheet`, `CreedSheet`, `ReflectSheet`) are untouched. Add the chip CSS:

```css
/* ===== Intention creed chip (mezo-j7u4) ===== */
.creedchip { margin: 0 24px 12px; padding: 10px 13px; border-radius: 16px; display: flex; gap: 9px;
  align-items: center; background: color-mix(in srgb, var(--lav) 11%, transparent); }
.creedchip-st { color: var(--lav-deep); font-size: 13px; }
.creedchip-tx { flex: 1; font-size: 11.5px; font-style: italic; color: var(--lav-deep); line-height: 1.4; }
.creedchip-go { flex: none; font-size: 10px; font-weight: 800; color: var(--lav-deep); border: 0;
  border-radius: 999px; padding: 5px 9px; font-family: inherit; cursor: pointer;
  background: color-mix(in srgb, var(--surface) 70%, transparent); }
```

Delete the unused `.intent`, `.intent-head`, `.intent-star`, `.intent-eye`, `.intent-edit`, `.intent-creed`, `.intent-div`, `.intent-row`, `.intent-prompt`, `.intent-cta`, `.intent-focus-eye`, `.intent-foci`, `.fx`, `.fx-mark`, `.fx-text`, `.intent-add`, `.intent-cap` rules. **Keep `.reflect`, `.reflect-q`, `.reflect-opts`, `.reflect-opt`, `.reflect-done`.**

Update `IntentionBanner.test.tsx`: every existing case becomes a `variant="chip"` or `variant="reflect"` case; add one asserting the chip ghosts without data and one asserting `variant="reflect"` renders nothing outside the evening data shape.

- [ ] **Step 5: Run the affected tests**

```bash
cd frontend && pnpm vitest run src/features/today/components/BriefingCard.test.tsx \
  src/features/today/components/RitualCard.test.tsx \
  src/features/today/components/IntentionBanner.test.tsx \
  src/features/today/components/WindDownBanner.test.tsx \
  src/shared/ui/ItemCard.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Run the full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS in both modes. `TodayPage.test.tsx` may fail here — it still mounts the old composition. That is expected and Task 10 fixes it; if so, note it and proceed. Nothing else may fail.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today/components frontend/src/styles/prototype.css
git commit -m "refactor(today): re-dress briefing, ritual, wind-down and intention onto ItemCard (mezo-j7u4)"
```

---

### Task 10: The three faces and the `TodayPage` re-composition

**Files:**
- Create: `frontend/src/features/today/components/FaceMorning.tsx`
- Create: `frontend/src/features/today/components/FaceDay.tsx`
- Create: `frontend/src/features/today/components/FaceEvening.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.tsx` (whole file)
- Modify: `frontend/src/features/today/pages/TodayPage.test.tsx` (whole file)
- Delete: the ten components listed below, with their colocated tests
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: everything from Tasks 1–9.
- Produces: the finished screen. No new exported API.

- [ ] **Step 1: Write the failing composition test**

Replace `frontend/src/features/today/pages/TodayPage.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2026, 4, 21)
  d.setHours(h, m, 0, 0)
  return d
}

function renderToday(path = '/today') {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <TodayPage />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

describe('TodayPage — face selection', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('with no ?dp the face comes from the clock', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday()
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Reggel/)
  })

  test('the evening clock lands on the evening face', () => {
    vi.useFakeTimers().setSystemTime(at('21:05'))
    renderToday()
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Este/)
  })

  test('?dp= overrides the clock', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday('/today?dp=este')
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Este/)
  })

  test.each(['', 'holnap', '4'])('a blank or unknown ?dp=%s falls back to the clock face', (v) => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    renderToday(`/today?dp=${v}`)
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Nap/)
  })

  test('tapping another pill switches the rendered face', async () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday()
    screen.getByRole('tab', { name: /^Este/ }).click()
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Este/)
  })
})

describe('TodayPage — composition', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('the fixed chrome renders on every face', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    expect(container.querySelector('.apphero')).toBeTruthy()
    expect(container.querySelector('.greet')).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'Napszakok' })).toBeInTheDocument()
  })

  test('the retired sections are gone', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    expect(container.querySelector('.dayarc')).toBeNull()
    expect(container.querySelector('.zonediv')).toBeNull()
    expect(container.querySelector('.beats')).toBeNull()
    expect(container.querySelector('.scard')).toBeNull()
    expect(container.querySelector('.np-hero')).toBeNull()
    expect(screen.queryByText('Teendők ma')).toBeNull()
    expect(screen.queryByText('A napod')).toBeNull()
    expect(screen.queryByText('Ma eddig')).toBeNull()
  })

  test('?day=rough still replaces the whole screen with AnchorMode', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday('/today?day=rough')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByText('Kilépés')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/today/pages/TodayPage.test.tsx`
Expected: FAIL — no `tablist` on the page.

- [ ] **Step 3: Create the three face components**

`FaceMorning.tsx`:

```tsx
// ============================================================
// Mezo · FaceMorning — the 🌅 face (mezo-j7u4): the morning chain hero, the
// companion's briefing, the creed chip, the day's remaining todos, and a
// preview of what the later faces hold (the screen's actual guidance).
// ============================================================
import { BriefingCard } from '@/features/today/components/BriefingCard'
import { DoneFold } from '@/features/today/components/DoneFold'
import { FaceHeroCard } from '@/features/today/components/FaceHeroCard'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { TodoCard } from '@/features/today/components/TodoCard'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { Briefing } from '@/data/types'
import type { DayFace } from '@/features/today/logic/dayFace'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function FaceMorning({
  open, done, doneXp, chain, briefing, briefingDemo, briefingFacts, later, onAct, onFace,
}: {
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  chain: { done: number; total: number; next: TodayItem | null; rest: string[] }
  briefing: Briefing
  briefingDemo?: boolean
  briefingFacts: string[]
  /** Items belonging to the later faces, previewed as compact rows. */
  later: TodayItem[]
  onAct: (item: TodayItem) => void
  onFace: (face: DayFace) => void
}) {
  const todo = open.filter((i) => i.source !== 'habit' || i.face !== 'reggel')
  return (
    <>
      <FaceHeroCard
        tone="body" emoji="🌅" tag="REGGELI RUTIN"
        title={chain.next ? 'Indul a lánc' : 'Megvan a reggeled'}
        done={chain.done} total={chain.total} next={chain.next} rest={chain.rest} onAct={onAct}
      />
      <BriefingCard briefing={briefing} demo={briefingDemo} facts={briefingFacts} />
      <IntentionBanner variant="chip" />
      <TodoCard items={todo} doneCount={done.length} xp={doneXp} onAct={onAct} />
      {later.length > 0 && (
        <>
          <div className="zoneline"><span>Ma még vár rád</span><i /></div>
          {later.map((it) => (
            <ItemRow
              key={it.id} tone={it.tone} emoji={it.emoji} title={it.title}
              subtitle={it.subtitle} time={it.time}
              onAction={() => onFace(it.face === 'all' ? 'nap' : it.face)}
              ariaLabel={`${it.title} — ugrás a napszakára`}
            />
          ))}
        </>
      )}
      <DoneFold items={done} xp={doneXp} />
    </>
  )
}
```

`FaceDay.tsx`:

```tsx
// ============================================================
// Mezo · FaceDay — the ☀️ face (mezo-j7u4): the day's session as the hero with
// its real start CTA, the remaining todos, the companion's midday note, and a
// preview of the evening.
// ============================================================
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { DoneFold } from '@/features/today/components/DoneFold'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { TodoCard } from '@/features/today/components/TodoCard'
import { ItemCard, type ItemTone } from '@/shared/ui/ItemCard'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { CompanionNote } from '@/data/types'
import type { DayFace } from '@/features/today/logic/dayFace'
import type { TodayItem } from '@/features/today/logic/todayItems'

export interface DayHero {
  tone: ItemTone; emoji: string; tag: string; time: string | null; title: string
  facts: (string | null | undefined | false)[]
  logged: boolean; loggedSummary?: string; ctaLabel?: string; onLog?: () => void
}

export function FaceDay({
  open, done, doneXp, hero, note, later, onAct, onFace, onCustom,
}: {
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  /** null on a rest day. */
  hero: DayHero | null
  note: CompanionNote | null
  later: TodayItem[]
  onAct: (item: TodayItem) => void
  onFace: (face: DayFace) => void
  onCustom: () => void
}) {
  const todo = open.filter((i) => i.source !== 'session')
  return (
    <>
      {hero ? (
        <ItemCard {...hero} />
      ) : (
        <ItemCard
          tone="gym" emoji="🌤️" tag="PIHENŐ" title="Ma pihenőnap"
          facts={['a heti rended a Heti fülön']} logged={false}
          ctaLabel="Saját edzés" onLog={onCustom}
        />
      )}
      <IntentionBanner variant="chip" />
      <TodoCard items={todo} doneCount={done.length} xp={doneXp} onAct={onAct} />
      {note && <CompanionNoteCard note={note} />}
      {later.length > 0 && (
        <>
          <div className="zoneline"><span>Este vár rád</span><i /></div>
          {later.map((it) => (
            <ItemRow
              key={it.id} tone={it.tone} emoji={it.emoji} title={it.title}
              subtitle={it.subtitle} time={it.time}
              onAction={() => onFace('este')}
              ariaLabel={`${it.title} — ugrás az esti napszakra`}
            />
          ))}
        </>
      )}
      <DoneFold items={done} xp={doneXp} />
    </>
  )
}
```

`FaceEvening.tsx`:

```tsx
// ============================================================
// Mezo · FaceEvening — the 🌙 face (mezo-j7u4): the Napzárás hero (with the
// wind-down card above it inside the dim/winddown window), the evening todos,
// the intention reflection, and the day's retrospective — the completed items
// with their DoneBar summaries plus the day's XP.
// ============================================================
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { DoneFold } from '@/features/today/components/DoneFold'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { RitualCard } from '@/features/today/components/RitualCard'
import { TodoCard } from '@/features/today/components/TodoCard'
import { WindDownBanner } from '@/features/today/components/WindDownBanner'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { CompanionNote } from '@/data/types'
import type { TodayItem } from '@/features/today/logic/todayItems'

export function FaceEvening({
  open, done, doneXp, dayXp, note, onAct,
}: {
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  /** Total XP earned today across every source — the retrospective's headline. */
  dayXp: number
  note: CompanionNote | null
  onAct: (item: TodayItem) => void
}) {
  const todo = open.filter((i) => i.source !== 'ritual')
  return (
    <>
      <WindDownBanner />
      <RitualCard />
      <TodoCard items={todo} doneCount={done.length} xp={doneXp} onAct={onAct} />
      <IntentionBanner variant="reflect" />
      {note && <CompanionNoteCard note={note} />}
      {done.length > 0 && (
        <>
          <div className="zoneline"><span>Ahogy a nap telt</span><i /></div>
          {done.map((it) => (
            <ItemRow key={it.id} tone={it.tone} emoji={it.emoji} title={it.title} subtitle={it.subtitle} done />
          ))}
          <div className="dayxp">Ma összesen <b>+{dayXp} XP</b></div>
        </>
      )}
    </>
  )
}
```

- [ ] **Step 4: Rewrite `TodayPage.tsx`**

```tsx
// ============================================================
// Mezo · TodayPage — the Mai screen's composition root (mezo-j7u4).
// The screen has three sleep-anchored daypart faces (dayFace.ts); `?dp=` is the
// single source of truth for which one renders, derived from the URL and never
// mirrored into state — the TrainTodayPage `?day=` precedent, including its two
// traps: `params.get()` returns `null` when absent and `''` when blank, and both
// must mean "the current face" rather than falling through to a parsed value.
// Every source is normalized by todayItems.ts, so this file only wires hooks to
// faces and dispatches row actions; it holds no per-domain branching.
// ============================================================
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useActivities, useCheckins, useCompanionNote, useDailyQuests, useFuelPreview, useHabitActions,
  useHabitDay, useQuestActions, useQuickStats, useRitualDay, useSleep, useSleepGoal, useToday,
  useTodayScenario, useWaterActions, resolveBriefing,
} from '@/data/hooks'
import { AppHero } from '@/features/progression/components/AppHero'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { GreetingHeader } from '@/features/today/components/GreetingHeader'
import { DayFaceStrip } from '@/features/today/components/DayFaceStrip'
import { FaceMorning } from '@/features/today/components/FaceMorning'
import { FaceDay, type DayHero } from '@/features/today/components/FaceDay'
import { FaceEvening } from '@/features/today/components/FaceEvening'
import { VulnerabilityCard } from '@/features/today/components/VulnerabilityCard'
import { AnchorModeView } from '@/features/today/pages/AnchorModeView'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { questAction } from '@/features/today/logic/questAction'
import { habitAction } from '@/features/today/logic/habitAction'
import { DAY_FACES, dayFace, type DayFace as Face } from '@/features/today/logic/dayFace'
import { buildTodayItems, itemsForFace, openCountByFace, type TodayItem } from '@/features/today/logic/todayItems'
import { sportOf, SPORT_EMOJI, SPORT_TAGS, SPORT_TITLES, SPORT_TONE } from '@/features/train/logic/sportKinds'
import { localDateString } from '@/shared/lib/dates'
import { Icon } from '@/shared/ui/Icon'
import type { DailyQuest } from '@/data/types'

const isFace = (v: string | null): v is Face => v !== null && (DAY_FACES as readonly string[]).includes(v)

export function TodayPage() {
  const date = localDateString()
  const scenario = useTodayScenario()
  const { today, user, workout, volleyballSessions, workoutTime, prediction, briefing, briefingDemo } = useToday()
  const { checkins, saveCheckIn } = useCheckins()
  const { goal: sleepGoal } = useSleepGoal()
  const { quests } = useDailyQuests(date)
  const { data: activities } = useActivities(date)
  const { habits } = useHabitDay(date)
  const { check } = useHabitActions(date)
  const { data: ritualDay } = useRitualDay(date)
  const { visible: fuelSlots } = useFuelPreview()
  const { logWater } = useWaterActions(date)
  const stats = useQuickStats()
  const companionNote = useCompanionNote()
  const { showLevelUp } = useLevelUp()
  const navigate = useNavigate()
  const [params, setSearchParams] = useSearchParams()
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)
  const [activityQuest, setActivityQuest] = useState<DailyQuest | null>(null)
  const [customOpen, setCustomOpen] = useState(false)

  const sportToday = volleyballSessions.find((s) => s.today)
  const items = useMemo(() => buildTodayItems({
    quests, habits, checkins, fuelSlots, ritual: ritualDay, goal: sleepGoal,
    sessions: [
      ...(workout ? [{
        id: 'gym', tone: 'gym' as const, emoji: '🏋️', tag: 'GYM', title: workout.title,
        time: workoutTime ?? null,
        facts: [`${workout.exercises.length} gyakorlat`, `~${workout.durationEst} perc`, prediction?.label],
        logged: false,
      }] : []),
      ...(sportToday ? [{
        id: 'sport', tone: SPORT_TONE[sportOf(sportToday)], emoji: SPORT_EMOJI[sportOf(sportToday)],
        tag: SPORT_TAGS[sportOf(sportToday)], title: SPORT_TITLES[sportOf(sportToday)],
        time: sportToday.time, facts: [`${sportToday.duration} perc`, sportToday.court, sportToday.role],
        logged: false,
      }] : []),
    ],
  }), [quests, habits, checkins, fuelSlots, ritualDay, sleepGoal, workout, workoutTime, prediction, sportToday])

  // The current face comes from the clock; `?dp=` overrides it. Absent (`null`) and
  // blank (`''`) both mean "current" — neither may fall through to a parsed value.
  const current = dayFace(new Date(), sleepGoal)
  const raw = params.get('dp')
  const selected: Face = isFace(raw) ? raw : current
  const selectFace = (face: Face) => {
    const next = new URLSearchParams(params)
    if (face === current) next.delete('dp')
    else next.set('dp', face)
    setSearchParams(next, { replace: true })
  }

  if (scenario.anchorMode) return <AnchorModeView />

  const { open, done } = itemsForFace(items, selected)
  const doneXp = done.reduce((s, i) => s + (i.xp ?? 0), 0)
  const dayXp = items.filter((i) => i.status === 'done').reduce((s, i) => s + (i.xp ?? 0), 0)
    + (activities ?? []).reduce((s, e) => s + e.xpAwarded, 0)

  // A row's action is dispatched through the SAME mappings the old cards used —
  // ADR 0010: nothing here ever self-completes a quest or a DERIVED habit.
  const act = (item: TodayItem) => {
    const a = item.action
    if (!a) return
    if (a.kind === 'checkin') return setCheckInIdx(a.slotIdx)
    if (a.kind === 'nav') return navigate(a.to)
    if (a.kind === 'quest') {
      const qa = questAction(a.quest)
      if (!qa) return
      if (qa.kind === 'water') return logWater(qa.amountMl)
      if (qa.kind === 'checkin') {
        const idx = checkins.findIndex((c) => c.state === 'now' || c.state === 'pending')
        return idx >= 0 ? setCheckInIdx(idx) : undefined
      }
      if (qa.kind === 'activity') return setActivityQuest(a.quest)
      return navigate(qa.to)
    }
    const ha = habitAction(a.habit)
    if (ha.kind === 'check') {
      check(a.habit.key).then((lu) => lu?.[0] && showLevelUp(lu[0]))
      return
    }
    if (ha.kind === 'nav') return navigate(ha.to)
  }

  const morningChain = habits.filter((h) => h.chain === 'MORNING')
  const chainItems = open.filter((i) => i.source === 'habit' && i.face === 'reggel')
  const chain = {
    done: morningChain.filter((h) => h.status === 'done').length,
    total: morningChain.length,
    next: chainItems[0] ?? null,
    rest: chainItems.slice(1).map((i) => i.title),
  }
  const later = items.filter((i) => i.face !== selected && i.face !== 'all' && i.status === 'open')

  const dayHero: DayHero | null = workout
    ? {
        tone: 'gym', emoji: '🏋️', tag: `GYM${workout.tag ? ` · ${workout.tag}` : ''}`, time: workoutTime ?? null,
        title: workout.title,
        facts: [`${workout.exercises.length} gyakorlat`, `~${workout.durationEst} perc`, prediction?.label],
        logged: false, ctaLabel: 'Indítsuk', onLog: () => navigate('/train'),
      }
    : sportToday
      ? {
          tone: SPORT_TONE[sportOf(sportToday)], emoji: SPORT_EMOJI[sportOf(sportToday)],
          tag: SPORT_TAGS[sportOf(sportToday)], time: sportToday.time,
          title: SPORT_TITLES[sportOf(sportToday)],
          facts: [`${sportToday.duration} perc`, sportToday.court, sportToday.role],
          logged: false, ctaLabel: 'Logold', onLog: () => navigate('/train'),
        }
      : null

  return (
    <>
      <AppHero
        utilities={<Link to="/insights" aria-label="Insights" className="icon-btn"><Icon name="sparkle" size={18} /></Link>}
      />
      <GreetingHeader today={today} user={user} retaDay={scenario.retaDay} />
      <DayFaceStrip
        selected={selected}
        current={current}
        counts={openCountByFace(items)}
        doneCounts={Object.fromEntries(DAY_FACES.map((f) => [f, itemsForFace(items, f).done.length])) as Record<Face, number>}
        onSelect={selectFace}
      />
      {scenario.vulnerable && <VulnerabilityCard />}

      {selected === 'reggel' && (
        <FaceMorning
          open={open} done={done} doneXp={doneXp} chain={chain}
          briefing={briefing ?? resolveBriefing(scenario.dayState)}
          briefingDemo={briefingDemo}
          briefingFacts={stats.map((s) => `${s.label} ${s.value}${s.unit ?? ''}`)}
          later={later} onAct={act} onFace={selectFace}
        />
      )}
      {selected === 'nap' && (
        <FaceDay
          open={open} done={done} doneXp={doneXp} hero={dayHero} note={companionNote}
          later={later.filter((i) => i.face === 'este')} onAct={act} onFace={selectFace}
          onCustom={() => setCustomOpen(true)}
        />
      )}
      {selected === 'este' && (
        <FaceEvening open={open} done={done} doneXp={doneXp} dayXp={dayXp} note={companionNote} onAct={act} />
      )}

      {checkInIdx !== null && (
        <CheckInSheet
          slot={checkins[checkInIdx]} slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)}
          onSave={(data) => saveCheckIn(checkInIdx, data)}
        />
      )}
      {activityQuest && <ActivityLogSheet quest={activityQuest} onClose={() => setActivityQuest(null)} />}
      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
    </>
  )
}
```

Note the `useSleep` import is unused above — remove it if TypeScript flags it. Do **not** leave unused imports; `pnpm build` will fail.

- [ ] **Step 5: Add the `.zoneline` and `.dayxp` CSS**

Append to `frontend/src/styles/prototype.css`, after the `.donefold` block:

```css
/* ===== Face section line + day XP (mezo-j7u4) ===== */
.zoneline { display: flex; align-items: center; gap: 9px; padding: 16px 24px 8px; }
.zoneline span { font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase;
  color: var(--faint); white-space: nowrap; }
.zoneline i { flex: 1; height: 1px; background: var(--line); }
.dayxp { margin: 8px 24px 20px; padding: 12px 14px; border-radius: 16px; background: var(--warm);
  font-size: 12px; font-weight: 700; color: var(--sub); text-align: center; }
.dayxp b { color: var(--sage-deep); font-variant-numeric: tabular-nums; }
```

- [ ] **Step 6: Delete the retired components, tests and CSS**

```bash
cd frontend && git rm \
  src/features/today/components/DayArc.tsx src/features/today/components/DayArc.test.tsx \
  src/features/today/components/ZoneDivider.tsx \
  src/features/today/components/CheckInStrip.tsx src/features/today/components/CheckInStrip.test.tsx \
  src/features/today/components/QuickStatsRow.tsx \
  src/features/today/components/FuelTimelinePreview.tsx src/features/today/components/FuelTimelinePreview.test.tsx \
  src/features/today/components/WorkoutTeaser.tsx src/features/today/components/WorkoutTeaser.test.tsx \
  src/features/today/components/VolleyballCard.tsx \
  src/features/today/components/RoutineCard.tsx src/features/today/components/RoutineCard.test.tsx \
  src/features/today/components/TodayQuestsCard.tsx src/features/today/components/TodayQuestsCard.test.tsx \
  src/features/today/components/bottomSections.test.tsx \
  src/features/today/components/conditionalCards.test.tsx \
  src/shared/ui/QuickStat.tsx
```

**Do NOT delete `src/features/today/logic/dayArc.ts`** — `features/ritual/components/DayStoryStep.tsx` imports from it. Verify with `grep -rn "logic/dayArc" src/` before finishing.

`conditionalCards.test.tsx` also covered `VulnerabilityCard`, which survives. Before deleting it, move its `VulnerabilityCard` cases into a new `src/features/today/components/VulnerabilityCard.test.tsx`.

Then delete these CSS families from `frontend/src/styles/prototype.css` (search each selector and remove its whole rule, including the `@keyframes` they own):
`.dayarc`, `.arc-base`, `.arc-progress`, `.arc-dot`, `.arc-checkin-done`, `.arc-checkin-now`, `.arc-checkin-pending`, `.arc-workout`, `.arc-sleep`, `.arc-sun`, `.arclbl`, `.zonediv`, `.beats`, `.beat`, `.beat.done`, `.beat.now`, `@keyframes beatpulse`, `.scard`, `.np-hero`, `.np-hero-eyebrow`, `.np-hero-meta`, `.growrow`, `.quest-row`, `.quest-disc`, `.quest-pip`, `.quest-title`, `.quest-xp`, `.quest-cta`, `.quests-head`, `.quests-progress`.

**Keep** `.ritcard*` only if `RitualCard` still uses it after Task 9 — it does not, so delete `.ritcard`, `.ritcard-done`, `.ritcard-ttl`, `.ritcard-moon`, `.ritcard-sub`, `.ritcard-cta` and `@keyframes ritcard-breath` as well. **Keep every `.rz-*` rule** (the `/ritual` flow) and every `.wdb-night*` rule.

After deleting, verify nothing still references a removed class:
```bash
cd frontend && for c in dayarc zonediv "beat " scard np-hero growrow quest-row ritcard; do
  echo "--- $c"; grep -rn "$c" src --include=*.tsx | grep -v "\.test\." | head -3
done
```
Expected: no hits outside `prototype.css`.

- [ ] **Step 7: Run the composition test**

Run: `cd frontend && pnpm vitest run src/features/today/pages/TodayPage.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS in both modes. Fix any test that imports a deleted component. Note that the `today-*` visual goldens **will** fail now — they are regenerated in Task 13, not here.

- [ ] **Step 9: Commit and close the slice**

```bash
git add -A frontend/src
git commit -m "feat(today): rebuild Mai as three sleep-anchored daypart faces (mezo-j7u4)"
bd close mezo-j7u4
```

---

# Slice S4 — The polish (bd `mezo-1khu`)

### Task 11: Motion and the reduced-motion guard

**Files:**
- Modify: `frontend/src/features/today/pages/TodayPage.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Create: `frontend/src/features/today/todayReducedMotion.test.ts`

**Interfaces:**
- Consumes: everything from S3.
- Produces: no new exports.

- [ ] **Step 1: Add the face-swap motion CSS**

Append to `frontend/src/styles/prototype.css`:

```css
/* ===== Today face-swap motion (mezo-1khu) ===== */
/* The incoming face rebuilds with the existing np-anim stagger; direction is carried
   by a data attribute on the wrapper so forward/backward reads spatially. */
.faceswap > * { opacity: 0; animation: np-rise .5s var(--np-ease-ios) forwards;
  animation-delay: calc(var(--i, 0) * 70ms); }
.faceswap[data-dir="fwd"] > * { animation-name: face-in-fwd; }
.faceswap[data-dir="back"] > * { animation-name: face-in-back; }
@keyframes face-in-fwd  { from { opacity: 0; transform: translate(-14px, 10px); } to { opacity: 1; transform: none; } }
@keyframes face-in-back { from { opacity: 0; transform: translate( 14px, 10px); } to { opacity: 1; transform: none; } }

/* The TodoCard's progress bar reuses the existing grow keyframe. */
.tdc-bar i, .fhc-bar i { animation: progress-mbar-grow 1.1s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; }

/* A quiet pulse on the current pill — only while it still has open items. */
.dfs-pill.now.has-open .dfs-e { animation: dfs-pulse 2.4s ease-in-out infinite; }
@keyframes dfs-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }

@media (prefers-reduced-motion: reduce) {
  .faceswap > *, .faceswap[data-dir="fwd"] > *, .faceswap[data-dir="back"] > * { animation: none; opacity: 1; }
  .tdc-bar i, .fhc-bar i { animation: none; }
  .dfs-pill.now.has-open .dfs-e { animation: none; }
}
```

- [ ] **Step 2: Wire the wrapper and the stagger index in `TodayPage`**

Wrap the three face renders in a keyed div so React remounts (and therefore re-animates) on every face change, and stamp the direction:

```tsx
const dirOf = (from: Face, to: Face) =>
  DAY_FACES.indexOf(to) >= DAY_FACES.indexOf(from) ? 'fwd' : 'back'
const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
// inside selectFace, before setSearchParams:
setDir(dirOf(selected, face))
```

```tsx
<div className="faceswap" data-dir={dir} key={selected}>
  {selected === 'reggel' && <FaceMorning … />}
  {selected === 'nap' && <FaceDay … />}
  {selected === 'este' && <FaceEvening … />}
</div>
```

In `DayFaceStrip.tsx`, add `open > 0 && 'has-open'` to the pill's `cn(...)` call.

- [ ] **Step 3: Write the reduced-motion guard test**

Create `frontend/src/features/today/todayReducedMotion.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * Guard (mezo-1khu, mirroring features/ritual/reducedMotionGuard.test.ts): every
 * Today face-swap animation must be neutralized under prefers-reduced-motion, or the
 * Playwright goldens (which run reducedMotion: 'reduce') flake on in-flight frames.
 */
const CSS = readFileSync(resolve(__dirname, '../../styles/prototype.css'), 'utf8')

const REDUCED_BLOCKS = [...CSS.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
  .map((m) => m[1])
  .join('\n')

describe('Today motion is reduced-motion safe', () => {
  test.each(['.faceswap > *', '.tdc-bar i', '.dfs-pill.now.has-open .dfs-e'])(
    '%s is disabled under prefers-reduced-motion',
    (selector) => {
      expect(REDUCED_BLOCKS).toContain(selector)
    },
  )

  test('every Today-specific keyframe animation has a matching reduce rule', () => {
    for (const name of ['face-in-fwd', 'face-in-back', 'dfs-pulse']) {
      expect(CSS).toContain(`@keyframes ${name}`)
    }
    expect(REDUCED_BLOCKS).toMatch(/animation:\s*none/)
  })
})
```

- [ ] **Step 4: Run the guard test**

Run: `cd frontend && pnpm vitest run src/features/today/todayReducedMotion.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS in both modes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today frontend/src/styles/prototype.css
git commit -m "feat(today): face-swap motion with a reduced-motion guard (mezo-1khu)"
```

---

### Task 12: The loading skeleton

**Files:**
- Create: `frontend/src/features/today/pages/TodaySkeleton.tsx`
- Create: `frontend/src/features/today/pages/TodaySkeleton.test.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TodaySkeleton` (default export, matching the `TrainTodaySkeleton` precedent).

**Context:** `useSleepGoal` now decides which face renders. In real mode, before it resolves, the fallback would flash the wrong face. Read `frontend/src/features/train/pages/TrainTodaySkeleton.tsx` first and follow its structure and class usage.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import TodaySkeleton from '@/features/today/pages/TodaySkeleton'

describe('TodaySkeleton', () => {
  test('mirrors the real layout: greeting block, three pills, hero and a todo card', () => {
    const { container } = render(<TodaySkeleton />)
    expect(container.querySelectorAll('.dfs-pill')).toHaveLength(3)
    expect(container.querySelector('.todaycard')).toBeTruthy()
    expect(container.querySelector('.tdc')).toBeTruthy()
  })

  test('is inert — no buttons, no tablist semantics', () => {
    const { container, queryByRole } = render(<TodaySkeleton />)
    expect(queryByRole('button')).toBeNull()
    expect(queryByRole('tablist')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/today/pages/TodaySkeleton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TodaySkeleton.tsx`**

Build a layout-matched, inert skeleton: a `.greet` block, three `<div className="dfs-pill">` placeholders inside a plain `<div className="dfs">` (a `div`, not a `tablist` — a skeleton must not advertise tabs), one `.todaycard` placeholder and one `.tdc` placeholder with three row-height bars. Wrap it in `<div aria-busy="true" aria-label="Betöltés">`. Reuse the shimmer utility already in `prototype.css` (`grep -n "mezo-shimmer" src/styles/prototype.css` for the class name).

- [ ] **Step 4: Gate the page on `useSleepGoal`**

In `TodayPage.tsx`, add after all hooks and before the `anchorMode` early return:

```tsx
  // The face selection depends on the sleep anchor; rendering before it resolves would
  // flash the wrong face in real mode. The skeleton is layout-matched (TrainTodaySkeleton
  // precedent) so the swap does not shift the page.
  if (sleepGoalPending) return <TodaySkeleton />
```

Destructure it from the hook: `const { goal: sleepGoal, isPending: sleepGoalPending } = useSleepGoal()`.

**The early return must sit after every hook call** — React's hook order must stay stable.

- [ ] **Step 5: Run the tests**

Run: `cd frontend && pnpm vitest run src/features/today`
Expected: PASS.

- [ ] **Step 6: Run the full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS in both modes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today/pages
git commit -m "feat(today): layout-matched skeleton while the sleep anchor resolves (mezo-1khu)"
```

---

### Task 13: Visual goldens, documentation and cleanup

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts`
- Modify: `frontend/tests/visual/visual.spec.ts-snapshots/*` (regenerated)
- Create: `docs/decisions/0011-today-daypart-faces.md`
- Modify: `docs/features/today.md`, `docs/features/_platform-design-system.md`, `docs/features/habit.md`, `docs/features/ritual.md`, `docs/features/intention.md`, `docs/features/growth.md`, `docs/features/fuel.md`
- Delete: `frontend/public/_mockup-mai.html`

- [ ] **Step 1: Add the three Today face goldens**

In `frontend/tests/visual/visual.spec.ts`, replace the single `['today', '/today']` entry in `SCREENS` with three entries that also pin their own clock. The current loop freezes one time for every screen; add a per-screen clock override:

```ts
// [name, path, frozenTime?] — Today's three daypart faces each need their own clock so
// the sleep-anchored face selection is deterministic (mezo-1khu).
const SCREENS: Array<[string, string, string?]> = [
  ['today-reggel', '/today', '2026-05-21T09:12:00'],
  ['today-nap', '/today', '2026-05-21T13:42:00'],
  ['today-este', '/today', '2026-05-21T21:05:00'],
  ['train', '/train'],
  // …the rest unchanged
]
```

and in the test body:

```ts
for (const [name, path, frozen] of SCREENS) {
  test(name, async ({ page }) => {
    await page.clock.setFixedTime(new Date(frozen ?? '2026-05-21T13:42:00'))
    // …unchanged
```

Update the file's header comment: the screen count changed from 17 to 19.

- [ ] **Step 2: Regenerate the darwin goldens**

```bash
cd frontend && pnpm test:visual:update
```
Then **look at every regenerated `today-*` PNG** and confirm the three faces render as the spec describes. Delete the now-orphaned `today-light-darwin.png` / `today-dark-darwin.png` / `today-light-linux.png` / `today-dark-linux.png`.

- [ ] **Step 3: Verify the goldens pass clean**

```bash
cd frontend && pnpm test:visual
```
Expected: PASS with no diffs, including every `train-*` shot.

- [ ] **Step 4: Write the ADR**

Create `docs/decisions/0011-today-daypart-faces.md` following the template in `docs/README.md`. It must record: the problem (13 idioms, ~14 co-equal CTAs, a clock-blind screen, quest/habit duplication); the decision (three sleep-anchored faces + one card language + one merged todo card + dissolving the four context blocks); the alternatives rejected (A akció-konzol, B műszerfal, fixed-hour dayparts, a fourth overview face); and the consequences (Today gains a `useSleepGoal` dependency and a skeleton; `DayArc` leaves Today but its logic survives for the Napzárás flow; `shared/ui` gains two primitives Train also consumes).

- [ ] **Step 5: Rewrite `docs/features/today.md`**

Rewrite §1 (summary), §2 (user-facing behavior — the three faces, `?dp=`, act-anywhere), §3 (architecture — the two logic modules and what feeds them), §8 (testing — the new files and the three goldens), §9 (decisions & gotchas — link the ADR; record that `logic/dayArc.ts` outlives its component; record the degenerate-anchor guard), §10 (key files). Update the frontmatter `updated:` date and `key_files`.

- [ ] **Step 6: Update the remaining docs**

- `_platform-design-system.md`: add the shared `ItemCard`/`ItemRow` family and the `.itemrow`/`.dfs`/`.tdc`/`.fhc`/`.donefold`/`.creedchip`/`.zoneline` classes; record the deleted `.dayarc`/`.arc-*`, `.beats`/`.beat`, `.scard`, `.zonediv`, `.np-hero*`, `.quest-*`, `.ritcard*`, `.intent-*` families and that `QuickStat` is gone.
- `habit.md`, `ritual.md`, `intention.md`, `growth.md`, `fuel.md`: update every paragraph describing how the domain surfaces on Today (`RoutineCard`, `RitualCard`, `TodayQuestsCard`, `IntentionBanner`, `FuelTimelinePreview` are all gone or changed shape).

- [ ] **Step 7: Remove the working mockup and run the doc lint**

```bash
git rm frontend/public/_mockup-mai.html
node scripts/lint-docs.mjs
```
Expected: no staleness flags on the touched feature docs. Fix anything it reports.

- [ ] **Step 8: Run the full gate one last time**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm test:visual
```
Expected: PASS everywhere.

- [ ] **Step 9: Commit and close the slice**

```bash
git add -A
git commit -m "docs(today): ADR + feature docs for the daypart faces; three-face visual goldens (mezo-1khu)"
bd close mezo-1khu
bd close mezo-mvb4
```

- [ ] **Step 10: Regenerate the linux goldens on CI**

Push the branch, open the self-PR, and once it is up:

```bash
gh workflow run update-visual-baselines.yml -r feat/today-daypart-faces
```

Wait for it to land, pull, and confirm CI is green before merging locally with `--no-ff`.

---

## Self-Review Notes

- **Spec coverage:** §3 day model → Task 3. §4.1 primitives → Tasks 1–2. §4.2 components → Tasks 6–8. §4.3 `todayItems` → Tasks 4–5. §5 content map → Tasks 9–10. §6 component fate → Task 10 (deletions) + Task 9 (re-dressing). §7 motion → Task 11. §8 risk 3 (skeleton) → Task 12; risks 2 + 5 (goldens) → Task 13. §9 testing → distributed. §11 docs → Task 13.
- **Type consistency:** `ItemTone` is defined once in Task 1 and imported by `ItemRow`, `todayItems`, `FaceHeroCard` and `FaceDay`. `DayFace` is defined in Task 3 and aliased to `Face` inside `TodayPage` only, to avoid shadowing the `FaceDay` component name. `TodayItem`, `ItemAction`, `SessionItemInput`, `TodayItemsInput` are defined in Task 4 and unchanged by Task 5.
- **Known follow-up:** `ItemCard` imports `DoneBar` from `@/features/train/components/DoneBar`, so a `shared/ui` file reaches into a feature. That is an existing-code compromise, not a new one — `DoneBar` is already domain-free in substance. File a bd issue in S4 to move `DoneBar` into `shared/ui` rather than widening this task.
