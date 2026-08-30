# „Összes értesítés" feed-oldal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egy valódi értesítés-feed oldal a `/me/ertesitesek` úton, a Mozaik/Huawei csempe→saját-teljes-oldal mintában, amely egyben a hiányzó `markAllRead` hívó — így a fejléc olvasatlan-badge-e végre ki tud aludni.

**Architecture:** Új `NotificationFeedPage` a `MozaikPage`/`PageHead`/`PageHero`/`PageBody` recepttel. A nap-csoportosítást a **meglévő** `groupByDay` adja, kiszélesítve (a `Korábban` gyűjtőbucket naponkénti csoportokra bomlik). A beállítások `/me/ertesitesek/beallitasok`-ra költöznek, tartalmilag változatlanul. A holt `NotificationBell`/`NotificationPanel` páros törlődik, a tint-paletta CSS-e pedig kiskópolódik alóla.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6, TanStack Query, Vitest + @testing-library/react + userEvent, meglévő `prototype.css` és `shared/ui/clay` ikonkészlet.

**Spec:** [`docs/superpowers/specs/2026-08-31-ertesites-feed-oldal-design.md`](../specs/2026-08-31-ertesites-feed-oldal-design.md)
**bd:** `mezo-nol0` (lezárja: `mezo-61w0`, `mezo-h682`)

## Global Constraints

- Munka-könyvtár: `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220`, ág `feat/notification-feed-page`. Soha ne `cd`-zz a fő repóba — az a `main`-en ül.
- Minden frontend parancs a `frontend/` alkönyvtárból fut. Csomagkezelő: `pnpm`.
- A repóban **NINCS eslint**. A kapuk: `pnpm exec tsc --noEmit -p tsconfig.json` (a `-b --noEmit` alak egy előbbről meglévő, ide nem tartozó `tsconfig.node.json` hibán elhasal), vitest, és `node scripts/lint-docs.mjs --errors-only` a repó gyökeréből.
- A frontend teszteket explicit mód-változóval kell futtatni — a beállítatlan `VITE_USE_MOCK` csendben mock módot jelent, tehát a puszta `pnpm test` nem kétmódú kapu:
  - mock: `VITE_USE_MOCK=true pnpm test`
  - real: `VITE_USE_MOCK=false pnpm test`
- Magyar UI-szövegek, változatlan másolással: `Értesítések`, `Értesítés-beállítások`, `Beállítások ›`, `Ma`, `Tegnap`, `Még nincs értesítésed.`, `Összes értesítés ›`, `Értesítések beállításai`.
- Új nyers hex szín NEM kerülhet a CSS-be — kizárólag meglévő tokenek (`--dv-lav`, `--dv-sage`, `--dv-sky`, `--dv-amber`, `--primary-base`, `--surface-recess`, `--surface-card`, `--divider`, `--text-primary`, `--text-secondary`, `--text-muted`, `--ff-body`, `--ff-display`, `--ff-serif`, `--r-lg`, `--r-full`).
- Commit-üzenetek Conventional Commits + a bd id: `feat(fe): ... (mezo-nol0)`.
- A `docs/CODEMAP.md` generált — kézzel SOHA ne szerkeszd, csak `node scripts/gen-codemap.mjs`-sel.
- A környező kód kommentkonvenciója: a *miért* magyarázata bd id-vel; magától értetődő sorokra nincs narráció.

---

## File Structure

| Fájl | Felelősség |
|---|---|
| `frontend/src/features/notification/logic/groupByDay.ts` | **MÓDOSUL.** A `Korábban` gyűjtőbucket naponkénti, dátum-címkés csoportokra bomlik; a `label` típusa `string`-re szélesedik; defenzív csökkenő rendezés. |
| `frontend/src/features/notification/logic/groupByDay.test.ts` | **MÓDOSUL.** A meglévő esetek maradnak, plusz a felbontás, a rendezés és a hónapforduló. |
| `frontend/src/data/types.ts` | **MÓDOSUL.** `APP_NOTIFICATION_KIND_META` kap egy `clay: ClayIconName` mezőt az `emoji` és a `tint` mellé. |
| `frontend/src/features/me/pages/NotificationFeedPage.tsx` | **ÚJ.** Maga az oldal: hero, nap-csoportok, sorok, nyitáskori `markAllRead` + pillanatkép, üres állapot. |
| `frontend/src/features/me/pages/NotificationFeedPage.test.tsx` | **ÚJ.** Az oldal viselkedés-tesztjei. |
| `frontend/src/styles/prototype.css` | **MÓDOSUL.** A tint-paletta + `.nf-ico` + `.nf-dot` kiskópolása a `.nf-panel` alól; új `.nf-page` blokk; a panel-only szabályok törlése (Task 4). |
| `frontend/src/app/router.tsx` | **MÓDOSUL.** `me/ertesitesek` → `NotificationFeedPage`; új `me/ertesitesek/beallitasok` → `NotificationsPage`. |
| `frontend/src/features/me/pages/NotificationsPage.tsx` | **MÓDOSUL.** Két `PageHead` címke és a `PageHero` neve — semmi más. |
| `frontend/src/features/me/pages/EnHubPage.tsx` | **MÓDOSUL.** Az `Értesítés` csempe célja az al-útvonalra. |
| `frontend/src/app/notificationRoutes.test.tsx` | **ÚJ.** A route-váltás és a badge-kör regressziós pinje. |
| `frontend/src/features/notification/components/NotificationBell.tsx` · `NotificationPanel.tsx` · `NotificationBell.test.tsx` | **TÖRLŐDIK** (Task 4). |
| `docs/features/_platform-notifications.md`, `me.md` | **MÓDOSUL.** Az új felület és az útvonalváltás. |

