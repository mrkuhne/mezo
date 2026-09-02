# NapMezoPage Üzenetek | Életjelek tab-szétválasztás — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/nap/uzenetek` oldal két tabra bomlik (Üzenetek | Életjelek): a companion-üzenetek és az Életjel-nudge kártyák nem keverednek, a régebbi üzenetek összecsukva rövidítik a lapot.

**Architecture:** Prezentációs partíció — a `MezoThreadProvider` egy-szál doktrínája (mezo-atry) érintetlen; a `MezoMessageItem` új `source?: 'eletjel'` mezőt kap, a NapMezoPage ezen bont két tabra (`?tab=` URL-paraméter). Az Életjelek tab a `useNeeds` gyűrű-állapotokból kap kompakt státusz-sávot.

**Tech Stack:** React + TypeScript, react-router (`useSearchParams`), vitest + testing-library, prototype.css (design_2.0 `mz-*`/`nap-*` osztálynyelv).

**Spec:** `docs/superpowers/specs/2026-09-02-mezo-uzenetek-tabok-design.md` · **Issue:** mezo-ho9k

## Global Constraints

- A szál sorrendje és a `buildMezoMessages` szignatúrája NEM változhat (badge-vízjel = UTOLSÓ elem id; három külső hívó: FuelMaiPage, FuelMezoPage, MezoHubPage).
- Feedback-chip CSAK `artifactId != null` sorokon (mezo-kr9v).
- `MezoMessageItem.id` ≠ `artifactId` — a partíció-kulcs az új `source` mező, sosem string-egyeztetés eyebrow/meta szövegen.
- FE tesztek MINDKÉT módban zöldek: `VITE_USE_MOCK=true pnpm vitest run <files>` és `VITE_USE_MOCK=false pnpm vitest run <files>` (a bare futás mock-ot futtat kétszer!). Minden parancs a `frontend/` könyvtárból.
- Touch-target ≥ 44pt minden új interaktív elemre (todayTapTargets.test.ts szűri a nap-scope-ot).
- prototype.css-be új osztályok a `.nap-mzmsg` blokk MELLÉ kerülnek `nap-mz` prefixszel; szín csak `--mz-*`/szemantikus tokenből vagy a meglévő blokk literál-idiómájával; `@media` blokkok záró kapcsosait `pnpm build` ellenőrzi.
- Commit-formátum: `feat(today): ... (mezo-ho9k)` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` záró sor.

---

### Task 1: `source` mező + tab-partíció logika (pure)

**Files:**
- Modify: `frontend/src/features/today/logic/mezoMessages.ts`
- Modify: `frontend/src/features/today/logic/needsNudges.ts` (`toNudgeMessage`)
- Test: `frontend/src/features/today/logic/mezoMessages.test.ts`, `frontend/src/features/today/logic/needsNudges.test.ts`

**Interfaces:**
- Produces: `MezoMessageItem.source?: 'eletjel'`; `partitionMezoThread(messages: MezoMessageItem[]): { uzenetek: MezoMessageItem[]; eletjelek: MezoMessageItem[] }` (export a `mezoMessages.ts`-ből — sorrendtartó, stabil referencia nem elvárás).
- Consumes: a meglévő `MezoMessageItem` alak (id/artifactId/kind/eyebrow/time/paragraphs/refs/meta).

- [ ] **Step 1: Bukó tesztek** — `mezoMessages.test.ts` végére:

```ts
describe('partitionMezoThread (mezo-ho9k)', () => {
  const feedItem: MezoMessageItem = {
    id: 'morning', artifactId: 'fm-1', kind: 'morning', eyebrow: 'Reggeli briefing',
    time: '07:05', paragraphs: ['szöveg'], refs: [], meta: null,
  }
  const nudgeItem: MezoMessageItem = {
    id: 'nudge-hidratacio-2026-05-22T12:00:00.000Z', eyebrow: 'Életjel', time: '12:00',
    paragraphs: ['💧'], refs: [], meta: 'Életjel-figyelő', source: 'eletjel',
  }

  test('a source: eletjel elemek az eletjelek partícióba kerülnek, a többi az uzenetek-be', () => {
    const { uzenetek, eletjelek } = partitionMezoThread([feedItem, nudgeItem])
    expect(uzenetek).toEqual([feedItem])
    expect(eletjelek).toEqual([nudgeItem])
  })

  test('sorrendtartó mindkét partíción belül', () => {
    const n2 = { ...nudgeItem, id: 'nudge-mozgas-x' }
    const f2 = { ...feedItem, id: 'sleep' }
    const { uzenetek, eletjelek } = partitionMezoThread([feedItem, nudgeItem, f2, n2])
    expect(uzenetek.map((m) => m.id)).toEqual(['morning', 'sleep'])
    expect(eletjelek.map((m) => m.id)).toEqual([nudgeItem.id, 'nudge-mozgas-x'])
  })
})
```

`needsNudges.test.ts` végére:

```ts
test('toNudgeMessage stamps source: eletjel — the tab partition key (mezo-ho9k)', () => {
  expect(toNudgeMessage({ key: 'hidratacio', at: '2026-05-22T12:00:00.000Z' }).source).toBe('eletjel')
})
```

Az importokat bővítsd: `partitionMezoThread` a `mezoMessages`-ből; a `MezoMessageItem` típus már importálva van vagy vedd fel.

- [ ] **Step 2: Futtasd — bukjon** — `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/today/logic/mezoMessages.test.ts src/features/today/logic/needsNudges.test.ts` → FAIL (`partitionMezoThread` nem létezik; `source` undefined).

- [ ] **Step 3: Implementáció** — `mezoMessages.ts`: a `MezoMessageItem` interface `meta` sora után:

```ts
  /** Tab-partíció kulcs (mezo-ho9k): 'eletjel' = Életjel-figyelő nudge — a NapMezoPage
   *  Életjelek tabjára tartozik. Hiánya = companion-üzenet (Üzenetek tab). */
  source?: 'eletjel'
