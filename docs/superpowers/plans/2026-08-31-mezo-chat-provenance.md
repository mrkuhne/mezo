# Mezo chat 2.0 — provenance rétegek + élő fejléc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-face the Mezo chat's provenance layers (tool calls → collapsed work strip, refs → domain groups, memories → horizontal card strip) and its header (orb-led single live row), per the approved prototype.

**Architecture:** Pure frontend re-face — no API/backend change. One shared domain map (`toolDomains.ts`) feeds a new `ToolWorkStrip` component, the grouped refs footer in `ChatMessage`, and the memory card icons. `ChatPage` swaps its two-row header for the orb-led row and reuses `ToolWorkStrip` in live mode for the streaming turn. CSS goes into the existing `mzc-*` block of `prototype.css`, tokens themed light+dark like the surrounding `--mz-chat-*` tokens.

**Tech Stack:** React 18 + TS, Vitest + Testing Library, `prototype.css` token system, Clay sprites (`ClayIcon`/`ClaySpot`).

**Spec:** `docs/superpowers/specs/2026-08-31-mezo-chat-provenance-design.md` · **Visual truth:** `docs/design_2.0/prototypes/mezo-chat.html` · **bd:** mezo-vdf4

## Global Constraints

- Branch: `claude/chat-ui-design-structure-2a4873` (worktree). NEVER `cd` to the primary repo.
- Conventional commits carrying the bd id, e.g. `feat(chat): … (mezo-vdf4)`.
- Frontend tests run in BOTH modes; bare `pnpm test` in a worktree runs mock twice — real mode needs `VITE_USE_MOCK=false` explicitly (see memory `vite-use-mock-unset-means-mock`).
- All test commands from `frontend/`: `pnpm vitest run <file>` (mock mode default).
- Behavioral contracts that MUST NOT change: subtitle precedence (degraded → new → mode), votable-only-persisted feedback, Memory-ref dedupe vs `recalled` days, blank-answer naming gated on `m.id`, hidden-when-empty sections, ThinkingDots gating on `turn.draft` (mezo-280), composer autosize/Enter/IME handling.
- Never touch `ToolChipRow`/`ToolChip` themselves — fuel/train pages consume them.
- Hungarian UI copy; honest fallbacks (unknown tool/kind → raw name, neutral wash) — nothing fabricated.

---

### Task 1: `toolDomains.ts` — the shared domain map

**Files:**
- Create: `frontend/src/features/insights/logic/toolDomains.ts`
- Test: `frontend/src/features/insights/logic/toolDomains.test.ts`

**Interfaces:**
- Consumes: `ClayIconName` from `@/shared/ui/clay`.
- Produces (later tasks rely on these exact names):
  - `type DomainWash = 'sky' | 'lav' | 'sage' | 'coral' | 'gold' | 'rose' | 'neutral'`
  - `interface ToolDomain { label: string; icon: ClayIconName; wash: DomainWash }`
  - `toolDomain(name: string): ToolDomain` — 17 real tool names mapped; unknown → `{ label: name, icon: 'i-mezo', wash: 'neutral' }`
  - `refDomain(kind: string): ToolDomain` — ref kinds mapped (label comes from `chatRefDisplay`, so `refDomain().label` is unused by refs; still filled honestly)
  - `memoryIcon(kind: string): ClayIconName` — recalled-memory wire kinds; unknown → `'i-retegek'`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/insights/logic/toolDomains.test.ts
import { memoryIcon, refDomain, toolDomain } from '@/features/insights/logic/toolDomains'

describe('toolDomain', () => {
  it('maps the real companion tools to human labels + clay icons + washes', () => {
    expect(toolDomain('get_weight_log')).toEqual({ label: 'Súlynapló', icon: 'i-suly', wash: 'sky' })
    expect(toolDomain('get_recovery')).toEqual({ label: 'Alvás & pihenés', icon: 'i-alvas', wash: 'lav' })
    expect(toolDomain('get_fuel_log')).toEqual({ label: 'Fuel napló', icon: 'i-fuel', wash: 'sage' })
    expect(toolDomain('get_training_log')).toEqual({ label: 'Edzésnapló', icon: 'i-edzes', wash: 'coral' })
    expect(toolDomain('find_similar_past_days')).toEqual({ label: 'Emlékek', icon: 'i-retegek', wash: 'lav' })
  })
  it('falls back honestly on an unknown tool: raw name, neutral wash', () => {
    expect(toolDomain('recallSharedMemory')).toEqual({ label: 'recallSharedMemory', icon: 'i-mezo', wash: 'neutral' })
  })
})

describe('refDomain', () => {
  it('maps ref kinds to the same domain families', () => {
    expect(refDomain('Workout').wash).toBe('coral')
    expect(refDomain('SleepLog').wash).toBe('lav')
    expect(refDomain('Pattern')).toEqual({ label: 'Minta', icon: 'i-minta', wash: 'gold' })
    expect(refDomain('Memory')).toEqual({ label: 'Emlék', icon: 'i-retegek', wash: 'lav' })
  })
  it('falls back honestly on an unknown kind', () => {
    expect(refDomain('FuelDay')).toEqual({ label: 'FuelDay', icon: 'i-mezo', wash: 'neutral' })
  })
})

