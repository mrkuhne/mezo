# Egységes shell-szintű AppHeader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A felső fejléc-sor (dátum · napszakváltó · üzenetek · értesítések · profil orb) egyetlen shell-szintű komponens legyen, minden oldalon azonos tartalommal, és az Üzenetek felület a Nap-mozaik csempéjéből fejléc-karikává váljon.

**Architecture:** Új `frontend/src/app/AppHeader.tsx` az `AppLayout`-ban, a `ScreenContent` első gyerekeként (az `Outlet` fölött, a görgethető területen belül). A komponens maga hívja az adat-hookjait, tehát az öt tab-gyökér semmit nem ad neki lefelé; onnan a duplikált `.nap-head` blokkok törlődnek. A napszak-választás állapota változatlanul az URL-ben (`/nap?dp=`) él — nincs új globális state.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6, TanStack Query, Vitest + @testing-library/react + userEvent, meglévő `prototype.css` (`.nap-head` recept) és `shared/ui/clay` ikonkészlet.

**Spec:** [`docs/superpowers/specs/2026-08-30-egyseges-appheader-design.md`](../specs/2026-08-30-egyseges-appheader-design.md)
**bd:** `mezo-atry`

## Global Constraints

- Munka-könyvtár: `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mezociklus-template-upload-88b220`. Soha ne `cd`-zz a fő repóba — az a `main`-en ül.
- Minden frontend parancs a `frontend/` alkönyvtárból fut. Csomagkezelő: `pnpm` (9-es major).
- A frontend teszteket **mindkét módban** futtatni kell, mert a `VITE_USE_MOCK` beállítatlanul mock módot jelent, tehát a puszta `pnpm test` kétszer futtatná ugyanazt:
  - mock: `VITE_USE_MOCK=true pnpm test`
  - real: `VITE_USE_MOCK=false pnpm test`
- Új CSS osztály csak egy van: `.app-head`. A `.nap-head`, `.nap-head-grow`, `.nap-dpwrap`, `.nap-roundbtn`, `.nap-badge`, `.nap-offnow`, `.nap-dpmenu`, `.nap-ntfmenu`, `.nap-ntfrow`, `.nap-ntf-t`, `.nap-ntf-x`, `.nap-ntffoot`, `.nap-avatar` receptek **változatlanok** — csak új helyről használjuk őket.
- Magyar UI-szövegek, változatlan másolással: `Napszak váltása`, `Reggel` / `Nap` / `Este`, `Értesítések`, `Értesítések, {n} olvasatlan`, `Értesítések · ma`, `Összes értesítés ›`, `Mezo üzenetei`, `Mezo üzenetei, {n} olvasatlan`, `Profil`.
- Commit-üzenetek Conventional Commits + a bd id: `feat(fe): ... (mezo-atry)`.
- A `docs/CODEMAP.md` generált — kézzel SOHA ne szerkeszd, csak `node scripts/gen-codemap.mjs`-sel regeneráld.

---

## File Structure

| Fájl | Felelősség |
|---|---|
| `frontend/src/app/AppHeader.tsx` | **ÚJ.** A teljes fejléc: dátum-eyebrow, napszakváltó + menü, üzenet-karika, értesítés-karika + dropdown, profil orb. Maga hívja az adat-hookjait. |
| `frontend/src/app/AppHeader.test.tsx` | **ÚJ.** A komponens viselkedés-tesztjei (navigáció, badge-ek, dropdown-kizárás). |
| `frontend/src/app/AppLayout.tsx` | Mountolja az `AppHeader`-t; `hideTabBar` → `hideChrome` átnevezés. |
| `frontend/src/styles/prototype.css` | Egy új szabály: `.app-head` (függőleges ritmus). |
| `frontend/src/features/today/pages/NapHubPage.tsx` | Két `.nap-head` blokk + `mezoTile` + a hozzájuk tartozó state/importok törlése; `--d` késleltetések újrasorszámozása. |
| `frontend/src/features/train/pages/EdzesHubPage.tsx` | `.nap-head` blokk + `ntfOpen`/`unreadNtf` törlése. |
| `frontend/src/features/fuel/pages/FuelMaiPage.tsx` | ugyanaz |
| `frontend/src/features/insights/pages/MezoHubPage.tsx` | ugyanaz |
| `frontend/src/features/me/pages/EnHubPage.tsx` | ugyanaz |
| `frontend/src/app/hubHeaders.test.tsx` | Átírva: a fejléc a shellé, nem az öt oldalé. |
| `frontend/src/features/today/pages/NapHubPage.test.tsx` | A fejléc- és Mezo-csempe-tesztek törlése/áthelyezése. |
| `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx` | A `.nap-head` assert törlése. |
| `docs/features/today.md`, `me.md`, `fuel.md` | A fejléc-recept leírásának frissítése. |
| `docs/CODEMAP.md` | Regenerálva. |

---

## Task 1: AppHeader komponens

**Files:**
- Create: `frontend/src/app/AppHeader.tsx`
- Test: `frontend/src/app/AppHeader.test.tsx`

