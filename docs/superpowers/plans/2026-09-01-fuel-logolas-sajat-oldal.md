# Fuel · a logolás saját oldala — Implementation Plan (mezo-bq2t)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/fuel/log` blokk-CTA-i egy saját logoló oldalra (`/fuel/log/uj`) navigáljanak a helyben
nyíló composer helyett, ragadós mentés-sávval; és a Kamra/Recept picker összelapuló sorai gyógyuljanak.

**Architecture:** Egy új route-olt oldal (`FuelLogNewPage`) URL-ből olvassa a kontextust
(`?d` nap, `?w` ablak-kulcs, `?ai` AI-panel), feloldja az ablakot ugyanabból a nap-modellből, amit a
lista használ (`useFuelTimeline` + `buildWindowLane` + `asPastDayLane`), és a változatlan
`MealComposer`-t rendereli. A `FuelLogPage` elveszti a helyben nyíló wellt és állapotát.

**Tech Stack:** React 19 + react-router-dom, TanStack Query (`useFuelDay`/`useFuelTimeline`),
Vitest + Testing Library (mock és real mód), Playwright (`frontend/tests/visual/layout.spec.ts`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-01-fuel-logolas-sajat-oldal-design.md` — a prototípus
  (`docs/design_2.0/prototypes/fuel-log-oldal.html`) a vizuális igazság, 1:1 hűséggel.
- `MealComposer` mentési logikája NEM változhat (`loggedAt`, provenance, slot-zár) — az egyetlen
  megengedett módosítás az akció-sor `logflow-actions` osztálya.
- `LogFlowPage` és hívói (Kamra-tétel, Recept, Életjel, NapRutin) pixel- és viselkedés-azonosak
  maradnak.
- Dátum-kezelés kizárólag `@/shared/lib/dates` helperekkel (`addDays`, `localDateString`,
  `huMonthDay`, `huWeekdayFullIso`); a „ma" a page-en egyszer rögzül (`useState(() => localDateString())`).
- `MAX_BACK = 7`; a `?d` ezen kívül vagy értelmezhetetlenül → ma.
- Honest-state szabály: soha nem fabrikálunk ablakot; ismeretlen `w` → ablakon kívüli logolás.
- Új CSS csak `frontend/src/styles/prototype.css`-be, létező tokenekkel (nincs `--gold`).
- Magyar UI-szövegek a specből/prototípusból szó szerint.
- Minden task végén: `pnpm test` mindkét módban a változott fájlokra (`VITE_USE_MOCK=false` is),
  `pnpm build` a záró taskban.

---

### Task 1: A picker-sorok összelapulásának javítása + layout-guard

**Files:**
- Modify: `frontend/src/styles/prototype.css` (a `.fkp-item` szabály, ~6524. sor)
- Modify: `frontend/tests/visual/layout.spec.ts`

**Interfaces:**
- Consumes: semmi.
- Produces: semmi (izolált CSS + teszt).

- [ ] **Step 1: Írd meg a bukó layout-tesztet**

A `frontend/tests/visual/layout.spec.ts` végére, a fájl meglévő mintáját követve (valódi böngésző,
mert a jsdom nem számol layoutot):

```ts
test('fuel · a Kamra-picker sorai sok találatnál sem lapulnak össze', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/fuel/log')
  // Az első nyitható ablak CTA-ja → logoló oldal → Kamra forrás-csempe → picker.
  await page.getByRole('button', { name: /^(Logold|Pótold) · / }).first().click()
  await page.getByRole('button', { name: 'Kamra · hozzáadás' }).click()
  const rows = page.locator('.fkp-item')
  await expect(rows.first()).toBeVisible()
  const heights = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))
  expect(heights.length).toBeGreaterThan(4)
  // Egy ép sor ~114 px; az összelapult bug ~20 px-et adott.
  expect(Math.min(...heights)).toBeGreaterThan(60)
})
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd frontend && pnpm exec playwright test --config tests/visual/playwright.config.ts -g "nem lapulnak össze"`
Expected: FAIL (a minimum magasság ~20 px).

Ha a futtatás előtt maradt élő vite a portján, előbb: `pkill -f 'vite/bin/vite.js'`.

- [ ] **Step 3: A javítás**

`prototype.css`-ben a `.fkp-item` szabály kapja meg a `flex: none;`-t (a sor `overflow: hidden`-je
nullázza a flex auto-minimumot, ezért nyomja össze a `max-height: 400px`-es flex-lista):

```css
/* flex: none — a sor `overflow: hidden`-je nullázza a flex auto min-height-jét, így a
   max-height-es picker-lista minden sort ~20px-re nyomna sok találat esetén (mezo-bq2t). */