---

## Task 1: `groupByDay` kiszélesítése naponkénti csoportokra

**Files:**
- Modify: `frontend/src/features/notification/logic/groupByDay.ts`
- Test: `frontend/src/features/notification/logic/groupByDay.test.ts`

**Interfaces:**
- Consumes: `AppNotificationView` (`@/data/types`), `localDateString(d?: Date): string` és `addDays(iso: string, n: number): string` (`@/shared/lib/dates`).
- Produces: `export interface FeedGroup { label: string; day: string; items: AppNotificationView[] }` és
  `export function groupByDay(items: AppNotificationView[], today: string): FeedGroup[]`.
  A Task 2 oldala ezt hívja `groupByDay(items, localDateString())` alakban.

- [ ] **Step 1: Írd meg a bukó teszteket**

Cseréld le `frontend/src/features/notification/logic/groupByDay.test.ts` TELJES tartalmát:

```ts
import { describe, expect, it } from 'vitest'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import type { AppNotificationView } from '@/data/types'

// Minden időbélyeg DÉLI UTC: így a futtató gép időzónája (±12 h) nem tolhatja át az elemet
// egy szomszédos naptári napra, és a teszt CI-ben (UTC) is ugyanazt jelenti, mint itthon.
const item = (id: string, occurredAt: string): AppNotificationView => ({
  id, kind: 'memory_note', title: 't', body: null, deeplink: '/insights', occurredAt, readAt: null,
})

describe('groupByDay', () => {
  it('splits Ma / Tegnap against the given today', () => {
    const groups = groupByDay([
      item('a', '2026-08-18T12:00:00.000Z'),
      item('b', '2026-08-17T12:00:00.000Z'),
    ], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma', 'Tegnap'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['a'])
    expect(groups[1].items.map((i) => i.id)).toEqual(['b'])
  })

  // A dropdown 3 sorában a „Korábban" gyűjtőbucket elég volt; egy teljes oldalon két hét
  // egyetlen cím alá söpörve használhatatlan (mezo-nol0).
  it('gives every older day its own dated label', () => {
    const groups = groupByDay([
      item('a', '2026-08-18T12:00:00.000Z'),
      item('b', '2026-08-15T12:00:00.000Z'),
      item('c', '2026-08-14T12:00:00.000Z'),
    ], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma', 'aug. 15.', 'aug. 14.'])
    expect(groups.some((g) => g.label === 'Korábban')).toBe(false)
  })

  it('sorts newest-first inside a group and across groups, whatever order it is given', () => {
    const groups = groupByDay([
      item('old', '2026-08-14T12:00:00.000Z'),
      item('now2', '2026-08-18T15:00:00.000Z'),
      item('now1', '2026-08-18T09:00:00.000Z'),
    ], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma', 'aug. 14.'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['now2', 'now1'])
  })

  it('omits empty groups', () => {
    const groups = groupByDay([item('a', '2026-08-18T12:00:00.000Z')], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma'])
  })

  it('returns nothing for an empty feed', () => {
    expect(groupByDay([], '2026-08-18')).toEqual([])
  })

  // Hónapforduló: a „tegnap" a hónap utolsó napja, az azelőtti pedig dátum-címkét kap.
  it('crosses a month boundary without mislabelling', () => {
    const groups = groupByDay([
      item('a', '2026-07-31T12:00:00.000Z'),
      item('b', '2026-07-30T12:00:00.000Z'),
    ], '2026-08-01')
    expect(groups.map((g) => g.label)).toEqual(['Tegnap', 'júl. 30.'])
  })
})
```