```

A fájl végére:

```ts
/** A NapMezoPage két tabjának partíciója (mezo-ho9k). Pure, sorrendtartó — a szál
 *  maga (sorrend, tartalom) érintetlen: ez CSAK megjelenítési bontás. */
export function partitionMezoThread(messages: MezoMessageItem[]): {
  uzenetek: MezoMessageItem[]
  eletjelek: MezoMessageItem[]
} {
  return {
    uzenetek: messages.filter((m) => m.source !== 'eletjel'),
    eletjelek: messages.filter((m) => m.source === 'eletjel'),
  }
}
```

`needsNudges.ts` `toNudgeMessage` return-objektumába: `source: 'eletjel',` (a `meta` sor után).

- [ ] **Step 4: Futtasd — zöld mindkét módban** — a Step 2 parancs `VITE_USE_MOCK=true`-val és `VITE_USE_MOCK=false`-szal is: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/logic/mezoMessages.ts frontend/src/features/today/logic/mezoMessages.test.ts frontend/src/features/today/logic/needsNudges.ts frontend/src/features/today/logic/needsNudges.test.ts
git commit -m "feat(today): source mező + partitionMezoThread a tab-bontáshoz (mezo-ho9k)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Tab-váz a NapMezoPage-ben (szegmens-váltó + két pane)

**Files:**
- Modify: `frontend/src/features/today/pages/NapMezoPage.tsx`
- Modify: `frontend/src/styles/prototype.css` (a `.nap-mz-cta` blokk után)
- Test: `frontend/src/features/today/pages/NapMezoPage.test.tsx`

**Interfaces:**
- Consumes: `partitionMezoThread` (Task 1).
- Produces: `?tab=eletjelek` URL-szerződés (minden más érték/hiány = Üzenetek); `.nap-mzseg` szegmens-váltó (`role="tablist"`, gombok `role="tab"` + `aria-selected`); a nudge-kártyák CSAK az Életjelek pane-ben. A meglévő üzenet-kártya render (`.nap-mzmsg` + chips) és a CTA az Üzenetek pane-ben marad.

- [ ] **Step 1: Bukó tesztek** — `NapMezoPage.test.tsx`. A meglévő nudge-tesztek tabot kell váltsanak: a `'a red Életjel ring appends its nudge…'` tesztben a szál-végi pozíció-assertek helyett tab-viselkedés. Cseréld le a két nudge-tesztet és vedd fel az újakat:

```ts
// ── Tab-szétválasztás (mezo-ho9k): a nudge-ok az Életjelek tabra költöznek.
test('alapból az Üzenetek tab aktív, a nudge nem látszik — az Életjelek tabra váltva igen', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  renderPage()
  expect(await screen.findByText('07:05 · Reggeli briefing')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Üzenetek/ })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByText(/alig ittál/)).toBeNull()
  await userEvent.click(screen.getByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  expect(screen.queryByText('07:05 · Reggeli briefing')).toBeNull()
})

test('a nudge naponta egyszer jelenik meg az Életjelek tabon (megjelenés-napló változatlan)', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  const { unmount } = renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  unmount()
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(1)
})

