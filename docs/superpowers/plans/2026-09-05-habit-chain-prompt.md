# Habit chain prompt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user ticks a habit that another habit is stacked onto (`anchorHabitKey`), the dependent habit gets a persistent "Most jön" highlight on the Nap surface — the habit-stacking framework finally pays off at runtime.

**Architecture:** Frontend-only, catalog-driven. A new pure function `nextInChain(catalog, habits, tickedKey)` in `frontend/src/features/today/logic/chainPrompt.ts` resolves the dependent habit from `HabitCatalog.chains[].defs[].anchorHabitKey`, which the client already loads. Both Nap tick handlers call it from the state as it stood **before** the check and store the result in a page-local `promptKey` state; the render *derives* the highlight from that key, so it self-clears. No backend change, no contract change.

**Tech Stack:** React 18 + TypeScript, vitest + @testing-library/react + userEvent, pnpm. Styles live in `frontend/src/styles/prototype.css`.

**Spec:** `docs/superpowers/specs/2026-09-05-habit-chain-prompt-design.md`

## Global Constraints

- **bd issue:** `mezo-3zue.6`. Every commit subject carries it: `feat(habit): ... (mezo-3zue.6)`.
- **Commit trailer:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **All commands run from the worktree root** `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/habit-chain-prompt`. Never `cd` to the primary repo — it sits on `main`.
- **Frontend tests must be run in BOTH modes, explicitly:** `VITE_USE_MOCK=true pnpm test` AND `VITE_USE_MOCK=false pnpm test`. An unset `VITE_USE_MOCK` means mock mode, so a bare `pnpm test` runs mock twice and the real-mode arm is vacuous. Typecheck separately with `pnpm exec tsc -b`. There is no local eslint.
- **No backend change and no contract change in this plan.** If you find yourself editing `api/feature/habit/habit.yml`, `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`, or anything under `backend/`, stop — you have left the plan.
- **The tick handlers must compute the candidate BEFORE calling `check()`**, from the pre-tick `habits` array. This is the rule `frontend/src/features/today/logic/chainMilestone.ts` defends in its own file header: a mounted state-watcher re-fires on every mount, and that bug class was already deleted from this repo once.
- **Candidate ordering uses `HabitItem.position`** (the day row), not the catalog def's `position`. The catalog def objects in the test stubs carry only the fields the page reads, and the day row's position is always present in both mock and real data.
- **Copy is Hungarian.** The highlight label is exactly `Most jön`.
- **Doc mandate:** a habit change updates `docs/features/habit.md` §2/§3/§9/§10 with the front-matter `updated:` field. Then run `node scripts/gen-codemap.mjs` (the codemap freshness gate fails on a changed doc front-matter alone, not only on new files) and `node scripts/lint-docs.mjs --errors-only`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `frontend/src/features/today/logic/chainPrompt.ts` | **Create.** The single pure rule: which habit (if any) is prompted by ticking a given key. | 1 |
| `frontend/src/features/today/logic/chainPrompt.test.ts` | **Create.** Unit tests for the rule, including fan-out, cycles, and the silence cases. | 1 |
| `frontend/src/features/today/pages/NapRutinPage.tsx` | **Modify.** `tickAction` records the candidate; the row render derives the highlight. | 2 |
| `frontend/src/styles/prototype.css` | **Modify.** Page-local `.nr-row.now` + `.nr-nowtag` styling. | 2 |
| `frontend/src/features/today/pages/NapRutinPage.test.tsx` | **Modify.** Highlight appears / stays silent / toast unchanged. | 2 |
| `frontend/src/features/today/pages/NapHubPage.tsx` | **Modify.** `tileTick` records the candidate; `habitTile` prefers it when picking `next`. | 3 |
| `frontend/src/features/today/pages/NapHubPage.test.tsx` | **Modify.** Tile shows the chained habit, not the next-by-order one. | 3 |
| `frontend/src/data/habit/habitMock.ts` | **Modify.** Seed one honest anchored pair so mock mode is not blind. | 4 |
| `frontend/src/data/habit/habitMock.test.ts` | **Modify.** Seed invariant for the pair. | 4 |
| `frontend/src/data/habit/habitHooks.ts` | **Modify.** Stale NOTE naming the deleted `TodayPage` as a caller. | 4 |
| `docs/features/habit.md` | **Modify.** §2/§3/§9/§10 + front-matter `updated:`. | 5 |

---

### Task 1: The rule — `chainPrompt.ts`

**Files:**
- Create: `frontend/src/features/today/logic/chainPrompt.ts`
- Test: `frontend/src/features/today/logic/chainPrompt.test.ts`

**Interfaces:**
- Consumes: `HabitCatalog`, `HabitItem` from `@/data/types`; `habitAction` from `@/features/today/logic/habitAction`.
- Produces: `export function nextInChain(catalog: HabitCatalog, habits: HabitItem[], tickedKey: string): HabitItem | null` — used by Task 2 and Task 3.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/today/logic/chainPrompt.test.ts`:

```ts
import { nextInChain } from '@/features/today/logic/chainPrompt'
import type { HabitCatalog, HabitDefInfo, HabitItem } from '@/data/types'