A `'aug. 15.'` / `'júl. 30.'` alakot a `hu-HU` `{ month: 'short', day: 'numeric' }` formázó adja —
ellenőrizve, nem találgatás. Ha egy futtatókörnyezet ICU-ja mást ad, NE lazítsd az assertet
regexre: állítsd meg a munkát és jelezd, mert akkor a képernyőn megjelenő címke sem az, amit a
spec leír.

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/notification/logic/groupByDay.test.ts
```

Expected: FAIL — a „gives every older day its own dated label" eset `['Ma', 'Korábban']`-t kap
`['Ma', 'aug. 15.', 'aug. 14.']` helyett.

- [ ] **Step 3: Írd meg az implementációt**

Cseréld le `frontend/src/features/notification/logic/groupByDay.ts` TELJES tartalmát:

```ts
import type { AppNotificationView } from '@/data/types'
import { addDays, localDateString } from '@/shared/lib/dates'

export interface FeedGroup {
  /** `Ma` · `Tegnap` · vagy a nap saját dátum-címkéje (`aug. 15.`). */
  label: string
  items: AppNotificationView[]
}

const dateLabel = (occurredAt: string) =>
  new Date(occurredAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })

/** Day-buckets the feed. `today` is injectable for pure tests (`localDateString()` at the call
 *  site). A „Korábban" gyűjtőbucket helyett minden régebbi nap SAJÁT dátum-címkét kap
 *  (mezo-nol0): a 3 soros dropdownban egy gyűjtőcím elég volt, a teljes oldalon nem. A rendezés
 *  itt történik, nem a hívónál — ISO-időbélyegek lexikografikus sorrendje = időrend. */
export function groupByDay(items: AppNotificationView[], today: string): FeedGroup[] {
  const yesterday = addDays(today, -1)
  const sorted = [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  // Map: a beszúrási sorrend = a rendezett sorrend, tehát a csoportok maguktól csökkenőek.
  const byLabel = new Map<string, AppNotificationView[]>()
  for (const n of sorted) {
    const day = localDateString(new Date(n.occurredAt))
    const label = day === today ? 'Ma' : day === yesterday ? 'Tegnap' : dateLabel(n.occurredAt)
    const bucket = byLabel.get(label)
    if (bucket) bucket.push(n)
    else byLabel.set(label, [n])
  }
  return [...byLabel].map(([label, groupItems]) => ({ label, items: groupItems }))
}
```

- [ ] **Step 4: Futtasd a tesztet**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/notification/logic/groupByDay.test.ts
```

Expected: PASS, 6 teszt.

- [ ] **Step 5: Nézd meg, hogy a mai egyetlen hívó fordul-e**

```bash
cd frontend && pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: hibamentes. A `NotificationPanel.tsx` a `group.label === 'Korábban'` ágra épít a
`timeLabel`-jében — ez most már sosem igaz, tehát a panel dátum helyett órát írna a régi
elemekre. **NE javítsd**: a panel a Task 4-ben törlődik. Ha a `tsc` mégis hibát ad rá, az más
probléma — jelezd.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/notification/logic && git commit -m "feat(fe): groupByDay — minden régebbi nap saját dátum-címkét kap (mezo-nol0)"
```

---

## Task 2: A feed-oldal

**Files:**
- Modify: `frontend/src/data/types.ts` (`APP_NOTIFICATION_KIND_META`, jelenleg ~1515-1529. sor)
- Modify: `frontend/src/styles/prototype.css` (a `.nf-*` blokk, jelenleg ~2694-2735. sor)
- Create: `frontend/src/features/me/pages/NotificationFeedPage.tsx`
- Test: `frontend/src/features/me/pages/NotificationFeedPage.test.tsx`

**Interfaces:**
- Consumes: `groupByDay(items, today)` + `FeedGroup` (`label` · `day` · `items`) a Task 1-ből — a React `key` a `day`, NEM a `label`: két, pontosan egy évre lévő csoport ugyanazt a címkét viseli; `useNotificationFeed(): { items: AppNotificationView[]; isPending: boolean }` és `useNotificationFeedActions(): { markAllRead: () => Promise<void> }` (`@/data/notification/feedHooks`); `MozaikPage`, `PageHead`, `PageHero`, `PageBody` (`@/shared/ui/mozaik`); `EntranceGroup` (`@/shared/ui/mozaik/motion`); `ClayIcon` (`@/shared/ui/clay`); `GhostState` (`@/shared/ui/GhostState`); `cn` (`@/shared/lib/cn`); `localDateString` (`@/shared/lib/dates`).
- Produces: `export function NotificationFeedPage(): JSX.Element` — paraméter nélküli oldal-komponens. A Task 3 route-olja.

- [ ] **Step 1: Írd meg a bukó tesztet**

Hozd létre `frontend/src/features/me/pages/NotificationFeedPage.test.tsx`-et:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { NotificationFeedPage } from '@/features/me/pages/NotificationFeedPage'
import { QueryWrapper } from '@/test/queryWrapper'

// A mock seed (data/notification/feedMock.ts) MAI napra van kötve (`at(daysAgo, hh:mm)`):
// 3 olvasatlan ma (nf-1..nf-3), 1 olvasott tegnap-előtti napokon szétosztva (nf-4..nf-6).
// Ezért a mód kényszerítve van, hogy a real-módú CI-futás is ugyanezt lássa.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

const renderPage = () =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/ertesitesek']}>
        <NotificationFeedPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

test('a hero a nyitáskori olvasatlan-számot viszi, nem nullát', async () => {
  const { container } = renderPage()
  expect(await screen.findByText('Értesítések')).toBeInTheDocument()
  expect(container.querySelector('.mz-bignum')).toHaveTextContent('3')
})

test('a mai elemek a Ma csoportba kerülnek, a régebbiek dátum-címke alá', async () => {
  const { container } = renderPage()
  await screen.findByText('Ma')
  const labels = [...container.querySelectorAll('.nf-daylabel')].map((e) => e.textContent)
  expect(labels[0]).toBe('Ma')
  expect(labels).not.toContain('Korábban')
  const maGroup = container.querySelector('.nf-group')!
  expect(within(maGroup as HTMLElement).getAllByRole('button')).toHaveLength(3)
})

test('egy sor koppintása a deeplinkre navigál', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: /Új minta vár döntésre/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/mezo/patterns/late-meal-sleep')
})