**Interfaces:**
- Consumes: `useToday()` → `{ today: { dayLabel, dateLabel } }`; `useSleepGoal()` → `{ goal }`; `useTodayScenario()` → `{ dayState }`; `useCompanionFeed()` → `FeedMessage[]`; `resolveBriefing(dayState)` → `Briefing | null` (mind `@/data/hooks`-ból); `useNotificationFeed()` → `{ items: AppNotificationView[] }` (`@/data/notification/feedHooks`); `dayFace(now, goal)`, `DAY_FACES`, `FACE_LABEL`, `type DayFace` (`@/features/today/logic/dayFace`); `useMinuteTick()`; `buildMezoMessages({ feed, demoBriefing })`; `lastSeenMessage(date)`; `localDateString()`; `ClayIcon`; `cn`.
- Produces: `export function AppHeader(): JSX.Element` — paraméter nélküli komponens. A Task 2 ezt mountolja.

- [ ] **Step 1: Write the failing test**

Hozd létre `frontend/src/app/AppHeader.test.tsx`-et ezzel a teljes tartalommal:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppHeader } from '@/app/AppHeader'
import { QueryWrapper } from '@/test/queryWrapper'

// A fejléc a shellben él, tehát MINDKÉT módú CI-futásban ugyanazt kell mutatnia —
// ezért a mock mód kényszerítve van (ugyanaz a minta, mint a hubHeaders.test.tsx-ben).
// Mock módban a companion-feed üres, a demo-briefing viszont megvan → PONTOSAN 1 üzenet,
// és a notificationFeedSeed-ben 3 olvasatlan értesítés van (nf-1..nf-3).
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
})
afterEach(() => vi.unstubAllEnvs())

/** Kiírja az élő URL-t, hogy a navigációk megfigyelhetők legyenek. */
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

const renderAt = (path: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <AppHeader />
        <LocationProbe />
      </MemoryRouter>
    </QueryWrapper>,
  )