/** Only the fields the rule reads — the page's own catalog stubs are equally partial. */
const def = (habitKey: string, anchorHabitKey: string | null): Partial<HabitDefInfo> =>
  ({ habitKey, anchorHabitKey })

const catalogOf = (...defs: Partial<HabitDefInfo>[]): HabitCatalog => ({
  chains: [{
    id: 'c-m', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
    position: 1, isActive: true, defs,
  }] as unknown as HabitCatalog['chains'],
})

const row = (key: string, over: Partial<HabitItem> = {}): HabitItem => ({
  key, chain: 'MORNING', position: 1, title: key, why: '', anchorCopy: null,
  mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: null, ...over,
} as HabitItem)

test('a horgonyra kötött nyitott szokást adja vissza', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  const habits = [row('a', { position: 1 }), row('b', { position: 2 })]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('b')
})

test('nincs kötés → null', () => {
  const catalog = catalogOf(def('a', null), def('b', null))
  expect(nextInChain(catalog, [row('a'), row('b')], 'a')).toBeNull()
})

test('a már kész láncolt szokás csendet ér', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  const habits = [row('a'), row('b', { status: 'done' })]
  expect(nextInChain(catalog, habits, 'a')).toBeNull()
})

test('a kihagyott (missed) láncolt szokás sem prompt', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  const habits = [row('a'), row('b', { status: 'missed' })]
  expect(nextInChain(catalog, habits, 'a')).toBeNull()
})

test('DERIVED láncolt szokás csendet ér — egy DERIVED sor sosem pipálja magát (ADR 0010)', () => {
  const catalog = catalogOf(def('a', null), def('morning_weigh_in', 'a'))
  const habits = [row('a'), row('morning_weigh_in', { mode: 'DERIVED' })]
  expect(nextInChain(catalog, habits, 'a')).toBeNull()
})

test('fan-out: a legkisebb position-ű nyitott jelölt nyer', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'), def('c', 'a'))
  const habits = [row('a', { position: 1 }), row('c', { position: 3 }), row('b', { position: 2 })]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('b')
})

test('fan-out: a kész jelölt kiesik, a mögötte lévő nyitott nyer', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'), def('c', 'a'))
  const habits = [
    row('a', { position: 1 }), row('b', { position: 2, status: 'done' }), row('c', { position: 3 }),
  ]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('c')
})

test('a katalógusban létező, de a mai napban hiányzó jelölt kiesik', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  expect(nextInChain(catalog, [row('a')], 'a')).toBeNull()
})

test('ismeretlen kulcsra null', () => {
  const catalog = catalogOf(def('a', null), def('b', 'a'))
  expect(nextInChain(catalog, [row('a'), row('b')], 'nincs-ilyen')).toBeNull()
})

test('önhorgony nem promptolja saját magát', () => {
  // A validátor tiltja, de egy régi sor hordozhatja — a szabály nem dőlhet be tőle.
  const catalog = catalogOf(def('a', 'a'))
  expect(nextInChain(catalog, [row('a')], 'a')).toBeNull()
})

test('A→B→A ciklus egy ugrásnál megáll, nem végtelenít', () => {
  const catalog = catalogOf(def('a', 'b'), def('b', 'a'))
  const habits = [row('a', { position: 1 }), row('b', { position: 2 })]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('b')
  expect(nextInChain(catalog, habits, 'b')?.key).toBe('a')
})

test('több láncon átnyúló kötést is megtalál', () => {
  const catalog: HabitCatalog = {
    chains: [
      { id: 'c-m', chainKey: 'MORNING', title: 'Reggel', daypart: 'MORNING', position: 1, isActive: true,
        defs: [def('a', null)] },
      { id: 'c-e', chainKey: 'EVENING', title: 'Este', daypart: 'EVENING', position: 2, isActive: true,
        defs: [def('b', 'a')] },
    ] as unknown as HabitCatalog['chains'],
  }
  const habits = [row('a', { position: 1 }), row('b', { chain: 'EVENING', position: 1 })]
  expect(nextInChain(catalog, habits, 'a')?.key).toBe('b')
})
```

- [ ] **Step 2: Run the test to verify it fails for the right reason**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run src/features/today/logic/chainPrompt.test.ts
```