test('?tab=eletjelek induláskor az Életjelek tabot nyitja', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/nap/uzenetek?tab=eletjelek']}>
        <MezoThreadProvider>
          <Routes><Route path="/nap/uzenetek" element={<NapMezoPage />} /></Routes>
        </MezoThreadProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Életjelek/ })).toHaveAttribute('aria-selected', 'true')
})
```

A `'a healthy ring set adds nothing to the thread'` teszt maradhat, de assertje az Üzenetek tabra vonatkozik (1 kártya) — változatlanul zöld lesz. A hero-teszt (`2 üzenet`) változatlan: a hero a TELJES szálat számolja.

- [ ] **Step 2: Futtasd — bukjon** — `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/today/pages/NapMezoPage.test.tsx` → FAIL (nincs `tab` role).

- [ ] **Step 3: Implementáció** — `NapMezoPage.tsx`:

Import-bővítés: `partitionMezoThread` a `mezoMessages`-ből; `cn` a `@/shared/lib/cn`-ből.

A komponensben (a `useSearchParams` már megvan — `params`):

```tsx
type MezoTab = 'uzenetek' | 'eletjelek'
const tab: MezoTab = params.get('tab') === 'eletjelek' ? 'eletjelek' : 'uzenetek'
const setTab = (t: MezoTab) => {
  const next = new URLSearchParams(params)
  if (t === 'eletjelek') next.set('tab', 'eletjelek')
  else next.delete('tab')
  setParams(next, { replace: true })
}
const { uzenetek, eletjelek } = useMemo(() => partitionMezoThread(messages), [messages])
```

Ehhez a `useSearchParams` hívást bővítsd: `const [params, setParams] = useSearchParams()`.

A JSX-ben a hero UTÁN, a `PageBody` elején a szegmens-váltó, majd a két pane. A meglévő `displayMessages.map(...)` render-blokk VÁLTOZATLANUL költözik az Üzenetek pane-be, csak a forráslistája változik: `displayUzenetek = linkedItem ? [linkedItem, ...uzenetek] : uzenetek` (a `displayMessages` memo cserélődik erre). Az Életjelek pane ugyanazzal a kártya-markuppal rendereli az `eletjelek` listát (idő · eyebrow fej, szöveg, meta — chips ott SOSEM lesz, mert nudge-nak nincs `artifactId`-je):

```tsx
<div className="nap-mzseg" role="tablist" aria-label="Mezo tartalom">
  <button type="button" role="tab" aria-selected={tab === 'uzenetek'}
    className={cn(tab === 'uzenetek' && 'on')} onClick={() => setTab('uzenetek')}>
    Üzenetek
  </button>
  <button type="button" role="tab" aria-selected={tab === 'eletjelek'}
    className={cn(tab === 'eletjelek' && 'on')} onClick={() => setTab('eletjelek')}>
    Életjelek
  </button>
</div>
```

Pane-váltás feltételes renderrel (`{tab === 'uzenetek' && (...)}` / `{tab === 'eletjelek' && (...)}`) — nem `hidden` attribútummal, a meglévő EntranceGroup-stagger így pane-enként újraindul. A CTA az Üzenetek pane része marad. Az Életjelek pane kártyarendere a nudge-elemekre a meglévo kártya-JSX másolata chips-ág nélkül (a `messageSpot` helyett fix `s-energia` spot NEM kell — a nudge-kártya fej maradjon a mostani: spot nélkül nem volt eddig sem; a mostani render minden elemre ugyanaz, tartsd is meg egy közös `renderCard(m, i, { chips })` helper-függvénnyel a komponensen belül, hogy ne legyen duplikált JSX).

`prototype.css` — a `.nap-mz-cta` blokk után:

```css
/* ── Üzenetek | Életjelek tab-váltó (mezo-ho9k) — a mem-seg pill-idióma a nap
      oldalon: 44pt gombok, aktív = gradient CTA. ── */
.nap-mzseg { display: flex; gap: 5px; border-radius: 999px; padding: 4px; margin-bottom: 12px;
  background: color-mix(in srgb, var(--text-primary) 5%, transparent); }
.nap-mzseg button { flex: 1; border: none; background: none; border-radius: 999px; min-height: 44px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12px; font-weight: 700; color: var(--mz-ink-soft); font-family: inherit; cursor: pointer; }
.nap-mzseg button.on { background: var(--gradient-cta); color: #fff;
  box-shadow: 0 4px 9px -2px rgba(255, 91, 54, 0.5); }