.fkp-item { position: relative; overflow: hidden; border-radius: 15px; padding: 10px 11px 10px 15px;
  flex: none;
```

(A meglévő szabály többi deklarációja változatlan.)

- [ ] **Step 4: Futtasd — menjen át**

Run: ugyanaz a parancs. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/prototype.css frontend/tests/visual/layout.spec.ts
git commit -m "fix(fuel): a Kamra/Recept picker sorai ne lapuljanak össze a görgethető listában (mezo-bq2t)"
```

---

### Task 2: `MealComposer` akció-sor horgony

**Files:**
- Modify: `frontend/src/features/fuel/components/MealComposer.tsx:544`

**Interfaces:**
- Produces: a `logflow-actions` osztály az akció-soron — a Task 3 oldala erre tesz sticky szabályt.

- [ ] **Step 1: Add hozzá az osztályt**

A záró akció-sor `className`-je `"row gap-sm"` → `"row gap-sm logflow-actions"`, a `style` és minden
gyerek változatlan:

```tsx
      <div className="row gap-sm logflow-actions" style={{ margin: '14px 0 12px' }}>
        <button className="cta-ghost" onClick={onCancel} style={{ flex: 1 }}>Mégse</button>
        <button className="cta-primary" disabled={!canSave} onClick={save} style={{ flex: 1.8 }}>
          {saveLabel ?? <><Icon name="check" size={15} /> Logolás · +10 XP</>}
        </button>
      </div>
```

Az osztálynak MOST nincs CSS-szabálya — puszta horgony, hogy a `LogFlowPage` overlay-en semmi ne
változzon.

- [ ] **Step 2: Futtasd a composer-teszteket**

Run: `cd frontend && pnpm exec vitest run src/features/fuel/components/MealComposer.logDate.test.tsx`
Expected: PASS (viselkedés nem változott).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/fuel/components/MealComposer.tsx
git commit -m "refactor(fuel): stabil logflow-actions horgony a composer akció-során (mezo-bq2t)"
```

---

### Task 3: `FuelLogNewPage` — a logolás saját oldala

**Files:**
- Create: `frontend/src/features/fuel/pages/FuelLogNewPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelLogNewPage.test.tsx`
- Modify: `frontend/src/app/router.tsx` (import + route a `fuel/log` sor MELLÉ)
- Modify: `frontend/src/styles/prototype.css` (új `.flognew-*` szabályok a `.flog-*` blokk után)

**Interfaces:**
- Consumes: `MealComposer` propjai (`fixedSlot`, `prefill`, `aiPanelOpenOnMount`, `logDate`,
  `logTime`, `saveLabel`, `onSaved`, `onCancel`); `buildWindowLane`/`asPastDayLane`/`WindowTileVM`
  a `fuelSwimlane.ts`-ből; `useFuelDay`, `useFuelTimeline`; `MozaikPage`, `PageHead`, `PageBody`,
  `ClayIcon`; a Task 2 `logflow-actions` horgonya.
- Produces: az `/fuel/log/uj` route az URL-szerződéssel (`d`, `w`, `ai`) — a Task 4 erre navigál.

- [ ] **Step 1: Írd meg a bukó tesztet**

`FuelLogNewPage.test.tsx` — a `FuelLogPage.test.tsx` meglévő setupját (QueryClient + `createMemoryRouter`
vagy `MemoryRouter initialEntries`) másold, mert a page `useSearchParams`-ot és `useNavigate`-et használ.
Esetek:

```tsx
it('az ablak-kulcsból fejlécet és rögzített slotot old fel', async () => {
  renderAt('/fuel/log/uj?w=' + encodeURIComponent('16:30-Uzsonna'))
  expect(await screen.findByText('Uzsonna')).toBeInTheDocument()
  // fixedSlot → nincs MIKOR szegmens
  expect(screen.queryByRole('button', { name: 'Reggeli' })).not.toBeInTheDocument()
})

it('ismeretlen ablak-kulcsnál ablakon kívüli módra esik vissza', async () => {
  renderAt('/fuel/log/uj?w=99:99-Nincs')
  expect(await screen.findByText('Ablakon kívül')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reggeli' })).toBeInTheDocument()
})

it('múltbeli napon Pótlás-hangulatot és a nap-figyelmeztetést mutatja', async () => {
  const y = addDays(localDateString(), -1)
  renderAt('/fuel/log/uj?d=' + y)
  expect(await screen.findByText('Pótlás')).toBeInTheDocument()
  expect(screen.getByText(/erre a napra könyvelődik|napra könyvelődik/)).toBeInTheDocument()
})

it('jövőbeli és értelmezhetetlen d-t mára clampel', async () => { /* mindkettőre: nincs "Pótlás" */ })

it('ai=1 nyitott AI panellel indul', async () => {
  renderAt('/fuel/log/uj?ai=1')
  expect(await screen.findByLabelText('Mit ettél?')).toBeInTheDocument()
})

it('Mégse a listára visz vissza ugyanarra a napra', async () => {
  const y = addDays(localDateString(), -1)
  renderAt('/fuel/log/uj?d=' + y)
  await userEvent.click(await screen.findByRole('button', { name: 'Mégse' }))
  expect(currentPath()).toBe('/fuel/log?d=' + y)
})
```

A `renderAt`/`currentPath` helpereket a fájl tetején definiáld (memory router `router.state.location`).

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd frontend && pnpm exec vitest run src/features/fuel/pages/FuelLogNewPage.test.tsx`
Expected: FAIL (a modul nem létezik).

- [ ] **Step 3: Írd meg az oldalt**

```tsx
// ============================================================
// Mezo · FuelLogNewPage — /fuel/log/uj, a logolás saját oldala (mezo-bq2t)
// Forrás: docs/design_2.0/prototypes/fuel-log-oldal.html +
// docs/superpowers/specs/2026-09-01-fuel-logolas-sajat-oldal-design.md
//
// A /fuel/log blokk-CTA-i ide navigálnak a helyben nyíló composer helyett: a
// MealComposer teljes képernyőt kap, a fejléc végig mutatja, MELYIK ablakba és
// MELYIK napra könyvelsz, a mentés-sáv pedig az oldal aljára tapad.
//
// A kontextus az URL-ben él (d = nap, w = ablak-kulcs, ai = AI-panel), így a
// logolás deep-linkelhető és a böngésző-vissza természetes. Ismeretlen `w` nem
// hiba: ablakon kívüli logolásra esik vissza — sosem fabrikálunk ablakot.
// ============================================================
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useFuelTimeline } from '@/data/hooks'
import { buildWindowLane, asPastDayLane, type WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import { addDays, huMonthDay, huWeekdayFullIso, localDateString } from '@/shared/lib/dates'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { MealComposer } from '@/features/fuel/components/MealComposer'

const MAX_BACK = 7

export function FuelLogNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [today] = useState(() => localDateString())

  const offset = (() => {
    const d = searchParams.get('d')
    if (!d) return 0
    const diff = Math.round((+new Date(today) - +new Date(d)) / 86_400_000)
    return Number.isFinite(diff) && diff >= 1 && diff <= MAX_BACK ? diff : 0
  })()
  const date = addDays(today, -offset)
  const past = offset > 0
  const ai = searchParams.get('ai') === '1'

  const { plan, budget } = useFuelTimeline(date)
  const { fuel } = useFuelDay(date)
  const laneRaw = buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })
  const lane = past ? asPastDayLane(laneRaw) : laneRaw
  // Ismeretlen kulcs → null: ablakon kívüli logolás, látható MIKOR szegmenssel.
  const tile: WindowTileVM | null = lane.tiles.find(t => t.key === searchParams.get('w')) ?? null

  const slot = plan.slots.find(s => tile != null && `${s.time}-${s.label}` === tile.key)
  const prefill = slot?.suggestedRecipeId && !ai
    ? { source: 'recipe' as const, recipeId: slot.suggestedRecipeId }
    : null

  const back = () => navigate(`/fuel/log${past ? `?d=${date}` : ''}`, { replace: true })

  return (
    <MozaikPage tone={past ? 'gold' : 'coral'} className="flognew-page">
      <PageHead onBack={back} label="‹ Vissza" />
      <div className={`flognew-head${past ? ' is-past' : ''}`}>
        <div className="flognew-ic"><ClayIcon name={tile?.icon ?? 'i-fuel'} size={26} /></div>
        <div className="flognew-txt">
          <div className="flognew-eyebrow">{past ? 'Pótlás' : 'Logolás'}</div>
          <div className="flognew-title">{tile ? tile.label : 'Ablakon kívül'}</div>
          <div className="flognew-sub">
            {tile ? `${tile.time} · ablak` : 'szabad tétel · te választod a mikort'}
          </div>
        </div>
        <span className="flognew-daychip">
          <b>{huMonthDay(date).toLowerCase()}.</b>
          <small>{past ? huWeekdayFullIso(date).toLowerCase() : 'ma'}</small>
        </span>
      </div>
      {past && (
        <div className="flognew-pastnote">
          <i aria-hidden="true" />
          Amit itt logolsz, <b>{huMonthDay(date).toLowerCase()}.</b> napra könyvelődik — pontszámot is kap.
        </div>
      )}
      <PageBody>
        <MealComposer
          fixedSlot={tile?.slotKey}
          prefill={prefill}
          aiPanelOpenOnMount={ai}
          logDate={past ? date : undefined}
          logTime={past ? tile?.time : undefined}
          saveLabel={past ? `✓ Pótlás · ${huMonthDay(date).toLowerCase()}.` : undefined}
          onSaved={back}
          onCancel={back}
        />
      </PageBody>
    </MozaikPage>
  )
}
```

Megjegyzések, amikre figyelj:
- `useFuelDay` importja is kell (`@/data/hooks`).
- `PageBody` `principle` propja itt NEM kell (a fejléc már elmondja a kontextust).
- Ha a `PageHead` `label` propja nem támogatja a „‹ Vissza" feliratot, nézd meg a
  `FuelLogPage.tsx:110` hívást és kövesd pontosan azt a mintát.

- [ ] **Step 4: Route**

`frontend/src/app/router.tsx`: import a többi fuel-oldal mellé, és a route közvetlenül a
`fuel/log` sor UTÁN (a react-router pontos egyezést használ, sorrend-ütközés nincs):

```tsx
      { path: 'fuel/log', element: <FuelLogPage /> },
      // A blokk-CTA-k saját logoló oldala (mezo-bq2t) — a kontextus az URL-ben él.
      { path: 'fuel/log/uj', element: <FuelLogNewPage /> },
```

- [ ] **Step 5: CSS**

`prototype.css`-be, a `.flog-*` blokk után:

```css
/* ===== /fuel/log/uj — a logolás saját oldala (mezo-bq2t) ===== */
.flognew-head { display: flex; align-items: center; gap: 9px; padding: 8px 0 10px; }
.flognew-ic { width: 38px; height: 38px; border-radius: 13px; flex: none; display: grid; place-items: center;
  background: var(--surface-card); box-shadow: inset 0 0 0 1px var(--border-subtle); }
.flognew-txt { min-width: 0; }
.flognew-eyebrow { font-size: 7.5px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--coral); }
.flognew-head.is-past .flognew-eyebrow { color: var(--mz-cell-amber-ink); }
.flognew-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; }
.flognew-sub { font-size: 9px; color: var(--text-secondary); margin-top: 1px; font-variant-numeric: tabular-nums; }
.flognew-daychip { margin-left: auto; flex: none; border-radius: 999px; padding: 4px 10px 5px; text-align: center;
  background: var(--surface-card); border: 1px solid var(--border-subtle); }
.flognew-daychip b { display: block; font-size: 10px; font-weight: 800; line-height: 1.2; }
.flognew-daychip small { display: block; font-size: 6.5px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--text-tertiary); }
.flognew-head.is-past .flognew-daychip { background: var(--mz-cell-amber-bg); border-color: transparent; }
.flognew-head.is-past .flognew-daychip b { color: var(--mz-cell-amber-ink); }
.flognew-pastnote { display: flex; gap: 6px; align-items: center; font-size: 8px; font-weight: 600;
  color: var(--mz-cell-amber-ink); background: var(--mz-cell-amber-bg); border-radius: 10px;
  padding: 6px 9px; margin-bottom: 8px; }
.flognew-pastnote i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
/* Ragadós mentés-sáv: a composer akció-sora az oldal aljára tapad, nem görög a tételek alá. */
.flognew-page .logflow-actions { position: sticky; bottom: 0; z-index: 2;
  padding: 9px 0 10px; margin: 14px 0 0;
  background: linear-gradient(180deg, transparent 0%, var(--surface-page) 32%); }
```

A `--surface-page` / `--mz-cell-amber-*` tokenek létezését ellenőrizd a fájlban; ha valamelyik nincs,
használd a `.flog-pastnote` / `.flog-dayclosed` szabályok tokenjeit (azok bizonyítottan élnek).

- [ ] **Step 6: Futtasd a teszteket mindkét módban**

```bash
cd frontend && pnpm exec vitest run src/features/fuel/pages/FuelLogNewPage.test.tsx
VITE_USE_MOCK=false pnpm exec vitest run src/features/fuel/pages/FuelLogNewPage.test.tsx
```
Expected: PASS mindkettő.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelLogNewPage.tsx frontend/src/features/fuel/pages/FuelLogNewPage.test.tsx frontend/src/app/router.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): a logolás saját oldala /fuel/log/uj — ablak+nap az URL-ben, ragadós mentés-sáv (mezo-bq2t)"
```

---

### Task 4: A `/fuel/log` átkötése navigációra

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelLogPage.tsx`
- Modify: `frontend/src/features/fuel/components/WindowBlock.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelLogPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a helyben nyíló well szabályai, ~6732–6739)

**Interfaces:**
- Consumes: a Task 3 `/fuel/log/uj?d=&w=&ai=` szerződése.
- Produces: `WindowBlock` `open`/`children` prop nélkül.

- [ ] **Step 1: Írd át a teszteket (bukjanak)**

`FuelLogPage.test.tsx`: a composer-hez kötött eseteket (a `Logold` után megjelenő composer, a múltbeli
mentés `loggedAt`-je, a composer bezárása napváltáskor) TÖRÖLD — az új oldal tesztje fedi őket. Helyettük:

```tsx
it('a Logold CTA az új logoló oldalra navigál az ablak kulcsával', async () => {
  renderAt('/fuel/log')
  await userEvent.click(await screen.findByRole('button', { name: /^Logold · / }))
  expect(currentPath()).toBe('/fuel/log/uj?w=' + encodeURIComponent('16:30-Uzsonna'))
})

it('az ✨ AI CTA ai=1-gyel navigál', async () => { /* .../uj?w=…&ai=1 */ })

it('múltbeli napon a d paramétert is átadja', async () => { /* ?d=<tegnap>&w=… */ })

it('az Ablakon kívül CTA ablak-kulcs nélkül navigál', async () => { /* /fuel/log/uj */ })
```

A pontos várt URL-eket a mock nap-modelljéből olvasd ki (a meglévő teszt már ismeri az ablakokat) —
ne találgass kulcsot.

- [ ] **Step 2: Futtasd — bukjanak**

Run: `cd frontend && pnpm exec vitest run src/features/fuel/pages/FuelLogPage.test.tsx`
Expected: FAIL az új eseteknél.

- [ ] **Step 3: `FuelLogPage` átkötése**

- Töröld: `openKey`, `aiOnMount`, `openComposer`, `closeComposer` state-et és a `MealComposer` importot
  + mindkét mount-helyét, valamint a `prefillFor` helpert (a prefillt már az új oldal oldja fel).
- A `stepDay` a composer-zárás helyett csak az offsetet állítja és a scrollt nullázza.
- Új helper és használata:

```tsx
  // A logolás saját oldalra megy (mezo-bq2t): a kontextus — nap, ablak, AI-szándék — az URL-ben
  // utazik, így a lista állapota érintetlen marad és a vissza-gomb visszatesz ide.
  const openLog = (windowKey: string | null, ai: boolean) => {
    const q = new URLSearchParams()
    if (past) q.set('d', date)
    if (windowKey) q.set('w', windowKey)
    if (ai) q.set('ai', '1')
    const s = q.toString()
    navigate(`/fuel/log/uj${s ? `?${s}` : ''}`)
  }
```

- A `WindowBlock` hívása: `onOpen={(ai) => openLog(tile.key, ai)}`, `open`/`children` nélkül.
- Az „Ablakon kívül" blokk két CTA-ja: `onClick={() => openLog(null, false)}` illetve `(null, true)`;
  az `aria-expanded` attribútumok lekerülnek, a `.flog-composer` markup-blokk törlődik a blokkból.

- [ ] **Step 4: `WindowBlock` egyszerűsítése**

- `WindowBlockProps`: `open` és `children` törölve (a `ReactNode` import is, ha feleslegessé válik).
- A gyökér `className`-ből az `${open ? ' is-open' : ''}` és a CTA-k `aria-expanded`-je törölve.
- A `.flog-composer` / `.flog-cin` / `.flog-cbody` markup törölve.
- A fájl-fejléc második bekezdése (az EXPAND-IN-PLACE well leírása) cserélve arra, hogy a CTA-k
  a `/fuel/log/uj` oldalra navigálnak (a `onOpen` most navigációs szándék).

- [ ] **Step 5: CSS-takarítás**

`prototype.css`: töröld a `.flog-blk.is-open .flog-ctas`, `.flog-composer`, `.flog-cin`,
`.flog-blk.is-open .flog-composer`, `.flog-cbody` szabályokat és a reduced-motion blokkból a
`.flog-composer { transition: none; }` sort. Semmi mást ne mozgass abban a blokkban.

- [ ] **Step 6: Futtasd mindkét módban + build**

```bash
cd frontend && pnpm exec vitest run src/features/fuel
VITE_USE_MOCK=false pnpm exec vitest run src/features/fuel
pnpm build
```
Expected: PASS + sikeres build (a törölt propok miatt nem maradhat típushiba).

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "refactor(fuel): a /fuel/log blokk-CTA-i az új logoló oldalra navigálnak, a helyben nyíló well törölve (mezo-bq2t)"
```

---

### Task 5: Dokumentáció + záró ellenőrzés

**Files:**
- Modify: `docs/features/fuel.md`
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:**
- Consumes: a Task 3–4 végleges felülete.

- [ ] **Step 1: `fuel.md`**

Keresd meg a `/fuel/log` szakaszt és a „helyben nyíló composer" leírásokat (`grep -n "helyben\|in-place\|expand" docs/features/fuel.md`), és cseréld le:
- a nézetek/route-ok táblázata kapjon `/fuel/log/uj` sort az URL-szerződéssel (`d`, `w`, `ai`);
- a logolási út leírása mondja ki, hogy a CTA navigál, a mentés-sáv ragadós, és mentés/mégse után a
  lista jön vissza ugyanarra a napra;
- egy mondat a picker-bugról és a javításról (mezo-bq2t), hogy a következő olvasó ne essen bele újra.

- [ ] **Step 2: CODEMAP**

Run: a repo szokásos generátora (`grep -rn "CODEMAP" package.json scripts/ | head` alapján), majd
ellenőrizd, hogy az új oldal szerepel benne.

- [ ] **Step 3: Teljes FE gate mindkét módban**

```bash
cd frontend && pnpm test
VITE_USE_MOCK=false pnpm test
pnpm build
node ../scripts/lint-docs.mjs --errors-only
```
Expected: minden zöld (a lint-docs CSAK `--errors-only` formában kötelező).

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs(fuel): a logolás saját oldala + a picker-összelapulás nyoma (mezo-bq2t)"
```
