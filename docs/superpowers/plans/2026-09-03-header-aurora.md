# AppHeader aurora fejléc — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az app egyetlen fejléce (`AppHeader`) kap napszak-követő aurora hátteret, kitapadó (sticky) pozíciót kompakt üvegmóddal, és bal oldalt az aktuális szekció nevét egy clay spot ikonnal.

**Architecture:** A fejléc marad EGY komponens (`AppHeader.tsx`), de három új, egy-felelősségű modul segíti: `headerSection.ts` (pure path→{címke, spot} leképezés), `HeaderAurora.tsx` (a dekoratív háttérréteg), `useCondensedHeader.ts` (scroll→kompakt osztály). A vizuális réteg tokenizált CSS-ben él (`prototype.css`), light és dark párral. A jobb oldali gombsor viselkedése változatlan.

**Tech Stack:** React 18 + TypeScript, react-router-dom, Vitest + Testing Library (colocated tesztek), plain CSS custom properties (`prototype.css`), inline SVG.

**Spec:** [`docs/superpowers/specs/2026-09-03-header-aurora-design.md`](../specs/2026-09-03-header-aurora-design.md)
**Prototípus (jóváhagyott látvány):** [`docs/design_2.0/prototypes/header-aurora.html`](../../design_2.0/prototypes/header-aurora.html)
**bd:** mezo-8az6

## Global Constraints

- **Egy fejléc.** Nincs per-hub másolat; minden változás az `AppHeader.tsx`-ben. (`hubHeaders.test.tsx` őrzi.)
- **Tokenek, nem hexek.** Komponensben nincs hardkódolt szín. Minden új CSS custom property a `:root` blokkban ÉS a `:root[data-theme="dark"]` blokkban is deklarálva. Az új tokenek prefixe `--mzh-`.
- **Clay ikonok `<use>`-szal**, `ClayIcon`/`ClaySpot` komponensen át. „Clay, nem emoji" — kőbe vésett szabály.
- **Sprite-lánc:** új clay art ELŐSZÖR `docs/design_2.0/assets/clay-spots.svg`-be kerül, onnan másolódik VERBATIM a `frontend/src/shared/ui/clay/clay-spots.svg`-be. A két fájl bájtra azonos.
- **Magyar UI-szövegek és magyar kommentek** ezen a területen.
- **A jobb oldali gombsor szerződése sérthetetlen:** sorrend (kalauz · napszak · üzenetek · értesítések · profil), `aria-haspopup`, `menuitemradio` + `aria-checked`, Escape / kívülre kattintás / route-váltás zárás, a `?dp=` szemantika a szcenárió-paraméterek megőrzésével és `replace` navigációval.
- **Nincs új végtelen animáció.** Csak `transition`; így nem kell `prefers-reduced-motion` guard, és nem regresszáljuk az S8 invariánst.
- **`prototype.css` a repó legtörékenyebb merge-fájlja.** Minden CSS-változás után KÖTELEZŐ: `pnpm exec vitest run src/shared/ui/mozaik/prototypeCssStructure.test.ts src/shared/ui/mozaik/mozaikCssTokens.test.ts` ÉS `pnpm build`.
- **Tesztfuttatás mindkét módban:** `VITE_USE_MOCK=true` és `VITE_USE_MOCK=false`. A bare `pnpm test` mock-ot futtat kétszer — az nem gate.
- **Minden parancs a worktree gyökeréből**, abszolút úton: `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba`. A frontend parancsok a `frontend/` alkönyvtárból.
- **Commit-üzenet:** conventional subject a bd id-vel, pl. `feat(fe): ... (mezo-8az6)`.

## File Structure

| Fájl | Felelősség |
|---|---|
| `docs/design_2.0/assets/clay-spots.svg` | **Módosít** — a két új `<symbol>` + két új gradiens (a művészeti forrás) |
| `frontend/src/shared/ui/clay/clay-spots.svg` | **Módosít** — verbatim másolat a fentiről |
| `frontend/src/shared/ui/clay/index.tsx` | **Módosít** — `ClaySpotName` unió + 2 név |
| `frontend/src/app/headerSection.ts` | **Új** — pure `sectionFor(pathname)` → `{ label, spot } | null` |
| `frontend/src/app/headerSection.test.ts` | **Új** — a leképezés tesztje |
| `frontend/src/app/HeaderAurora.tsx` | **Új** — a napszak-függő dekoratív háttérréteg (wash + foltok + SVG grafika) |
| `frontend/src/app/useCondensedHeader.ts` | **Új** — a `.screen-content` scrolljából származó `condensed` boolean |
| `frontend/src/app/useCondensedHeader.test.ts` | **Új** — a hook tesztje |
| `frontend/src/app/AppHeader.tsx` | **Módosít** — eyebrow ki, szekció-blokk be, aurora + kompakt osztály |
| `frontend/src/app/AppHeader.test.tsx` | **Módosít** — az eyebrow-teszt helyére a szekció-teszt |
| `frontend/src/styles/prototype.css` | **Módosít** — `--mzh-*` tokenek (light+dark), `.app-head` sticky/aurora/kompakt szabályok |
| `docs/features/_platform-design-system.md` | **Módosít** — a fejléc új rétegei |
| `docs/features/today.md` | **Módosít** — a fejléc-szerződés frissítése (eyebrow → szekciónév) |

---

### Task 1: Két új clay spot — `s-fuel` és `s-en`

A Fuel és az Én szekcióhoz nincs spot a készletben. Mindkettő a meglévő recept szerint készül: 100×100 viewBox, alul tompított árnyék-ellipszis, radiális gradiens, bal-felső fehér highlight.

**Files:**
- Modify: `docs/design_2.0/assets/clay-spots.svg`
- Modify: `frontend/src/shared/ui/clay/clay-spots.svg` (verbatim másolat)
- Modify: `frontend/src/shared/ui/clay/index.tsx:28-34` (`ClaySpotName`)
- Test: `frontend/src/shared/ui/clay/Clay.test.tsx:11-15` (a darabszám 22 → 24)