```

- [ ] **Step 4: Futtasd — zöld mindkét módban** — `VITE_USE_MOCK=true` és `VITE_USE_MOCK=false` a NapMezoPage.test.tsx-re, PLUSZ a szomszéd-őrök: `pnpm vitest run src/features/today/pages/NapMezoPage.test.tsx src/app/AppHeader.test.tsx src/features/today/todayTapTargets.test.ts src/features/today/todayCssTokens.test.ts src/features/today/todayScope.test.ts`.

- [ ] **Step 5: Commit** — `feat(today): Üzenetek | Életjelek tab-váltó a NapMezoPage-en (mezo-ho9k)` (a szokott formában).

---

### Task 3: Üzenetek tab — régebbiek összecsukva

**Files:**
- Modify: `frontend/src/features/today/pages/NapMezoPage.tsx`
- Modify: `frontend/src/styles/prototype.css` (a `.nap-mzseg` blokk után)
- Test: `frontend/src/features/today/pages/NapMezoPage.test.tsx`

**Interfaces:**
- Consumes: Task 2 `displayUzenetek` listája és `renderCard` helpere.
- Produces: az Üzenetek pane-ben CSAK az utolsó elem (a nap legfrissebb hangja — a lista vége) teljes kártya; minden korábbi `.nap-mzrow` összecsukott gomb (`aria-expanded`), koppintásra teljes kártyává nyílik. `expandedIds: Set<string>` state; a kibontás nem csukható vissza (YAGNI — a prototípus sem csukja).

- [ ] **Step 1: Bukó tesztek**:

```ts
// ── Összecsukott régebbiek (mezo-ho9k): a legújabb teljes, a többi egysoros.
test('a legújabb üzenet teljes kártya, a régebbi összecsukott sor — koppintva kinyílik chipekkel', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg, sleepMsg])
  renderPage()
  // a szál vége (sleep, 07:12) a legfrissebb → az teljes kártya
  expect(await screen.findByText('07:12 · Alvás-reakció')).toBeInTheDocument()
  expect(screen.getByText(/zsinórban a harmadik/)).toBeInTheDocument()
  // a morning (07:05) összecsukott: a fejsora látszik, a törzse nem
  expect(screen.queryByText(/W3-csúcs/)).toBeNull()
  const row = screen.getByRole('button', { name: /07:05.*Reggeli briefing/ })
  expect(row).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(row)
  expect(await screen.findByText(/W3-csúcs/)).toBeInTheDocument()
  // kibontva a chipjei is élnek (mezo-kr9v: artifactos sor)
  const msg = screen.getByText('07:05 · Reggeli briefing').closest('.nap-mzmsg') as HTMLElement
  await userEvent.click(within(msg).getByRole('button', { name: /Segített/ }))
  expect(voteMock.vote).toHaveBeenCalledWith('fm-1', 'up', undefined)
})

test('egyetlen üzenet nem kap összecsukott sort', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  renderPage()
  expect(await screen.findByText(/W3-csúcs/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /07:05.*Reggeli briefing/ })).toBeNull()
})
```

FIGYELEM: a meglévő `'feed messages render as thread cards…'` teszt két teljes kártyát vár — igazítsd: a morning-ra kattints rá előbb (vagy assertáld az összecsukott fejsort). A `'no morning message…'` teszt (demo + sleep = 2 kártya) szintén: a demo lesz összecsukva, a `cards[0]` assert cserélendő kibontás utánira. A watermark-teszt változatlan.

- [ ] **Step 2: Futtasd — bukjon.**

- [ ] **Step 3: Implementáció** — a komponensben:

```tsx
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
const isExpanded = (id: string) => expandedIds.has(id)
const expand = (id: string) => setExpandedIds((s) => new Set(s).add(id))
```

Az Üzenetek pane render: `displayUzenetek.map((m, i) => …)` — ha `i === displayUzenetek.length - 1` (legfrissebb) VAGY `isExpanded(m.id)` VAGY `m.id === scrollTargetId`, a teljes `renderCard`; különben:

```tsx
<button type="button" key={m.id} className="nap-mzrow rise"
  style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}
  aria-expanded="false" onClick={() => expand(m.id)}>
  <span className="t">{m.time ? `${m.time} · ${m.eyebrow}` : m.eyebrow}</span>
  <span className="pv">{m.paragraphs[0]}</span>
  <span className="chev" aria-hidden="true">▾</span>
</button>
```

(A kibontott kártyán nem kell `aria-expanded` — a sor-gomb eltűnik, kártya jön helyette.)

`prototype.css`:

```css
/* ── Összecsukott régebbi üzenet-sor (mezo-ho9k) ── */
.nap-mzrow { width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 10px;
  text-align: left; min-height: 44px; margin-bottom: 8px; padding: 10px 14px; cursor: pointer;
  background: var(--surface-card); border-radius: 15px; border: 0.5px solid rgba(43, 33, 24, 0.06);
  box-shadow: 0 10px 22px -17px rgba(43, 33, 24, 0.3); font-family: inherit; color: var(--text-primary); }