Expected: the whole file fails to resolve — `Failed to resolve import "@/features/today/logic/chainPrompt"`. **Confirm that is the message.** If instead you see assertion failures, the file already exists and you are not doing TDD.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/today/logic/chainPrompt.ts`:

```ts
// ============================================================
// Mezo · chainPrompt (mezo-3zue.6) — a habit stacking kifizetődése: melyik szokás
// promptja szólal meg attól, hogy a horgonyát KIPIPÁLTÁK.
//
// A `chainMilestone.ts` testvére, ugyanazzal a védelemmel: ezt a függvényt a tick-kezelő
// hívja, a pipa ELŐTTI állapotból, tehát a prompt az AKTUS következménye, nem egy mountolt
// állapotfigyelőé. (A törölt `useChainCelebration` pont ezen bukott el: minden mountoláskor
// újra megszólalt.)
//
// A `anchorHabitKey` már ma is a katalógusban van (HabitDefInfo), ezért ehhez nem kell
// szerver-oldali mező: a napi sorok és a katalógus együtt mindent tudnak.
// ============================================================
import type { HabitCatalog, HabitItem } from '@/data/types'
import { habitAction } from '@/features/today/logic/habitAction'

/**
 * @param catalog   a habit-katalógus (a keret-mezők forrása — a napi sor nem viszi őket)
 * @param habits    a mai sorok AHOGY A PIPA ELŐTT álltak (a pipált sor még pending)
 * @param tickedKey az imént kipipált szokás kulcsa
 * @returns a promptolandó sor, vagy null, ha a pillanat csendet érdemel
 */
export function nextInChain(
  catalog: HabitCatalog,
  habits: HabitItem[],
  tickedKey: string,
): HabitItem | null {
  // EGY ugrás, nem tranzitív bejárás. A HabitFrameworkValidator csak az önhorgonyt tiltja,
  // tehát A→B→A tárolható; egy ugrással a ciklus konstrukció szerint nem probléma.
  const anchored = new Set(
    catalog.chains
      .flatMap((c) => c.defs)
      .filter((d) => d.anchorHabitKey === tickedKey && d.habitKey !== tickedKey)
      .map((d) => d.habitKey),
  )
  if (anchored.size === 0) return null

  const candidates = habits
    .filter((h) => anchored.has(h.key))
    // Csak nyitott sor kap promptot, és csak az, amit a felhasználó ITT ÉS MOST kipipálhat.
    // A habitAction az egyetlen CTA-diszpécser: ha az nem 'check' (DERIVED, sheet, nav,
    // szerver-hintelt sor), a „Most jön" ígéretét egy pipa nem teljesítené → csend.
    .filter((h) => h.status === 'pending' && habitAction(h).kind === 'check')

  if (candidates.length === 0) return null
  // Fan-out: egy horgonyra több szokás is köthető (a repository is listát ad vissza).
  // A napi sor position-je dönt — a lánc saját sorrendje.
  return candidates.reduce((best, h) => (h.position < best.position ? h : best))
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run src/features/today/logic/chainPrompt.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Typecheck**

```bash
pnpm --dir frontend exec tsc -b
```

Expected: no output (success).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/logic/chainPrompt.ts frontend/src/features/today/logic/chainPrompt.test.ts
```

Then commit with this message body (heredoc via your editor or `git commit -F`):

```
feat(habit): nextInChain — a láncolt szokás feloldása a katalógusból (mezo-3zue.6)

A chainMilestone testvére: tiszta függvény, a tick-kezelő hívja a pipa ELŐTTI
állapotból. Egy ugrás (ciklus-biztos), a habitAction dönt a csendről, fan-outnál
a legkisebb position nyer.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 2: The list — `NapRutinPage` highlighted row

**Files:**
- Modify: `frontend/src/features/today/pages/NapRutinPage.tsx` (`tickAction` at :115-145, the row render at :180-200)
- Modify: `frontend/src/styles/prototype.css` (after `.nr-row + .nr-row` at :5345)
- Test: `frontend/src/features/today/pages/NapRutinPage.test.tsx`

**Interfaces:**
- Consumes: `nextInChain(catalog, habits, tickedKey)` from Task 1.
- Produces: the CSS class contract `.nr-row.now` + `.nr-nowtag` and the visible label `Most jön`, which Task 5 documents.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/features/today/pages/NapRutinPage.test.tsx`, after the celebration tests (around line 330):

```tsx
// ── a habit stacking kifizetődése: a pipa promptolja a láncolt szokást (mezo-3zue.6) ──

test('a horgony pipálása kiemeli a rá kötött szokást a listán', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: '50 fekvőtámasz' }))
  const now = await screen.findByText('Most jön')
  // a kiemelés a láncolt soron ül, nem a pipálton
  const row = now.closest('.nr-row') as HTMLElement
  expect(within(row).getByText('Reggeli videó')).toBeInTheDocument()
  expect(row.classList.contains('now')).toBe(true)
})

test('a kiemelés eltűnik, amint a láncolt szokást is kipipálják', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: '50 fekvőtámasz' }))
  expect(await screen.findByText('Most jön')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reggeli videó' }))
  expect(screen.queryByText('Most jön')).toBeNull()
})

test('már kész láncolt szokásnál a pipa csendet hagy', async () => {
  const user = userEvent.setup()
  habitStore.seed([
    ...morningHabits,
    { ...chainedVideo, status: 'done' },
  ])
  renderPage()
  await user.click(screen.getByRole('button', { name: '50 fekvőtámasz' }))
  // a jutalom-toast szól, a prompt nem
  expect(await screen.findByText('ökölbe szorított kéz + „ez az”')).toBeInTheDocument()
  expect(screen.queryByText('Most jön')).toBeNull()
})