// A badge azonnal nullázódik (markAllRead), de amíg az oldalon vagyunk, LÁTNI kell, mi volt új.
test('a nyitáskor olvasatlan sorok kiemelve maradnak az oldalon', async () => {
  const { container } = renderPage()
  await screen.findByText('Ma')
  expect(container.querySelectorAll('.nf-row.unread')).toHaveLength(3)
  expect(container.querySelectorAll('.nf-dot')).toHaveLength(3)
})

test('a Beállítások gomb a beállítások aloldalra visz', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Beállítások' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek/beallitasok')
})
```

Külön fájlban az üres eset, mert saját hook-stubot kíván — hozd létre
`frontend/src/features/me/pages/NotificationFeedPage.empty.test.tsx`-et:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationFeedPage } from '@/features/me/pages/NotificationFeedPage'
import { QueryWrapper } from '@/test/queryWrapper'

vi.mock('@/data/notification/feedHooks', () => ({
  useNotificationFeed: () => ({ items: [], isPending: false }),
  useNotificationFeedActions: () => ({ markAllRead: vi.fn() }),
}))

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('üres feed: ghost-állapot, nap-csoport fejléc nélkül', async () => {
  const { container } = render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/me/ertesitesek']}>
        <NotificationFeedPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(await screen.findByText('Még nincs értesítésed.')).toBeInTheDocument()
  expect(container.querySelector('.nf-daylabel')).toBeNull()
})
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/NotificationFeedPage
```

Expected: FAIL — `Failed to resolve import "@/features/me/pages/NotificationFeedPage"`.

- [ ] **Step 3: Vedd fel a `clay` mezőt a kind-metába**

`frontend/src/data/types.ts` — az `APP_NOTIFICATION_KIND_META` deklarációja. A típus bővül, és
minden sor kap egy `clay` értéket. Az `emoji` MARAD (nem tudjuk, ki más olvassa; a felkutatása nem
ennek a körnek a dolga). A `ClayIconName` importja a fájl tetejére kerül:

```ts
import type { ClayIconName } from '@/shared/ui/clay'
```

```ts
/** Per-kind panel icon + tint class suffix (the mockup's family colors). A `clay` a Mozaik-nyelv
 *  ikonja (mezo-nol0): a feed-oldal ezt rendereli, az `emoji` a régi dropdown-panel öröksége. */
export const APP_NOTIFICATION_KIND_META: Record<AppNotificationKindKey, { emoji: string; tint: string; clay: ClayIconName }> = {
  pattern_inbox: { emoji: '🧩', tint: 'pattern', clay: 'i-minta' },
  pattern_signal: { emoji: '🧩', tint: 'pattern', clay: 'i-minta' },
  hypothesis_new: { emoji: '🧩', tint: 'pattern', clay: 'i-minta' },
  fact_candidate: { emoji: '📚', tint: 'knowledge', clay: 'i-tudas' },
  fact_reinforced: { emoji: '📚', tint: 'knowledge', clay: 'i-tudas' },
  memoir_ready: { emoji: '✍️', tint: 'memoir', clay: 'i-memoar' },
  prediction_new: { emoji: '🔮', tint: 'prediction', clay: 'i-kristaly' },
  prediction_outcome: { emoji: '🔮', tint: 'prediction', clay: 'i-kristaly' },
  experiment_proposed: { emoji: '🧪', tint: 'experiment', clay: 'i-lombik' },
  experiment_closed: { emoji: '🧪', tint: 'experiment', clay: 'i-lombik' },
  challenge_event: { emoji: '🏆', tint: 'experiment', clay: 'i-kihivas' },
  memory_note: { emoji: '🗂', tint: 'memory', clay: 'i-rend' },
}
```