.nap-mzrow .t { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: #A8801F; flex: none; }
.nap-mzrow .pv { flex: 1; min-width: 0; font-size: 12px; font-weight: 300; color: var(--mz-ink-mut);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nap-mzrow .chev { color: var(--mz-ink-mut); font-size: 12px; flex: none; }
```

- [ ] **Step 4: Futtasd — zöld mindkét módban** (a Task 2 Step 4 fájl-listájával).

- [ ] **Step 5: Commit** — `feat(today): régebbi üzenetek összecsukva az Üzenetek tabon (mezo-ho9k)`.

---

### Task 4: Életjelek tab — státusz-sáv + „minden rendben"

**Files:**
- Create: `frontend/src/features/today/components/EletjelStrip.tsx`
- Modify: `frontend/src/features/today/pages/NapMezoPage.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Test: `frontend/src/features/today/pages/NapMezoPage.test.tsx`

**Interfaces:**
- Consumes: `useNeeds(tick)` (`{ states: NeedState[]; isPending }`), `useMinuteTick()`, `VITAL_TILE`-analóg skin — de itt a `NEED_META`-t NE használd: a tab a EletjelPage tile-nyelvét beszéli. Exportáld a skint az EletjelPage-ből: `EletjelPage.tsx`-ben a `VITAL_TILE` konstansra tegyél `export`-ot, és importáld.
- Produces: `<EletjelStrip states={NeedState[]} onOpen={() => void} />` — 6 cella (`.nap-ejcell`): eyebrow + mini conic ring (a meglévő `.ej-rr` osztállyal) + %; piros/kritikus cella `warn` osztályt kap; a teljes sáv egy gomb, `onOpen` → `/nap/eletjel` (a meglévő teljes életjel-oldal).

- [ ] **Step 1: Bukó tesztek**:

```ts
// ── Életjelek tab státusz-sáv (mezo-ho9k): mindig látszik, sosem üres a tab.
test('az Életjelek tab a 6 gyűrű státusz-sávját mutatja, riasztás nélkül "minden rendben" sorral', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [
    { key: 'energia', pct: 72, band: 'green' }, { key: 'hidratacio', pct: 82, band: 'green' },
    { key: 'pihenes', pct: 88, band: 'green' }, { key: 'mozgas', pct: 65, band: 'green' },
    { key: 'lelek', pct: 60, band: 'green' }, { key: 'rend', pct: 55, band: 'yellow' },
  ]
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText('Víz')).toBeInTheDocument() // hidratacio eyebrow (EletjelPage tile-nyelv)
  expect(screen.getByText('82%')).toBeInTheDocument()
  expect(screen.getByText(/Minden gyűrű rendben/)).toBeInTheDocument()
  expect(document.querySelectorAll('.nap-ejcell')).toHaveLength(6)
})

test('piros gyűrű cellája warn jelölést kap, és a nudge-kártya alatta áll — nincs "minden rendben"', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: /Életjelek/ }))
  expect(await screen.findByText(/alig ittál/)).toBeInTheDocument()
  expect(document.querySelector('.nap-ejcell.warn')).not.toBeNull()
  expect(screen.queryByText(/Minden gyűrű rendben/)).toBeNull()
})

test('a státusz-sáv a teljes életjel-oldalra visz', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 82, band: 'green' }]
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/nap/uzenetek?tab=eletjelek']}>
        <MezoThreadProvider>
          <Routes>
            <Route path="/nap/uzenetek" element={<NapMezoPage />} />
            <Route path="/nap/eletjel" element={<div>eletjel-page</div>} />
          </Routes>
        </MezoThreadProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Életjelek részletei' }))
  expect(await screen.findByText('eletjel-page')).toBeInTheDocument()
})
```

Megjegyzés: a suite `useNeeds`-mockja miatt a strip a `needsMock.states`-ből dolgozik; a NapMezoPage a saját `useNeeds(tick)` hívását ugyanazon a mockon kapja.

- [ ] **Step 2: Futtasd — bukjon.**

- [ ] **Step 3: Implementáció** — `EletjelPage.tsx`: `const VITAL_TILE` → `export const VITAL_TILE` (semmi más nem változik). Új `frontend/src/features/today/components/EletjelStrip.tsx`:

```tsx
// ============================================================
// Mezo · EletjelStrip — a NapMezoPage Életjelek tabjának kompakt státusz-sávja
// (mezo-ho9k): 6 cella (eyebrow + mini conic ring + %), az EletjelPage tile-
// nyelvén (VITAL_TILE skin). Az egész sáv egy gomb — a teljes /nap/eletjel
// oldalra visz. Honest states: pending alatt a hívó nem rendereli (nincs
// kitalált százalék). A piros/kritikus cella warn-t kap.
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { NeedState } from '@/features/today/logic/needs'
import { VITAL_TILE } from '@/features/today/pages/EletjelPage'

export function EletjelStrip({ states, onOpen }: { states: NeedState[]; onOpen: () => void }) {
  return (
    <button type="button" className="nap-ejstrip rise" style={{ '--d': '40ms' } as React.CSSProperties}
      onClick={onOpen} aria-label="Életjelek részletei">
      {states.map((s) => {
        const meta = VITAL_TILE[s.key]
        const warn = s.band === 'red' || s.band === 'critical'
        return (
          <span key={s.key} className={cn('nap-ejcell', warn && 'warn')}>
            <span className="eb" style={{ color: meta.ink }}>{meta.eyebrow}</span>
            <span className="ej-rr" style={{ '--v': s.pct, '--c': meta.ring } as React.CSSProperties} aria-hidden="true" />
            <span className="pct">{s.pct}%</span>
          </span>
        )
      })}
    </button>
  )
}
```

`NapMezoPage.tsx` — az Életjelek pane:

```tsx
{tab === 'eletjelek' && (
  <EntranceGroup>
    {!needs.isPending && <EletjelStrip states={needs.states} onOpen={() => navigate('/nap/eletjel')} />}
    {eletjelek.map((m, i) => renderCard(m, i))}
    {!needs.isPending && eletjelek.length === 0 && (
      <p className="nap-ejok rise" style={{ '--d': '100ms' } as React.CSSProperties}>
        Minden gyűrű rendben — ma nincs teendő. ✓
      </p>
    )}
  </EntranceGroup>
)}
```

Ehhez a page-ben: `const tick = useMinuteTick()` + `const needs = useNeeds(tick)` importokkal (`useMinuteTick`, `useNeeds`, `EletjelStrip`).

`prototype.css`:

```css
/* ── Életjelek tab: státusz-sáv + rendben-sor (mezo-ho9k) ── */
.nap-ejstrip { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; width: 100%;
  box-sizing: border-box; margin-bottom: 12px; padding: 0; border: none; background: none;
  font-family: inherit; cursor: pointer; }
.nap-ejcell { display: grid; justify-items: center; gap: 4px; padding: 9px 2px 7px; min-height: 44px;
  background: var(--surface-card); border-radius: 13px; border: 0.5px solid rgba(43, 33, 24, 0.06); }
.nap-ejcell .eb { font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.nap-ejcell .pct { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
.nap-ejcell.warn { border-color: color-mix(in srgb, var(--coral-deep, #E85D33) 55%, transparent); }
.nap-ejok { font-size: 12px; font-weight: 600; color: var(--sage-deep, #5F7A52); text-align: center; margin: 4px 0 10px; }
```

(Token-ellenőrzés: ha `--coral-deep`/`--sage-deep` nem létezik a prototype.css tokenjei közt, használd a todayCssTokens.test.ts által elfogadott megfelelőt — a teszt megmondja.)

- [ ] **Step 4: Futtasd — zöld mindkét módban** (Task 2 Step 4 fájl-listája + `src/features/today/pages/EletjelPage.test.tsx`).

- [ ] **Step 5: Commit** — `feat(today): Életjelek tab státusz-sáv + rendben-állapot (mezo-ho9k)`.

---

### Task 5: Tab-pöttyök (olvasatlan-pillanatkép)

**Files:**
- Modify: `frontend/src/features/today/pages/NapMezoPage.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Test: `frontend/src/features/today/pages/NapMezoPage.test.tsx`

**Interfaces:**
- Consumes: `useMezoThread()` `unread` mezője (a vízjel ÓTA érkezett elemek száma — a szál UTOLSÓ `unread` eleme az olvasatlan halmaz), Task 1 partíciója.
- Produces: `.nap-mzdot` pötty a tab-gombokban; session-lokális állapot, nem perzisztens.

- [ ] **Step 1: Bukó tesztek**:

```ts
// ── Tab-pöttyök (mezo-ho9k): belépéskori olvasatlan-pillanatkép, tab-látogatás törli.
test('olvasatlan nudge mellett az Életjelek tabon pötty ég, és a tab meglátogatása törli', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  renderPage()
  await screen.findByText('07:05 · Reggeli briefing')
  const ejTab = screen.getByRole('tab', { name: /Életjelek/ })
  expect(ejTab.querySelector('.nap-mzdot')).not.toBeNull()
  // az aktív Üzenetek tabon nincs pötty (ott van a user)
  expect(screen.getByRole('tab', { name: /Üzenetek/ }).querySelector('.nap-mzdot')).toBeNull()
  await userEvent.click(ejTab)
  expect(ejTab.querySelector('.nap-mzdot')).toBeNull()
})

test('minden olvasottnak jelölve → egyik tabon sincs pötty', async () => {
  feedMock.useCompanionFeed.mockReturnValue([morningMsg])
  needsMock.states = [{ key: 'hidratacio', pct: 12, band: 'red' }]
  const { unmount } = renderPage()
  await screen.findByText('07:05 · Reggeli briefing') // markSeen lefutott
  unmount()
  renderPage()
  await screen.findByText('07:05 · Reggeli briefing')
  expect(document.querySelector('.nap-mzdot')).toBeNull()
})
```

- [ ] **Step 2: Futtasd — bukjon.**

- [ ] **Step 3: Implementáció** — a page-ben a `markSeen` effect ELÉ (az effect-deklarációk sorrendje adja, hogy a pillanatkép a vízjel-bélyegzés ELŐTT készül):

```tsx
// Belépéskori olvasatlan-pillanatkép (mezo-ho9k): a szál utolsó `unread` eleme az
// olvasatlan halmaz — partíciónként egy pötty. A markSeen effect KÉSŐBB fut (lentebb
// deklarált), így itt még a belépés előtti unread él. Session-lokális, nem perzisztens.
const { messages, unread, markSeen } = useMezoThread()
const [dots, setDots] = useState<{ uzenetek: boolean; eletjelek: boolean } | null>(null)
useEffect(() => {
  if (dots !== null || messages.length === 0) return
  const unseen = messages.slice(messages.length - unread)
  setDots({
    uzenetek: unseen.some((m) => m.source !== 'eletjel'),
    eletjelek: unseen.some((m) => m.source === 'eletjel'),
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- egyszeri pillanatkép
}, [messages, unread, dots])
useEffect(() => {
  if (dots?.[tab]) setDots((d) => (d ? { ...d, [tab]: false } : d))
}, [tab, dots])
```

(A meglévő `const { messages, markSeen } = useMezoThread()` sor bővül `unread`-del.) A tab-gombokban: `{dots?.uzenetek && tab !== 'uzenetek' && <span className="nap-mzdot" />}` (és ugyanez eletjelek-re). Mivel az aktív tab pöttye a második effectben azonnal törlődik, a `tab !== …` guard csak villanás-védelem.

`prototype.css`: `.nap-mzdot { width: 6px; height: 6px; border-radius: 50%; background: var(--gradient-cta); flex: none; }` — ha a gradient nem áll háttérként pöttyön, `background: #E85D33` a nap-blokk literál-idiómájával.

- [ ] **Step 4: Futtasd — zöld mindkét módban** (Task 2 Step 4 listája — az AppHeader.test.tsx külön figyelemmel: a badge-életciklusnak változatlannak kell lennie).

- [ ] **Step 5: Commit** — `feat(today): tab-pöttyök a belépéskori olvasatlan-pillanatképből (mezo-ho9k)`.

---

### Task 6: Deeplink — Üzenetek tabra kényszerítés + kibontás

**Files:**
- Modify: `frontend/src/features/today/pages/NapMezoPage.tsx`
- Test: `frontend/src/features/today/pages/NapMezoPage.deeplink.test.tsx`

**Interfaces:**
- Consumes: Task 2 tab-állapot, Task 3 `isExpanded`/kibontási feltétel (`m.id === scrollTargetId` már teljes kártyát ad), a meglévő `deepLinkId`/`scrollTargetId` plumbing.
- Produces: `?n=` jelenlétekor a tab MINDIG `uzenetek` (a `?tab=eletjelek`-et is felülírja); a scroll-target kártya teljesként renderel.

- [ ] **Step 1: Bukó teszt** — `NapMezoPage.deeplink.test.tsx`-ben (a fájl meglévő `renderPage(path)` harnessével):

```ts
test('a deeplink ?tab=eletjelek mellett is az Üzenetek tabra érkezik, a cél-kártya kibontva (mezo-ho9k)', async () => {
  // ugyanaz a fixture-szereposztás, mint a fájl same-day deeplink tesztjében: a feedben
  // lévő sor uuid-jével — másold az ottani mock-beállítást.
  renderPage('/nap/uzenetek?n=<a same-day teszt uuid-je>&tab=eletjelek')
  expect(await screen.findByRole('tab', { name: /Üzenetek/ })).toHaveAttribute('aria-selected', 'true')
  // a cél-kártya teljes (nem összecsukott sor): a törzse látszik
  // (a same-day teszt meglévő assertje a scroll/highlightra változatlanul áll)
})
```

A `<a same-day teszt uuid-je>` helyére a fájl meglévő same-day tesztjének tényleges fixture-uuid-ja kerül — olvasd ki a fájlból implementáláskor, és a törzs-assertet a fixture szövegére írd.

- [ ] **Step 2: Futtasd — bukjon** — `VITE_USE_MOCK=true pnpm vitest run src/features/today/pages/NapMezoPage.deeplink.test.tsx`.

- [ ] **Step 3: Implementáció** — a Task 2 `tab` levezetése bővül:

```tsx
const tab: MezoTab = deepLinkId ? 'uzenetek' : params.get('tab') === 'eletjelek' ? 'eletjelek' : 'uzenetek'
```

A Task 3 kibontási feltétele (`m.id === scrollTargetId`) már teljes kártyát ad a célnak — ellenőrizd, hogy a same-day target (ami a partíció közepén ülhet) tényleg teljesként jön.

- [ ] **Step 4: Futtasd — zöld mindkét módban** — a deeplink suite + NapMezoPage.test.tsx.

- [ ] **Step 5: Commit** — `feat(today): deeplink mindig az Üzenetek tabra, kibontott céllal (mezo-ho9k)`.

---

### Task 7: Prototípus + dokumentáció + kommentek

**Files:**
- Modify: `docs/design_2.0/prototypes/src/nap-body.html` (`#page-mezo`)
- Modify: `docs/features/today.md` (§2, §9, §10)
- Modify: `frontend/src/features/today/logic/needsNudges.ts` (fejléc-komment), `frontend/src/features/today/pages/NapMezoPage.tsx` (fejléc-komment)
- Run: `node scripts/gen-codemap.mjs` (új fájl: EletjelStrip.tsx)

**Interfaces:** nincs kód-felület — dokumentum-feladat.

- [ ] **Step 1: Prototípus** — a `#page-mezo` `page-body`-jába a hero után szegmens-váltó (a `mem-seg`-gel azonos markup-idióma, `Üzenetek | Életjelek`), a meglévő 3 `mz-msg` az Üzenetek panelbe, egy új Életjelek panel (alapból `hidden`) a 6-cellás mini-ring sávval és egy `Életjel`-kártyával — a jóváhagyott artifact-prototípus (mezo-ho9k brainstorm) szerint; a prototípus-oldal saját `<script>` blokkjában egy kis tabváltó. Futtasd `bash docs/design_2.0/prototypes/build.sh`-t, ha a build összefűzi a src-t (nézd meg a README.md-t).
- [ ] **Step 2: today.md** — §2: a NapMezoPage bekezdés bővítése a tab-viselkedéssel (alap tab, `?tab=`, összecsukás, pöttyök, deeplink-kényszerítés); §9 gotchák: `source: 'eletjel'` a partíció-kulcs (nem eyebrow-szöveg), a pillanatkép-effect deklaráció-sorrendje a markSeen előtt; §10: a two stale bullet (needsNudges "no delivery path", "nudges param unused") törlése/javítása. A `needsNudges.ts` fejléc-kommentben a `TodayPage`-hivatkozás cseréje `MezoThreadProvider`-re; a `NapMezoPage.tsx` fejléc-kommentje bővül a tab-szétválasztással (mezo-ho9k).
- [ ] **Step 3: CODEMAP** — `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`.
- [ ] **Step 4: Teljes fókuszált futás** — `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/today src/app/AppHeader.test.tsx && VITE_USE_MOCK=false pnpm vitest run src/features/today src/app/AppHeader.test.tsx && pnpm lint && pnpm build`.
- [ ] **Step 5: Commit** — `docs(today): tab-szétválasztás prototípus + feature-doc + CODEMAP (mezo-ho9k)`.

---

## Kapuk és lezárás (a végrehajtó session csinálja, nem külön task)

1. `git push -u origin feat/mezo-uzenetek-tabok` → self-PR (`gh pr create`) → CI zöld (a teljes backend IT + FE mindkét mód + lint + contract-drift a CI-ban fut).
2. `git checkout main` TILOS a worktree-ből — a merge-hez: `git fetch origin main`, majd a house-flow szerint main-re merge `--no-ff` (a primary checkout main-jén vagy `git worktree` nélküli push-flow-val, lásd CLAUDE.md) — CSAK CI-zöld után.
3. `bd close mezo-ho9k` + `bd dolt push` + handoff.