test('a jutalom-toast változatlan marad a prompt mellett', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: '50 fekvőtámasz' }))
  expect(await screen.findByText('ökölbe szorított kéz + „ez az”')).toBeInTheDocument()
  expect(screen.getByText('Most jön')).toBeInTheDocument()
})
```

These need two fixture changes in the same file. First, add the chained row next to `morningHabits` (after the `morningHabits` array at :80-85):

```tsx
/** A morning_pushups-ra KÖTÖTT sor (mezo-3zue.6) — MANUAL + pending, tehát valóban pipálható. */
const chainedVideo: Partial<HabitItem> = {
  key: 'morning_video', chain: 'MORNING', position: 5, title: 'Reggeli videó', why: '',
  anchorCopy: 'napfény után', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 39,
}
```

and include it in the shared seed, replacing the `beforeEach` at :90:

```tsx
beforeEach(() => habitStore.seed([...morningHabits, chainedVideo, ...eveningHabits]))
```

Second, teach the catalog stub about the link — replace the MORNING chain's `defs` array in the `useHabitCatalog` stub (:47-51):

```tsx
defs: [
  { habitKey: 'morning_pushups', framework: 'FOGG', celebration: 'ökölbe szorított kéz + „ez az”', anchorHabitKey: null },
  { habitKey: 'morning_sunlight', framework: null, celebration: null, anchorHabitKey: null },
  // mezo-3zue.6: a videó a fekvőtámaszra van kötve — ettől szólal meg a „Most jön" prompt
  { habitKey: 'morning_video', framework: 'FOGG', celebration: 'bólintok, hogy megvolt', anchorHabitKey: 'morning_pushups' },
],
```

Adding a fifth morning row shifts two existing assertions in this file. Update them in the same edit:
- the anatomy test's `expect(screen.getByText('2/4'))` becomes `'2/5'`
- the anatomy test's `expect(screen.getByText('4 elem · lánc'))` becomes `'5 elem · lánc'`

Run the file once first to see whether any *other* assertion counts morning rows, and fix only what the failures name:

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run src/features/today/pages/NapRutinPage.test.tsx
```

- [ ] **Step 2: Run the new tests to verify they fail for the right reason**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run src/features/today/pages/NapRutinPage.test.tsx -t 'Most jön'
```

Expected: the three tests naming `Most jön` fail with `Unable to find an element with the text: Most jön`. The fourth (`már kész …`) passes already — it asserts an *absence*, so it is a regression guard, not a driver. **Confirm the failure message is the missing text, not a render crash.**

- [ ] **Step 3: Implement the page change**

In `frontend/src/features/today/pages/NapRutinPage.tsx`:

Add the import next to the other logic imports:

```tsx
import { nextInChain } from '@/features/today/logic/chainPrompt'
```

Add the state next to the page's other `useState` calls:

```tsx
// mezo-3zue.6: a horgony pipálásának KÖVETKEZMÉNYE — a rá kötött szokás kulcsa. Tartós
// (nem toast), de nincs saját takarító effektje: a render deriválja, lásd `promptRow`.
const [promptKey, setPromptKey] = useState<string | null>(null)
```

In `tickAction`'s `'check'` branch, compute the candidate alongside the existing pre-tick reads and set it after a successful write:

```tsx
      case 'check':
        return () => {
          const { done, total } = chainProgress(h.chain)
          // az ünneplés a katalógusból jön (a napi sor nem viszi) — hiányában a toast a régi
          const celebration = celebrationFor(catalog, h.key)
          // a mérföldkő a pipa ELŐTTI állapotból dől el: csak akkor szólal meg, ha ez a sor
          // az utolsó nyitott a napszakában (mezo-sqe3)
          const chainLabel = daypartMilestone(catalog, habits, h.chain)
          // ugyanabból a pipa előtti állapotból: mi van erre a horgonyra kötve (mezo-3zue.6)
          const chained = nextInChain(catalog, habits, h.key)
          check(h.key)
            .then((lu) => {
              emitToast(buildHabitRewardToast({
                title: h.title, chainDone: done, chainTotal: total, xp: h.xp, levelUp: lu?.[0],
                celebration, chainLabel,
              }))
              // csak sikeres írás után — egy elhasalt pipa nem ígérhet folytatást
              setPromptKey(chained?.key ?? null)
            })
            .catch(() => {})
        }