Ha a `@/shared/ui/clay` importja `data/types.ts`-ből réteg-szabályt sértene (a projekt ArchUnit-
szerű konvenciói), akkor a `clay` mező helyett tedd a leképezést az oldal mellé
(`features/me/logic/notificationClay.ts`), és jelezd a jelentésedben — a leképezés tartalma
ugyanez marad.

- [ ] **Step 4: Skópold ki a tint-palettát a panel alól**

`frontend/src/styles/prototype.css` — a jelenlegi `.nf-panel .nf-dot`, `.nf-panel .nf-ico` és a hat
`.nf-panel .nf-ico.<tint>` szabályból vedd ki a `.nf-panel ` prefixet, hogy az oldal is használhassa
őket. A `.nf-ico` `font-size: 15px` értéke maradhat (a clay `<svg>`-t nem érinti). A többi
`.nf-panel …` szabályhoz **most ne nyúlj** — azok a Task 4-ben, a komponenssel együtt tűnnek el.

Az érintett hat + kettő szabály a kiskópolás után:

```css
.nf-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary-base); position: absolute; left: 6px; top: 50%; transform: translateY(-50%); }
.nf-ico { width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; }
.nf-ico.pattern { background: color-mix(in srgb, var(--dv-lav) 18%, transparent); }
.nf-ico.knowledge { background: color-mix(in srgb, var(--dv-sage) 20%, transparent); }
.nf-ico.prediction { background: color-mix(in srgb, var(--dv-sky) 18%, transparent); }
.nf-ico.experiment { background: color-mix(in srgb, var(--dv-amber) 22%, transparent); }
.nf-ico.memoir { background: color-mix(in srgb, var(--primary-base) 12%, transparent); }
.nf-ico.memory { background: var(--surface-recess); }
```

- [ ] **Step 5: Vedd fel az oldal CSS-blokkját**

`frontend/src/styles/prototype.css` — a fájl VÉGÉRE:

```css
/* ── Értesítés-feed oldal (mezo-nol0) ────────────────────────────────────────
   A /me/ertesitesek teljes oldala. A családi tint-paletta (.nf-ico.*) és a .nf-dot
   fentebb, a törölt dropdown-panelből kiskópolva él — itt csak a sor-recept van. */
.nf-page .nf-daylabel {
  font: 800 10.5px/1 var(--ff-body); letter-spacing: .6px; text-transform: uppercase;
  color: var(--text-muted); padding: 14px 2px 6px;
}
.nf-page .nf-group { display: flex; flex-direction: column; }
.nf-page .nf-row {
  display: flex; gap: 10px; align-items: flex-start; position: relative;
  width: 100%; padding: 11px 12px 11px 18px; text-align: left; cursor: pointer;
  background: var(--surface-card); border: 1px solid var(--divider); border-radius: var(--r-lg);
}
.nf-page .nf-row + .nf-row { margin-top: 7px; }
.nf-page .nf-row.unread { background: color-mix(in srgb, var(--primary-base) 5%, transparent); }
.nf-page .nf-txt { min-width: 0; flex: 1; display: block; }
.nf-page .nf-t { display: block; font: 700 12.5px/1.25 var(--ff-body); color: var(--text-primary); }
.nf-page .nf-x {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  font: 400 11.5px/1.4 var(--ff-body); color: var(--text-secondary); margin-top: 2px;
}
.nf-page .nf-time { font: 600 10px/1 var(--ff-body); color: var(--text-muted); flex-shrink: 0; margin-top: 2px; white-space: nowrap; }
```

- [ ] **Step 6: Írd meg az oldalt**

Hozd létre `frontend/src/features/me/pages/NotificationFeedPage.tsx`-et:

```tsx
// ============================================================
// Mezo · NotificationFeedPage — az „Összes értesítés" saját teljes oldala (mezo-nol0).
// A fejléc csengője 3 sort mutat, a lábléce ide vezet. Ez az oldal EGYBEN a hiányzó
// `markAllRead` hívó: előtte a fában nem volt elérhető útvonal, ami olvasottá tett volna
// egy értesítést, tehát a badge minden képernyőn véglegesen égett (mezo-61w0).
// A kiemelés a NYITÁSKORI pillanatképből jön, nem az élő `readAt`-ból: a badge azonnal
// nullázódik, de amíg itt vagy, látod, mi volt új — a törölt NotificationBell szemantikája.
// ============================================================
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_NOTIFICATION_KIND_META } from '@/data/types'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/notification/feedHooks'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'

const timeLabel = (occurredAt: string) =>
  new Date(occurredAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })

export function NotificationFeedPage() {
  const navigate = useNavigate()
  const { items } = useNotificationFeed()
  const { markAllRead } = useNotificationFeedActions()

  // Nyitáskori pillanatkép: a lista ebből rajzolja a kiemelést, nem az élő `readAt`-ból —
  // különben a `markAllRead` a szemünk előtt tüntetné el, mi volt új.
  const snapshot = useRef<ReadonlySet<string> | null>(null)
  if (snapshot.current === null && items.length > 0) {
    snapshot.current = new Set(items.filter((n) => n.readAt === null).map((n) => n.id))
  }
  const wasUnread = snapshot.current ?? new Set<string>()

  const marked = useRef(false)
  useEffect(() => {
    if (marked.current || wasUnread.size === 0) return
    marked.current = true
    void markAllRead()
  }, [wasUnread, markAllRead])

  const groups = useMemo(() => groupByDay(items, localDateString()), [items])

  return (
    <MozaikPage tone="sky" className="nf-page">
      <PageHead onBack={() => navigate(-1)}>
        <button type="button" className="mzc-pgact" aria-label="Beállítások"
          onClick={() => navigate('/me/ertesitesek/beallitasok')}>
          Beállítások ›
        </button>
      </PageHead>
      <PageHero icon="i-ertesites" name="Értesítések" big={wasUnread.size}
        sub={`${items.length} értesítés`} />
      <PageBody>
        {groups.length === 0 ? (
          <GhostState message="Még nincs értesítésed." />
        ) : (
          <EntranceGroup>
            {groups.map((g, gi) => (
              <div key={g.day} className="nf-group rise"
                style={{ '--d': `${gi * 60}ms` } as React.CSSProperties}>
                <div className="nf-daylabel">{g.label}</div>
                {g.items.map((n) => {
                  const meta = APP_NOTIFICATION_KIND_META[n.kind]
                  return (
                    <button key={n.id} type="button"
                      className={cn('nf-row', wasUnread.has(n.id) && 'unread')}
                      onClick={() => navigate(n.deeplink)}>
                      {wasUnread.has(n.id) && <span className="nf-dot" aria-hidden="true" />}
                      <span className={cn('nf-ico', meta.tint)} aria-hidden="true">
                        <ClayIcon name={meta.clay} size={20} />
                      </span>
                      <span className="nf-txt">
                        <span className="nf-t">{n.title}</span>
                        {n.body && <span className="nf-x">{n.body}</span>}
                      </span>
                      <span className="nf-time">{timeLabel(n.occurredAt)}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </EntranceGroup>
        )}
      </PageBody>
    </MozaikPage>
  )
}
```