test('a fejléc mind a négy kontrollt viseli, ebben a sorrendben', async () => {
  const { container } = renderAt('/fuel')
  expect(await screen.findByRole('button', { name: 'Napszak váltása' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Mezo üzenetei/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Értesítések/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Profil' })).toBeInTheDocument()

  const labels = [...container.querySelectorAll('.nap-head button')]
    .map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Napszak váltása')
  expect(labels[1]).toMatch(/^Mezo üzenetei/)
  expect(labels[2]).toMatch(/^Értesítések/)
  expect(labels[3]).toBe('Profil')
})

test('a napszakváltó bármely oldalról a /nap oldalra dob, dp paraméterrel', async () => {
  renderAt('/fuel')
  await userEvent.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Este' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap?dp=este')
})

test('a napszakváltó menüje bezárul a választás után', async () => {
  renderAt('/fuel')
  await userEvent.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  const menu = screen.getByRole('menu')
  await userEvent.click(screen.getByRole('menuitem', { name: 'Reggel' }))
  expect(menu).not.toBeInTheDocument()
})

test('/nap-on kívül a dp paraméter figyelmen kívül marad és nincs eltérés-pötty', async () => {
  const { container } = renderAt('/fuel?dp=este')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(container.querySelector('.nap-offnow')).toBeNull()
})

test('/nap?dp=este esetén az alvás-ikon és az eltérés-pötty látszik', async () => {
  const { container } = renderAt('/nap?dp=este')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(container.querySelector('.nap-head use[href="#i-alvas"]')).not.toBeNull()
  expect(container.querySelector('.nap-offnow')).not.toBeNull()
})

test('az Üzenetek karika a /nap/uzenetek oldalra navigál', async () => {
  renderAt('/mezo')
  await userEvent.click(await screen.findByRole('button', { name: /^Mezo üzenetei/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/nap/uzenetek')
})

test('az Üzenetek karika badge-e az olvasatlan üzenetek számát viseli', async () => {
  renderAt('/nap')
  const btn = await screen.findByRole('button', { name: /^Mezo üzenetei/ })
  expect(btn.getAttribute('aria-label')).toBe('Mezo üzenetei, 1 olvasatlan')
  expect(btn.querySelector('.nap-badge')).toHaveTextContent('1')
})

test('az értesítés-karika badge-e az olvasatlan értesítések számát viseli', async () => {
  renderAt('/nap')
  const btn = await screen.findByRole('button', { name: /^Értesítések/ })
  expect(btn.getAttribute('aria-label')).toBe('Értesítések, 3 olvasatlan')
  expect(btn.querySelector('.nap-badge')).toHaveTextContent('3')
})

test('az értesítés-dropdown a /me/ertesitesek oldalra visz a lábléceről', async () => {
  renderAt('/nap')
  await userEvent.click(await screen.findByRole('button', { name: /^Értesítések/ }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Összes értesítés ›' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/ertesitesek')
})

test('a két dropdown kölcsönösen kizárja egymást', async () => {
  const { container } = renderAt('/nap')
  await userEvent.click(await screen.findByRole('button', { name: 'Napszak váltása' }))
  expect(container.querySelector('.nap-dpmenu')).not.toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /^Értesítések/ }))
  expect(container.querySelector('.nap-dpmenu')).toBeNull()
  expect(container.querySelector('.nap-ntfmenu')).not.toBeNull()
})

test('a profil orb a /me oldalra visz', async () => {
  renderAt('/fuel')
  await userEvent.click(await screen.findByRole('button', { name: 'Profil' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/app/AppHeader.test.tsx
```

Expected: FAIL — `Failed to resolve import "@/app/AppHeader"`.

- [ ] **Step 3: Write the implementation**

Hozd létre `frontend/src/app/AppHeader.tsx`-et ezzel a teljes tartalommal:

```tsx
// ============================================================
// Mezo · AppHeader — az app EGYETLEN felső fejléce (mezo-atry). Korábban mind az öt
// tab-gyökér külön bemásolta a `.nap-head` receptet, eltérő tartalommal; itt egy helyen
// él, és az AppLayout mountolja minden oldalra. Sorrend fixen:
//   dátum-eyebrow · napszakváltó · Mezo-üzenetek · értesítések · profil orb
// A napszak-választás állapota az URL-ben marad (`/nap?dp=`) — nincs globális state, és a
// meglévő deep-linkek változatlanul működnek. A választó BÁRHONNAN a Nap oldalra navigál.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { lastSeenMessage } from '@/shared/lib/seenMessages'
import { resolveBriefing, useCompanionFeed, useSleepGoal, useToday, useTodayScenario } from '@/data/hooks'
import { useNotificationFeed } from '@/data/notification/feedHooks'
import { DAY_FACES, FACE_LABEL, dayFace, type DayFace } from '@/features/today/logic/dayFace'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'

const FACE_ICON: Record<DayFace, 'i-hajnal' | 'i-nap' | 'i-alvas'> = {
  reggel: 'i-hajnal', nap: 'i-nap', este: 'i-alvas',
}
const isFace = (v: string | null): v is DayFace =>
  v !== null && (DAY_FACES as readonly string[]).includes(v)

export function AppHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  const { today } = useToday()
  const { goal: sleepGoal } = useSleepGoal()
  const nowFace = dayFace(useMinuteTick(), sleepGoal)
  // A `?dp=` CSAK a Nap oldalon jelent napszak-választást; máshol a valós napszak látszik.
  const onNap = pathname === '/nap'
  const dpParam = params.get('dp')
  const face: DayFace = onNap && isFace(dpParam) ? dpParam : nowFace

  const { items: notifications } = useNotificationFeed()
  const unreadNtf = notifications.filter((n) => n.readAt === null).length

  const scenario = useTodayScenario()
  const feed = useCompanionFeed()
  const messages = useMemo(
    () => buildMezoMessages({ feed, demoBriefing: resolveBriefing(scenario.dayState) }),
    [feed, scenario.dayState],
  )
  // Az olvasatlan-vízjel localStorage-ban él, és a fejléc — a shellben lévén — NEM remountol
  // az üzenetek oldalról visszatérve. Ezért minden útvonalváltás után újraolvassuk, különben
  // a badge beragadna.
  const date = localDateString()
  const [seenId, setSeenId] = useState<string | null>(() => lastSeenMessage(date))
  useEffect(() => { setSeenId(lastSeenMessage(date)) }, [date, pathname])
  const unreadMsgs = useMemo(() => {
    if (seenId === null) return messages.length
    const idx = messages.findIndex((m) => m.id === seenId)
    return idx < 0 ? messages.length : messages.length - (idx + 1)
  }, [seenId, messages])

  const [dpOpen, setDpOpen] = useState(false)
  const [ntfOpen, setNtfOpen] = useState(false)
  // Útvonalváltáskor minden popover bezárul — a shellben élő fejléc nem remountol.
  useEffect(() => { setDpOpen(false); setNtfOpen(false) }, [pathname])

  const pickFace = (f: DayFace) => {
    setDpOpen(false)
    navigate(f === nowFace ? '/nap' : `/nap?dp=${f}`)
  }

  return (
    <div className="nap-head app-head">
      <div className="nap-head-grow">
        <span className="mz-eyebrow">{today.dayLabel} · {today.dateLabel}</span>
      </div>

      <div className="nap-dpwrap">
        <button type="button" className="nap-roundbtn" aria-label="Napszak váltása" aria-expanded={dpOpen}
          onClick={() => { setNtfOpen(false); setDpOpen((o) => !o) }}>
          <ClayIcon name={FACE_ICON[face]} size={22} />
          {onNap && face !== nowFace && <span className="nap-offnow" aria-hidden="true" />}
        </button>
        {dpOpen && (
          <div className="nap-dpmenu" role="menu">
            {DAY_FACES.map((f) => (
              <button key={f} type="button" role="menuitem" aria-label={FACE_LABEL[f]}
                className={cn(f === face && 'on')} onClick={() => pickFace(f)}>
                <ClayIcon name={FACE_ICON[f]} size={22} />
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="nap-roundbtn"
        aria-label={unreadMsgs > 0 ? `Mezo üzenetei, ${unreadMsgs} olvasatlan` : 'Mezo üzenetei'}
        onClick={() => navigate('/nap/uzenetek')}>
        <ClayIcon name="i-level" size={21} />
        {unreadMsgs > 0 && <span className="nap-badge">{unreadMsgs}</span>}
      </button>

      <div className="nap-dpwrap">
        <button type="button" className="nap-roundbtn" aria-expanded={ntfOpen}
          aria-label={unreadNtf > 0 ? `Értesítések, ${unreadNtf} olvasatlan` : 'Értesítések'}
          onClick={() => { setDpOpen(false); setNtfOpen((o) => !o) }}>
          <ClayIcon name="i-ertesites" size={21} />
          {unreadNtf > 0 && <span className="nap-badge">{unreadNtf}</span>}
        </button>
        {ntfOpen && (
          <div className="nap-ntfmenu" role="menu">
            <span className="mz-eyebrow">Értesítések · ma</span>
            {notifications.slice(0, 3).map((n) => (
              <button key={n.id} type="button" role="menuitem" className="nap-ntfrow"
                onClick={() => { setNtfOpen(false); if (n.deeplink) navigate(n.deeplink) }}>
                <span className="nap-ntf-t">{n.title}</span>
                <span className="nap-ntf-x">{n.body}</span>
              </button>
            ))}
            <button type="button" role="menuitem" className="nap-ntffoot"
              onClick={() => { setNtfOpen(false); navigate('/me/ertesitesek') }}>
              Összes értesítés ›
            </button>
          </div>
        )}
      </div>

      <button type="button" className="nap-avatar" aria-label="Profil" onClick={() => navigate('/me')}>
        <ClayIcon name="i-mezo" size={19} />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/app/AppHeader.test.tsx
```

Expected: PASS, 11 teszt.

Ha az „1 olvasatlan üzenet" assert elhasal, NE a számot igazítsd a valósághoz — először nézd meg
`resolveBriefing(scenario.dayState)` visszatérését mock módban. Ha `null`, akkor a szál üres, és
a teszt-elvárás (`1`) rossz feltevésen alapul; ekkor az assert `0`-ra javítandó, és a badge
hiányát kell pinnelni (`expect(btn.querySelector('.nap-badge')).toBeNull()`).

- [ ] **Step 5: Típusellenőrzés**

```bash
cd frontend && pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: hibamentes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/AppHeader.tsx frontend/src/app/AppHeader.test.tsx && git commit -m "feat(fe): AppHeader — az app egyetlen felső fejléce (mezo-atry)"
```

---

## Task 2: Mountolás a shellbe + a duplikált fejlécek törlése

**Files:**
- Modify: `frontend/src/app/AppLayout.tsx`
- Modify: `frontend/src/styles/prototype.css` (a `.nap-head` szabály mellé, ~4185. sor)
- Modify: `frontend/src/features/today/pages/NapHubPage.tsx` (két `.nap-head` blokk)
- Modify: `frontend/src/features/train/pages/EdzesHubPage.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Modify: `frontend/src/features/insights/pages/MezoHubPage.tsx`
- Modify: `frontend/src/features/me/pages/EnHubPage.tsx`
- Test: `frontend/src/app/hubHeaders.test.tsx` (átírva)
- Test: `frontend/src/features/today/pages/NapHubPage.test.tsx`, `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`

**Interfaces:**
- Consumes: `AppHeader` a Task 1-ből.
- Produces: nincs új export. Utána `.nap-head` már csak `AppHeader.tsx`-ben és a CSS-ben létezik.

- [ ] **Step 1: Írd át a hubHeaders tesztet (ez a bukó teszt)**

Cseréld le `frontend/src/app/hubHeaders.test.tsx` TELJES tartalmát:

```tsx
import { render } from '@testing-library/react'
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

// Design 2.0 endgame (mezo-d20.9.1) óta minden tab-gyökér SAJÁT `.nap-head` blokkot vitt —
// öt másolat, eltérő tartalommal. mezo-atry ezt megfordítja: a fejléc a SHELL-é (AppLayout),
// tehát egyetlen példány van belőle, minden oldalon ugyanaz, ugyanabban a sorrendben.
//   /nap — mezo-d20.2.1  /train — mezo-d20.3.1  /fuel — mezo-d20.4.1
//   /mezo — mezo-d20.5.1 (a /insights route ide irányít át)   /me — mezo-d20.6.1
test.each(['/nap', '/train', '/fuel', '/mezo', '/me'])('a %s tab-gyökéren PONTOSAN egy .nap-head van', (path) => {
  renderAt(path)
  expect(document.querySelectorAll('.nap-head')).toHaveLength(1)
})

test.each(['/nap', '/train', '/fuel', '/mezo', '/me'])('a %s tab-gyökér fejléce mind a négy kontrollt viseli', (path) => {
  const { container } = renderAt(path)
  const labels = [...container.querySelectorAll('.nap-head button')]
    .map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Napszak váltása')
  expect(labels[1]).toMatch(/^Mezo üzenetei/)
  expect(labels[2]).toMatch(/^Értesítések/)
  expect(labels[3]).toBe('Profil')
})

// A fejléc nem áll meg a tab-gyökereknél — az aloldalakon is ott van (D1).
test('az aloldalakon is ott a fejléc', () => {
  renderAt('/nap/rutin')
  expect(document.querySelectorAll('.nap-head')).toHaveLength(1)
})

// A chrome-mentes teljes képernyős flow-k: ahol a TabBar sem látszik, a fejléc sem.
test.each(['/train/session', '/me/sleep/night', '/ritual'])('a %s chrome-mentes felületen nincs fejléc', (path) => {
  renderAt(path)
  expect(document.querySelector('.nap-head')).not.toBeInTheDocument()
})

// A Nap hub fejlécéből az ✨ Insights link már a Design 2.0 körben eltűnt (a Mezo első-
// osztályú tab, B döntés) — ez a pin marad.
test('a Nap fejléce nem visz ✨ Insights linket', () => {
  renderAt('/nap')
  expect(document.querySelector('a[aria-label="Insights"]')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/app/hubHeaders.test.tsx
```

Expected: FAIL — `expected length 1, received 0` a chrome-mentes/aloldal teszteknél még nem, de
a „PONTOSAN egy" tesztek 1-et kapnak (a régi oldal-fejléc), a „négy kontroll" tesztek pedig
elhasalnak `/train`, `/fuel`, `/mezo`, `/me` alatt (nincs napszakváltó), az aloldal-teszt
0-t kap.

- [ ] **Step 3: Mountold a fejlécet az AppLayout-ba**

`frontend/src/app/AppLayout.tsx` — add hozzá az importot a többi `@/app/...` import közé:

```tsx
import { AppHeader } from '@/app/AppHeader'
```

Nevezd át a `hideTabBar` konstanst `hideChrome`-ra (immár három fogyasztója van), és frissítsd a
kommentjét:

```tsx
  // Full-screen surfaces where the app chrome is dead weight: the active workout session,
  // the extra-dark night page (its light would defeat the <30 lux point), and the
  // Napzárás ritual flow (mezo-ilsj). No header, no tab bar, no FAB.
  const hideChrome = ['/train/session', '/me/sleep/night', '/ritual'].includes(location.pathname)
```

A `ScreenContent` blokkot cseréld erre:

```tsx
            <ScreenContent>
              {/* A fejléc a shellé, nem az oldalaké (mezo-atry): egy példány, minden
                  oldalon ugyanaz. A scrollerben ÜL, tehát a tartalommal együtt görög. */}
              {!hideChrome && <AppHeader />}
              {/* Tab-level boundary: a crashed page degrades to a fallback card; the chrome
                  (TabBar) stays usable and navigating away (resetKey) recovers. */}
              <ErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </ScreenContent>
            {!hideChrome && <TabBar />}
            {/* Decision B (mezo-d20.1.1): quick log = floating coral FAB, present on
                every tab, absent on the chrome-free full-screen flows. */}
            {!hideChrome && <QuickLogFab />}
```

- [ ] **Step 4: Add hozzá az `.app-head` CSS-szabályt**

`frontend/src/styles/prototype.css` — közvetlenül a `.nap-head` szabály (jelenleg 4185. sor) UTÁN:

```css
/* A shell-szintű fejléc (mezo-atry) függőleges ritmusa. Korábban a `.nap-hub`/`.eh-hub`/…
   konténerek `padding: 6px 0 8px` + `gap: 11–13px` adta; a fejléc kikerült belőlük, ezért a
   6px felső margót maga hozza, az alsó rést pedig 7px-re méretezi — a hub-konténer saját 6px
   padding-topjával együtt ez adja vissza a régi 13px-et. */
.app-head { padding-top: 6px; margin-bottom: 7px; }
```

- [ ] **Step 5: Töröld a NapHubPage két fejléc-blokkját**

`frontend/src/features/today/pages/NapHubPage.tsx`:

1. A horgony-ágban (a `if (scenario.anchorMode)` return-jén belül, jelenleg 267–274. sor) töröld
   a teljes `<div className="nap-head"> … </div>` blokkot, a benne lévő dátum-eyebrow-val és
   `nap-avatar` gombbal együtt.
2. A normál return-ben (jelenleg 325–374. sor) töröld a teljes `<div className="nap-head"> … </div>`
   blokkot — a dátum-eyebrow-t, a napszakváltó `.nap-dpwrap`-ot a menüjével, az értesítés-
   `.nap-dpwrap`-ot a dropdownjával és a `nap-avatar` gombot.
3. Töröld a most feleslegessé vált állapotot és helpert:
   - `const [dpOpen, setDpOpen] = useState(false)`
   - `const [ntfOpen, setNtfOpen] = useState(false)`
   - a teljes `const setFace = (f: DayFace) => { … }` blokkot
   - `const { items: notifications } = useNotificationFeed()`
   - `const unreadNtf = notifications.filter((n) => n.readAt === null).length`
   - a `FACE_ICON` és `FACE_LABEL` modul-szintű konstansokat (a fájl tetején)
   - a `setSearchParams` destrukturálást: `const [params, setSearchParams] = useSearchParams()`
     → `const [params] = useSearchParams()`
   - az `import { useNotificationFeed } from '@/data/notification/feedHooks'` sort

   A `face`, `nowFace`, `isFace`, `dpParam`, `params`, `useMinuteTick`, `dayFace` MARAD — az
   oldal továbbra is a `?dp=` alapján választja a panelt.
4. Frissítsd a fájl fejléc-kommentjét: a „Header recipe (date eyebrow · daypart switch with menu ·
   clay bell + dropdown · orb avatar), then …" mondatból vedd ki a fejléc-részt, és írd oda, hogy
   a fejléc a shellé (`app/AppHeader.tsx`, mezo-atry); az oldal a `?dp=` paraméterből csak a
   panelt választja.

- [ ] **Step 6: Töröld a másik négy oldal fejléc-blokkját**

Mind a négy fájlban ugyanaz a művelet — töröld a teljes `<div className="nap-head"> … </div>`
blokkot, majd a benne használt, máshol NEM használt állapotot/importot:

| Fájl | Blokk (jelenlegi sorok) | Törlendő még |
|---|---|---|
| `features/train/pages/EdzesHubPage.tsx` | 307–338 | `const [ntfOpen, setNtfOpen] = useState(false)` (52. sor), `const unreadNtf = …` (303.), `const { items: notifications } = useNotificationFeed()` (51.), a `useNotificationFeed` import (30.) |
| `features/fuel/pages/FuelMaiPage.tsx` | 163–194 | `ntfOpen` (76.), `unreadNtf` (136.), `notifications` (63.), a `useNotificationFeed` import (38.) |
| `features/insights/pages/MezoHubPage.tsx` | 135–166 | `ntfOpen` (47.), `unreadNtf` (131.), `notifications` (46.), a `useNotificationFeed` import (26.) |
| `features/me/pages/EnHubPage.tsx` | 215–243 | `ntfOpen` (60.), `unreadNtf` (211.), `notifications` (59.), a `useNotificationFeed` import (32.) |

FONTOS: a `useToday()` / `today` és a `ClayIcon` MARAD mindegyik fájlban — az oldalak törzse
máshol is használja őket. A `useState` importot csak akkor vedd ki, ha az adott fájlban nem
maradt más `useState` hívás. A `navigate` mindenhol marad.

A biztos módszer a maradékra: futtasd a típusellenőrzést (Step 8) — a `noUnusedLocals`
pontosan a használatlanná vált szimbólumokat sorolja fel. (A repóban NINCS eslint: a `tsc` és a
vitest a valódi kapu.)

- [ ] **Step 7: Igazítsd a két érintett oldal-tesztet**

`frontend/src/features/fuel/pages/FuelMaiPage.test.tsx` — a teszt a `FuelMaiPage`-et shell nélkül
rendereli, tehát a fejléc ott már nem létezik. A 86. sorban kezdődő tesztben töröld ezt a sort:

```tsx
  expect(container.querySelector('.nap-head')).toBeInTheDocument()
```

és a teszt nevéből a „header recipe → " részt, hogy a név ne ígérjen többet a törzsnél:

```tsx
test('the hub is the Mozaik face: hero → swimlane → Mezo banner → mosaic → band, no sub-nav shell', () => {
```

`frontend/src/features/today/pages/NapHubPage.test.tsx` — ugyanez, két teszt:

1. Töröld TELJESEN a `test('the header carries the date eyebrow, the daypart switch, the bell and the orb avatar', …)` tesztet (128–131. sor környéke) — amit pinnelt, azt most az `AppHeader.test.tsx` és a `hubHeaders.test.tsx` pinneli.
2. A `test('the daypart switch opens a 3-option menu and switching re-renders the panel + updates ?dp', …)` teszt fele (a menü) az `AppHeader`-hez tartozik, a másik fele (a panel a `?dp` szerint rendereli magát) az oldalé. Cseréld le erre:

```tsx
test('a panel a ?dp paraméterből következik — a váltó maga a shell fejlécében él (mezo-atry)', async () => {
  renderHub('/nap?dp=este')
  expect(await screen.findByText('Villanyoltásig')).toBeInTheDocument()
  // A napszakváltó gomb NEM az oldalé többé.
  expect(screen.queryByRole('button', { name: 'Napszak váltása' })).toBeNull()
})
```

- [ ] **Step 8: Típusellenőrzés**

```bash
cd frontend && pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: hibamentes. Ha `no-unused-vars` jelez a Step 6 fájljaiban, töröld a jelzett szimbólumot
(és ha ezzel az importja üresre fogyott, az import sort is).

- [ ] **Step 9: Futtasd a teszteket**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/app src/features/today src/features/fuel src/features/train src/features/insights src/features/me
```

Expected: PASS. A `RitualPage.test.tsx` két „Napszak váltása" assertje továbbra is átmegy: a
`/ritual`-on nincs fejléc, de a Kilépés `/nap`-ra visz, ahol van.

- [ ] **Step 10: Ellenőrizd, hogy a `.nap-head` már csak egy helyen él**

```bash
cd frontend && grep -rn "nap-head" src --include=*.tsx
```

Expected: csak `src/app/AppHeader.tsx`, `src/app/AppHeader.test.tsx` és `src/app/hubHeaders.test.tsx`.

- [ ] **Step 11: Commit**

```bash
git add frontend/src && git commit -m "feat(fe): a fejléc a shellé — öt duplikált .nap-head blokk törölve (mezo-atry)"
```

---

## Task 3: Az Üzenetek csempe eltávolítása a Nap-mozaikokból

**Files:**
- Modify: `frontend/src/features/today/pages/NapHubPage.tsx`
- Test: `frontend/src/features/today/pages/NapHubPage.test.tsx`

**Interfaces:**
- Consumes: semmit a korábbi taskokból (a fejléc-karika már megvan és tesztelt).
- Produces: nincs új export. Utána a `mezoTile` helper és a `nap-unread` osztály használata megszűnik.

- [ ] **Step 1: Írd meg a bukó teszteket**

`frontend/src/features/today/pages/NapHubPage.test.tsx`:

1. Töröld TELJESEN a `test('the Mezo tile navigates to the Mezo üzenetei page (mezo-d20.2.2)', …)` tesztet (185. sor környéke) — az `AppHeader.test.tsx` „az Üzenetek karika a /nap/uzenetek oldalra navigál" tesztje váltja ki.
2. Töröld TELJESEN a `test('the Mezo tile carries the unread COUNT, not a bare dot', …)` tesztet — az `AppHeader.test.tsx` badge-tesztje váltja ki.
3. A `test('the mosaic tiles render with clay spots — Mezo, Küldetések, Check-in, Életjel', …)` tesztből vedd ki a Mezo-sort, és nevezd át:

```tsx
test('the mosaic tiles render with clay spots — Küldetések, Check-in, Életjel', async () => {
  renderHub('/nap?dp=nap')
  expect(await screen.findByRole('button', { name: 'Napi küldetések' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check-in' })).toBeInTheDocument()
  expect(document.querySelector('.nap-bigring')).not.toBeNull()
})
```

4. Vedd fel ezt az ÚJ tesztet a fájl végére:

```tsx
// mezo-atry: az Üzenetek a mozaikból a shell fejlécébe költözött — háromszori csempe-
// ismétlés helyett egy karika. A csempének mind a három napszakon el kell tűnnie.
test.each(['reggel', 'nap', 'este'])('a(z) %s panel mozaikjában nincs Mezo-üzenetek csempe', async (dp) => {
  renderHub(`/nap?dp=${dp}`)
  // Egy napszak-független horgony, hogy a panel biztosan felépüljön.
  expect(await screen.findByRole('button', { name: 'Napi küldetések' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Mezo üzenetei/ })).toBeNull()
  expect(document.querySelector('.nap-unread')).toBeNull()
})
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/today/pages/NapHubPage.test.tsx
```

Expected: FAIL — a három új `test.each` eset elhasal (`expected null, received <button>`), mert a csempe még ott van.

- [ ] **Step 3: Töröld a csempét és sorszámozd újra a késleltetéseket**

`frontend/src/features/today/pages/NapHubPage.tsx`:

1. Töröld a teljes `const mezoTile = (delay: number) => ( … )` helpert (jelenleg 156–170. sor), és
   a fölötte lévő komment-blokkból a „Mezo / " említést:

```tsx
  // ── shared tiles (Küldetések / Check-in appear on every panel) ──
```

2. Töröld a most feleslegessé vált adat-ágat:
   - `const feed = useCompanionFeed()`
   - `const messages = useMemo(() => buildMezoMessages({ … }), [feed, scenario.dayState])`
   - a teljes `const unreadMsgs = useMemo(() => { … }, [date, messages])` blokkot a fölötte lévő
     kommenttel együtt
   - az importokból: `lastSeenMessage` (`@/shared/lib/seenMessages`), `buildMezoMessages`
     (`@/features/today/logic/mezoMessages`), és a `@/data/hooks` listájából `useCompanionFeed`
     és `resolveBriefing` — de CSAK ha a `tsc` valóban használatlannak jelzi őket (a `scenario`
     maga máshol is kell, az marad).

3. **reggel panel** — a `<Mosaic>` első négy sora legyen:

```tsx
            <Mosaic>
              {habitTile('reggel', 70)}
              {questTile(110)}
              {checkTile(150)}
```

   és a rá következő Kreed-gomb késleltetése `230ms` → `190ms`:

```tsx
              <button type="button" className="mz-tile mz-w-white rise"
                style={{ '--d': '190ms' } as React.CSSProperties}
```

4. **nap panel** — a Stack-csempe után törlődik a `{mezoTile(270)}` sor, a maradék kettő lép előre:

```tsx
              {questTile(270)}
              {checkTile(310)}
```

5. **este panel** — törlődik a `{mezoTile(190)}` sor, és az „Éjszakai mód" csempe `delayMs`-e
   `230` → `190`:

```tsx
              {bedIn <= 90 && bedIn > 0 && (
                <Tile key="night" wash="lav" icon="i-alvas" eyebrow="Éjszakai mód" delayMs={190}
                  line={`indul ${sleepGoal.bedTime} előtt`}
                  onClick={() => navigate('/me/sleep/night')} aria-label="Éjszakai mód" />
              )}
```

   Az este panelt záró `StatStrip` `--d: 240ms`-e MARAD — az a mozaik utáni sáv, nem a kaszkád része.

- [ ] **Step 4: Futtasd a teszteket**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/today
```

Expected: PASS.

- [ ] **Step 5: Típusellenőrzés**

```bash
cd frontend && pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: hibamentes.

- [ ] **Step 6: Nézd meg élőben**

Indítsd el a mock-módú appot és ellenőrizd szemre a három napszakot + az öt tabot: a fejléc
mindenhol ugyanaz, a sorrend `dátum · napszakváltó · üzenetek · csengő · orb`, a mozaikban nincs
Üzenetek-csempe, a fejléc és az első csempe közti rés nem nagyobb, mint eddig, és bármelyik tabon
napszakot váltva a Nap oldalra kerülsz. A recept: `verify` skill (`docs/` alatti mock-mód PWA
build/launch/drive leírás).

- [ ] **Step 7: Commit**

```bash
git add frontend/src && git commit -m "feat(fe): az Üzenetek csempe kikerül a Nap-mozaikokból (mezo-atry)"
```

---

## Task 4: Dokumentáció, CODEMAP, teljes kapuk, PR

**Files:**
- Modify: `docs/features/today.md`, `docs/features/me.md`, `docs/features/fuel.md`
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:**
- Consumes: az 1–3. task teljes eredménye.
- Produces: zöld CI és merge-elt főág.

- [ ] **Step 1: Keresd meg az elavult dokumentum-részeket**

```bash
grep -rn "nap-head\|Üzenetek ›\|mezoTile" docs/features docs/decisions
```

Expected: találatok `docs/features/today.md`, `docs/features/me.md`, `docs/features/fuel.md` alatt.
(A `docs/design_2.0/prototypes/` alatti HTML-ek a forrásprototípusok — azokat NE írd át.)

- [ ] **Step 2: Frissítsd a három feature-doksit**

Minden találatnál ugyanaz a javítás: ahol a doksi azt írja, hogy az adott hub „header recipe"-t
(`.nap-head` — dátum-eyebrow · csengő · avatar) rendereli, ott most az álljon, hogy a fejléc a
**shellé** (`frontend/src/app/AppHeader.tsx`, `AppLayout` mountolja minden oldalra), és a tartalma
fixen `dátum-eyebrow · napszakváltó · Mezo-üzenetek karika · értesítés-csengő · profil orb`;
a napszakváltó bárhonnan a `/nap`-ra navigál (`?dp=` a nem-aktuális napszakra). A `today.md`-ben
külön írd le, hogy a Mezo-üzenetek csempe a mozaikból a fejlécbe költözött (`mezo-atry`), és hogy
a `/nap/uzenetek` oldal maga változatlan.

- [ ] **Step 3: Regeneráld a CODEMAP-et és lintold a doksikat**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs
```

Expected: a CODEMAP felveszi az `app/AppHeader.tsx`-et; a doc-lint hibamentes (nincs árva fájl,
nincs törött link).

- [ ] **Step 4: Teljes frontend kapuk — MINDKÉT módban**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Expected: mindhárom zöld. Backend nem érintett, ezért a backend-suite nem szükséges lokálisan.

- [ ] **Step 5: Commit + push + PR**

```bash
git add docs && git commit -m "docs(fe): shell-szintű fejléc a feature-doksikban + CODEMAP (mezo-atry)"
```

```bash
git push -u origin claude/header-unify-navigation-d10a9e
```

```bash
gh pr create --fill --title "feat(fe): egységes shell-szintű AppHeader (mezo-atry)"
```

- [ ] **Step 6: Várd meg a zöld CI-t, majd merge-elj lokálisan**

```bash
gh pr checks --watch
```

```bash
git checkout main && git pull --rebase && git merge --no-ff claude/header-unify-navigation-d10a9e && git push
```

- [ ] **Step 7: Zárd a bd issue-t**

```bash
bd close mezo-atry && bd dolt push
```

---

## Ellenőrző lista a végén

- [ ] `grep -rn "nap-head" frontend/src --include=*.tsx` → csak `app/AppHeader.tsx` + a két teszt
- [ ] `grep -rn "mezoTile" frontend/src` → nincs találat
- [ ] Mind az öt tabon és legalább egy aloldalon PONTOSAN egy fejléc, azonos sorrenddel
- [ ] `/train/session`, `/me/sleep/night`, `/ritual` → nincs fejléc
- [ ] Bármelyik tabról napszakot váltva a `/nap` oldalra kerülsz
- [ ] `git status` → „up to date with origin"

## Ismert, szándékosan kihagyott tétel

`frontend/src/features/notification/components/NotificationBell.tsx` (+ `NotificationPanel`) a
törölt `AppHero` maradéka: már csak a saját tesztje használja. Az `AppHeader` NEM ezt használja,
hanem a `.nap-ntfmenu` clay-receptet — a kettő összevonása vagy a holt kód kivezetése külön kör,
saját bd issue-val.