```

Above the `return (`, derive the highlighted row:

```tsx
  // A kiemelés DERIVÁLT, nem külön állapotgép: amint a promptolt sor kész lesz vagy eltűnik
  // a napból (a szerver `releaseAnchors`-e menet közben is oldhatja a kötést), magától
  // elmúlik — nincs mit takarítani.
  const promptRow = promptKey
    ? habits.find((h) => h.key === promptKey && h.status === 'pending') ?? null
    : null
```

In the row render, mark the row and add the label. Change the row wrapper (currently `<div key={h.key} className="nr-row">`):

```tsx
                  const isNow = promptRow?.key === h.key
                  return (
                    <div key={h.key} className={cn('nr-row', isNow && 'now')}>
```

and inside `<div className="nr-grow">`, as the first child, before the title:

```tsx
                        {isNow && <span className="mz-eyebrow nr-nowtag">Most jön</span>}
```

- [ ] **Step 4: Add the styles**

In `frontend/src/styles/prototype.css`, immediately after the `.nr-row + .nr-row` rule (:5345):

```css
/* mezo-3zue.6 — a horgony pipálása után a rá kötött sor „Most jön" állapotba kerül.
   Halk arany derengés: a jutalom-toast birtokolja a pillanatot, ez csak megmutatja, hova
   tovább. Page-lokális (nr-*), a megosztott mozaik-réteg nem változik. */
.nr-row.now { background: var(--mz-qxp-bg); border-radius: 13px;
  margin: 0 -8px; padding-left: 8px; padding-right: 8px; }
.nr-row.now + .nr-row, .nr-row + .nr-row.now { border-top-color: transparent; }
.nr-nowtag { display: block; color: var(--mz-qxp-ink); margin-bottom: 1px; }
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run src/features/today/pages/NapRutinPage.test.tsx
```

Expected: PASS, whole file.

- [ ] **Step 6: Typecheck**

```bash
pnpm --dir frontend exec tsc -b
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today/pages/NapRutinPage.tsx frontend/src/features/today/pages/NapRutinPage.test.tsx frontend/src/styles/prototype.css
```

Message body:

```
feat(habit): „Most jön" kiemelés a rutin-listán a horgony pipálása után (mezo-3zue.6)

A tick a pipa előtti állapotból oldja fel a láncolt sort, és sikeres írás után
egy lokális promptKey-be teszi. A kiemelés derivált — a sor kipipálásakor vagy a
kötés feloldásakor magától elmúlik. A jutalom-toast érintetlen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 3: The hub tile — chain-aware `next`

**Files:**
- Modify: `frontend/src/features/today/pages/NapHubPage.tsx` (`tileTick` at :160-180, `habitTile` at :181-215)
- Test: `frontend/src/features/today/pages/NapHubPage.test.tsx`

**Interfaces:**
- Consumes: `nextInChain(catalog, habits, tickedKey)` from Task 1.
- Produces: nothing consumed by later tasks; Task 5 documents the behaviour.

- [ ] **Step 1: Extend the fixture**

The hub tile shows `items.find(h => h.status === 'pending')`, so a discriminating test needs the chain's target to sit **behind** the order-based next. The existing MORNING fixture is `morning_sunlight` (pos 1, done) · `morning_video` (pos 2, MANUAL pending) · `morning_pushups` (pos 3, MANUAL pending). Ticking `morning_video` gives order-next = `morning_pushups`; so the chain must point past it. Add one row at position 4.

In `habitStore`'s `seed()` (`NapHubPage.test.tsx:29-34`), append after the `morning_pushups` line:

```tsx
    { key: 'morning_journal', chain: 'MORNING', position: 4, title: 'Reggeli napló', why: '', anchorCopy: 'videó után', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 41, linkUrl: null },
```

In `CATALOG`'s MORNING chain (`:47`), replace the `defs` array:

```tsx
      defs: [
        { habitKey: 'morning_video', framework: null, celebration: 'ez a rutin első lépése', anchorHabitKey: null },
        // mezo-3zue.6: a napló a videóra van kötve — a sorrend szerint a fekvőtámasz jönne
        { habitKey: 'morning_journal', framework: 'FOGG', celebration: 'becsukom a füzetet', anchorHabitKey: 'morning_video' },
      ],
```

The new row changes the MORNING tile's done/total. Find every assertion that counts it before you run anything:

```bash
grep -n "1/3\|1 / 3\|Reggeli videó\|50 fekvőtámasz\|Rutin" frontend/src/features/today/pages/NapHubPage.test.tsx
```

Update the counts the failures name (`1/3` → `1/4`), and nothing else.

- [ ] **Step 2: Write the failing test**

Append to `frontend/src/features/today/pages/NapHubPage.test.tsx`:

```tsx
// ── mezo-3zue.6: a csempe a lánc következő szemét mutatja, nem a sorrendét ──

test('pipa után a csempe a horgonyra kötött szokásra vált, nem a sorrend szerinti következőre', async () => {
  const user = userEvent.setup()
  renderHub()
  await user.click(await screen.findByRole('button', { name: 'Kipipálás — Reggeli videó' }))
  // sorrend szerint az 50 fekvőtámasz (position 3) jönne, a lánc szerint a napló (position 4)
  expect(await screen.findByText('Reggeli napló')).toBeInTheDocument()
  expect(screen.getByText('Most jön')).toBeInTheDocument()
  expect(screen.queryByText('50 fekvőtámasz')).toBeNull()
})

test('lánc nélküli pipa után a csempe a sorrend szerinti következőt mutatja', async () => {
  const user = userEvent.setup()
  renderHub()
  // a naplóra semmi nincs kötve → a pipa után a sorrend dönt, prompt nélkül
  await user.click(await screen.findByRole('button', { name: 'Kipipálás — Reggeli videó' }))
  await user.click(await screen.findByRole('button', { name: 'Kipipálás — Reggeli napló' }))
  expect(await screen.findByText('50 fekvőtámasz')).toBeInTheDocument()
  expect(screen.queryByText('Most jön')).toBeNull()
})
```

If `renderHub` is named differently in this file, use its actual name — check with `grep -n "function render" frontend/src/features/today/pages/NapHubPage.test.tsx`.

- [ ] **Step 3: Run to verify it fails for the right reason**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run src/features/today/pages/NapHubPage.test.tsx
```

Expected: the first new test fails with `Unable to find an element with the text: Reggeli napló` — the tile still shows `50 fekvőtámasz`, the next-by-order row. The second new test passes already; it is a regression guard, not a driver. **Confirm the failure is the missing text, not a render crash.** Every pre-existing test in the file must be green at this point (you fixed the counts in Step 1).

- [ ] **Step 4: Implement**

In `frontend/src/features/today/pages/NapHubPage.tsx`, add the import:

```tsx
import { nextInChain } from '@/features/today/logic/chainPrompt'
```

Add the state next to the page's other `useState` calls:

```tsx
// mezo-3zue.6: a hubon nincs lista, amit ki lehetne emelni — a csempe „következő" választása
// lesz lánc-tudatos. Ugyanaz a pipa-következmény, mint a rutin-oldalon, oldal-lokálisan.
const [promptKey, setPromptKey] = useState<string | null>(null)
```

In `tileTick`, resolve the candidate before the write and record it after:

```tsx
    const chainLabel = daypartMilestone(habitCatalog, habits, h.chain)
    // ugyanabból a pipa előtti állapotból (mezo-3zue.6)
    const chained = nextInChain(habitCatalog, habits, h.key)
    return () => {
      check(h.key)
        .then((lu) => {
          emitToast(buildHabitRewardToast({
            title: h.title,
            chainDone: chainSteps.filter((x) => x.status === 'done').length,
            chainTotal: chainSteps.length,
            xp: h.xp,
            levelUp: lu?.[0],
            celebration,
            chainLabel,
          }))
          setPromptKey(chained?.key ?? null)
        })
        .catch(() => {})
    }
```

In `habitTile`, make the `next` selection chain-aware and switch the eyebrow:

```tsx
    const done = items.filter((h) => h.status === 'done').length
    // A lánc előzi a sorrendet: ha az imént pipált horgonyra kötött sor itt van és még
    // nyitott, a csempe AZT mutatja — így a stacking a hubról pipálva is kifizetődik.
    const chained = promptKey ? items.find((h) => h.key === promptKey && h.status === 'pending') : undefined
    const next = chained ?? items.find((h) => h.status === 'pending') ?? null
```

and the eyebrow line:

```tsx
        <span className={cn('mz-eyebrow', f === 'este' ? 'nap-lav' : 'nap-gold')}>
          {chained ? 'Most jön' : 'Rutin'}
        </span>
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run src/features/today/pages/NapHubPage.test.tsx
```

Expected: PASS, whole file.

- [ ] **Step 6: Typecheck**

```bash
pnpm --dir frontend exec tsc -b
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today/pages/NapHubPage.tsx frontend/src/features/today/pages/NapHubPage.test.tsx
```

Message body:

```
feat(habit): lánc-tudatos „következő" a Nap-hub rutin-csempéjén (mezo-3zue.6)

A csempe eddig a sorrend szerinti első nyitott sort mutatta. Pipa után a horgonyra
kötött szokás előzi a sorrendet, az eyebrow „Most jön" — új UI nélkül.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 4: Mock seed + stale comments

**Files:**
- Modify: `frontend/src/data/habit/habitMock.ts` (`MOCK_CELEBRATION` at :98, `toDefInfo` at :104-131)
- Modify: `frontend/src/data/habit/habitMock.test.ts`
- Modify: `frontend/src/data/habit/habitHooks.ts:142-144`
- Modify: `frontend/src/features/today/pages/NapRutinPage.tsx:114`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the mock catalog invariant that `morning_video.anchorHabitKey === 'morning_pushups'`.

**Why this task exists:** every mock def currently sets `anchorHabitKey: null`, so the `VITE_USE_MOCK=true` CI arm would pass vacuously on real data and the mock PWA could not demo the chain at all. The `MOCK_CELEBRATION` map right above `toDefInfo` is the precedent — it exists for exactly this reason and defends itself in its own doc comment.

The pair is `morning_pushups` (MORNING, position 3, MANUAL, **pending**) → `morning_video` (MORNING, position 4, MANUAL, **pending**). Both are MANUAL and open in `mockHabitDay`, so the chain is actually playable.

`morning_video` also needs a celebration: `HabitFrameworkValidator:37-43` requires a FOGG def to carry an anchor **and** a celebration, and `toDefInfo` derives `framework: 'FOGG'` from `MOCK_CELEBRATION` membership. Without it the mock would describe a def the backend would reject — which the file's own doc comments explicitly forbid.

- [ ] **Step 1: Write the failing invariant test**

Append to `frontend/src/data/habit/habitMock.test.ts`:

```ts
test('a mock katalógus hordoz egy játszható horgony-párt (mezo-3zue.6)', () => {
  const defs = mockHabitCatalog.chains.flatMap((c) => c.defs)
  const dependent = defs.find((d) => d.habitKey === 'morning_video')
  const anchor = defs.find((d) => d.habitKey === 'morning_pushups')
  expect(dependent?.anchorHabitKey).toBe('morning_pushups')
  // mindkét oldal MANUAL és nyitott a mock napban — különben a lánc nem játszható végig
  expect(anchor?.mode).toBe('MANUAL')
  expect(dependent?.mode).toBe('MANUAL')
  const day = mockHabitDay.filter((h) => h.key === 'morning_pushups' || h.key === 'morning_video')
  expect(day).toHaveLength(2)
  expect(day.every((h) => h.status === 'pending')).toBe(true)
  // FOGG-teljes: a validátor horgonyt ÉS ünneplést vár (HabitFrameworkValidator)
  expect(dependent?.framework).toBe('FOGG')
  expect(dependent?.celebration).toBeTruthy()
})
```

Check the file's existing imports first and extend them rather than duplicating:

```bash
sed -n 1,15p frontend/src/data/habit/habitMock.test.ts
```

If the catalog export is named differently there, use the name that file already uses.

- [ ] **Step 2: Run to verify it fails for the right reason**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run src/data/habit/habitMock.test.ts -t 'horgony-párt'
```

Expected: `expected null to be "morning_pushups"` — the anchor is not seeded yet. **Not** an import error; if you get one, fix the import and re-run before moving on.

- [ ] **Step 3: Implement the seed**

In `frontend/src/data/habit/habitMock.ts`, add `morning_video` to `MOCK_CELEBRATION`:

```ts
const MOCK_CELEBRATION: Record<string, string> = {
  morning_pushups: 'ökölbe szorított kéz + „ez az”',
  kitchen_close: 'lekapcsolom a lámpát és bólintok',
  // mezo-3zue.6: a horgony-pár függő oldala. FOGG-hoz a validátor horgonyt ÉS ünneplést
  // vár, tehát ünneplés nélkül a mock elutasítandó állapotot írna le.
  morning_video: 'bólintok, hogy megvolt',
}

/**
 * A mock egyetlen szokás-láncolása (mezo-3zue.6): a reggeli videó a fekvőtámaszra van kötve.
 * Mindkét sor MANUAL és pending a mock napban, tehát a „Most jön" prompt végig eljátszható.
 * Nélküle a VITE_USE_MOCK=true teszt-arm vakon zöldülne és a mock PWA-n a habit stacking
 * kifizetődése demózhatatlan lenne — ugyanaz az érv, ami a MOCK_CELEBRATION-t is indokolja.
 */
const MOCK_ANCHOR: Record<string, string> = {
  morning_video: 'morning_pushups',
}
```

and in `toDefInfo`, replace the `anchorHabitKey: null` line:

```ts
    anchorHabitKey: MOCK_ANCHOR[h.key] ?? null,
```

- [ ] **Step 4: Run the mock tests to verify they pass**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run src/data/habit/habitMock.test.ts
```

Expected: PASS, whole file. If a pre-existing test asserts the *count* of FOGG defs or celebrations, update that number — the seed honestly gained one.

- [ ] **Step 5: Fix the two stale comments**

In `frontend/src/data/habit/habitHooks.ts:142-144`, the NOTE names `TodayPage`'s `act()` dispatcher as a caller; `TodayPage` was deleted in `mezo-d20.9.1`. Read it and rewrite the caller list to `NapRutinPage.tickAction` and `NapHubPage.tileTick` (keep `WindDownBanner` if the NOTE lists it and it still calls `check`; verify with `grep -rn "useHabitActions" frontend/src`).

In `frontend/src/features/today/pages/NapRutinPage.tsx:114`, the comment reads "The Today dispatcher's habit branch, verbatim semantics (TodayPage `act()`)". Rewrite it to describe what the function does without citing the deleted page, e.g. `/** A napi sor tick-viselkedése: a pipa, illetve a sor saját felületére vivő CTA. */`

- [ ] **Step 6: Run the full frontend suite in both modes**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run
```

then

```bash
VITE_USE_MOCK=false pnpm --dir frontend test run
```

Expected: both green. The real-mode arm exercises MSW fixtures, so a failure there means a fixture also needs the anchored def — fix the fixture, not the test.

- [ ] **Step 7: Typecheck**

```bash
pnpm --dir frontend exec tsc -b
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/habit/habitMock.ts frontend/src/data/habit/habitMock.test.ts frontend/src/data/habit/habitHooks.ts frontend/src/features/today/pages/NapRutinPage.tsx
```

Message body:

```
feat(habit): játszható horgony-pár a mock seedben + elavult TodayPage-kommentek (mezo-3zue.6)

morning_video → morning_pushups, mindkettő MANUAL és pending, ünnepléssel (a FOGG
validátor horgonyt ÉS ünneplést vár). Enélkül a mock-arm vakon zöldülne és a
stacking a mock PWA-n demózhatatlan lenne.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 5: Documentation + gates

**Files:**
- Modify: `docs/features/habit.md` (front-matter `updated:`, §2, §3, §9, §10)
- Regenerate: `docs/CODEMAP.md`

**Interfaces:**
- Consumes: the behaviour delivered by Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Read the sections you are about to change**

```bash
grep -n "^## \|^updated:" docs/features/habit.md
```

Then read §2, §3, §9 and §10 in full before editing. Match the file's existing voice and depth — do not paste plan prose into it.

- [ ] **Step 2: Write the doc changes**

- **front-matter:** set `updated: 2026-09-05`.
- **§2 (the surface / flow):** the Nap tick now has a fourth pre-tick read alongside `chainProgress`, `celebrationFor` and `daypartMilestone` — `nextInChain`. On the rutin list the chained habit's row takes a persistent `Most jön` highlight; on the hub the rutin tile's "next" becomes chain-aware. The reward toast is unchanged.
- **§3 (rules):** state the rule precisely — one hop (not transitive), candidates must be `pending` **and** dispatch to `check` via `habitAction` (so an already-done row and a DERIVED row both produce silence, per ADR 0010), fan-out resolves by the day row's `position`. Note that the prompt is derived from a page-local key and self-clears, and that a `releaseAnchors` on the server side is tolerated by construction.
- **§9:** remove S6 from the "deferred" list and record what landed. Add the explicit statement the doc has never carried: until this slice, `anchorHabitKey` had **no runtime effect** — it does now, on the Nap surface. Leave the **mezo-esemény anchors** (weigh-in, workout end) named as still deferred, and say why: they fire from other features' write points, not from the habit check.
- **§10:** add the new file `frontend/src/features/today/logic/chainPrompt.ts` to whatever inventory/anchor list §10 keeps, alongside its sibling `chainMilestone.ts`.

- [ ] **Step 3: Regenerate the codemap**

```bash
node scripts/gen-codemap.mjs
```

The freshness gate fails on a changed doc front-matter alone, not only on new files — run it even if you think nothing structural moved.

- [ ] **Step 4: Lint the docs**

```bash
node scripts/lint-docs.mjs --errors-only
```

Expected: `result: PASS` with `✗ 0 error`. Stale/warn findings are advisory under this flag.

- [ ] **Step 5: Final full gate, both modes explicitly**

```bash
VITE_USE_MOCK=true pnpm --dir frontend test run
```

```bash
VITE_USE_MOCK=false pnpm --dir frontend test run
```

```bash
pnpm --dir frontend exec tsc -b
```

```bash
pnpm --dir frontend build
```

All four must succeed. Do not claim completion on a partial run.

- [ ] **Step 6: Commit**

```bash
git add docs/features/habit.md docs/CODEMAP.md
```

Message body:

```
docs(habit): a lánc-prompt a habit doksiban — §2/§3/§9/§10 (mezo-3zue.6)

Kimondja, amit a doksi eddig sehol: az anchorHabitKey-nek mostanáig nem volt
futásidejű hatása. A mezo-esemény horgonyok maradnak elhalasztva.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## Closing the slice

After Task 5 is committed:

1. Push the branch and open a self-PR — the PR is the CI trigger, not a review request. CI (`ci.yml`) is the authoritative full-suite gate; a run takes ~20-25 minutes and the queue is shared with other sessions.
2. This session is worktree-isolated, so the local `--no-ff merge on main` route is unavailable. Once CI is green: `gh pr merge <n> --merge`, then, as a **separate** command, `git push origin --delete feat/habit-chain-prompt`. Verify with `gh pr view <n> --json state,mergeCommit`.
3. If `main` moves underneath, `git merge origin/main` into the branch — conflicts land in `docs/features/habit.md` and `docs/CODEMAP.md`.
4. Known and not yours: the deploy workflow's `version` job sometimes dies with exit 141 (`compute-release.sh` SIGPIPE). The `ci.yml` gate is independent — don't chase it.
5. `bd close mezo-3zue.6`, then `bd dolt push`. In bd text, avoid the word for the version-control tool and avoid command substitution (the worktree guard rejects them).
6. File a follow-up bd issue for the **mezo-esemény anchors** (weigh-in, workout end, …): they fire from other features' write points, so they need their own slice.