**Interfaces:**
- Consumes: semmit (ez az első task)
- Produces: `ClaySpotName` két új tagja: `'s-fuel'` és `'s-en'`; a `#s-fuel` és `#s-en` symbol id-k a sprite-ban.

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/shared/ui/clay/Clay.test.tsx` — cseréld a darabszám-tesztet erre, és told alá az új tesztet:

```tsx
test('ClaySprites mounts all 54 icon symbols and 24 spot symbols', () => {
  render(<ClaySprites />)
  expect(document.querySelectorAll('symbol[id^="i-"]')).toHaveLength(54)
  expect(document.querySelectorAll('symbol[id^="s-"]')).toHaveLength(24)
})

// mezo-8az6: a fejléc szekció-spotjaihoz a Fuel és az Én darabja hiányzott a készletből.
test('a két új szekció-spot a sprite-ban van, a clay recept szerint', () => {
  render(<ClaySprites />)
  for (const id of ['s-fuel', 's-en']) {
    const sym = document.querySelector(`#${id}`)
    expect(sym, `${id} hiányzik`).not.toBeNull()
    expect(sym!.getAttribute('viewBox')).toBe('0 0 100 100')
    // minden spot alján tompított árnyék-ellipszis ül
    expect(sym!.querySelector('ellipse')).not.toBeNull()
  }
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/shared/ui/clay/Clay.test.tsx
```

Elvárt: FAIL — „expected 22 to be 24", és `s-fuel hiányzik`.

- [ ] **Step 3: Vedd fel a két gradienst a design_2.0 sprite defs-ébe**

`docs/design_2.0/assets/clay-spots.svg` — a `<defs>` blokk végére, a `sg-mount` gradiens UTÁN (a `</defs>` előtti utolsó gradiens-sor mögé):

```xml
    <!-- mezo-8az6 · a fejléc szekció-spotjaihoz -->
    <radialGradient id="sg-bowl" cx="38%" cy="35%" r="85%"><stop offset="0" stop-color="#B9D3A8"/><stop offset="0.5" stop-color="#7FA06C"/><stop offset="1" stop-color="#4E6B42"/></radialGradient>
    <radialGradient id="sg-person" cx="36%" cy="30%" r="85%"><stop offset="0" stop-color="#FFB597"/><stop offset="0.5" stop-color="#E0704A"/><stop offset="1" stop-color="#C44B26"/></radialGradient>
```

- [ ] **Step 4: Vedd fel a két symbolt**

`docs/design_2.0/assets/clay-spots.svg` — a `s-hegycel` symbol UTÁN (a `<defs>` lezárása előtt, ahol a többi symbol is ül):

```xml
    <!-- mezo-8az6 · Fuel szekció — az i-fuel tál-motívuma, gőzpárával -->
    <symbol id="s-fuel" viewBox="0 0 100 100">
      <ellipse cx="50" cy="90" rx="28" ry="5.5" fill="rgba(78,107,66,0.25)"/>
      <path d="M37 27c0-7 6-7 6-14M57 27c0-7 6-7 6-14" fill="none" stroke="#A8C494" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
      <path d="M14 48a36 33 0 0 0 72 0Z" fill="url(#sg-bowl)"/>
      <rect x="10" y="42" width="80" height="10" rx="5" fill="#A8C494"/>
      <ellipse cx="32" cy="61" rx="9" ry="5.5" fill="rgba(255,255,255,0.4)" transform="rotate(-18 32 61)"/>
    </symbol>

    <!-- mezo-8az6 · Én szekció — az i-emberek alakja egy személyre sűrítve -->
    <symbol id="s-en" viewBox="0 0 100 100">
      <ellipse cx="50" cy="91" rx="26" ry="5.5" fill="rgba(196,75,38,0.25)"/>
      <circle cx="50" cy="33" r="19" fill="url(#sg-person)"/>
      <path d="M18 88a32 27 0 0 1 64 0Z" fill="url(#sg-person)"/>
      <ellipse cx="42" cy="25" rx="7" ry="4.5" fill="rgba(255,255,255,0.55)" transform="rotate(-22 42 25)"/>
    </symbol>
```

- [ ] **Step 5: Másold a sprite-ot verbatim a frontendbe**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && cp docs/design_2.0/assets/clay-spots.svg frontend/src/shared/ui/clay/clay-spots.svg && diff docs/design_2.0/assets/clay-spots.svg frontend/src/shared/ui/clay/clay-spots.svg && echo "VERBATIM OK"
```

Elvárt: `VERBATIM OK` (a diff néma).

- [ ] **Step 6: Bővítsd a `ClaySpotName` uniót**

`frontend/src/shared/ui/clay/index.tsx` — a `| 's-orb-pszichologus' | 's-orb-drill' | ...` sor UTÁN:

```ts
  // Szekció-spotok a shell-fejléchez (mezo-8az6): a Fuel és az Én darabja hiányzott.
  | 's-fuel' | 's-en'
```

- [ ] **Step 7: Futtasd — menjen át**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/shared/ui/clay/Clay.test.tsx
```

Elvárt: PASS (4 teszt).

- [ ] **Step 8: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git add docs/design_2.0/assets/clay-spots.svg frontend/src/shared/ui/clay/ && git commit -m "feat(fe): s-fuel és s-en clay spot a fejléc szekcióihoz (mezo-8az6)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `headerSection` — path → szekciónév + spot

115 route van; route→cím tábla karbantarthatatlan. A címke szekció-szintű, a path ELSŐ szegmenséből. Ismeretlen prefix → `null` (a fejléc bal oldala üresen marad, a gombsor a helyén).

**Files:**
- Create: `frontend/src/app/headerSection.ts`
- Create: `frontend/src/app/headerSection.test.ts`

**Interfaces:**
- Consumes: `ClaySpotName` (Task 1)
- Produces: `export interface HeaderSection { label: string; spot: ClaySpotName }` és
  `export function sectionFor(pathname: string): HeaderSection | null`

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/app/headerSection.test.ts`:

```ts
import { sectionFor } from '@/app/headerSection'

test('az öt tab gyökere a saját nevét és spotját adja', () => {
  expect(sectionFor('/nap')).toEqual({ label: 'Nap', spot: 's-reggel' })
  expect(sectionFor('/train')).toEqual({ label: 'Edzés', spot: 's-edzes' })
  expect(sectionFor('/fuel')).toEqual({ label: 'Fuel', spot: 's-fuel' })
  expect(sectionFor('/mezo')).toEqual({ label: 'Mezo', spot: 's-orb-figyel' })
  expect(sectionFor('/me')).toEqual({ label: 'Én', spot: 's-en' })
})

// A fejléc a SZEKCIÓT jelöli („hol vagyok"), nem az oldalt — a pontos címet az
// oldal saját PageHead-je adja. Így egy új route sem igényel táblabővítést.
test('a mélyoldalak a szekciójuk címkéjét öröklik', () => {
  expect(sectionFor('/train/mesocycles/42/week/hat')).toEqual({ label: 'Edzés', spot: 's-edzes' })
  expect(sectionFor('/fuel/recipes/12/edit')).toEqual({ label: 'Fuel', spot: 's-fuel' })
  expect(sectionFor('/nap/uzenetek')).toEqual({ label: 'Nap', spot: 's-reggel' })
  expect(sectionFor('/me/sleep')).toEqual({ label: 'Én', spot: 's-en' })
})

test('a query és a záró perjel nem zavarja', () => {
  expect(sectionFor('/nap/')).toEqual({ label: 'Nap', spot: 's-reggel' })
  expect(sectionFor('/train')).toEqual({ label: 'Edzés', spot: 's-edzes' })
})

// Honest state: ismeretlen szekcióra nem találgatunk címet.
test('ismeretlen prefix és a gyökér null-t ad', () => {
  expect(sectionFor('/')).toBeNull()
  expect(sectionFor('/ritual')).toBeNull()
  expect(sectionFor('/auth/login')).toBeNull()
  expect(sectionFor('')).toBeNull()
})

// A „train" prefix nem ragadhat rá egy hasonló nevű szekcióra.
test('a szegmens teljes egyezés, nem prefix-illesztés', () => {
  expect(sectionFor('/training')).toBeNull()
  expect(sectionFor('/napok')).toBeNull()
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/app/headerSection.test.ts
```

Elvárt: FAIL — „Failed to resolve import '@/app/headerSection'".

- [ ] **Step 3: Írd meg a modult**

`frontend/src/app/headerSection.ts`:

```ts
// ============================================================
// Mezo · A shell-fejléc bal oldala: melyik SZEKCIÓBAN vagyunk (mezo-8az6).
// 115 route van, ezért nincs route→cím tábla: a címke a path ELSŐ szegmenséből
// jön, szekció-szinten. A mélyoldal pontos címét a saját PageHead-je adja; a
// fejléc csak a „hol vagyok"-ot mutatja — így új route sosem igényel itt bővítést.
// Ismeretlen szegmensre `null`: a fejléc bal oldala üresen marad (honest state).
// ============================================================
import type { ClaySpotName } from '@/shared/ui/clay'

export interface HeaderSection {
  label: string
  spot: ClaySpotName
}

// A tab-gyökerek a TabBar sorrendjében. A Mezo tudatosan `s-orb-figyel`, nem `s-orb`:
// az utóbbi betűre ugyanaz, mint a fejléc jobb szélén ülő profil-orb.
const SECTIONS: Record<string, HeaderSection> = {
  nap: { label: 'Nap', spot: 's-reggel' },
  train: { label: 'Edzés', spot: 's-edzes' },
  fuel: { label: 'Fuel', spot: 's-fuel' },
  mezo: { label: 'Mezo', spot: 's-orb-figyel' },
  me: { label: 'Én', spot: 's-en' },
}

export function sectionFor(pathname: string): HeaderSection | null {
  const first = pathname.split('/').filter(Boolean)[0]
  return (first && SECTIONS[first]) ?? null
}
```

- [ ] **Step 4: Futtasd — menjen át**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/app/headerSection.test.ts
```

Elvárt: PASS (5 teszt).

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git add frontend/src/app/headerSection.ts frontend/src/app/headerSection.test.ts && git commit -m "feat(fe): headerSection — path→szekciónév+spot leképezés (mezo-8az6)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `useCondensedHeader` — scroll → kompakt mód

A fejléc kitapad; görgetéskor kompakt üvegsávvá húzódik. A küszöb 14px. A scroller a `.screen-content` (`screenScroller()`), ami unit tesztben és portálban hiányozhat — a hook null-safe.

**Files:**
- Create: `frontend/src/app/useCondensedHeader.ts`
- Create: `frontend/src/app/useCondensedHeader.test.ts`

**Interfaces:**
- Consumes: `screenScroller` a `@/shared/lib/screenScroll`-ból
- Produces: `export function useCondensedHeader(): boolean`

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/app/useCondensedHeader.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { useCondensedHeader } from '@/app/useCondensedHeader'

/** A shell egyetlen görgetője; a hook ezt keresi meg. */
function mountScroller(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'screen-content'
  document.body.appendChild(el)
  return el
}

afterEach(() => { document.body.innerHTML = '' })

test('scroller nélkül nem borul el és nem kompakt', () => {
  const { result } = renderHook(() => useCondensedHeader())
  expect(result.current).toBe(false)
})

test('a küszöb fölé görgetve kompakt lesz, vissza alá pedig nem', () => {
  const el = mountScroller()
  const { result } = renderHook(() => useCondensedHeader())
  expect(result.current).toBe(false)

  act(() => { el.scrollTop = 40; el.dispatchEvent(new Event('scroll')) })
  expect(result.current).toBe(true)

  act(() => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')) })
  expect(result.current).toBe(false)
})

test('a küszöbön (14px) még nem kompakt, fölötte igen', () => {
  const el = mountScroller()
  const { result } = renderHook(() => useCondensedHeader())

  act(() => { el.scrollTop = 14; el.dispatchEvent(new Event('scroll')) })
  expect(result.current).toBe(false)

  act(() => { el.scrollTop = 15; el.dispatchEvent(new Event('scroll')) })
  expect(result.current).toBe(true)
})

test('leszereléskor lekapcsolja a listenert', () => {
  const el = mountScroller()
  const remove = vi.spyOn(el, 'removeEventListener')
  const { unmount } = renderHook(() => useCondensedHeader())
  unmount()
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/app/useCondensedHeader.test.ts
```

Elvárt: FAIL — „Failed to resolve import '@/app/useCondensedHeader'".

- [ ] **Step 3: Írd meg a hookot**

`frontend/src/app/useCondensedHeader.ts`:

```ts
// ============================================================
// Mezo · A kitapadó fejléc kompakt módja (mezo-8az6).
// Az app EGYETLEN görgetője a `.screen-content` (screenScroll.ts) — a fejléc benne
// ül, tehát a saját scrolljára iratkozunk fel, passzívan. A küszöb fölött a fejléc
// aurora háttere kifakul, és áttetsző üvegsávvá húzódik össze; az ikonok végig
// elérhetők maradnak. A scroller hiányozhat (unit teszt, portálolt felület) — ilyenkor
// a hook csendben `false`-ot ad.
// ============================================================
import { useEffect, useState } from 'react'
import { screenScroller } from '@/shared/lib/screenScroll'

/** E fölött az offset fölött kompakt a fejléc. */
const THRESHOLD = 14

export function useCondensedHeader(): boolean {
  const [condensed, setCondensed] = useState(false)
  useEffect(() => {
    const el = screenScroller()
    if (!el) return
    const read = () => setCondensed(el.scrollTop > THRESHOLD)
    read() // a belépő állapot (route-váltás után a scroller a tetején áll, de ne feltételezzük)
    el.addEventListener('scroll', read, { passive: true })
    return () => el.removeEventListener('scroll', read)
  }, [])
  return condensed
}
```

- [ ] **Step 4: Futtasd — menjen át**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/app/useCondensedHeader.test.ts
```

Elvárt: PASS (4 teszt).

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git add frontend/src/app/useCondensedHeader.ts frontend/src/app/useCondensedHeader.test.ts && git commit -m "feat(fe): useCondensedHeader — a kitapadó fejléc kompakt módja (mezo-8az6)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `HeaderAurora` — a napszak-függő háttérréteg

A dekoratív réteg: wash + két elmosott fényfolt + napszak-grafika. Tisztán prezentációs, `aria-hidden`, `pointer-events: none` (a CSS adja). A napszakot a hívó adja át, hogy a komponens pure és könnyen tesztelhető maradjon.

**Files:**
- Create: `frontend/src/app/HeaderAurora.tsx`
- Create: `frontend/src/app/HeaderAurora.test.tsx`

**Interfaces:**
- Consumes: `DayFace` típus a `@/features/today/logic/dayFace`-ből (értékei: `'reggel' | 'nap' | 'este'`)
- Produces: `export function HeaderAurora({ face }: { face: DayFace }): JSX.Element` — a gyökere `div.app-head-bg`, `data-face={face}` attribútummal.

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/app/HeaderAurora.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { HeaderAurora } from '@/app/HeaderAurora'

test('a napszakot data-attribútumban adja tovább a CSS-nek', () => {
  const { container, rerender } = render(<HeaderAurora face="reggel" />)
  const bg = container.querySelector('.app-head-bg')!
  expect(bg.getAttribute('data-face')).toBe('reggel')
  rerender(<HeaderAurora face="este" />)
  expect(container.querySelector('.app-head-bg')!.getAttribute('data-face')).toBe('este')
})

test('tisztán dekoratív: a kisegítő fából kimarad', () => {
  const { container } = render(<HeaderAurora face="nap" />)
  expect(container.querySelector('.app-head-bg')!.getAttribute('aria-hidden')).toBe('true')
})

test('minden napszak a saját grafikáját kapja', () => {
  const { container: reggel } = render(<HeaderAurora face="reggel" />)
  const { container: nap } = render(<HeaderAurora face="nap" />)
  const { container: este } = render(<HeaderAurora face="este" />)
  const svg = (c: HTMLElement) => c.querySelector('.app-head-deco svg')!.innerHTML
  expect(svg(reggel)).not.toBe(svg(nap))
  expect(svg(nap)).not.toBe(svg(este))
  // este: csillagok + hold — a legtöbb elemből álló rajz
  expect(este.querySelectorAll('.app-head-deco circle').length).toBeGreaterThan(3)
})

test('a wash és a két fényfolt réteg mindig ott van', () => {
  const { container } = render(<HeaderAurora face="nap" />)
  expect(container.querySelector('.app-head-wash')).not.toBeNull()
  expect(container.querySelectorAll('.app-head-blob')).toHaveLength(2)
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/app/HeaderAurora.test.tsx
```

Elvárt: FAIL — „Failed to resolve import '@/app/HeaderAurora'".

- [ ] **Step 3: Írd meg a komponenst**

`frontend/src/app/HeaderAurora.tsx` — a rajzok 1:1-ben a jóváhagyott prototípusból (`docs/design_2.0/prototypes/header-aurora.html`), 240×92-es viewBoxban:

```tsx
// ============================================================
// Mezo · A fejléc aurora háttere (mezo-8az6) — a Huawei-féle „nem sáv, hanem felület"
// recept: wash + két elmosott fényfolt + napszak-grafika. A réteg alja maszkkal fakul
// a tartalomba (prototype.css), így nincs éles vágás a fejléc és az oldal között.
// Tisztán dekoratív: aria-hidden, és a CSS pointer-events: none-t ad rá.
// A látvány forrása: docs/design_2.0/prototypes/header-aurora.html
// ============================================================
import type { DayFace } from '@/features/today/logic/dayFace'

/** A napszakok dekorációja. A viewBox mindenütt 240×92 — a sáv magassága. */
const DECO: Record<DayFace, JSX.Element> = {
  reggel: (
    <>
      <path className="app-head-arc" d="M10 84 A 180 180 0 0 1 230 84" />
      <path className="app-head-arc" d="M44 84 A 140 140 0 0 1 196 84" opacity="0.55" />
      <circle className="app-head-dfill" cx="120" cy="38" r="11" />
    </>
  ),
  nap: (
    <>
      <circle className="app-head-arc" cx="188" cy="18" r="36" />
      <circle className="app-head-arc" cx="188" cy="18" r="56" opacity="0.5" />
      <ellipse className="app-head-dfill" cx="76" cy="56" rx="32" ry="10" opacity="0.45" />
      <ellipse className="app-head-dfill" cx="112" cy="70" rx="24" ry="8" opacity="0.3" />
    </>
  ),
  este: (
    <>
      <path className="app-head-arc" d="M230 78 A 180 180 0 0 0 10 78" opacity="0.5" />
      <circle className="app-head-dfill" cx="158" cy="22" r="2.4" />
      <circle className="app-head-dfill" cx="200" cy="40" r="1.7" />
      <circle className="app-head-dfill" cx="128" cy="44" r="1.4" />
      <circle className="app-head-dfill" cx="216" cy="16" r="1.4" />
      <circle className="app-head-dfill" cx="104" cy="20" r="1.8" />
      <path className="app-head-dfill" d="M188 60a14 14 0 1 1-6-25a11 11 0 0 0 6 25Z" />
    </>
  ),
}

export function HeaderAurora({ face }: { face: DayFace }) {
  return (
    <div className="app-head-bg" data-face={face} aria-hidden="true">
      <div className="app-head-wash" />
      <span className="app-head-blob b1" />
      <span className="app-head-blob b2" />
      <div className="app-head-deco">
        <svg viewBox="0 0 240 92" width="240" height="92">{DECO[face]}</svg>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Futtasd — menjen át**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/app/HeaderAurora.test.tsx
```

Elvárt: PASS (4 teszt).

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git add frontend/src/app/HeaderAurora.tsx frontend/src/app/HeaderAurora.test.tsx && git commit -m "feat(fe): HeaderAurora — napszak-követő fejléc-háttér (mezo-8az6)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `AppHeader` átszerelése

Az eyebrow helyére a szekció-blokk, a fejléc köré az aurora, és a kompakt osztály. A jobb oldali gombsor egy karaktert sem változik.

**Files:**
- Modify: `frontend/src/app/AppHeader.tsx`
- Modify: `frontend/src/app/AppHeader.test.tsx:199-206` (az eyebrow-teszt helyére)

**Interfaces:**
- Consumes: `sectionFor` (Task 2), `useCondensedHeader` (Task 3), `HeaderAurora` (Task 4), `ClaySpot` (Task 1)
- Produces: a `<header>` osztályai: `nap-head app-head` + kompakt módban `is-cond`; a bal blokk `.app-head-sec` (`.app-head-title` a címke).

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/app/AppHeader.test.tsx` — CSERÉLD a „a fejléc a dátum-eyebrow-val kezdődik" tesztet (199-206. sor) erre a háromra:

```tsx
// ── item 7: a bal oldal a SZEKCIÓT mutatja (mezo-8az6, korábban dátum-eyebrow) ──
test('a fejléc a szekció nevével és spotjával kezdődik', async () => {
  const { container } = renderAt('/fuel')
  await screen.findByRole('button', { name: 'Profil' })
  expect(container.querySelector('.app-head-title')!.textContent).toBe('Fuel')
  expect(container.querySelector('.app-head-sec use')!.getAttribute('href')).toBe('#s-fuel')
})

test('mélyoldalon a szekció címkéje marad', async () => {
  const { container } = renderAt('/train/mesocycles')
  await screen.findByRole('button', { name: 'Profil' })
  expect(container.querySelector('.app-head-title')!.textContent).toBe('Edzés')
})

// A dátum a telefon státuszsávján látszik — a fejlécből tudatosan kikerült.
test('nincs többé dátum-eyebrow a fejlécben', async () => {
  const { container } = renderAt('/fuel')
  await screen.findByRole('button', { name: 'Profil' })
  expect(container.querySelector('.nap-head .mz-eyebrow')).toBeNull()
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/app/AppHeader.test.tsx
```

Elvárt: FAIL — a három új teszt bukik (`.app-head-title` null), a többi 22 átmegy.

- [ ] **Step 3: Írd át az `AppHeader`-t**

`frontend/src/app/AppHeader.tsx` — négy pontosan körülhatárolt módosítás:

**(a)** A fejléc-komment sorrend-szerződését frissítsd (a fájl elején, a 4-5. sorban):

```tsx
// él, és az AppLayout mountolja minden oldalra. Sorrend fixen:
//   szekció (spot + név) · [kalauz ?] · napszakváltó · Mezo-üzenetek · értesítések · profil orb
```

**(b)** Az importok közé (a `ClayIcon, ClaySpot` import már megvan, azt bővítsd, a többi új sor):

```tsx
import { HeaderAurora } from '@/app/HeaderAurora'
import { sectionFor } from '@/app/headerSection'
import { useCondensedHeader } from '@/app/useCondensedHeader'
```

**(c)** A `useToday()` sor helyére (a `const { today } = useToday()` TÖRLENDŐ, és vele a `useToday` import is, ha máshol nem használt — ellenőrizd a fájlban!):

```tsx
  // A bal oldal a szekciót mutatja („hol vagyok"); a pontos oldalcím a lapok PageHead-jéé.
  const section = sectionFor(pathname)
  const condensed = useCondensedHeader()
```

**(d)** A `<header>` nyitása és a bal blokk:

```tsx
    <header className={cn('nap-head app-head', condensed && 'is-cond')} ref={rootRef}>
      <HeaderAurora face={face} />
      <div className="nap-head-grow app-head-sec">
        {section && (
          <>
            <ClaySpot name={section.spot} size={30} className="app-head-spot" />
            <span className="app-head-title">{section.label}</span>
          </>
        )}
      </div>
```

(A régi `<div className="nap-head-grow"><span className="mz-eyebrow">…</span></div>` blokk helyére.)

- [ ] **Step 4: Futtasd az egész fejléc-készletet — menjen át**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/app/AppHeader.test.tsx src/app/hubHeaders.test.tsx src/app/shell.test.tsx
```

Elvárt: PASS. Ha a `hubHeaders` vagy a `shell` bukik, az szerződés-sértés — javítsd a komponenst, NE a tesztet.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git add frontend/src/app/AppHeader.tsx frontend/src/app/AppHeader.test.tsx && git commit -m "feat(fe): a fejléc bal oldala a szekciót mutatja, aurora háttérrel (mezo-8az6)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: A CSS — tokenek, sticky, aurora, kompakt üvegmód

**Files:**
- Modify: `frontend/src/styles/prototype.css` — (a) `:root` token-blokk, (b) `:root[data-theme="dark"]` token-blokk, (c) a fejléc-szabályok a 4525-4564 közötti blokkban

**Interfaces:**
- Consumes: a Task 4/5 osztálynevei (`.app-head-bg`, `.app-head-wash`, `.app-head-blob`, `.app-head-deco`, `.app-head-arc`, `.app-head-dfill`, `.app-head-sec`, `.app-head-title`, `.app-head-spot`, `.is-cond`)
- Produces: `--mzh-*` tokenek mindkét téma-blokkban

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/shared/ui/mozaik/mozaikCssTokens.test.ts` — a fájl VÉGÉRE, a záró `})` elé egy új teszt:

```ts
  // mezo-8az6: a fejléc aurora tokenjei ugyanezt a szabályt követik.
  test('minden --mzh-* fejléc-token deklarált light-ban ÉS dark-ban', () => {
    const light = declared(blockBody(rawCss, /(?:^|\n):root[ \t]*\{([^}]*)\}/))
    const dark = declared(blockBody(rawCss, /(?:^|\n):root\[data-theme="dark"\][ \t]*\{([^}]*)\}/))
    const used = new Set([...rawCss.matchAll(/var\(\s*(--mzh-[a-zA-Z0-9-]+)/g)].map(m => m[1]))
    expect(used.size).toBeGreaterThan(3)
    for (const token of used) {
      expect(light.has(token), `${token} hiányzik a light :root-ból`).toBe(true)
      expect(dark.has(token), `${token} hiányzik a dark blokkból`).toBe(true)
    }
  })
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/shared/ui/mozaik/mozaikCssTokens.test.ts
```

Elvárt: FAIL — „expected 0 to be greater than 3" (még nincs `--mzh-*` használat).

- [ ] **Step 3: Vedd fel a light tokeneket**

`frontend/src/styles/prototype.css` — a `:root` blokkban, közvetlenül a `--mz-ink-mut: #A2958A;` sor UTÁN:

```css
  /* ── Fejléc-aurora (mezo-8az6) — napszak-tónusok. A wash a sáv teteje, a foltok
        adják a mélységet; a réteg alja maszkkal fakul a tartalomba. Dark párjuk a
        dark blokkban, azonos nevekkel. */
  --mzh-wash-reggel: linear-gradient(155deg, #FFD9A8 0%, #FFE7CE 55%, #FFF3E6 100%);
  --mzh-wash-nap:    linear-gradient(155deg, #B9DCF0 0%, #D3E9F6 55%, #EAF4FA 100%);
  --mzh-wash-este:   linear-gradient(155deg, #D6CDF3 0%, #E4DDF7 55%, #F1EDFB 100%);
  --mzh-blob1-reggel: #FFC078; --mzh-blob2-reggel: #FF8E6A;
  --mzh-blob1-nap:    #7FBEE8; --mzh-blob2-nap:    #69CFBD;
  --mzh-blob1-este:   #A392E4; --mzh-blob2-este:   #E28FBB;
  --mzh-deco-line: rgba(43, 33, 24, 0.18);
  --mzh-deco-fill: rgba(43, 33, 24, 0.24);
  --mzh-glass: rgba(255, 255, 255, 0.6);
  --mzh-glass-line: rgba(43, 33, 24, 0.08);
```

- [ ] **Step 4: Vedd fel a dark tokeneket**

`frontend/src/styles/prototype.css` — a `:root[data-theme="dark"]` blokkban, a `--mz-ink-mut` dark megfelelője UTÁN (ha nincs ilyen sor, a blokk `--mz-tone-*` sorai után):

```css
  /* ── Fejléc-aurora dark párja (mezo-8az6): mélyebb, tompított tónusok a grafit
        vászon fölé; a foltok ugyanazok a színek, a wash viszi a sötétítést. */
  --mzh-wash-reggel: linear-gradient(155deg, #5A4224 0%, #3E2E1C 55%, #241C14 100%);
  --mzh-wash-nap:    linear-gradient(155deg, #1F4560 0%, #1C3242 55%, #1A2027 100%);
  --mzh-wash-este:   linear-gradient(155deg, #3A2F63 0%, #2A2444 55%, #1E1A2A 100%);
  --mzh-blob1-reggel: #FFC078; --mzh-blob2-reggel: #FF8E6A;
  --mzh-blob1-nap:    #7FBEE8; --mzh-blob2-nap:    #69CFBD;
  --mzh-blob1-este:   #A392E4; --mzh-blob2-este:   #E28FBB;
  --mzh-deco-line: rgba(255, 255, 255, 0.2);
  --mzh-deco-fill: rgba(255, 255, 255, 0.3);
  --mzh-glass: rgba(24, 19, 15, 0.6);
  --mzh-glass-line: rgba(255, 255, 255, 0.09);
```

- [ ] **Step 5: Írd meg a fejléc-szabályokat**

`frontend/src/styles/prototype.css` — a `.app-head { padding-top: 6px; margin-bottom: 7px; }` szabályt CSERÉLD az alábbi blokkra (a fölötte lévő magyarázó komment maradjon):

```css
/* A fejléc KITAPAD (mezo-8az6): az app egyetlen görgetője a .screen-content, a fejléc
   benne ül, így `top: 0` a helyes — a scroller padding-top: 54px-je már a fake
   státuszsáv alá offsetel (ugyanez a logika, mint a .sticky-top-nál). Az értesítés és
   az üzenetek így egy hosszú lista aljáról is egy koppintásra vannak. */
.app-head {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  padding-top: 6px;
  margin-bottom: 7px;
  transition: padding var(--duration-normal) var(--ease-in-out);
}
/* Az aurora full-bleed: a .screen-content --screen-gutter paddingját negatív margóval
   lépi át, hogy a telefon széléig érjen. A fejléc TARTALMA a gutteren belül marad. */
.app-head-bg {
  position: absolute;
  top: 0;
  left: calc(-1 * var(--screen-gutter));
  right: calc(-1 * var(--screen-gutter));
  height: 92px;
  overflow: hidden;
  pointer-events: none;
  transition: opacity var(--duration-normal) var(--ease-out);
  /* az alja belefolyik a tartalomba — nincs éles vágás */
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 58%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 0%, black 58%, transparent 100%);
}
.app-head-wash { position: absolute; inset: 0; }
.app-head-bg[data-face="reggel"] .app-head-wash { background: var(--mzh-wash-reggel); }
.app-head-bg[data-face="nap"]    .app-head-wash { background: var(--mzh-wash-nap); }
.app-head-bg[data-face="este"]   .app-head-wash { background: var(--mzh-wash-este); }
.app-head-blob { position: absolute; border-radius: 50%; filter: blur(30px); opacity: 0.75; }
.app-head-blob.b1 { width: 190px; height: 190px; left: -56px; top: -84px; }
.app-head-blob.b2 { width: 150px; height: 150px; right: -34px; top: -66px; opacity: 0.55; }
.app-head-bg[data-face="reggel"] .b1 { background: var(--mzh-blob1-reggel); }
.app-head-bg[data-face="reggel"] .b2 { background: var(--mzh-blob2-reggel); }
.app-head-bg[data-face="nap"]    .b1 { background: var(--mzh-blob1-nap); }
.app-head-bg[data-face="nap"]    .b2 { background: var(--mzh-blob2-nap); }
.app-head-bg[data-face="este"]   .b1 { background: var(--mzh-blob1-este); }
.app-head-bg[data-face="este"]   .b2 { background: var(--mzh-blob2-este); }
.app-head-deco { position: absolute; inset: 0; }
.app-head-deco svg { position: absolute; right: 0; top: 0; opacity: 0.9; }
.app-head-arc { fill: none; stroke: var(--mzh-deco-line); stroke-width: 1.5; }
.app-head-dfill { fill: var(--mzh-deco-fill); }
/* A szekció-blokk a fejléc bal oldalán: spot + név, egy sorban, csonkolva. */
.app-head-sec { display: flex; align-items: center; gap: 8px; }
.app-head-spot { flex: none; }
.app-head-title {
  font-size: 19px; font-weight: 800; letter-spacing: -0.02em;
  color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* Kompakt üvegmód: az aurora kifakul, a helyét áttetsző, elmosott sáv veszi át.
   A blur SZÁNDÉKOSAN csak erre az alacsony sávra kerül, nem a teljes aurorára —
   nagy felületen a backdrop-filter gyenge telefonon képkockát ejt. */
.app-head.is-cond { padding-top: 4px; margin-bottom: 3px; }
.app-head.is-cond .app-head-bg { opacity: 0; }
.app-head.is-cond::before {
  content: "";
  position: absolute;
  top: 0; bottom: 0;
  left: calc(-1 * var(--screen-gutter));
  right: calc(-1 * var(--screen-gutter));
  background: var(--mzh-glass);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-bottom: 0.5px solid var(--mzh-glass-line);
}
/* A fejléc tartalma az aurora és az üvegsáv FÖLÖTT ül. */
.app-head > *:not(.app-head-bg) { position: relative; z-index: 1; }
```

- [ ] **Step 6: Futtasd a CSS-kapukat — menjenek át**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm exec vitest run src/shared/ui/mozaik/mozaikCssTokens.test.ts src/shared/ui/mozaik/prototypeCssStructure.test.ts && pnpm build
```

Elvárt: mindkét teszt PASS, és a build hiba nélkül lefut. A `pnpm build` itt NEM opcionális — a struktúra-teszt maga dokumentálja, hogy egyszer még az sem fogta meg a hibát, csak a build.

- [ ] **Step 7: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git add frontend/src/styles/prototype.css frontend/src/shared/ui/mozaik/mozaikCssTokens.test.ts && git commit -m "feat(fe): fejléc-aurora tokenek + sticky/kompakt CSS (mezo-8az6)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Vizuális ellenőrzés élő appban

A CSS-t egység-teszt nem látja. Ez a task a `verify` skill receptjével nézi meg a valódi felületet.

**Files:** nincs kódváltozás; ha hibát találsz, a Task 5/6 fájljait javítod.

**Interfaces:**
- Consumes: a teljes eddigi implementáció
- Produces: megerősítés, hogy a látvány a prototípust követi

- [ ] **Step 1: Indítsd az appot mock módban**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm dev
```

- [ ] **Step 2: Nézd meg a fejlécet a böngészőben**

Ellenőrzési lista (mindegyik a jóváhagyott prototípushoz mérve):

1. `/nap` — bal oldalt nap-spot + „Nap"; az aurora meleg/hűvös a napszak szerint.
2. Görgess le: a fejléc KITAPAD, az aurora kifakul, üvegsáv marad, az öt kontroll kattintható.
3. Görgess vissza: az aurora visszatér.
4. `/train`, `/fuel`, `/mezo`, `/me` — a helyes címke és spot; a Fuel és az Én spotja a többivel egy stílusban ül.
5. Napszakváltó a fejlécben: az aurora tónusa és a grafika követi a választást.
6. Sötét téma (Beállítások): mindhárom napszakban olvasható a cím, a grafika látszik, de nem tolakszik.
7. Az aurora a telefon széléig ér (full-bleed), a cím és az ikonok viszont a 12px gutteren belül.
8. Nyiss egy sheetet (pl. Kalauz „?"): a fejléc a helyén marad, a görgetés zárolva.

- [ ] **Step 3: Ha eltérést látsz, javítsd, és futtasd újra az érintett teszteket**

Minden CSS-javítás után: `pnpm exec vitest run src/shared/ui/mozaik/prototypeCssStructure.test.ts && pnpm build`.

- [ ] **Step 4: Commit (csak ha volt javítás)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git add -A && git commit -m "fix(fe): fejléc-aurora vizuális finomhangolás (mezo-8az6)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Dokumentáció, codemap, teljes kapuk

**Files:**
- Modify: `docs/features/_platform-design-system.md`
- Modify: `docs/features/today.md`
- Modify: `docs/CODEMAP.md` (generált)

- [ ] **Step 1: Frissítsd a design-system feature-docot**

`docs/features/_platform-design-system.md` — a fejlécről szóló résznél (a `mezo-atry` megjegyzés környékén) told hozzá:

```markdown
**Fejléc-aurora (mezo-8az6).** A shell-fejléc kitapad (`position: sticky`, `top: 0` a
`.screen-content` scrollerben), és napszak-követő aurora hátteret visel: wash + két
elmosott fényfolt + dekoratív SVG (`HeaderAurora.tsx`), a réteg alja maszkkal fakul a
tartalomba. Görgetéskor (`useCondensedHeader`, küszöb 14px) az aurora kifakul, és
áttetsző, elmosott üvegsáv marad — az ikonok végig elérhetők. A bal oldalon a SZEKCIÓ
neve + clay spot (`headerSection.ts`), nem a dátum. Tokenek: `--mzh-*`, light és dark
párral. A látvány forrása: `docs/design_2.0/prototypes/header-aurora.html`.
```

- [ ] **Step 2: Frissítsd a Today feature-docot**

`docs/features/today.md` — a „The header is the shell's, not the hub's" szakaszban a hat elem felsorolásánál cseréld a dátum-eyebrow-t:

```markdown
A sorrend: **szekció (clay spot + név)** · [kalauz „?"] · napszakváltó · Mezo-üzenetek ·
értesítések · profil orb. A dátum-eyebrow a mezo-8az6-ban kikerült: a dátumot a
telefon státuszsávja mutatja, a helyét az „épp melyik szekcióban vagyok" vette át
(`app/headerSection.ts` — szekció-szintű, a path első szegmenséből, 115 route mellett
tábla nélkül).
```

- [ ] **Step 3: Regeneráld a codemapet**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && echo "CODEMAP OK"
```

Elvárt: `CODEMAP OK`.

- [ ] **Step 4: Futtasd a TELJES frontend kaput mindkét módban**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba/frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Elvárt: minden zöld. Ha bármi bukik, javítsd, mielőtt továbbmész.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git add -A && git commit -m "docs(fe): fejléc-aurora a design-system és a today feature-docban + codemap (mezo-8az6)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Self-PR, CI-kapu, merge

- [ ] **Step 1: Push és PR**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git push -u origin feat/header-aurora && gh pr create --title "feat(fe): AppHeader aurora fejléc — sticky, szekciónév + clay spot (mezo-8az6)" --body "$(cat <<'EOF'
## Mit

A shell-fejléc vizuális újratervezése a jóváhagyott prototípus szerint
(`docs/design_2.0/prototypes/header-aurora.html`):

- **Aurora háttér** — napszak-követő wash + két fényfolt + dekoratív SVG, alul maszkkal
  a tartalomba fakulva; full-bleed a telefon széléig.
- **Sticky + kompakt üvegmód** — görgetéskor az aurora kifakul, áttetsző elmosott sáv marad;
  az értesítések és az üzenetek egy hosszú lista aljáról is elérhetők.
- **Bal oldalt a szekció** neve + clay spot a dátum-eyebrow helyén (a dátum a telefon
  státuszsávján van). Szekció-szintű, a path első szegmenséből — 115 route mellett tábla nélkül.
- **Két új clay spot:** `s-fuel`, `s-en` (a készletből hiányoztak).

A jobb oldali gombsor viselkedése, a11y-szerződése és a `?dp=` szemantika változatlan.

## Kapuk

FE tesztek mindkét módban, lint, build, CSS-struktúra + token guard, codemap check — lokálisan zöld.

Spec: `docs/superpowers/specs/2026-09-03-header-aurora-design.md`
Terv: `docs/superpowers/plans/2026-09-03-header-aurora.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Várd meg a CI-t**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && gh pr checks --watch
```

Elvárt: minden check zöld. Ha valami bukik, javítsd, pushold, és várd meg újra.

- [ ] **Step 3: Merge lokálisan, `--no-ff`**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && git checkout main && git pull --rebase && git merge --no-ff feat/header-aurora -m "Merge feat/header-aurora — AppHeader aurora fejléc (mezo-8az6)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" && git push
```

- [ ] **Step 4: Zárd a bd issue-t és takaríts**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba && bd close mezo-8az6 && bd dolt push && git push origin --delete feat/header-aurora && git status
```

Elvárt: `git status` „up to date with origin/main".