- [ ] **Step 7: Futtasd a teszteket**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/NotificationFeedPage
```

Expected: PASS, 6 teszt (5 + 1 az üres fájlból).

Ha a „deeplinkre navigál" eset `/insights/patterns/late-meal-sleep`-et lát `/mezo/…` helyett, az
azért van, mert a `MemoryRouter` nem futtatja a `router.tsx` `insights/*` átirányítását — akkor
igazítsd az assertet a nyers deeplinkre (`/insights/patterns/late-meal-sleep`), és a
prefix-átirányítást a Task 3 route-tesztje fedi le. Ez a teszt az oldal navigációját pinneli, nem
a router redirect-tábláját.

- [ ] **Step 8: Típusellenőrzés**

```bash
cd frontend && pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: hibamentes.

- [ ] **Step 9: Commit**

```bash
git add frontend/src && git commit -m "feat(fe): NotificationFeedPage — az Összes értesítés saját oldala (mezo-nol0)"
```

---

## Task 3: Útvonalak — a feed viszi a nevet, a beállítások alá költözik

**Files:**
- Modify: `frontend/src/app/router.tsx` (a `me/ertesitesek` sor, jelenleg 220.)
- Modify: `frontend/src/features/me/pages/NotificationsPage.tsx` (két `PageHead`, jelenleg 187. és 229.; a `PageHero` neve 188.)
- Modify: `frontend/src/features/me/pages/EnHubPage.tsx` (az `Értesítés` csempe, jelenleg 265-266.)
- Modify: `frontend/src/features/me/pages/EnHubPage.test.tsx` (a csempe-tábla, jelenleg 182.)
- Test: `frontend/src/app/notificationRoutes.test.tsx` (ÚJ)

**Interfaces:**
- Consumes: `NotificationFeedPage` a Task 2-ből.
- Produces: nincs új export. Utána `/me/ertesitesek` = feed, `/me/ertesitesek/beallitasok` = beállítások.

- [ ] **Step 1: Írd meg a bukó route-tesztet**

Hozd létre `frontend/src/app/notificationRoutes.test.tsx`-et:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

// mezo-nol0: a főnév a feedé lett, a kapcsolók alá költöztek. A fejléc dropdown lábléce
// („Összes értesítés ›") ezért változtatás nélkül a helyes helyre visz.
test('/me/ertesitesek a feedet rendereli', async () => {
  const { container } = renderAt('/me/ertesitesek')
  expect(await screen.findByText('Ma')).toBeInTheDocument()
  expect(container.querySelector('.nf-page')).toBeInTheDocument()
})

test('/me/ertesitesek/beallitasok a kapcsolókat rendereli', async () => {
  const { container } = renderAt('/me/ertesitesek/beallitasok')
  expect(await screen.findByText('Értesítés-beállítások')).toBeInTheDocument()
  expect(container.querySelector('.nf-page')).toBeNull()
})

test('a fejléc dropdown lábléce a feedre visz', async () => {
  renderAt('/nap')
  await userEvent.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Összes értesítés ›' }))
  expect(await screen.findByText('Ma')).toBeInTheDocument()
})

// mezo-61w0 regressziós pinje: a badge eddig SOSEM tudott kialudni, mert a fában nem volt
// elérhető markAllRead hívó. Most a feed-oldal megnyitása az.
test('a fejléc olvasatlan-badge-e eltűnik, miután megnyitottuk a feedet', async () => {
  renderAt('/nap')
  const bell = await screen.findByRole('button', { name: 'Értesítések, 3 olvasatlan' })
  expect(bell.querySelector('.nap-badge')).toHaveTextContent('3')

  await userEvent.click(bell)
  await userEvent.click(screen.getByRole('menuitem', { name: 'Összes értesítés ›' }))
  await screen.findByText('Ma')

  const after = await screen.findByRole('button', { name: 'Értesítések' })
  expect(after.querySelector('.nap-badge')).toBeNull()
})
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/app/notificationRoutes.test.tsx
```

Expected: FAIL — `/me/ertesitesek` a beállítások oldalát rendereli, nincs `Ma`, nincs `.nf-page`.

- [ ] **Step 3: Vedd fel az útvonalakat**

`frontend/src/app/router.tsx` — az import-blokkban, a `NotificationsPage` importja mellé:

```tsx
import { NotificationFeedPage } from '@/features/me/pages/NotificationFeedPage'
```

A `me/ertesitesek` sort cseréld erre a kettőre:

```tsx
      // mezo-nol0: a főnevet a FEED viszi (ide vezet a fejléc dropdown „Összes értesítés ›"
      // lábléce), a kapcsolók alá költöztek.
      { path: 'me/ertesitesek', element: <NotificationFeedPage /> },
      { path: 'me/ertesitesek/beallitasok', element: <NotificationsPage /> },
```

- [ ] **Step 4: Igazítsd a beállítások oldalát**

`frontend/src/features/me/pages/NotificationsPage.tsx` — MINDKÉT `PageHead` címkéje:

```tsx
        <PageHead onBack={() => navigate(-1)} label="‹ Értesítések" />
```

és az ELSŐ ág `PageHero`-jának neve (a push-gate ág, jelenleg 188. sor), valamint a második ág
`PageHero`-ja, ha az is `name="Értesítések"`-et visz:

```tsx
        <PageHero icon="i-ertesites" name="Értesítés-beállítások" />
```

Indok: a feed hero-ja is `Értesítések`; két testvéroldal azonos névvel a fejlécben nem
megkülönböztethető. A `navigate(-1)` viselkedés MARAD — csak a címke szövege változik.

Ha a második ág `PageHero`-ja más nevet visz, hagyd békén, és jelezd a jelentésedben.

- [ ] **Step 5: Igazítsd az Én-hub csempéjét**

`frontend/src/features/me/pages/EnHubPage.tsx` — az `Értesítés` csempe `onClick`-je:

```tsx
            line={ertesitesLine} onClick={() => navigate('/me/ertesitesek/beallitasok')} aria-label="Értesítések beállításai" />
```

`frontend/src/features/me/pages/EnHubPage.test.tsx` — a csempe-táblában:

```tsx
    ['Értesítések beállításai', '/me/ertesitesek/beallitasok'],
```

- [ ] **Step 6: Futtasd a teszteket**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/app src/features/me
```

Expected: PASS. Ha a `NotificationsPage.test.tsx` a `‹ Én` címkére vagy az `Értesítések` hero-névre
assertál, igazítsd az új szövegekre — a teszt nevét is, ha az ígéretét túlnőné.

- [ ] **Step 7: Típusellenőrzés**

```bash
cd frontend && pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: hibamentes.

- [ ] **Step 8: Commit**

```bash
git add frontend/src && git commit -m "feat(fe): a /me/ertesitesek a feedé, a kapcsolók alá költöznek (mezo-nol0)"
```

---

## Task 4: A holt csengő-páros kivezetése, doksik, teljes kapuk

**Files:**
- Delete: `frontend/src/features/notification/components/NotificationBell.tsx`, `NotificationPanel.tsx`, `NotificationBell.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a maradék `.nf-panel …` és `.nf-bell …` szabályok)
- Modify: `docs/features/_platform-notifications.md`, `docs/features/me.md`
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:**
- Consumes: az 1-3. task teljes eredménye.
- Produces: zöld kapuk, kivezetett holt kód.

- [ ] **Step 1: Bizonyosodj meg, hogy tényleg holt**

```bash
cd frontend && grep -rn "NotificationBell\|NotificationPanel" src --include=*.ts --include=*.tsx
```

Expected: csak a három törlendő fájl saját sorai. Ha BÁRMI más hivatkozik rájuk, **állj meg**: a
kivezetés nem ennek a körnek a dolga, hagyd őket a helyükön, jelezd a jelentésedben, és ugorj a
Step 3-ra.

- [ ] **Step 2: Töröld a három fájlt**

```bash
git rm frontend/src/features/notification/components/NotificationBell.tsx frontend/src/features/notification/components/NotificationPanel.tsx frontend/src/features/notification/components/NotificationBell.test.tsx
```

Majd a `frontend/src/styles/prototype.css`-ből töröld a most gazdátlanná vált szabályokat:
`.nf-bell`, `.nf-bell .cnt.bell`, `.nf-bell .bell-badge`, `.nf-panel`, `.nf-panel .nf-head`,
`.nf-panel .nf-title`, `.nf-panel .nf-scroll`, `.nf-panel .nf-empty`, `.nf-panel .nf-group`,
`.nf-panel .nf-item`, `.nf-panel .nf-item + .nf-item`, `.nf-panel .nf-item.unread`,
`.nf-panel .nf-txt`, `.nf-panel .nf-t`, `.nf-panel .nf-b`, `.nf-panel .nf-time`, és a blokk fölötti
kommentet, amely a panel stacking-receptjét magyarázza.

**NE töröld** a Task 2-ben kiskópolt `.nf-dot` és `.nf-ico*` szabályokat — azokat most az oldal
használja.

Ellenőrizd, hogy nem maradt árva szabály:

```bash
cd frontend && grep -n "nf-panel\|nf-bell\|bell-badge" src/styles/prototype.css
```

Expected: nincs találat.

- [ ] **Step 3: Frissítsd a doksikat**

```bash
grep -rn "NotificationBell\|NotificationPanel\|me/ertesitesek" docs/features docs/decisions
```

Minden találatnál: a `NotificationBell`/`NotificationPanel` páros már nem létezik — a fejléc
csengője (`app/AppHeader.tsx`, `.nap-ntfmenu`) adja a 3 soros peeket, és az „Összes értesítés ›"
a `/me/ertesitesek` **feed-oldalra** visz (`features/me/pages/NotificationFeedPage.tsx`), ahol a
megnyitás mindent olvasottá tesz. A beállítások `/me/ertesitesek/beallitasok`-on élnek. A
`_platform-notifications.md`-ben ezen felül írd le a nyitáskori pillanatkép szemantikáját (miért
maradnak a sorok kiemelve), és hogy a nap-csoportosítást a `groupByDay` adja, régebbi napokra
dátum-címkékkel.

- [ ] **Step 4: Regeneráld a CODEMAP-et és lintold a doksikat**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```

Expected: a doc-lint 0 hibával PASS. A CODEMAP generátor a `frontend/src/{data,features}` alatt
néz, tehát az új oldalt és a törölt komponenseket látja — ha a diff nem üres, commitold a
generált fájlt; kézzel SOHA ne szerkeszd.

- [ ] **Step 5: Teljes kapuk — MINDKÉT módban**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Expected: mindhárom zöld. A backend nem érintett.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore(fe): a holt NotificationBell/Panel kivezetése + doksik (mezo-nol0, mezo-h682)"
```

---

## Ellenőrző lista a végén

- [ ] `grep -rn "NotificationBell\|NotificationPanel" frontend/src` → nincs találat
- [ ] `grep -rn "Korábban" frontend/src/features/notification` → nincs találat (a gyűjtőbucket megszűnt; a szó máshol — pl. az `AppHeader.tsx` kommentjében — hétköznapi magyar szóként előfordul, az nem érinti)
- [ ] `/me/ertesitesek` = feed, `/me/ertesitesek/beallitasok` = kapcsolók
- [ ] A fejléc badge-e kialszik, miután a feed-oldalt megnyitottad
- [ ] Mindkét mód + `pnpm build` + `lint-docs --errors-only` zöld

## Amit ez a terv szándékosan NEM csinál

- Nem vezet ki `emoji` mezőt az `APP_NOTIFICATION_KIND_META`-ból.
- Nincs család-szűrő, nincs lapozás.
- Nem nyúl a backend `/notifications/feed` szerződéséhez.
- Nem push-ol, nem nyit PR-t, nem merge-el — az integráció a humán partner döntése.