describe('memoryIcon', () => {
  it('maps recalled-memory wire kinds to clay icons', () => {
    expect(memoryIcon('daily_summary')).toBe('i-nap')
    expect(memoryIcon('journal_entry')).toBe('i-naplo')
    expect(memoryIcon('weekly_summary')).toBe('i-heti')
    expect(memoryIcon('conversation')).toBe('i-mezo')
    expect(memoryIcon('checkin_note')).toBe('i-checkin')
  })
  it('falls back to the layers icon', () => {
    expect(memoryIcon('whatever_new')).toBe('i-retegek')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/insights/logic/toolDomains.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/insights/logic/toolDomains.ts
import type { ClayIconName } from '@/shared/ui/clay'

// ============================================================
// mezo-vdf4: ONE domain map for the chat's provenance layers —
// the work strip (tool names), the grouped refs footer (ref
// kinds) and the memory cards (recalled-memory kinds) must
// speak the same icon + wash language. Unknown values fall back
// honestly: raw name, neutral wash, the generic orb icon —
// nothing fabricated (the same discipline as chatRefs.ts).
// ============================================================

export type DomainWash = 'sky' | 'lav' | 'sage' | 'coral' | 'gold' | 'rose' | 'neutral'
export interface ToolDomain { label: string; icon: ClayIconName; wash: DomainWash }

const NEUTRAL = (label: string): ToolDomain => ({ label, icon: 'i-mezo', wash: 'neutral' })

/** The 17 real companion tools (backend CompanionToolRegistry inventory, 2026-08-31). */
const TOOLS: Record<string, ToolDomain> = {
  get_weight_log: { label: 'Súlynapló', icon: 'i-suly', wash: 'sky' },
  get_weight_trend: { label: 'Súlytrend', icon: 'i-suly', wash: 'sky' },
  get_recovery: { label: 'Alvás & pihenés', icon: 'i-alvas', wash: 'lav' },
  get_fuel_log: { label: 'Fuel napló', icon: 'i-fuel', wash: 'sage' },
  get_pantry: { label: 'Kamra', icon: 'i-kamra', wash: 'sage' },
  get_recipes: { label: 'Receptek', icon: 'i-recept', wash: 'sage' },
  get_training_log: { label: 'Edzésnapló', icon: 'i-edzes', wash: 'coral' },
  get_training_plan: { label: 'Edzésterv', icon: 'i-meso', wash: 'coral' },
  get_exercise_records: { label: 'Rekordok', icon: 'i-sport', wash: 'coral' },
  get_goal: { label: 'Cél', icon: 'i-cel', wash: 'gold' },
  get_growth: { label: 'Growth', icon: 'i-growth', wash: 'gold' },
  get_insights: { label: 'Összefüggések', icon: 'i-minta', wash: 'lav' },
  get_medication: { label: 'Gyógyszer', icon: 'i-injekcio', wash: 'rose' },
  get_protocol: { label: 'Stack', icon: 'i-stack', wash: 'sage' },
  get_daily_practice: { label: 'Napi gyakorlat', icon: 'i-nap', wash: 'gold' },
  find_similar_past_days: { label: 'Emlékek', icon: 'i-retegek', wash: 'lav' },
  compare_periods: { label: 'Időszak-összevetés', icon: 'i-idozito', wash: 'lav' },
}

export function toolDomain(name: string): ToolDomain {
  return TOOLS[name] ?? NEUTRAL(name)
}

/** Ref kinds (the wire's `ChatRef.kind` vocabulary — see chatRefs.ts KIND_LABELS). */
const REF_KINDS: Record<string, ToolDomain> = {
  Workout: { label: 'Edzés', icon: 'i-edzes', wash: 'coral' },
  Run: { label: 'Futás', icon: 'i-futas', wash: 'coral' },
  PR: { label: 'PR', icon: 'i-sport', wash: 'gold' },
  Pattern: { label: 'Minta', icon: 'i-minta', wash: 'gold' },
  Sleep: { label: 'Alvás', icon: 'i-alvas', wash: 'lav' },
  SleepLog: { label: 'Alvás', icon: 'i-alvas', wash: 'lav' },
  Checkin: { label: 'Check-in', icon: 'i-checkin', wash: 'rose' },
  CheckIn: { label: 'Check-in', icon: 'i-checkin', wash: 'rose' },
  Journal: { label: 'Napló', icon: 'i-naplo', wash: 'gold' },
  Meal: { label: 'Étkezés', icon: 'i-fuel', wash: 'sage' },
  GraphNode: { label: 'Összefüggés', icon: 'i-minta', wash: 'lav' },
  Memory: { label: 'Emlék', icon: 'i-retegek', wash: 'lav' },
}

export function refDomain(kind: string): ToolDomain {
  return REF_KINDS[kind] ?? NEUTRAL(kind)
}

/** Recalled-memory wire kinds (ChatRecalledMemory.kind — journal_entry/daily_summary today,
 *  the rest defensive for the recall surface's other producers). */
const MEMORY_ICONS: Record<string, ClayIconName> = {
  daily_summary: 'i-nap',
  weekly_summary: 'i-heti',
  journal_entry: 'i-naplo',
  conversation: 'i-mezo',
  checkin_note: 'i-checkin',
}

export function memoryIcon(kind: string): ClayIconName {
  return MEMORY_ICONS[kind] ?? 'i-retegek'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/insights/logic/toolDomains.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/logic/toolDomains.ts frontend/src/features/insights/logic/toolDomains.test.ts
git commit -m "feat(chat): shared tool/ref/memory domain map (mezo-vdf4)"
```

---

### Task 2: `ToolWorkStrip` — the collapsed work strip

**Files:**
- Create: `frontend/src/features/insights/components/ToolWorkStrip.tsx`
- Test: `frontend/src/features/insights/components/ToolWorkStrip.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (append to the mzc block, around line 4718 after `.mzc-cmic:disabled…`; new tokens next to `--mz-chat-*` at ~line 223 light and ~line 489 dark)

**Interfaces:**
- Consumes: `Tool` from `@/shared/ui/ToolChip` (`{ type: 'read'|'compute'|'write'; name: string; args?: string }`), `toolDomain` from Task 1, `ClayIcon` from `@/shared/ui/clay`.
- Produces: `ToolWorkStrip({ tools, live }: { tools: Tool[]; live?: boolean })` — root `<div className="mzc-tools mzc-wwrap">` (the `mzc-tools` class keeps ChatPage.test.tsx's order assertion working). Collapsed by default; `live` renders the running state (last tool pulses, label `Utánanéz…`, panel row `fut`).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/insights/components/ToolWorkStrip.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { ToolWorkStrip } from '@/features/insights/components/ToolWorkStrip'
import type { Tool } from '@/shared/ui/ToolChip'

const TOOLS: Tool[] = [
  { type: 'read', name: 'get_weight_log', args: 'days=7' },
  { type: 'read', name: 'get_recovery', args: 'days=7, scope=sleep' },
  { type: 'read', name: 'get_fuel_log', args: 'days=7, range=day' },
]

describe('ToolWorkStrip', () => {
  it('collapsed by default: human eyebrow + source count, no detail rows', () => {
    render(<ToolWorkStrip tools={TOOLS} />)
    expect(screen.getByRole('button', { name: /Utánanézett/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('3 forrás')).toBeInTheDocument()
    expect(screen.queryByText('Súlynapló')).not.toBeInTheDocument()
  })

  it('expands to human-labeled rows with raw args and a done tick', () => {
    render(<ToolWorkStrip tools={TOOLS} />)
    fireEvent.click(screen.getByRole('button', { name: /Utánanézett/ }))
    expect(screen.getByRole('button', { name: /Utánanézett/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Súlynapló')).toBeInTheDocument()
    expect(screen.getByText('days=7, scope=sleep')).toBeInTheDocument()
    expect(screen.getAllByText('✓')).toHaveLength(3)
  })

  it('unknown tool name falls back to the raw name', () => {
    render(<ToolWorkStrip tools={[{ type: 'read', name: 'recallSharedMemory' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Utánanézett/ }))
    expect(screen.getByText('recallSharedMemory')).toBeInTheDocument()
  })

  it('live mode: the working label, and the LAST source runs while earlier ones are done', () => {
    render(<ToolWorkStrip tools={TOOLS} live />)
    const strip = screen.getByRole('button', { name: /Utánanéz…/ })
    fireEvent.click(strip)
    expect(screen.getAllByText('✓')).toHaveLength(2)
    expect(screen.getByText('fut')).toBeInTheDocument()
  })

  it('renders nothing for an empty tool list', () => {
    const { container } = render(<ToolWorkStrip tools={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/insights/components/ToolWorkStrip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/features/insights/components/ToolWorkStrip.tsx
import { useState } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { toolDomain } from '@/features/insights/logic/toolDomains'
import type { Tool } from '@/shared/ui/ToolChip'

/** mezo-vdf4: the chat's tool calls as ONE human work strip instead of n raw
 *  monospace pills — overlapping domain clay icons + `Utánanézett · n forrás`,
 *  expanding to a per-source panel (human label + raw args + state). In `live`
 *  mode (the streaming turn) the label reads `Utánanéz…` and the last source is
 *  the running one — the list only ever grows during a stream, so "last = running"
 *  holds by construction. Root keeps the `mzc-tools` class: the strip sits exactly
 *  where the old ToolChipRow sat (above the answer bubble). */
const MAX_STACK_ICONS = 6

export function ToolWorkStrip({ tools, live }: { tools: Tool[]; live?: boolean }) {
  const [open, setOpen] = useState(false)
  if (tools.length === 0) return null
  const shown = tools.slice(0, MAX_STACK_ICONS)
  const extra = tools.length - shown.length
  return (
    <div className="mzc-tools mzc-wwrap col">
      <button
        type="button"
        className="mzc-wstrip"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="mzc-wstk">
          {shown.map((t, i) => {
            const d = toolDomain(t.name)
            const running = live && i === tools.length - 1
            return (
              <span key={i} className={running ? 'mzc-wic run' : 'mzc-wic'}>
                <ClayIcon name={d.icon} size={13} />
              </span>
            )
          })}
          {extra > 0 && <span className="mzc-wic mzc-wmore">+{extra}</span>}
        </span>
        <span className="mzc-wlbl">{live ? 'Utánanéz…' : 'Utánanézett'}</span>
        <span className="mzc-wsub">{tools.length} forrás</span>
        <span className="mzc-wchev" aria-hidden>{open ? '⌃' : '⌄'}</span>
      </button>
      {open && (
        <div className="mzc-wpanel">
          {tools.map((t, i) => {
            const d = toolDomain(t.name)
            const running = live && i === tools.length - 1
            return (
              <div key={i} className={running ? 'mzc-wrow run' : 'mzc-wrow'}>
                <span className={`mzc-wric dm-${d.wash}`}>
                  <ClayIcon name={d.icon} size={14} />
                </span>
                <span className="col" style={{ minWidth: 0 }}>
                  <span className="mzc-wnm">{d.label}</span>
                  {t.args && <span className="mzc-wprm">{t.args}</span>}
                </span>
                <span className="mzc-wst">{running ? <><i /> fut</> : '✓'}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Append the CSS**

New tokens — add to the light `--mz-chat-*` block (after `--mz-chat-composer-shadow`, ~line 223):

```css
  --mzc-strip-bd: rgba(93, 79, 160, 0.16);
  --mzc-strip-shadow: 0 10px 20px -12px rgba(93, 79, 160, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.75);
  --mzc-panel-bg: rgba(255, 255, 255, 0.85);
  --mzc-panel-line: rgba(93, 79, 160, 0.1);
  --mzc-tx-sky: #3E7396;
  --mzc-tx-rose: #8E3F6F;
```

And to the dark `--mz-chat-*` block (after its composer shadow, ~line 489+):

```css
  --mzc-strip-bd: color-mix(in srgb, var(--dv-lav) 30%, transparent);
  --mzc-strip-shadow: 0 10px 20px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --mzc-panel-bg: color-mix(in srgb, var(--surface-elevated) 88%, transparent);
  --mzc-panel-line: color-mix(in srgb, var(--dv-lav) 22%, transparent);
  --mzc-tx-sky: #9CC3DC;
  --mzc-tx-rose: #E3A8C8;
```

Component CSS — append right after `.mzc-cmic:disabled, .mzc-csend:disabled { … }` (~line 4715):

```css
/* ===== mezo-vdf4: munkacsík — a tool-hívások egyetlen emberi sora ===== */
/* Domain wash + deep text pairs — shared by the work panel and the grouped refs. */
.dm-sky   { --dmw: var(--mz-wash-sky);   --dmtx: var(--mzc-tx-sky); }
.dm-lav   { --dmw: var(--mz-wash-lav);   --dmtx: var(--lav-deep); }
.dm-sage  { --dmw: var(--mz-wash-sage);  --dmtx: var(--sage-deep); }
.dm-coral { --dmw: var(--mz-wash-coral); --dmtx: var(--coral-deep); }
.dm-gold  { --dmw: var(--mz-wash-gold);  --dmtx: var(--amber-deep); }
.dm-rose  { --dmw: var(--mz-wash-rose);  --dmtx: var(--mzc-tx-rose); }
.dm-neutral { --dmw: var(--mz-wash-white); --dmtx: var(--text-secondary); }
.mzc-wwrap { align-items: flex-start; gap: 0; margin-bottom: 10px; }
.mzc-wstrip {
  display: flex; align-items: center; gap: 6px; max-width: 100%; cursor: pointer;
  border: 0.5px solid var(--mzc-strip-bd); font-family: inherit;
  border-radius: 999px; padding: 5px 12px 5px 6px;
  background: var(--mz-wash-lav); box-shadow: var(--mzc-strip-shadow);
}
.mzc-wstk { display: flex; flex: none; }
.mzc-wic {
  width: 22px; height: 22px; border-radius: 50%; flex: none; position: relative;
  background: var(--surface-card); display: grid; place-items: center;
  box-shadow: 0 2px 5px rgba(43, 33, 24, 0.12), 0 0 0 1.5px var(--mz-wash-white);
}
.mzc-wic + .mzc-wic { margin-left: -7px; }
.mzc-wic.run { animation: mzc-livepulse 1.1s ease-in-out infinite; }
.mzc-wmore { font-size: 8px; font-weight: 800; color: var(--lav-deep); }
.mzc-wlbl { font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--lav-deep); margin-left: 3px; white-space: nowrap; }
.mzc-wsub { font-size: 9.5px; color: var(--text-tertiary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.mzc-wchev { font-size: 10px; color: var(--mz-chat-memline); }
.mzc-wpanel {
  align-self: stretch; margin-top: 6px; border-radius: 14px; padding: 3px 12px;
  background: var(--mzc-panel-bg); border: 0.5px solid var(--mzc-panel-line);
  box-shadow: 0 12px 22px -14px rgba(93, 79, 160, 0.4);
}
.mzc-wrow { display: flex; align-items: center; gap: 9px; padding: 7px 0; }
.mzc-wrow + .mzc-wrow { border-top: 0.5px solid var(--mzc-panel-line); }
.mzc-wric {
  width: 24px; height: 24px; border-radius: 8px; flex: none; background: var(--dmw);
  display: grid; place-items: center; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.mzc-wnm { font-size: 11px; font-weight: 700; line-height: 1.2; color: var(--text-primary); }
.mzc-wprm { font-size: 9px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.mzc-wst { margin-left: auto; font-size: 9px; font-weight: 800; color: var(--sage-deep); flex: none; display: flex; align-items: center; }
.mzc-wrow.run .mzc-wst { color: var(--lav-deep); }
.mzc-wrow.run .mzc-wst i {
  display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--lav-deep);
  margin-right: 4px; animation: mzc-livepulse 1.1s ease-in-out infinite;
}
@keyframes mzc-livepulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(138, 118, 204, 0.45); }
  50% { box-shadow: 0 0 0 4px rgba(138, 118, 204, 0.15); }
}
```

And extend the existing reduced-motion guard next to `.mzc-cmic, .mzc-csend { transition: none; }`:

```css
  .mzc-wic.run, .mzc-wrow.run .mzc-wst i { animation: none; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/insights/components/ToolWorkStrip.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights/components/ToolWorkStrip.tsx frontend/src/features/insights/components/ToolWorkStrip.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(chat): ToolWorkStrip — collapsed human work strip for tool calls (mezo-vdf4)"
```

---

### Task 3: ChatMessage — work strip swap + domain-grouped refs

**Files:**
- Modify: `frontend/src/features/insights/components/ChatMessage.tsx`
- Modify: `frontend/src/features/insights/components/ChatMessage.test.tsx` (add grouping tests)
- Modify: `frontend/src/styles/prototype.css` (refs CSS after the Task 2 block)

**Interfaces:**
- Consumes: `ToolWorkStrip` (Task 2), `refDomain` (Task 1), existing `chatRefDisplay`.
- Produces: unchanged `ChatMessage` signature. DOM contract for tests: full ref chips keep `mzc-refch`/`mzc-refk` classes; group chips are `button.mzc-refg` with `aria-expanded`; the footer eyebrow text becomes `Amire épült · L3`.

- [ ] **Step 1: Write the failing tests** (append to ChatMessage.test.tsx)

```tsx
import { fireEvent } from '@testing-library/react'
import type { ChatMessage as ChatMessageT } from '@/data/types'

describe('ChatMessage (grouped refs, mezo-vdf4)', () => {
  const manyRefs: ChatMessageT = {
    id: 'm-g1', role: 'assistant', ts: '11:25', text: 'Válasz.',
    refs: [
      { kind: 'Sleep', id: 'sleep-2026-08-25' },
      { kind: 'Sleep', id: 'sleep-2026-08-26' },
      { kind: 'Sleep', id: 'sleep-2026-08-27' },
      { kind: 'Workout', id: 'w-2026-08-26' },
    ],
  }

  it('more than 3 refs: one group chip per kind with a count, no full chips yet', () => {
    render(<ChatMessage m={manyRefs} />)
    expect(screen.getByRole('button', { name: /Alvás.*×3/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Edzés.*×1/ })).toBeInTheDocument()
    expect(document.querySelectorAll('.mzc-refch')).toHaveLength(0)
  })

  it('tapping a group expands ONLY that group into full chips', () => {
    render(<ChatMessage m={manyRefs} />)
    fireEvent.click(screen.getByRole('button', { name: /Alvás.*×3/ }))
    expect(document.querySelectorAll('.mzc-refch')).toHaveLength(3)
    expect(screen.getByText('aug. 25.')).toBeInTheDocument()
    // opening the other group closes the first
    fireEvent.click(screen.getByRole('button', { name: /Edzés.*×1/ }))
    expect(document.querySelectorAll('.mzc-refch')).toHaveLength(1)
    expect(screen.getByText('aug. 26.')).toBeInTheDocument()
  })

  it('3 or fewer refs render as full chips immediately, no group buttons', () => {
    render(
      <ChatMessage
        m={{ id: 'm-g2', role: 'assistant', ts: '11:25', text: 'V.', refs: [
          { kind: 'Pattern', id: 'p-x', label: 'gyógyszer × étvágy' },
          { kind: 'Sleep', id: 'sleep-2026-08-25' },
        ] }}
      />,
    )
    expect(document.querySelectorAll('.mzc-refg')).toHaveLength(0)
    expect(document.querySelectorAll('.mzc-refch')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd frontend && pnpm vitest run src/features/insights/components/ChatMessage.test.tsx`
Expected: the three new tests FAIL (no group buttons, eyebrow differs); the old ones pass.

- [ ] **Step 3: Implement in ChatMessage.tsx**

Replace the `ToolChipRow` import + usage and the refs footer. The component gains one
piece of state, so the assistant branch moves into a small inner component (hooks can't
sit behind the early `user` return):

```tsx
import { useState } from 'react'
import { Markdown } from '@/shared/lib/markdown'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { RecalledMemoriesRow } from '@/features/insights/components/RecalledMemoriesRow'
import { ToolWorkStrip } from '@/features/insights/components/ToolWorkStrip'
import { chatRefDisplay } from '@/features/insights/logic/chatRefs'
import { refDomain } from '@/features/insights/logic/toolDomains'
import type { ChatRef } from '@/data/types'
```

The refs footer render (inside the assistant bubble, replacing the current
`visibleRefs.length > 0 && …` block — `visibleRefs` computation and the Memory dedupe
comment stay EXACTLY as they are):

```tsx
{visibleRefs.length > 0 && <RefsFooter refs={visibleRefs} />}
```

New component in the same file (below ChatMessage):

```tsx
/** mezo-vdf4: >3 refs group by kind into wash chips (`Alvás ×3`) that expand one group
 *  at a time; ≤3 render as full chips immediately. Full chips keep the mzc-refch/mzc-refk
 *  classes — the pre-existing tests (and the human-label contract, gap 7) key off them. */
function RefsFooter({ refs }: { refs: ChatRef[] }) {
  const [openKind, setOpenKind] = useState<string | null>(null)
  const grouped = refs.length > 3
  const kinds = grouped
    ? [...new Map(refs.map((r) => [r.kind, r] as const)).keys()]
    : []
  const fullChips = (list: ChatRef[]) =>
    list.map((r, i) => {
      const d = chatRefDisplay(r)
      const dm = refDomain(r.kind)
      return (
        <span key={i} className={`mzc-refch dm-${dm.wash}`}>
          <span className="mzc-refic"><ClayIcon name={dm.icon} size={11} /></span>
          <b className="mzc-refk">{d.kind}</b>
          {d.label}
        </span>
      )
    })
  return (
    <div className="mzc-reffoot">
      <span className="mzc-refeb">Amire épült · L3</span>
      {grouped ? (
        <>
          <div className="mzc-refrow">
            {kinds.map((kind) => {
              const dm = refDomain(kind)
              const count = refs.filter((r) => r.kind === kind).length
              const open = openKind === kind
              return (
                <button
                  key={kind}
                  type="button"
                  className={`mzc-refg dm-${dm.wash}${open ? ' on' : ''}`}
                  aria-expanded={open}
                  onClick={() => setOpenKind(open ? null : kind)}
                >
                  <span className="mzc-refic"><ClayIcon name={dm.icon} size={11} /></span>
                  {chatRefDisplay({ kind, id: '' }).kind}
                  <span className="mzc-refn">×{count}</span>
                </button>
              )
            })}
          </div>
          {openKind && (
            <div className="mzc-refrow mzc-refdates">
              {fullChips(refs.filter((r) => r.kind === openKind))}
            </div>
          )}
        </>
      ) : (
        <div className="mzc-refrow">{fullChips(refs)}</div>
      )}
    </div>
  )
}
```

Note: `chatRefDisplay({ kind, id: '' }).kind` reuses the existing kind→Hungarian map with
no new lookup table; the empty id is never rendered.

Swap the tool row: `{m.tools && <ToolChipRow tools={m.tools} className="mzc-tools" />}` →
`{m.tools && <ToolWorkStrip tools={m.tools} />}` and delete the ToolChipRow import.

- [ ] **Step 4: Append the refs CSS** (after the Task 2 block in prototype.css)

```css
/* ===== mezo-vdf4: hivatkozások — domain-csoportok ===== */
.mzc-refch {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--dmw, var(--mz-chat-refch-bg));
  border: 0.5px solid var(--mz-chat-refch-bd); color: var(--dmtx, var(--text-secondary));
}
.mzc-refic {
  width: 16px; height: 16px; border-radius: 50%; flex: none;
  background: var(--surface-card); display: grid; place-items: center;
}
.mzc-refg {
  display: inline-flex; align-items: center; gap: 4px; border: none; cursor: pointer;
  font-family: inherit; border-radius: 999px; padding: 3px 10px 3px 4px;
  font-size: 10px; font-weight: 700; background: var(--dmw); color: var(--dmtx);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 4px 10px -6px rgba(43, 33, 24, 0.3);
}
.mzc-refg .mzc-refn { font-variant-numeric: tabular-nums; font-weight: 800; opacity: 0.75; }
.mzc-refg.on { box-shadow: inset 0 0 0 1.2px var(--dmtx), 0 4px 10px -6px rgba(43, 33, 24, 0.3); }
.mzc-refdates { margin-top: 6px; }
```

(The existing `.mzc-refch` rule at ~line 4677 keeps its font/radius/padding lines; merge —
the new `background`/`color` lines replace the old literal ones so the wash var wins, and
`.mzc-refk` gets `color: var(--dmtx, var(--text-primary));` so the kind name follows the wash.)

- [ ] **Step 5: Run the full ChatMessage + chips + ChatPage tests**

Run: `cd frontend && pnpm vitest run src/features/insights/components/ChatMessage.test.tsx src/shared/ui/chips.test.tsx src/features/insights/pages/ChatPage.test.tsx`
Expected: ChatMessage PASS. ChatPage may fail on tool-pill text assertions (raw
`get_recent_workouts` names no longer visible collapsed) — fix those assertions to expect
the strip instead: `screen.getByRole('button', { name: /Utánanézett/ })` where the old test
looked for tool chip text, and keep the `.mzc-tools`-before-bubble order assertion (the
strip root carries that class). Do NOT weaken unrelated assertions.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights/components/ChatMessage.tsx frontend/src/features/insights/components/ChatMessage.test.tsx frontend/src/features/insights/pages/ChatPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(chat): work strip in ChatMessage + domain-grouped refs footer (mezo-vdf4)"
```

---

### Task 4: RecalledMemoriesRow — horizontal card strip

**Files:**
- Modify: `frontend/src/features/insights/components/RecalledMemoriesRow.tsx`
- Test: `frontend/src/features/insights/components/RecalledMemoriesRow.test.tsx` (create)
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `memoryIcon` (Task 1), `ClayIcon`, `ChatRecalledMemory` (`{ occurredOn, kind, label, gist, similarity }`).
- Produces: same component signature `RecalledMemoriesRow({ items })`. Toggler text becomes `✦ Emlékek · n`; cards are `button.mzc-memcard`, expanding via the `open` class.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/insights/components/RecalledMemoriesRow.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { RecalledMemoriesRow } from '@/features/insights/components/RecalledMemoriesRow'
import type { ChatRecalledMemory } from '@/data/types'

const ITEMS: ChatRecalledMemory[] = [
  { occurredOn: '2026-08-29', kind: 'daily_summary', label: 'napi összefoglaló', gist: 'A napod nehezen indult…', similarity: 0.73 },
  { occurredOn: '2026-08-25', kind: 'journal_entry', label: 'napló', gist: 'Fejlesztem az appomat…', similarity: 0.65 },
]

describe('RecalledMemoriesRow (card strip, mezo-vdf4)', () => {
  it('collapsed by default — toggler names the count, no cards', () => {
    render(<RecalledMemoriesRow items={ITEMS} />)
    expect(screen.getByRole('button', { name: /Emlékek · 2/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/nehezen indult/)).not.toBeInTheDocument()
  })

  it('expands to one card per memory with label, date and similarity percent', () => {
    render(<RecalledMemoriesRow items={ITEMS} />)
    fireEvent.click(screen.getByRole('button', { name: /Emlékek · 2/ }))
    expect(screen.getByText('napi összefoglaló')).toBeInTheDocument()
    expect(screen.getByText('2026-08-29')).toBeInTheDocument()
    expect(screen.getByText('73')).toBeInTheDocument()
    expect(screen.getByText(/nehezen indult/)).toBeInTheDocument()
  })

  it('a card expands on tap (open class releases the clamp)', () => {
    render(<RecalledMemoriesRow items={ITEMS} />)
    fireEvent.click(screen.getByRole('button', { name: /Emlékek · 2/ }))
    const card = screen.getByText(/nehezen indult/).closest('.mzc-memcard')!
    fireEvent.click(card)
    expect(card.classList.contains('open')).toBe(true)
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<RecalledMemoriesRow items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run to verify the card tests fail**

Run: `cd frontend && pnpm vitest run src/features/insights/components/RecalledMemoriesRow.test.tsx`
Expected: FAIL (no cards, no aria-expanded, old list DOM).

- [ ] **Step 3: Rewrite the component's expanded branch**

```tsx
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { memoryIcon } from '@/features/insights/logic/toolDomains'
import type { ChatRecalledMemory } from '@/data/types'

/** W3.1b (mezo-b3pp.28): what ambient recall put in front of the model before it answered —
 *  collapsed by default (the answer is the point; this is its provenance). mezo-vdf4 face:
 *  the expanded rows became a horizontally scrollable lavender card strip (type icon + date
 *  + similarity ring + clamped gist; a tapped card widens and unclamps). Copy and disclosure
 *  behavior are unchanged. */
export function RecalledMemoriesRow({ items }: { items: ChatRecalledMemory[] }) {
  const [open, setOpen] = useState(false)
  const [openCard, setOpenCard] = useState<number | null>(null)
  if (items.length === 0) return null
  return (
    <div className="mzc-memwrap col gap-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mzc-membtn row gap-xs"
        title="Ezekre emlékezett a társ a válasz előtt (W3.1 ambient recall)"
        aria-expanded={open}
      >
        <span className="mzc-memeb">✦ Emlékek · {items.length}</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={10} color="var(--text-tertiary)" />
      </button>
      {open && (
        <div className="mzc-memcards">
          {items.map((r, i) => (
            <button
              key={i}
              type="button"
              className={openCard === i ? 'mzc-memcard open' : 'mzc-memcard'}
              onClick={() => setOpenCard(openCard === i ? null : i)}
            >
              <span className="mzc-memtop">
                <span className="mzc-memic"><ClayIcon name={memoryIcon(r.kind)} size={13} /></span>
                <span className="mzc-memkt">
                  <span className="mzc-memkind">{r.label}</span>
                  <span className="mzc-memd">{r.occurredOn}</span>
                </span>
                <span
                  className="mzc-simr"
                  style={{ ['--v' as string]: Math.round(r.similarity * 100) }}
                  data-l={Math.round(r.similarity * 100)}
                />
              </span>
              <span className="mzc-memgist">{r.gist}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Append the CSS** (after the Task 3 block; the old `.mzc-memlist` rules can be deleted — nothing else uses them; keep `.mzc-membtn`/`.mzc-memeb`)

```css
/* ===== mezo-vdf4: emlékek — vízszintes kártyasor ===== */
.mzc-memeb { color: var(--lav-deep); }
.mzc-memcards { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 7px 2px 12px; margin: 0 -2px; }
.mzc-memcards::-webkit-scrollbar { display: none; }
.mzc-memcard {
  flex: none; width: 168px; border-radius: 14px; padding: 9px 10px; cursor: pointer;
  text-align: left; font-family: inherit; border: 0.5px solid var(--mzc-strip-bd);
  background: var(--mz-wash-lav); box-shadow: var(--mzc-strip-shadow);
  display: flex; flex-direction: column; gap: 6px;
  transition: width 0.25s cubic-bezier(0.25, 0.8, 0.35, 1);
}
.mzc-memtop { display: flex; align-items: center; gap: 6px; }
.mzc-memic {
  width: 22px; height: 22px; border-radius: 7px; flex: none;
  background: var(--surface-card); display: grid; place-items: center;
  box-shadow: 0 2px 5px rgba(43, 33, 24, 0.08);
}
.mzc-memkt { display: flex; flex-direction: column; min-width: 0; }
.mzc-memkind { font-size: 7.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--lav-deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mzc-memd { font-size: 9px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.mzc-simr {
  width: 22px; height: 22px; border-radius: 50%; flex: none; margin-left: auto;
  display: grid; place-items: center;
  background: conic-gradient(var(--lav, #8A76CC) calc(var(--v) * 1%), rgba(43, 33, 24, 0.08) 0);
}
.mzc-simr::after {
  content: attr(data-l); width: 16px; height: 16px; border-radius: 50%;
  background: var(--surface-card); display: grid; place-items: center;
  font-size: 6.5px; font-weight: 800; color: var(--lav-deep); font-variant-numeric: tabular-nums;
}
.mzc-memgist {
  font-size: 10.5px; font-weight: 300; line-height: 1.45; color: var(--text-primary);
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
}
.mzc-memcard.open { width: 252px; }
.mzc-memcard.open .mzc-memgist { -webkit-line-clamp: unset; }
```

Reduced-motion guard addition: `.mzc-memcard { transition: none; }`.

- [ ] **Step 5: Run the tests**

Run: `cd frontend && pnpm vitest run src/features/insights/components/RecalledMemoriesRow.test.tsx src/features/insights/components/ChatMessage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights/components/RecalledMemoriesRow.tsx frontend/src/features/insights/components/RecalledMemoriesRow.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(chat): recalled memories as a horizontal card strip (mezo-vdf4)"
```

---

### Task 5: ChatPage — orb-led live header + live work strip

**Files:**
- Modify: `frontend/src/features/insights/pages/ChatPage.tsx`
- Modify: `frontend/src/features/insights/pages/ChatPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `ToolWorkStrip` (live mode), `ClaySpot`, existing hooks unchanged.
- Produces: header DOM — `div.mzc-chathead` with `‹` back disc (aria-label `Vissza`), orb, `Mezo` name, `span.mzc-hstat[data-st]` status, icon discs keeping aria-labels `Beszélgetések` and `Új beszélgetés` (existing tests key on these).

- [ ] **Step 1: Adjust/extend ChatPage tests first**

Update header-related assertions and add new ones (keep every behavioral test intact —
only selectors move):

```tsx
it('renders the orb-led header with the live status', async () => {
  renderChat()                                   // use the file's existing helper
  expect(await screen.findByLabelText('Vissza')).toBeInTheDocument()
  expect(screen.getByText('Mezo')).toBeInTheDocument()
  // mock mode → demo status text (subtitle precedence unchanged)
  expect(screen.getByText('demo beszélgetés')).toBeInTheDocument()
  expect(document.querySelector('.mzc-hstat')).toHaveAttribute('data-st', 'demo')
})

it('busy turn flips the status to dolgozom rajta…', async () => {
  // reuse the file's existing streaming-turn setup; while `turn` is truthy:
  expect(screen.getByText('dolgozom rajta…')).toBeInTheDocument()
})
```

`Mezo · társ` / `.mzc-chsub` assertions are removed with the element. The
`Beszélgetések` / `Új beszélgetés` label-based tests stay untouched.

- [ ] **Step 2: Run to see the new assertions fail**

Run: `cd frontend && pnpm vitest run src/features/insights/pages/ChatPage.test.tsx`
Expected: new header tests FAIL, everything else PASS.

- [ ] **Step 3: Implement the header in ChatPage.tsx**

Replace the `<PageHead …>…</PageHead>` + `<div className="mzc-chsub">…</div>` pair with:

```tsx
{/* mezo-vdf4: orb-led single-row header (ADR 0032 still holds — this IS the page's own
    header; the shell AppHeader stays above). Status precedence is the audited contract
    unchanged (degraded → new → mode), with one addition: a streaming turn reads
    `dolgozom rajta…`. */}
<div className="mzc-chathead">
  <button type="button" className="mzc-hdisc" onClick={() => navigate('/mezo')} aria-label="Vissza">
    ‹
  </button>
  <span className={cn('mzc-horb', turn && 'busy')}>
    <ClaySpot name="s-orb" size={34} />
  </span>
  <span className="col grow" style={{ gap: 1, minWidth: 0 }}>
    <span className="mzc-hnm">Mezo</span>
    <span
      className="mzc-hstat"
      data-st={degraded ? 'off' : turn ? 'busy' : isNew ? 'new' : mode === 'live' ? 'live' : 'demo'}
    >
      <span className="mzc-hdot" />
      {turn
        ? 'dolgozom rajta…'
        : degraded ? 'a társ most nem elérhető' : isNew ? 'új beszélgetés' : SUBTITLE[mode]}
    </span>
  </span>
  <button
    type="button"
    className="mzc-hdisc"
    onClick={() => setPickerOpen(true)}
    disabled={degraded}
    aria-label="Beszélgetések"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  </button>
  <button
    type="button"
    className="mzc-hdisc"
    onClick={() => selectConversation(NEW_CHAT)}
    disabled={degraded || isNew}
    aria-label="Új beszélgetés"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  </button>
</div>
```

`SUBTITLE` map: change `live: 'Gemini · élő'` → `live: 'élő · Gemini'` (prototype copy),
keep `mock: 'demo beszélgetés'`. Drop the now-unused `PageHead` import.

The streaming turn's tool chips swap to the live strip — in the turn render block replace
`...(turn.tools.length > 0 ? { tools: turn.tools } : {})` handling: the in-flight
assistant `ChatMessage` keeps receiving `tools` (it renders the strip non-live once the
draft streams), but while `!turn.draft` render the live strip next to the dots:

```tsx
{turn && !turn.draft && (
  <div className="mzc-msg-a col gap-sm">
    {turn.tools.length > 0 && <ToolWorkStrip tools={turn.tools} live />}
    <ThinkingDots />
  </div>
)}
```

and change the `ThinkingDots`-only line accordingly (ThinkingDots itself loses no
behavior; the mezo-280 gating comment moves with the block). The existing
`turn && !turn.thinking && (turn.draft || turn.tools.length > 0)` ChatMessage render
gains `live` semantics for its strip by passing the tools through unchanged — ChatMessage
renders them with `<ToolWorkStrip tools={…} />` (not live: the draft is already
streaming, sources are done).

Guard against double-render: when `!turn.draft`, the second block must NOT also render
(`turn.draft || turn.tools.length > 0` would fire on tools alone) — tighten that
condition to `turn && !turn.thinking && turn.draft` so the tools-only phase shows ONLY
the live strip + dots.

- [ ] **Step 4: Append the header CSS**

```css
/* ===== mezo-vdf4: orb-vezette chat fejléc ===== */
.mzc-chathead { display: flex; align-items: center; gap: 9px; padding: 2px 19px 0; }
.mzc-hdisc {
  width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; flex: none;
  font-family: inherit; font-size: 15px; color: var(--text-primary); padding: 0;
  background: var(--surface-card); display: grid; place-items: center;
  box-shadow: 0 6px 14px -8px rgba(43, 33, 24, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.mzc-hdisc:disabled { opacity: 0.5; cursor: default; }
.mzc-hdisc:active:not(:disabled) { transform: scale(0.92); }
.mzc-horb { position: relative; width: 38px; height: 38px; flex: none; display: grid; place-items: center; }
.mzc-horb svg { animation: mzc-orbbreathe 4.5s ease-in-out infinite; }
.mzc-horb.busy svg { animation: mzc-orbthink 1.1s ease-in-out infinite; }
.mzc-horb.busy::before {
  content: ''; position: absolute; inset: -2px; border-radius: 50%;
  border: 1.5px solid rgba(138, 118, 204, 0.55); animation: mzc-halo 1.3s ease-out infinite;
}
@keyframes mzc-orbbreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes mzc-orbthink { 0%, 100% { transform: scale(0.97); } 50% { transform: scale(1.1); } }
@keyframes mzc-halo { from { transform: scale(0.82); opacity: 0.9; } to { transform: scale(1.28); opacity: 0; } }
.mzc-hnm { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; color: var(--text-primary); }
.mzc-hstat { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--text-secondary); }
.mzc-hdot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--sage-deep); }
.mzc-hstat[data-st="live"] .mzc-hdot { animation: mzc-livepulse 2.4s ease-in-out infinite; }
.mzc-hstat[data-st="demo"] .mzc-hdot { background: var(--text-tertiary); }
.mzc-hstat[data-st="off"] .mzc-hdot { background: var(--amber-deep); }
.mzc-hstat[data-st="new"] .mzc-hdot { background: var(--lav-deep); }
.mzc-hstat[data-st="busy"] .mzc-hdot { background: var(--lav-deep); animation: mzc-livepulse 1.2s ease-in-out infinite; }
```

Reduced-motion guard addition:
`.mzc-horb svg, .mzc-horb.busy svg, .mzc-horb.busy::before, .mzc-hstat .mzc-hdot { animation: none; }`

Also delete the now-dead `.mzc-chsub`/`.mzc-pgact` chat rules ONLY if nothing else uses
them — `grep -rn "mzc-pgact\|mzc-chsub" frontend/src` first; `mz-page-head .mzc-pgact`
(line ~6701) suggests other pages share `.mzc-pgact`, in which case leave it.

- [ ] **Step 5: Run the ChatPage tests + composer polish**

Composer sheen (same commit, CSS only): in `.mzc-composer` change `background: …` to
`background: linear-gradient(150deg, var(--surface-card), var(--mz-wash-white) 60%, color-mix(in srgb, var(--dv-lav) 7%, var(--surface-card)));`
and mic rec state to coral: `.mzc-cmic.rec { background: rgba(255, 107, 74, 0.16); color: var(--coral-deep); }`.

Feedback chips polish (same commit, CSS only — spec §5, no component change): find the
chat FeedbackChips rules (`grep -n "fbc\|feedback" frontend/src/styles/prototype.css`,
the chat variant near the mzc block) and soften them: font-size one step down, background
`rgba(255, 255, 255, 0.55)` (dark: `color-mix(in srgb, var(--surface-elevated) 55%, transparent)`
via a token if the block is tokenized), text `var(--text-tertiary)`, hover →
`var(--text-secondary)`; the selected state keeps its current lav treatment.

Run: `cd frontend && pnpm vitest run src/features/insights/pages/ChatPage.test.tsx src/features/insights`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights/pages/ChatPage.tsx frontend/src/features/insights/pages/ChatPage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(chat): orb-led live header + streaming work strip (mezo-vdf4)"
```

---

### Task 6: FAB gating on the chat route

**Files:**
- Modify: `frontend/src/app/AppLayout.tsx:31` (the `hideChrome` block)
- Test: `frontend/src/app/navigation.test.tsx` (append)

**Interfaces:**
- Consumes: nothing new. Produces: no FAB on `/mezo/chat`; header/tab bar unchanged there.

- [ ] **Step 1: Write the failing test** (append to navigation.test.tsx, reusing the file's router-render helper)

```tsx
it('hides the quick-log FAB on the chat page but keeps the tab bar', async () => {
  // navigate the app router to /mezo/chat the same way the existing tests do
  expect(screen.queryByLabelText('Gyors logolás')).not.toBeInTheDocument()
  expect(screen.getByRole('navigation')).toBeInTheDocument() // tab bar stays
})
```

(If the tab bar has no `navigation` role in this app, assert on an existing tab label
instead, e.g. `screen.getByText('Edzés')` — check the file's idiom.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm vitest run src/app/navigation.test.tsx`
Expected: the new test FAILS (FAB present).

- [ ] **Step 3: Implement in AppLayout.tsx**

```tsx
  const hideChrome = ['/train/session', '/me/sleep/night', '/ritual'].includes(location.pathname)
  // mezo-vdf4: the chat's composer owns the thumb zone — the coral FAB overlapped the
  // send disc there. Chat keeps the rest of the chrome (header, tab bar).
  const hideFab = hideChrome || location.pathname === '/mezo/chat'
```

and `{!hideChrome && <QuickLogFab />}` → `{!hideFab && <QuickLogFab />}`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && pnpm vitest run src/app/navigation.test.tsx src/app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/AppLayout.tsx frontend/src/app/navigation.test.tsx
git commit -m "feat(chat): hide the quick-log FAB on /mezo/chat (mezo-vdf4)"
```

---

### Task 7: Gates, visual verify, push

- [ ] **Step 1: Full frontend gates, both modes + build**

```bash
cd frontend && pnpm vitest run && VITE_USE_MOCK=false pnpm vitest run && pnpm build
```
Expected: all green. (Memory `vite-use-mock-unset-means-mock`: the explicit
`VITE_USE_MOCK=false` run is the real-mode gate.)

- [ ] **Step 2: Lint**

Run: `cd frontend && pnpm lint`
Expected: clean.

- [ ] **Step 3: Runtime visual verify**

Use the `verify` skill (mock-mode PWA recipe) — navigate to `/mezo/chat`, screenshot:
header single row with orb + status, work strip collapsed on the seeded answer, tap to
expand, refs (2 in mock → full chips with icons), Emlékek toggler → card strip, send a
message → live strip build + `dolgozom rajta…`, no FAB. Compare against
`docs/design_2.0/prototypes/mezo-chat.html`.

- [ ] **Step 4: Close out**

```bash
bd close mezo-vdf4
git pull --rebase && bd dolt push && git push
git status   # MUST show "up to date with origin"
```

Then open the self-PR (CI gate) per the house git workflow.
