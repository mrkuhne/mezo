# Mezo-kalauz S2b — T0 első indítás (`KalauzWelcome`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Négylépéses, teljes képernyős, koppintható onboarding a legelső `/nap` betöltéskor, plusz a `resetAll()` bug javítása és a hiányzó „Kalauzok újranézése" Beállítások sor.

**Architecture:** A welcome adata a `KALAUZ_REGISTRY`-n **kívül** él (`registry/welcome.ts`, saját lépés-unió), de a seen-kulcsa (`'welcome'`) ugyanabba a `tutorial_progress` jsonb map-be megy — a backend kulcs-agnosztikus, tehát **nincs backend-, contract- vagy migráció-változás**. A `TutorialProvider` egy route-hoz kötött `welcomeStatus` state-tel bővül, ami a már meglévő „nem ütemez, amíg bármi nyitva van" guardon (`TutorialProvider.tsx:206`) keresztül nyomja el a `/nap` auto-openjét. A `KalauzWelcome` domain-mentes `shared/ui` komponens, a `LevelUpScreen` full-screen receptjével.

**Tech Stack:** React 18 + TypeScript, react-router-dom, TanStack Query, Vitest + Testing Library, Playwright (vizuális goldenek), MSW.

**Spec:** [`docs/superpowers/specs/2026-09-03-mezo-kalauz-s2b-welcome-design.md`](../specs/2026-09-03-mezo-kalauz-s2b-welcome-design.md)
**Driving bd issue:** `mezo-gb1s.4` (`mezo-gb1s` epic alatt). Beolvasztva: `mezo-gb1s.2` (resetAll bug).

## Global Constraints

- **Frontend-only.** Semmilyen backend-, contract- vagy adatbázis-változás. Nem futtatunk Maven-t.
- **Hang-lint** (a `registry.test.ts` már meglévő szabálya, a WELCOME-ra is kiterjesztve): tiltott tő `/\b(kell|muszáj|hib[aá]|elbuk|rossz)/i` a `title`-ben és a `voice`-ban; `voice` legfeljebb **2 mondat** (a mondat-számláló: `voice.split(/[.!?…]\s+(?=[\p{L}\d*„])/u).length`).
- **Az id-t sosem nevezzük át**, verziót bumpolunk: `WELCOME_ID = 'welcome'`, `WELCOME_VERSION = 1`.
- **`shared/ui` domain-mentes**: a `shared/ui/kalauz/KalauzWelcome.tsx` **nem** importálhat `@/data/*`-ból vagy `@/features/*`-ból. A típusait helyben deklarálja újra (a `KalauzSheet.tsx:19-25` technikája). Nincs eslint-kényszerítés — ez review-felelősség.
- **`src/test/kalauz.ts` Node-safe marad** (a Playwright `tests/visual/visual.spec.ts:2` importálja): modul-szinten se `localStorage`, se DOM.
- **Ref-tükör doktrína** (`TutorialProvider.tsx:55-64`): késleltetett callbackből vagy a route-effektből olvasott state-hez ref-tükör jár, `eslint-disable exhaustive-deps` helyett. A `persist()` **soha** nem hívható setState updateren belülről (StrictMode kétszer hívja).
- **z-index: 60** a welcome-nak (a `.logflow-page` sávja, `prototype.css:6879`).
- **A `prototype.css` merge-törékeny**: az új szabályok EGY összefüggő blokkban, a kalauz-blokk mellé.
- **Reduced motion**: `useReducedMotion()` (`shared/hooks/useReducedMotion.ts`), reduced alatt animáció nélküli végállapot.
- **Kapuk minden task végén**: a task által érintett tesztek. A branch végén: `VITE_USE_MOCK=true pnpm test` **és** `VITE_USE_MOCK=false pnpm test` + `pnpm build` + `node scripts/gen-codemap.mjs`.
- Minden parancs a `frontend/` könyvtárból fut, hacsak más nincs jelezve. Commit-üzenet: `<type>(tutorial): <mit> (mezo-gb1s.4)`, záró sorral `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## File Structure

| Fájl | Felelősség |
|---|---|
| `src/features/tutorial/registry/welcome.ts` | **ÚJ** — a `WELCOME` adat + a `WelcomeStep` unió. Tiszta adat, nulla React. |
| `src/features/tutorial/registry/welcome.test.ts` | **ÚJ** — hang-lint és szerkezeti lint a WELCOME-ra. |
| `src/features/tutorial/registry/lint.ts` | **ÚJ** — a két teszt által megosztott lint-primitívek (`FORBIDDEN`, `countSentences`). |
| `src/features/tutorial/registry/index.ts` | **MÓD** — `versionOf(id)` helper; `findKalauz` érintetlen. |
| `src/features/tutorial/registry/registry.test.ts` | **MÓD** — a lint-primitívek a `lint.ts`-ből jönnek. |
| `src/shared/ui/kalauz/KalauzWelcome.tsx` | **ÚJ** — domain-mentes full-screen lapozó, saját lépés-unióval. |
| `src/shared/ui/kalauz/KalauzWelcome.test.tsx` | **ÚJ** — lépés-navigáció, fókusz, Escape, skip/done. |
| `src/styles/prototype.css` | **MÓD** — `.welcome` / `.wl-*` blokk, z-index 60. |
| `src/features/tutorial/TutorialProvider.tsx` | **MÓD** — `welcomeStatus`, guard-bővítés, render, `isUnseen` ág, `resetAll` fix. |
| `src/features/tutorial/TutorialProvider.test.tsx` | **MÓD** — welcome-elnyomás, nincs láncolás, új eszköz, reset. |
| `src/test/kalauz.ts` | **MÓD** — `'welcome'` a `buildAllSeenProgress()`-be. |
| `src/features/today/pages/NapKuldetesekPage.test.tsx` | **MÓD** — `seedAllKalauzSeen()` a `beforeEach`-be. |
| `src/data/tutorial/tutorialProgressHooks.ts` | **MÓD** — a reset hibája felszínre kerül, GET cancel. |
| `src/data/tutorial/tutorialProgressHooks.test.tsx` | **MÓD** — a reset hiba-útja. |
| `src/features/me/pages/BeallitasokPage.tsx` | **MÓD** — „Kalauzok újranézése" sor. |
| `src/features/me/pages/BeallitasokPage.test.tsx` | **MÓD** — a sor viselkedése. |
| `docs/features/tutorial.md`, `docs/CODEMAP.md` | **MÓD** — feature-doc + codemap. |

---

### Task 1: A welcome adata és a megosztott lint

**Files:**
- Create: `frontend/src/features/tutorial/registry/lint.ts`
- Create: `frontend/src/features/tutorial/registry/welcome.ts`
- Test: `frontend/src/features/tutorial/registry/welcome.test.ts` (create)
- Modify: `frontend/src/features/tutorial/registry/registry.test.ts` (a `FORBIDDEN` és a mondat-számláló a `lint.ts`-ből)

**Interfaces:**
- Consumes: `ClayIconName`, `ClaySpotName` a `@/shared/ui/clay`-ből.
- Produces: `WELCOME_ID: 'welcome'`, `WELCOME_VERSION: 1`, `WELCOME: WelcomeGuide`, és a `WelcomeStep` unió négy tagja (`napszak` | `tabbar` | `log` | `sugo`). A Task 3 a `WelcomeStep` **alakját** másolja (nem importálja — `shared/ui` domain-mentes), a Task 4 a `WELCOME` konstanst és a `WELCOME_VERSION`-t importálja.

- [ ] **Step 1: A megosztott lint-primitívek**

Create `frontend/src/features/tutorial/registry/lint.ts`:

```ts
// ============================================================
// Mezo · kalauz hang-lint primitívek (mezo-gb1s.4).
// Két adathalmaz linteli magát velük: a KALAUZ_REGISTRY kártyái (registry.test.ts)
// és a WELCOME lépései (welcome.test.ts). A szabály EGY helyen él, hogy a welcome
// ne csússzon ki alóla.
// ============================================================

/** Stems, not whole words — no trailing \b — so inflections ("kellene", "hibázik",
 *  "elbuktad", "rosszul") are caught too, not just the dictionary form. */
export const FORBIDDEN = /\b(kell|muszáj|hib[aá]|elbuk|rossz)/i

/**
 * A lookahead szándékosan tág: a mondat kezdődhet **félkövéren** (`*`), számjeggyel, vagy
 * kisbetűvel is (idézet, márkanév) — a szűk „csak nagybetű" változat mellett egy 3 mondatos
 * kártya átcsúszott volna. Unicode-flag, hogy az ékezetes kisbetűk is beleessenek.
 */
export function countSentences(voice: string): number {
  return voice.split(/[.!?…]\s+(?=[\p{L}\d*„])/u).length
}
```

- [ ] **Step 2: A `registry.test.ts` átáll a megosztott primitívekre**

`frontend/src/features/tutorial/registry/registry.test.ts` — töröld a helyi `FORBIDDEN` konstansot (a fájl elején lévő `const FORBIDDEN = ...` a hozzá tartozó két sor kommenttel együtt), és tedd be az importot a többi import után:

```ts
import { FORBIDDEN, countSentences } from '@/features/tutorial/registry/lint'
```

A `hang-lint` tesztben cseréld a helyi `split`-et:

```ts
    const sentences = countSentences(c.voice)
    expect(sentences).toBeLessThanOrEqual(2)
```

(a fölötte lévő három sornyi lookahead-kommentet töröld — az most a `lint.ts`-ben él.)

- [ ] **Step 3: Futtasd a meglévő registry-linteket — zöldnek kell maradniuk**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/registry.test.ts`
Expected: PASS (tiszta refaktor, nulla viselkedés-változás)

- [ ] **Step 4: Írd meg a bukó tesztet a WELCOME-ra**

Create `frontend/src/features/tutorial/registry/welcome.test.ts`:

```ts
import { ClayIconName, ClaySpotName } from '@/shared/ui/clay'
import { FORBIDDEN, countSentences } from '@/features/tutorial/registry/lint'
import { WELCOME, WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'
import { KALAUZ_REGISTRY } from '@/features/tutorial/registry'

test('a welcome NEM a KALAUZ_REGISTRY-ben él', () => {
  // S2b-5: a findKalauz first-match — egy /nap route-ú bejegyzés némán árnyékolná a `nap`
  // kalauzt, és a KalauzCard öt típusa nem tudja kifejezni a koppintható demókat.
  expect(KALAUZ_REGISTRY.some((e) => e.id === WELCOME_ID)).toBe(false)
})

test('a welcome négy lépése a spec §3 sorrendjében áll', () => {
  expect(WELCOME.id).toBe('welcome')
  expect(WELCOME.version).toBe(WELCOME_VERSION)
  expect(WELCOME.steps.map((s) => s.kind)).toEqual(['napszak', 'tabbar', 'log', 'sugo'])
})

test('hang-lint: nincs tiltott szó, lépésenként legfeljebb 2 mondat', () => {
  for (const s of WELCOME.steps) {
    expect(s.title, s.kind).not.toMatch(FORBIDDEN)
    expect(s.voice, s.kind).not.toMatch(FORBIDDEN)
    expect(countSentences(s.voice), s.kind).toBeLessThanOrEqual(2)
  }
})

test('a demó-lépések szövegei is lintelve vannak', () => {
  for (const s of WELCOME.steps) {
    if (s.kind === 'napszak') for (const d of s.dayparts) expect(d.sub, d.label).not.toMatch(FORBIDDEN)
    if (s.kind === 'tabbar') for (const t of s.tabs) {
      expect(t.voice, t.label).not.toMatch(FORBIDDEN)
      expect(countSentences(t.voice), t.label).toBeLessThanOrEqual(2)
    }
    if (s.kind === 'log') for (const t of s.tiles) expect(t.label).not.toMatch(FORBIDDEN)
  }
})

test('a tabbar-lépés az öt VALÓDI fület hordozza, a valódi ikonokkal', () => {
  const step = WELCOME.steps.find((s) => s.kind === 'tabbar')
  expect(step?.kind).toBe('tabbar')
  if (step?.kind !== 'tabbar') return
  // A prototípus `i-polc`-ot használ az Én fülre; a TabBar.tsx:16 `i-emberek`-et. A kód a mérvadó.
  expect(step.tabs.map((t) => t.icon)).toEqual(['i-nap', 'i-edzes', 'i-fuel', 'i-mezo', 'i-emberek'])
  expect(step.tabs.map((t) => t.label)).toEqual(['Nap', 'Edzés', 'Fuel', 'Mezo', 'Én'])
})
```

- [ ] **Step 5: Futtasd — el kell buknia**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/welcome.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/tutorial/registry/welcome"`

- [ ] **Step 6: Írd meg a `welcome.ts`-t**

Create `frontend/src/features/tutorial/registry/welcome.ts`:

```ts
// ============================================================
// Mezo · WELCOME — a T0 első indítás négy lépése (mezo-gb1s.4, S2b spec §3).
// A KALAUZ_REGISTRY-n KÍVÜL él, két okból: (1) a lépések koppintható demók, amiket a
// KalauzCard öt típusa nem tud kifejezni; (2) egy `/nap` route-ú bejegyzést a findKalauz
// first-match szabálya (index.ts) némán szembeállítana a `nap` kalauzzal. A seen-kulcs
// viszont ugyanabba a tutorial_progress map-be megy — a backend kulcs-agnosztikus, tehát
// nincs contract- vagy migráció-változás.
//
// Ami a prototípusból (docs/design_2.0/prototypes/kalauz.html:1158-1265) KIESETT:
// az 1. „Szia, Mezo vagyok" lépés (a köszönés az 1. lépés címébe olvadt) és az 5. fejléc-
// lépés (standard minta; ráadásul a napszak-váltó hatóköre nyitott kérdés, epic-spec §13.1).
// Ami MEGVÁLTOZOTT: az Én fül ikonja `i-polc` → `i-emberek` (TabBar.tsx:16), és a
// „fotó / hang" logolás-létra helyére a VALÓDI QuickInputSheet anatómiája került — a `+`
// gomb mögött csak a csempe-rács és a „Mondd el Mezónak" sor él (QuickInputSheet.tsx:104-178).
// ============================================================
import type { ClayIconName, ClaySpotName } from '@/shared/ui/clay'

/** Stable id — a seen-store kulcsa. Sose nevezzük át; verziót bumpolunk. */
export const WELCOME_ID = 'welcome'
export const WELCOME_VERSION = 1

export interface WelcomeDaypart { key: string; label: string; spot: ClaySpotName; size: number; sub: string }
export interface WelcomeTab { key: string; label: string; icon: ClayIconName; voice: string }
export interface WelcomeTile { label: string; icon: ClayIconName }

interface StepBase { title: string; voice: string }
export type WelcomeStep =
  | (StepBase & { kind: 'napszak'; dayparts: WelcomeDaypart[] })
  | (StepBase & { kind: 'tabbar'; tabs: WelcomeTab[] })
  | (StepBase & { kind: 'log'; tiles: WelcomeTile[]; chat: string })
  | (StepBase & { kind: 'sugo' })

export interface WelcomeGuide { id: string; version: number; steps: WelcomeStep[] }

export const WELCOME: WelcomeGuide = {
  id: WELCOME_ID,
  version: WELCOME_VERSION,
  steps: [
    {
      kind: 'napszak',
      // A köszönés ide olvadt (S2b-1). Ez az egyetlen mechanika, amit egy ülésben lehetetlen
      // felfedezni: a /nap oldal napszakonként átrendezi magát.
      title: 'Szia, Mezo vagyok.',
      voice: 'Egy nap nálunk három szakasz: reggel **indítunk**, napközben **logolunk és edzünk**, este **lezárjuk**. A Nap fül mindig azt mutatja, ami éppen soron van.',
      dayparts: [
        { key: 'reggel', label: 'Reggel', spot: 's-reggel', size: 58, sub: 'rutin · mérleg · Mezo üzenete' },
        { key: 'nap', label: 'Nap', spot: 's-energia', size: 70, sub: 'logolás · edzés · check-in' },
        { key: 'este', label: 'Este', spot: 's-este', size: 58, sub: 'rutin · Napzárás' },
      ],
    },
    {
      kind: 'tabbar',
      title: 'Öt hely, ahol minden megvan.',
      voice: 'Koppints a fülekre — mindegyik megmutatja, mi lakik nála.',
      tabs: [
        { key: 'nap', label: 'Nap', icon: 'i-nap', voice: 'A mai nap gerince: rutin, üzenetek, küldetések, Életjel — mindig az, ami most a dolgunk.' },
        { key: 'train', label: 'Edzés', icon: 'i-edzes', voice: 'Edzés, sport, futás: a heti terv, az aktív edzés, a gyakorlatok és a medálok.' },
        { key: 'fuel', label: 'Fuel', icon: 'i-fuel', voice: 'Étkezés és napi keret, kamra, receptek, a stack és a gyógyszer.' },
        { key: 'mezo', label: 'Mezo', icon: 'i-mezo', voice: 'A társ: a chat, a minták, amiket rólad észrevesz, és amit rólad megtanult.' },
        { key: 'me', label: 'Én', icon: 'i-emberek', voice: 'Te: cél, súly, alvás, emberek, karakter, beállítások.' },
      ],
    },
    {
      kind: 'log',
      title: 'Logolni bárhonnan, tíz másodperc.',
      voice: 'A **+** gomb minden oldalon ott van. Koppints rá — megnézheted, mi fér el mögötte.',
      // A VALÓDI QuickInputSheet csempéi (QuickInputSheet.tsx:151-168), sorrendhelyesen.
      tiles: [
        { label: 'Étkezés', icon: 'i-fuel' },
        { label: 'Edzés', icon: 'i-edzes' },
        { label: 'Stack', icon: 'i-stack' },
        { label: 'Súly', icon: 'i-suly' },
        { label: 'Check-in', icon: 'i-checkin' },
        { label: 'Alvás', icon: 'i-alvas' },
        { label: 'Napló', icon: 'i-naplo' },
      ],
      chat: 'Mondd el Mezónak',
    },
    {
      kind: 'sugo',
      title: 'Ha bármikor elakadsz.',
      voice: 'Minden oldalnak van kalauza: elsőre magától felugrik. Utána a **?** alatt bármikor visszanézheted.',
    },
  ],
}
```

- [ ] **Step 7: Futtasd — zöldnek kell lennie**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/`
Expected: PASS (mind a `registry.test.ts`, mind a `welcome.test.ts`, mind az `anchors.test.tsx`)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/tutorial/registry/
git commit -m "feat(tutorial): a T0 welcome adata és a megosztott hang-lint (mezo-gb1s.4)"
```

---

### Task 2: `versionOf` — az `isUnseen('welcome')` ága

**Files:**
- Modify: `frontend/src/features/tutorial/registry/index.ts`
- Modify: `frontend/src/features/tutorial/TutorialProvider.tsx:113-117` (`isUnseen`)
- Test: `frontend/src/features/tutorial/registry/welcome.test.ts` (bővítés)

**Interfaces:**
- Consumes: `WELCOME_ID`, `WELCOME_VERSION` (Task 1).
- Produces: `versionOf(id: string): number | null` a `@/features/tutorial/registry`-ből. `null` = ismeretlen id. A Task 4 erre támaszkodik, amikor a welcome-ot „nem látottnak" minősíti.

**Miért kell:** az `isUnseen` ma `getKalauz(id)`-t hív, ami a welcome-ra `null`-t ad, tehát `isUnseen('welcome')` **`false`** lenne — a welcome sosem nyílna meg.

- [ ] **Step 1: Írd meg a bukó tesztet**

Fűzd a `frontend/src/features/tutorial/registry/welcome.test.ts` végére:

```ts
test('versionOf: a welcome verziója a registryn kívülről is megszólal', async () => {
  const { versionOf } = await import('@/features/tutorial/registry')
  expect(versionOf('welcome')).toBe(WELCOME_VERSION)
  expect(versionOf('fuel')).toBe(1)
  expect(versionOf('nincs-ilyen')).toBeNull()
})
```

- [ ] **Step 2: Futtasd — el kell buknia**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/welcome.test.ts -t versionOf`
Expected: FAIL — `versionOf is not a function`

- [ ] **Step 3: Vedd fel a `versionOf`-ot**

`frontend/src/features/tutorial/registry/index.ts` — az importok közé:

```ts
import { WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'
```

és a fájl végére:

```ts
/**
 * Egy kalauz-id verziója — a `findKalauz`/`getKalauz` route-alapú útjától FÜGGETLENÜL.
 * A T0 welcome szándékosan nincs a KALAUZ_REGISTRY-ben (lásd welcome.ts), de a seen-állapota
 * ugyanabban a mapben él, tehát a verzió-összehasonlításnak őt is ismernie kell.
 * `null` = ismeretlen id (a hívó ilyenkor nem tekinti „nem látottnak").
 */
export function versionOf(id: string): number | null {
  if (id === WELCOME_ID) return WELCOME_VERSION
  return getKalauz(id)?.version ?? null
}
```

- [ ] **Step 4: Állítsd át az `isUnseen`-t**

`frontend/src/features/tutorial/TutorialProvider.tsx` — az import sorban cseréld `getKalauz`-t kiegészítve:

```ts
import { findKalauz, getKalauz, versionOf, type KalauzEntry } from '@/features/tutorial/registry'
```

és az `isUnseen` teste (`:113-117`) legyen:

```ts
  const isUnseen = useCallback((id: string) => {
    // `versionOf`, nem `getKalauz`: a T0 welcome a registryn kívül él, de a seen-állapota
    // ugyanebben a mapben — enélkül `isUnseen('welcome')` mindig false lenne.
    const version = versionOf(id)
    if (version === null) return false
    const p = progressRef.current[id]
    return !p || p.version < version
  }, [])
```

- [ ] **Step 5: Futtasd**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/tutorial/
git commit -m "feat(tutorial): versionOf() — a welcome seen-állapota a registryn kívülről is olvasható (mezo-gb1s.4)"
```

---

### Task 3: `KalauzWelcome` — a full-screen lapozó és a CSS

**Files:**
- Create: `frontend/src/shared/ui/kalauz/KalauzWelcome.tsx`
- Test: `frontend/src/shared/ui/kalauz/KalauzWelcome.test.tsx` (create)
- Modify: `frontend/src/styles/prototype.css` (a `.kalauz-spot` blokk után, EGY összefüggő blokkban)

**Interfaces:**
- Consumes: semmit a korábbi taskokból kódszinten — a lépés-unió alakja a Task 1 `WelcomeStep`-jével AZONOS, de **helyben újradeklarálva** (`shared/ui` domain-mentes; ez a `KalauzSheet.tsx:19-25` bevett technikája).
- Produces: `KalauzWelcome` komponens, props: `{ steps: KalauzWelcomeStep[]; onClose: (reason: 'skip' | 'done', step: number) => void }`. A Task 4 ezt rendereli.

**Recept-forrás:** `frontend/src/features/progression/LevelUpScreen.tsx:52` (lusta portál-target), `:74-95` (fókusz + Escape + Tab), `:131-138` (dialog root), `:262` (`createPortal`). A `LogFlowPage.tsx` portálját **ne** másold — nincs benne fókusz-kezelés.

- [ ] **Step 1: Írd meg a bukó teszteket**

Create `frontend/src/shared/ui/kalauz/KalauzWelcome.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KalauzWelcome, type KalauzWelcomeStep } from '@/shared/ui/kalauz/KalauzWelcome'

const STEPS: KalauzWelcomeStep[] = [
  {
    kind: 'napszak', title: 'Szia, Mezo vagyok.', voice: 'Három szakasz.',
    dayparts: [
      { key: 'reggel', label: 'Reggel', spot: 's-reggel', size: 58, sub: 'rutin' },
      { key: 'nap', label: 'Nap', spot: 's-energia', size: 70, sub: 'logolás' },
      { key: 'este', label: 'Este', spot: 's-este', size: 58, sub: 'Napzárás' },
    ],
  },
  {
    kind: 'tabbar', title: 'Öt hely.', voice: 'Koppints a fülekre.',
    tabs: [
      { key: 'nap', label: 'Nap', icon: 'i-nap', voice: 'A mai nap gerince.' },
      { key: 'train', label: 'Edzés', icon: 'i-edzes', voice: 'A heti terv.' },
      { key: 'fuel', label: 'Fuel', icon: 'i-fuel', voice: 'Étkezés és keret.' },
      { key: 'mezo', label: 'Mezo', icon: 'i-mezo', voice: 'A társ.' },
      { key: 'me', label: 'Én', icon: 'i-emberek', voice: 'Te.' },
    ],
  },
  { kind: 'log', title: 'Logolni bárhonnan.', voice: 'A + gomb.', tiles: [{ label: 'Étkezés', icon: 'i-fuel' }], chat: 'Mondd el Mezónak' },
  { kind: 'sugo', title: 'Ha elakadsz.', voice: 'A ? alatt visszanézheted.' },
]

const renderWelcome = (onClose = vi.fn()) => {
  render(<KalauzWelcome steps={STEPS} onClose={onClose} />)
  return onClose
}

test('az első lépésen indul, a Vissza tiltva, a lépésszám látszik', () => {
  renderWelcome()
  expect(screen.getByRole('heading', { name: 'Szia, Mezo vagyok.' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Előző/ })).toBeDisabled()
  expect(screen.getByText('Első indítás · 1 / 4')).toBeInTheDocument()
})

test('a Tovább lépteti, az utolsón Induljunk lesz belőle és done-nal zár', async () => {
  const onClose = renderWelcome()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.getByRole('heading', { name: 'Öt hely.' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  const cta = screen.getByRole('button', { name: 'Induljunk' })
  await user.click(cta)
  expect(onClose).toHaveBeenCalledWith('done', 3)
})

// APG: tartalom-nehéz dialógusnál a fókusz a CÍMRE megy, nem az első interaktív elemre —
// és lépésváltáskor ÚJRA, különben a „Tovább" képernyőolvasóval némán nem csinál semmit.
test('a fókusz mountkor és minden lépésváltáskor az aktuális címre ugrik', async () => {
  renderWelcome()
  const user = userEvent.setup()
  expect(screen.getByRole('heading', { name: 'Szia, Mezo vagyok.' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.getByRole('heading', { name: 'Öt hely.' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: /Előző/ }))
  expect(screen.getByRole('heading', { name: 'Szia, Mezo vagyok.' })).toHaveFocus()
})

test('a Kihagyom és az Escape ugyanúgy skip-pel, a lépés indexével', async () => {
  const onClose = renderWelcome()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledWith('skip', 1)
})

test('a Kihagyom gomb az utolsó lépésen eltűnik (ott az Induljunk a kiút)', async () => {
  renderWelcome()
  const user = userEvent.setup()
  expect(screen.getByRole('button', { name: 'Kihagyom' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.queryByRole('button', { name: 'Kihagyom' })).not.toBeInTheDocument()
})

test('a tabbar-demó a koppintott fül mondatát mutatja, és NEM navigál', async () => {
  renderWelcome()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.getByText('A mai nap gerince.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Fuel' }))
  expect(screen.getByText('Étkezés és keret.')).toBeInTheDocument()
  expect(screen.queryByText('A mai nap gerince.')).not.toBeInTheDocument()
})

test('a logolás-lépés csempéi és a Mezo-sor csak koppintás után nyílnak ki', async () => {
  renderWelcome()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(screen.queryByText('Mondd el Mezónak')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Gyors logolás megnyitása' }))
  expect(screen.getByText('Étkezés')).toBeInTheDocument()
  expect(screen.getByText('Mondd el Mezónak')).toBeInTheDocument()
})

test('a dialógus aria-modal, és a címe adja a nevét', () => {
  renderWelcome()
  const dlg = screen.getByRole('dialog')
  expect(dlg).toHaveAttribute('aria-modal', 'true')
  expect(dlg).toHaveAccessibleName('Szia, Mezo vagyok.')
})
```

- [ ] **Step 2: Futtasd — el kell buknia**

Run: `VITE_USE_MOCK=true pnpm vitest run src/shared/ui/kalauz/KalauzWelcome.test.tsx`
Expected: FAIL — `Failed to resolve import "@/shared/ui/kalauz/KalauzWelcome"`

- [ ] **Step 3: Írd meg a komponenst**

Create `frontend/src/shared/ui/kalauz/KalauzWelcome.tsx`:

```tsx
// ============================================================
// Mezo · KalauzWelcome — a T0 első indítás teljes képernyős lapozója (mezo-gb1s.4, S2b spec §3).
// Domain-mentes: a lépéseket adatként kapja, a seen-állapotról semmit nem tud — azt a
// TutorialProvider intézi az `onClose(reason, step)` alapján (a KalauzSheet szerződése).
// A típus-unió SZÁNDÉKOSAN helyben van újradeklarálva, nem a registry/welcome.ts-ből importálva:
// a shared/ui nem függhet a features rétegtől (AGENTS.md §rétegek).
//
// Full-screen recept: LevelUpScreen.tsx — portál a .phone-screen-be, inset:0, fókusz mountkor
// + visszaadás unmountkor, Escape zár. A LogFlowPage portálja UGYANEZ a minta, de fókusz-kezelés
// NÉLKÜL — azt nem másoljuk.
//
// A11y (WAI-ARIA APG, Dialog Modal): tartalom-nehéz dialógusnál a fókusz egy tabindex=-1
// statikus elemre megy (a lépés címére), nem az első interaktív elemre — és LÉPÉSVÁLTÁSKOR
// ÚJRA, különben a „Tovább" képernyőolvasóval némán nem csinál semmit.
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ClayIcon, ClaySpot, type ClayIconName, type ClaySpotName } from '@/shared/ui/clay'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

export interface KalauzWelcomeDaypart { key: string; label: string; spot: ClaySpotName; size: number; sub: string }
export interface KalauzWelcomeTab { key: string; label: string; icon: ClayIconName; voice: string }
export interface KalauzWelcomeTile { label: string; icon: ClayIconName }

interface StepBase { title: string; voice: string }
export type KalauzWelcomeStep =
  | (StepBase & { kind: 'napszak'; dayparts: KalauzWelcomeDaypart[] })
  | (StepBase & { kind: 'tabbar'; tabs: KalauzWelcomeTab[] })
  | (StepBase & { kind: 'log'; tiles: KalauzWelcomeTile[]; chat: string })
  | (StepBase & { kind: 'sugo' })

export type KalauzWelcomeCloseReason = 'skip' | 'done'

export interface KalauzWelcomeProps {
  steps: KalauzWelcomeStep[]
  onClose: (reason: KalauzWelcomeCloseReason, step: number) => void
}

export function KalauzWelcome({ steps, onClose }: KalauzWelcomeProps) {
  const reduced = useReducedMotion()
  const [target] = useState<Element>(() => document.querySelector('.phone-screen') ?? document.body)
  const [step, setStep] = useState(0)
  // Per-lépés demó-állapot. `tab` a tabbar-lépés kiválasztott füle, `logOpen` a logolás-lépés
  // „kinyitott csempe-rács" állapota — a lépés úgy indul, ahogy a valódi app: csak a + gombbal.
  const [tab, setTab] = useState(0)
  const [logOpen, setLogOpen] = useState(false)

  const current = steps[step]
  const last = step === steps.length - 1
  const titleId = 'kalauz-welcome-title'
  const titleRef = useRef<HTMLHeadingElement>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const stepRef = useRef(step)
  stepRef.current = step

  const go = useCallback((k: number) => {
    setStep(k)
    setTab(0)
    setLogOpen(false)
  }, [])

  // APG: a fókusz mountkor ÉS minden lépésváltáskor az aktuális címre. useLayoutEffect, hogy a
  // fókusz még a festés előtt a helyére kerüljön (a userEvent.click után szinkronban látszódjon).
  useLayoutEffect(() => { titleRef.current?.focus() }, [step])

  // Escape zár, Tab a dialóguson belül marad. A `keydown` a documenten ül (a LevelUpScreen
  // receptje), a fókusz-visszaadás unmountkor történik.
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current('skip', stepRef.current)
        return
      }
      if (e.key !== 'Tab') return
      const focusables = rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="-1"]')
      if (!focusables || focusables.length === 0) return
      const list = [...focusables]
      const first = list[0]
      const lastEl = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [])

  const overlay = (
    <div
      ref={rootRef}
      className={cn('welcome', reduced && 'welcome--reduced')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="wl-art" key={step}>
        {current.kind === 'napszak' && (
          <div className="wl-arc">
            {current.dayparts.map((d) => (
              <div className="wl-st" key={d.key}>
                <ClaySpot name={d.spot} size={d.size} />
                {d.label}
                <span className="wl-sub">{d.sub}</span>
              </div>
            ))}
          </div>
        )}

        {current.kind === 'tabbar' && (
          <div className="wl-demo">
            <div className="wl-tabbar">
              {current.tabs.map((t, k) => (
                <button type="button" key={t.key} className={cn('wl-tab', k === tab && 'on')}
                  aria-pressed={k === tab} onClick={() => setTab(k)}>
                  <ClayIcon name={t.icon} size={22} />{t.label}
                </button>
              ))}
            </div>
            <div className="wl-demobox">
              <div className="wl-demoname">{current.tabs[tab].label}</div>
              <div className="wl-demotxt">{current.tabs[tab].voice}</div>
            </div>
            <div className="wl-hint">Koppints a fülekre.</div>
          </div>
        )}

        {current.kind === 'log' && (
          <div className="wl-demo">
            <button type="button" className="wl-fab" aria-label="Gyors logolás megnyitása"
              aria-expanded={logOpen} onClick={() => setLogOpen(true)}>
              <span aria-hidden="true">+</span>
            </button>
            {logOpen ? (
              <div className="wl-demobox">
                <div className="wl-tiles">
                  {current.tiles.map((t) => (
                    <span className="wl-tile" key={t.label}><ClayIcon name={t.icon} size={24} />{t.label}</span>
                  ))}
                </div>
                <div className="wl-chatrow"><ClaySpot name="s-orb" size={26} />{current.chat}</div>
              </div>
            ) : (
              <div className="wl-hint">Koppints a + gombra.</div>
            )}
          </div>
        )}

        {current.kind === 'sugo' && (
          <div className="wl-demo">
            <div className="wl-qrow">
              <span className="wl-q wl-qpulse" aria-hidden="true">?</span>
            </div>
            <ClaySpot name="s-orb-figyel" size={64} />
          </div>
        )}
      </div>

      <div className="wl-eyebrow">Első indítás · {step + 1} / {steps.length}</div>
      <h2 className="wl-title" id={titleId} ref={titleRef} tabIndex={-1}>{current.title}</h2>
      <div className="wl-voice"><SafeMarkdown text={current.voice} /></div>

      <div className="wl-dots" aria-hidden="true">
        {steps.map((s, k) => <span key={s.kind} className={cn('wl-dot', k === step && 'on', k < step && 'seen')} />)}
      </div>
      <div className="wl-foot">
        {!last && (
          <button type="button" className="wl-ghost wl-link" onClick={() => onClose('skip', step)}>Kihagyom</button>
        )}
        <button type="button" className="wl-ghost wl-back" aria-label="Előző lépés"
          disabled={step === 0} onClick={() => go(step - 1)}>‹ Vissza</button>
        {last
          ? <button type="button" className="wl-cta" onClick={() => onClose('done', step)}>Induljunk</button>
          : <button type="button" className="wl-cta" onClick={() => go(step + 1)}>Tovább</button>}
      </div>
    </div>
  )

  return createPortal(overlay, target)
}
```

- [ ] **Step 4: Futtasd — zöldnek kell lennie**

Run: `VITE_USE_MOCK=true pnpm vitest run src/shared/ui/kalauz/KalauzWelcome.test.tsx`
Expected: PASS (mind a 8 teszt)

- [ ] **Step 5: A CSS**

`frontend/src/styles/prototype.css` — a `.kalauz-spot` szabály utáni sorba, EGY összefüggő blokként (a fájl merge-törékeny, ne szórd szét). A prototípus `.welcome`/`.wl-*` receptje (`docs/design_2.0/prototypes/kalauz.html:280-310`) app-tokenekre fordítva, `z-index: 60`-nal:

```css
/* ── T0 első indítás — KalauzWelcome (mezo-gb1s.4, S2b spec §4.4) ──
   Full-screen a .phone-screen-ben, a .logflow-page sávjában (60): a tab-bar (40) és a
   fake státuszsáv (50) FÖLÖTT, a sheetek (200) és a LevelUp (250) alatt. A prototípus
   z 12 / státuszsáv z 15 rétegzése prototípus-lokális műtermék volt. */
.welcome { position: absolute; inset: 0; z-index: 60; display: flex; flex-direction: column;
  background: var(--canvas); padding: 44px 18px 18px; overflow-y: auto; }
.welcome .wl-art { flex: 1; display: grid; place-items: center; min-height: 0; width: 100%; }
.wl-eyebrow { font-size: 8.5px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--primary-deep); text-align: center; }
.wl-title { font-size: 21px; font-weight: 700; letter-spacing: -0.02em; text-align: center;
  margin: 4px 0 0; text-wrap: balance; color: var(--text-primary); }
.wl-title:focus-visible { outline: 2px solid var(--primary-base); outline-offset: 4px; border-radius: 8px; }
.wl-voice { font-size: 12.5px; font-weight: 300; line-height: 1.5; text-align: center;
  margin: 8px auto 0; max-width: 30ch; color: var(--text-secondary); }
.wl-voice b { font-weight: 600; }
.wl-dots { display: flex; justify-content: center; gap: 5px; margin-top: 14px; }
.wl-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--mz-cellbg); }
.wl-dot.seen { background: var(--mz-ink-mut); }
.wl-dot.on { width: 16px; border-radius: 3px; background: var(--primary-base); }
.wl-foot { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.wl-ghost { border: none; background: none; font-family: inherit; cursor: pointer;
  font-size: 12px; font-weight: 600; color: var(--mz-ink-soft); padding: 8px 12px; }
.wl-back { margin-left: auto; }
.wl-back[disabled] { opacity: 0.35; cursor: default; }
.wl-cta { border: none; font-family: inherit; cursor: pointer; padding: 9px 20px; border-radius: 999px;
  font-size: 13px; font-weight: 700; color: #fff; background: var(--gradient-cta); }
.wl-hint { font-size: 9.5px; text-align: center; color: var(--mz-ink-mut); }
/* a napi ív: három clay spot egy íven */
.wl-arc { display: flex; align-items: flex-end; justify-content: center; gap: 14px; }
.wl-st { display: grid; justify-items: center; gap: 3px; font-size: 9px; font-weight: 700; color: var(--mz-ink-soft); }
.wl-st:nth-child(2) { margin-bottom: 22px; }
.wl-sub { font-size: 8.5px; font-weight: 500; color: var(--mz-ink-mut); text-align: center; max-width: 64px; line-height: 1.3; }
/* koppintható demók (tabbar + logolás + „?") */
.wl-demo { display: grid; align-content: center; justify-items: stretch; gap: 12px; width: 100%; }
.wl-tabbar { display: flex; gap: 4px; background: var(--surface-card); border-radius: 22px; padding: 7px 6px;
  border: 0.5px solid rgba(43, 33, 24, 0.06); box-shadow: 0 14px 26px -16px rgba(43, 33, 24, 0.3); }
.wl-tab { flex: 1; border: none; background: none; font-family: inherit; cursor: pointer;
  display: grid; justify-items: center; gap: 2px; font-size: 9px; font-weight: 600;
  color: var(--mz-ink-mut); padding: 4px 2px; border-radius: 14px; }
.wl-tab.on { color: var(--primary-deep); background: color-mix(in srgb, var(--primary-base) 12%, transparent); }
.wl-demobox { background: var(--surface-card); border-radius: 18px; padding: 10px 12px; text-align: center;
  border: 0.5px solid rgba(43, 33, 24, 0.06); box-shadow: 0 14px 26px -16px rgba(43, 33, 24, 0.3); }
.wl-demoname { font-size: 11px; font-weight: 700; color: var(--text-primary); }
.wl-demotxt { font-size: 11px; font-weight: 300; line-height: 1.45; color: var(--text-secondary); margin-top: 3px; }
.wl-fab { width: 54px; height: 54px; border-radius: 50%; margin: 0 auto; border: none; cursor: pointer;
  background: var(--gradient-cta); color: #fff; display: grid; place-items: center;
  font-size: 26px; font-weight: 300; box-shadow: 0 12px 24px -6px rgba(255, 91, 54, 0.65); }
.wl-tiles { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.wl-tile { display: grid; justify-items: center; gap: 2px; font-size: 9px; font-weight: 600;
  color: var(--mz-ink-soft); min-width: 52px; }
.wl-chatrow { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 10px;
  padding-top: 9px; border-top: 0.5px solid rgba(43, 33, 24, 0.08);
  font-size: 11px; font-weight: 600; color: var(--primary-deep); }
.wl-qrow { display: flex; justify-content: center; }
.wl-q { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  font-family: var(--ff-display); font-style: italic; font-size: 17px; font-weight: 700;
  color: var(--primary-deep); background: var(--mz-chipbg); border: 0.5px solid rgba(43, 33, 24, 0.12); }
.wl-qpulse { animation: wlqpulse 1.8s ease-in-out infinite; }
@keyframes wlqpulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(201, 150, 46, 0.45); } 50% { box-shadow: 0 0 0 8px rgba(201, 150, 46, 0); } }
/* WCAG 2.3.3: az interakció kiváltotta mozgás letiltható — a lépés-belépés és a „?" pulzus is. */
.welcome .wl-art { animation: wlfade 0.28s ease both; }
@keyframes wlfade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.welcome--reduced .wl-art { animation: none; }
.welcome--reduced .wl-qpulse { animation: none; }
```

- [ ] **Step 6: Ellenőrizd, hogy a használt tokenek léteznek**

Run: `grep -n -- "--text-secondary\|--mz-ink-mut\|--mz-cellbg\|--ff-display\|--primary-base\|--primary-deep\|--gradient-cta\|--surface-card\|--mz-chipbg\|--mz-ink-soft" src/styles/prototype.css | head -20`
Expected: mindegyik token definiálva van. Ha valamelyik hiányzik, cseréld a legközelebbi létező társára (`--text-tertiary`, `--mz-ink-soft`) — **ne** vezess be új tokent.

- [ ] **Step 7: Futtasd újra a komponens-teszteket + a build-et**

Run: `VITE_USE_MOCK=true pnpm vitest run src/shared/ui/kalauz/ && pnpm build`
Expected: PASS + sikeres build

- [ ] **Step 8: Commit**

```bash
git add frontend/src/shared/ui/kalauz/ frontend/src/styles/prototype.css
git commit -m "feat(tutorial): KalauzWelcome — full-screen lapozó, APG fókusz-szerződéssel (mezo-gb1s.4)"
```

---

### Task 4: A Provider bekötése — trigger, elnyomás, teszt-seed

**Files:**
- Modify: `frontend/src/features/tutorial/TutorialProvider.tsx`
- Modify: `frontend/src/test/kalauz.ts`
- Modify: `frontend/src/features/today/pages/NapKuldetesekPage.test.tsx`
- Test: `frontend/src/features/tutorial/TutorialProvider.test.tsx` (bővítés)

**Interfaces:**
- Consumes: `WELCOME`, `WELCOME_ID`, `WELCOME_VERSION` (Task 1); `versionOf` (Task 2); `KalauzWelcome` + `KalauzWelcomeCloseReason` (Task 3).
- Produces: a Provider látható viselkedése. A `TutorialContextValue` **nem** bővül — semmi nem olvassa kívülről a welcome-állapotot.

**A trigger-szerződés** (spec §4.2), pontosan:

```
shouldWelcome = welcomeStatus === 'pending' && pathname === '/nap'
```

- `welcomeStatus` kezdőértéke a `readLocalProgress()`-ből: `'pending'`, ha `isUnseen('welcome')`, különben `'done'`.
- A route-effekt guardja (`:206`) bővül: `if (openIdRef.current !== null || shouldWelcomeRef.current) return`.
- Külön effekt: `shouldWelcome && !isPending` → `welcomeOpen = true` **és azonnal `persist`** a `welcome` bejegyzésre („látva = megjelent"), amitől `welcomeStatus === 'done'`.
- A `!isPending` várakozás azért van, hogy egy ÚJ eszközön (üres localStorage, szerver szerint látott) ne villanjon fel. A `:206` guard közben blokkolja a `/nap` 600 ms-os timerét, tehát a `/nap` sheet nem előzhet be.
- **Nincs láncolás**: a route-effekt ugyanarra a pathname-re nem fut újra, tehát a welcome bezárása után a `/nap` kalauz NEM ugrik fel; a következő belépéskor viszont igen.

- [ ] **Step 1: Írd meg a bukó teszteket**

Fűzd a `frontend/src/features/tutorial/TutorialProvider.test.tsx` végére. (A fájl `beforeEach`-e már `localStorage.clear()`-t és `vi.useFakeTimers({ shouldAdvanceTime: true })`-t hív; a `renderAt`, a `stubReducedMotion` és a `Probe` helperek a fájl tetején élnek.)

Előbb a fájl TETEJÉRE, a többi import közé:

```ts
import { WELCOME_VERSION } from '@/features/tutorial/registry/welcome'
```

**A sheet jelenlétét NE a `Kalauz · <label>` szövegre kérdezd**: a `KalauzSheet` két elembe is
kiírja (`.mz-eyebrow` és az `.sr-only` cím), tehát egy `getByText(/^Kalauz · /)` „multiple
elements" hibát dobna. Az egyedi horgony a pötty-sáv `aria-label`-je: `Kártyák`.

Aztán a fájl végére:

```tsx
// ── T0 welcome (mezo-gb1s.4, S2b spec §4.2) ─────────────────────────────────────
const SEEN = '2026-08-30T10:00:00.000Z'
const welcomeSeen = () => ({ welcome: { version: WELCOME_VERSION, seenAt: SEEN, completedAt: SEEN, dismissedAtStep: null } })

test('a legelső /nap betöltéskor a welcome felugrik, és a /nap kalauza NEM', async () => {
  renderAt('/nap')
  expect(await screen.findByRole('dialog')).toHaveAccessibleName('Szia, Mezo vagyok.')
  // A /nap auto-open timere el sem indult (a :206 guard), tehát 600 ms után sincs kalauz-sheet.
  await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
  expect(screen.queryByLabelText('Kártyák')).not.toBeInTheDocument()
})

test('„látva = megjelent": a welcome bejegyzés a megnyitás pillanatában íródik', async () => {
  renderAt('/nap')
  await screen.findByRole('dialog')
  await waitFor(() => expect(readLocalProgress().welcome?.seenAt).toEqual(expect.any(String)))
  expect(readLocalProgress().welcome?.version).toBe(WELCOME_VERSION)
  expect(readLocalProgress().welcome?.completedAt).toBeNull()
})

test('az Induljunk completedAt-ot ír, és utána NEM láncol a /nap kalauzába', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Induljunk' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(readLocalProgress().welcome?.completedAt).toEqual(expect.any(String)))
  // S2b-6: a route-effekt ugyanarra a pathname-re nem fut újra — a /nap kalauza most nem jön.
  await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
  expect(screen.queryByLabelText('Kártyák')).not.toBeInTheDocument()
})

test('a Kihagyom dismissedAtStep-et ír, és a welcome nem jön vissza', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Kihagyom' }))
  await waitFor(() => expect(readLocalProgress().welcome?.dismissedAtStep).toBe(1))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('látott welcome mellett a /nap kalauza normálisan felugrik', async () => {
  writeLocalProgress(welcomeSeen())
  renderAt('/nap')
  await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
  expect(await screen.findByLabelText('Kártyák')).toBeInTheDocument()
  expect(screen.queryByText('Szia, Mezo vagyok.')).not.toBeInTheDocument()
})

test('a függő welcome MÁS route kalauzát nem nyomja el', async () => {
  renderAt('/train')
  await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
  expect(await screen.findByLabelText('Kártyák')).toBeInTheDocument()
})

test('reduced-motion alatt is a welcome nyer a 0 ms-os /nap auto-open ellen', async () => {
  stubReducedMotion()
  renderAt('/nap')
  await act(async () => { vi.advanceTimersByTime(50) })
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Szia, Mezo vagyok.')
  expect(screen.queryByLabelText('Kártyák')).not.toBeInTheDocument()
})
```

Egészítsd ki a fájl tetején lévő importot:

```ts
import { AUTO_DELAY_MS, TutorialProvider, useTutorial } from '@/features/tutorial/TutorialProvider'
```

- [ ] **Step 2: Futtasd — el kell buknia**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/TutorialProvider.test.tsx`
Expected: FAIL — nincs `dialog` szerep a képernyőn (a welcome nem renderel)

- [ ] **Step 3: Kösd be a Providert**

`frontend/src/features/tutorial/TutorialProvider.tsx`:

(a) Importok — a `KalauzSheet` import mellé:

```ts
import { KalauzWelcome } from '@/shared/ui/kalauz/KalauzWelcome'
import { WELCOME, WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'
```

(b) A `const [openId, setOpenId] = ...` sor UTÁN:

```ts
  // T0 welcome (S2b spec §4.2). Lokális-először, mint minden más: a kezdőállapot a
  // localStorage-tükörből jön, hogy a legelső renderben már tudjuk, van-e dolgunk.
  const [welcomeStatus, setWelcomeStatus] = useState<'pending' | 'done'>(
    () => (readLocalProgress()[WELCOME_ID]?.version ?? 0) >= WELCOME_VERSION ? 'done' : 'pending',
  )
  const [welcomeOpen, setWelcomeOpen] = useState(false)
```

(c) A ref-tükrök közé (a `openIdRef` után), a doktrína szerint:

```ts
  // A route-effekt guardja ezt a render ELŐTT kérdezi meg (ugyanabban a futásban, mint az
  // openIdRef-et), ezért ref-tükör jár neki is. Route-hoz kötött: egy függő welcome CSAK a
  // /nap auto-openjét nyomja el, más oldal kalauzát nem.
  const shouldWelcome = welcomeStatus === 'pending' && pathname === '/nap'
  const shouldWelcomeRef = useRef(shouldWelcome)
  shouldWelcomeRef.current = shouldWelcome
```

(d) A `:206` guard bővítése — a route-effektben:

```ts
    if (openIdRef.current !== null || shouldWelcomeRef.current) return
```

és egészítsd ki a fölötte lévő kommentblokk végét egy mondattal:

```
    // ... A T0 welcome ugyanezen a résen nyom el: amíg `shouldWelcome`, a /nap timere el sem
    // indul, tehát a welcome-ot nem előzheti be a 600 ms-os (reduced-motion alatt 0 ms-os) sheet.
```

(e) A route-effekt UTÁN egy új effekt:

```ts
  // A welcome megnyitása. A `!isPending` várakozás szándékos: egy ÚJ eszközön (üres
  // localStorage, a szerver szerint viszont látott) enélkül felvillanna, mielőtt a merge
  // megérkezik. Amíg várunk, a fenti guard blokkolja a /nap auto-openjét, tehát nincs verseny.
  // `persist` az effektben, nem setState-updaterben (StrictMode kétszer hívná az updatert).
  useEffect(() => {
    if (isPending || welcomeStatus !== 'pending' || pathname !== '/nap') return
    const map = progressRef.current
    if ((map[WELCOME_ID]?.version ?? 0) >= WELCOME_VERSION) { setWelcomeStatus('done'); return }
    setWelcomeStatus('done') // „látva = megjelent" — a státusz a megnyitással zárul le
    setWelcomeOpen(true)
    persist({ ...map, [WELCOME_ID]: { version: WELCOME_VERSION, seenAt: new Date().toISOString(), completedAt: null, dismissedAtStep: null } })
  }, [isPending, welcomeStatus, pathname, persist])
```

(f) A welcome zárása — a `close` callback után:

```ts
  const closeWelcome = useCallback((reason: KalauzCloseReason, step: number) => {
    setWelcomeOpen(false)
    const map = progressRef.current
    const prev = map[WELCOME_ID]
    if (!prev) return
    persist({
      ...map,
      [WELCOME_ID]: reason === 'done'
        ? { ...prev, completedAt: new Date().toISOString() }
        : { ...prev, dismissedAtStep: step },
    })
  }, [persist])
```

(g) A render — a `{entry && <KalauzSheet … />}` blokk MELLÉ, testvérként:

```tsx
      {welcomeOpen && <KalauzWelcome steps={WELCOME.steps} onClose={closeWelcome} />}
```

- [ ] **Step 4: Futtasd a Provider-teszteket**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/TutorialProvider.test.tsx`
Expected: PASS (a régi tesztek is — azok kalauzos route-okat használnak, a welcome csak `/nap`-on jelenik meg, és a `/nap`-ot használó régi eseteknek most seedelniük kell; ha valamelyik régi teszt elbukik `dialog`-ütközésre, add hozzá a `writeLocalProgress(welcomeSeen())`-t a saját elejéhez, NE a globális `beforeEach`-hez — a fájl szándékosan a valódi auto-open utat gyakorolja)

- [ ] **Step 5: Bővítsd a seed-helpert**

`frontend/src/test/kalauz.ts` — a `buildAllSeenProgress()` bővítése:

```ts
import { WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'
```

és a `for` ciklus UTÁN, a `return out` ELŐTT:

```ts
  // A T0 welcome szándékosan nincs a KALAUZ_REGISTRY-ben (registry/welcome.ts), tehát a fenti
  // ciklus nem fedi — enélkül MINDEN /nap-ot rendelő shell-teszt welcome-képernyőt kapna.
  out[WELCOME_ID] = { version: WELCOME_VERSION, seenAt: SEEN_AT, completedAt: SEEN_AT, dismissedAtStep: null }
```

Frissítsd a fájl fejléc-kommentjét is: a „`KALAUZ_REGISTRY`-ből GENERÁL" mondat után jöjjön
„— plusz a registryn kívül élő T0 welcome, explicit sorral."

- [ ] **Step 6: Seedeld a hiányzó teljes-router tesztet**

`frontend/src/features/today/pages/NapKuldetesekPage.test.tsx` — ez a fájl `createMemoryRouter(routes, …)`-t hív `/nap?dp=nap`-pal (`:138` környékén), tehát a teljes `AppLayout`-ot mountolja, seed nélkül. Vedd fel az importot:

```ts
import { seedAllKalauzSeen } from '@/test/kalauz'
```

és a meglévő `beforeEach` blokkba (ha nincs, hozz létre egyet a `vi.stubEnv` mellé):

```ts
  seedAllKalauzSeen()
```

- [ ] **Step 7: Futtasd a teljes érintett kört**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/ src/features/today/ src/app/ src/shared/ui/kalauz/`
Expected: PASS

- [ ] **Step 8: Ellenőrizd a vizuális goldeneket (csak olvasás, valószínűleg nincs teendő)**

Run: `grep -n "goto('/nap\|goto(path" tests/visual/visual.spec.ts`
Expected: az egyetlen `/nap`-ot érintő blokk a `:114` `test.describe(theme, …)`, ami a
`buildAllSeenProgress()`-t seedeli (`:123`) — az most már tartalmazza a welcome-ot, tehát
nincs teendő. A `:144/:175/:197/:212/:225/:238` blokkok `/ritual`, `/train/review/*`,
`/fuel/recipes/*`, `/fuel/slots` felé mennek, a welcome ezekre nem triggerel.
**Ha** a grep bármelyik nem seedelt blokkban `/nap`-ot talál, vedd fel oda is a
`buildAllSeenProgress()`-es init-scriptet a `:123-126` mintájára.

- [ ] **Step 9: Teljes FE-suite mindkét módban**

Run: `VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test`
Expected: PASS mindkettőben

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/tutorial/ frontend/src/test/kalauz.ts frontend/src/features/today/pages/NapKuldetesekPage.test.tsx
git commit -m "feat(tutorial): a welcome triggere és a /nap auto-open elnyomása (mezo-gb1s.4)"
```

---

### Task 5: `resetAll()` javítása (`mezo-gb1s.2`)

**Files:**
- Modify: `frontend/src/data/tutorial/tutorialProgressHooks.ts:34-43`
- Modify: `frontend/src/features/tutorial/TutorialProvider.tsx` (`resetAll`)
- Test: `frontend/src/features/tutorial/TutorialProvider.test.tsx` (bővítés)

**Interfaces:**
- Consumes: `WELCOME_ID`, `WELCOME_VERSION` (Task 1); a Task 4 `welcomeStatus`/`welcomeOpen` state-je.
- Produces: `resetAll(): Promise<void>` — **elutasított promise-t ad**, ha a DELETE elbukott. A Task 6 (Beállítások sor) erre a szerződésre épít.

**A bug:** a `resetAll` `.catch(() => undefined)`-del nyeli a DELETE hibáját. A lokális kiürül,
majd a szerver-merge effekt (`:87-103`) a szerver **régi** állapotát visszahozza — a reset
látszólag sikerül, aztán némán visszafordul. Emellett a nyitott sheet, a futó timer és az
`autoShown` session-guard is életben marad.

- [ ] **Step 1: Írd meg a bukó teszteket**

Fűzd a `TutorialProvider.test.tsx` végére:

```tsx
test('resetAll: kiüríti az állapotot, zárja a nyitottat, és a welcome újra esedékes lesz', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  writeLocalProgress(welcomeSeen())
  renderAt('/fuel')
  await user.click(screen.getByText('nyisd'))
  expect(await screen.findByLabelText('Kártyák')).toBeInTheDocument()
  await act(async () => { await resetHandle.current!() })
  expect(screen.queryByLabelText('Kártyák')).not.toBeInTheDocument()
  expect(readLocalProgress()).toEqual({})
})

test('resetAll: a DELETE hibája FELSZÍNRE kerül, nem nyeli el némán', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.delete(`${API_BASE}/tutorial/progress`, () => new HttpResponse(null, { status: 500 })))
  renderAt('/fuel')
  await expect(act(async () => { await resetHandle.current!() })).rejects.toBeTruthy()
})
```

Ehhez a `Probe` komponens ki kell szivárogtassa a `resetAll`-t. Egészítsd ki a fájl tetején
lévő `Probe`-ot és vedd fel a modul-szintű `resetHandle` refet közvetlenül a `Probe` fölé:

```tsx
const resetHandle: { current: (() => Promise<void>) | null } = { current: null }
```

és a `Probe` törzsének elejére (a `const t = useTutorial()` után):

```tsx
  resetHandle.current = t.resetAll
```

- [ ] **Step 2: Futtasd — el kell buknia**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/TutorialProvider.test.tsx -t resetAll`
Expected: FAIL — a második teszt nem dob (a `.catch` elnyeli), és az első nem zárja a sheetet

- [ ] **Step 3: A data-réteg — a hiba felszínre kerül, a GET nem írhat vissza**

`frontend/src/data/tutorial/tutorialProgressHooks.ts` — a `reset` mutáció:

```ts
  const reset = useMutation({
    mutationFn: async () => {
      if (mock) { qc.setQueryData<TutorialProgress>(KEY, {}); return }
      // A DELETE hibája SZÁNDÉKOSAN kiszáll (mezo-gb1s.2): elnyelve a lokális kiürül, majd a
      // TutorialProvider szerver-merge effektje a szerver régi állapotát visszahozza — a reset
      // látszólag sikerül, aztán némán visszafordul.
      // A cancelQueries a repülő GET ellen véd: egy a DELETE ELŐTT indult válasz különben a
      // törlés UTÁN írná be a régi mapet a cache-be.
      await qc.cancelQueries({ queryKey: KEY })
      await tutorialProgressApi.reset()
      qc.setQueryData<TutorialProgress>(KEY, {})
    },
  })
```

- [ ] **Step 4: A Provider — teljes, honest reset**

`frontend/src/features/tutorial/TutorialProvider.tsx` — a `resetAll`:

```ts
  const resetAll = useCallback(async () => {
    // Minden session-állapot vissza a nullára: a guard, a futó timer és a NYITOTT kalauz is —
    // enélkül a reset után az épp látszó sheet a törölt bejegyzésre írna vissza záráskor.
    autoShown.current.clear()
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    openIdRef.current = null
    setOpenId(null)
    setWelcomeOpen(false)
    setWelcomeStatus('pending')
    setLocal({})
    writeLocalProgress({})
    // A hiba KISZÁLL (mezo-gb1s.2): a hívó dönt, mit mutat — a néma nyelés miatt fordult
    // vissza korábban a reset a következő szerver-merge-nél.
    await resetProgress()
  }, [resetProgress])
```

- [ ] **Step 5: Futtasd**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/ src/data/tutorial/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/tutorial/ frontend/src/data/tutorial/
git commit -m "fix(tutorial): resetAll — a DELETE-hiba felszínre kerül, a nyitott kalauz és a timer zárul (mezo-gb1s.2)"
```

---

### Task 6: „Kalauzok újranézése" sor a Beállításokban

**Files:**
- Modify: `frontend/src/features/me/pages/BeallitasokPage.tsx`
- Test: `frontend/src/features/me/pages/BeallitasokPage.test.tsx`

**Interfaces:**
- Consumes: `useTutorial().resetAll` (Task 5 szerződése: hibára elutasított promise).
- Produces: semmit további task számára.

**Figyelem:** a `useTutorial()` provider nélkül **dob** (`TutorialProvider.tsx:35`), ezért a
`BeallitasokPage.test.tsx` `renderPage()` helperét `TutorialProvider`-be kell csomagolni.

- [ ] **Step 1: Írd meg a bukó teszteket**

`frontend/src/features/me/pages/BeallitasokPage.test.tsx` — a `renderPage` helper bővítése:

```tsx
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
```

és a `<MemoryRouter …>` KÖZVETLEN gyerekeként csomagold be a tartalmat `<TutorialProvider>`-rel
(a provider `useLocation`-t hív, tehát a routeren BELÜL kell lennie):

```tsx
        <MemoryRouter initialEntries={['/me/beallitasok']}>
          <TutorialProvider>
            <Routes>
              <Route path="/me/beallitasok" element={<BeallitasokPage />} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </TutorialProvider>
        </MemoryRouter>
```

Új tesztek a fájl végére:

```tsx
test('a Kalauzok sor törli a seen-állapotot', async () => {
  localStorage.setItem('mezo.kalauz.v1', JSON.stringify({ fuel: { version: 1, seenAt: '2026-08-30T10:00:00.000Z', completedAt: null, dismissedAtStep: null } }))
  renderPage()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Kalauzok újranézése' }))
  await waitFor(() => expect(localStorage.getItem('mezo.kalauz.v1')).toBe('{}'))
})

test('a sor visszajelzést ad, és hiba esetén nem hazudik sikert', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.delete(`${API_BASE}/tutorial/progress`, () => new HttpResponse(null, { status: 500 })))
  renderPage()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Kalauzok újranézése' }))
  expect(await screen.findByText('Most nem sikerült — próbáld újra.')).toBeInTheDocument()
})
```

Vedd fel a fájl tetejére a szükséges importokat:

```tsx
import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
```

és a `beforeEach`-be `localStorage.clear()`-t a `mezo-theme` beállítás ELŐTT.

- [ ] **Step 2: Futtasd — el kell buknia**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/BeallitasokPage.test.tsx`
Expected: FAIL — nincs „Kalauzok újranézése" gomb

- [ ] **Step 3: Vedd fel a sort**

`frontend/src/features/me/pages/BeallitasokPage.tsx`:

(a) Importok:

```ts
import { useState } from 'react'
import { useTutorial } from '@/features/tutorial/TutorialProvider'
```

(b) A komponens törzsében, a `const isOwner = …` sor után:

```ts
  // A kalauzok újranézése (mezo-gb1s.4). Honest state: a hiba LÁTSZIK — a resetAll
  // szándékosan kiszáll hibára (mezo-gb1s.2), mert némán elnyelve a reset visszafordulna.
  const { resetAll } = useTutorial()
  const [kalauzState, setKalauzState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const kalauzLine = kalauzState === 'busy' ? 'Törlés…'
    : kalauzState === 'done' ? 'Kész — a következő oldalakon újra felugranak.'
    : kalauzState === 'error' ? 'Most nem sikerült — próbáld újra.'
    : 'Az első indítás és az oldal-kalauzok újra megjelennek'
```

(c) A `row(...)` helper alá egy akció-sor (a `row` navigál, ez nem):

```tsx
  const kalauzRow = (
    <button type="button" className="card row" aria-label="Kalauzok újranézése"
      disabled={kalauzState === 'busy'}
      onClick={() => {
        setKalauzState('busy')
        resetAll().then(() => setKalauzState('done')).catch(() => setKalauzState('error'))
      }}
      style={{ justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left' }}>
      <div className="row gap-md" style={{ alignItems: 'center' }}>
        <ClayIcon name="i-tudas" size={28} />
        <div className="col">
          <span>Kalauzok újranézése</span>
          <span style={SECTION_LABEL}>{kalauzLine}</span>
        </div>
      </div>
      <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>↺</span>
    </button>
  )
```

(d) A JSX-ben, közvetlenül az `{row('i-erme', 'AI-napló', aiLine, '/me/ai-usage')}` sor UTÁN:

```tsx
            {kalauzRow}
```

- [ ] **Step 4: Futtasd**

Run: `VITE_USE_MOCK=true pnpm vitest run src/features/me/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/pages/
git commit -m "feat(tutorial): „Kalauzok újranézése\" sor a Beállításokban (mezo-gb1s.4)"
```

---

### Task 7: Dokumentáció és CODEMAP

**Files:**
- Modify: `docs/features/tutorial.md`
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:** semmi kód.

- [ ] **Step 1: Frissítsd a feature-docot**

`docs/features/tutorial.md` — négy dolog:

1. **A T0 welcome szakasza** (a registry-szakasz mellé): a `registry/welcome.ts` a registryn
   KÍVÜL él, seen-kulcs `'welcome'`, `WELCOME_VERSION = 1`, négy lépés (napszak · tabbar · log ·
   sugo). A trigger: `welcomeStatus === 'pending' && pathname === '/nap' && !isPending`. Nincs
   láncolás a `/nap` kalauzába. z-index 60. A `versionOf(id)` az `isUnseen` ága.
2. **A §4/§6 „Kalauzok újranézése" állítás MOST igazzá vált** — írd át jelen időbe, és
   hivatkozd a `BeallitasokPage.tsx` sorát; a `resetAll` hibára elutasít.
3. **A §8 elavult mondat javítása**: a fejléc-tesztek NEM `writeLocalProgress()`-t seedelnek,
   hanem `seedAllKalauzSeen()`-t (`AppHeader.test.tsx`, `hubHeaders.test.tsx`).
4. **A vizuális goldenek állításának pontosítása**: a `mezo.kalauz.v1` seedelés CSAK a
   `visual.spec.ts` első `describe` blokkjára igaz; a további `addInitScript` hívások (`:144`,
   `:175`, `:197`, `:212`, `:225`, `:238`) csak a témát állítják, és nem érintenek `/nap`-ot.

Vedd fel a „Nyitott / továbbadva" szakaszba, ha van ilyen: a szülő-spec §5 még
`mezo.kalauz.<userId>`-t ír a shippelt `mezo.kalauz.v1` helyett, a §8 pedig
`fogalom: { term: FogalomKey }`-t a `{ term, def }` helyett — mindkettő korábbi szeletek
öröksége, itt csak jelölve.

- [ ] **Step 2: Regeneráld a CODEMAP-et**

Run: `node scripts/gen-codemap.mjs` (a repo gyökeréből)
Expected: `docs/CODEMAP.md` frissül az új fájlokkal (`registry/welcome.ts`, `registry/lint.ts`, `shared/ui/kalauz/KalauzWelcome.tsx`)

- [ ] **Step 3: Ellenőrizd a freshness-kaput**

Run: `node scripts/gen-codemap.mjs --check`
Expected: exit 0

- [ ] **Step 4: Teljes kapu-futtatás**

Run (a `frontend/`-ből): `VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build`
Expected: mindhárom PASS

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(tutorial): S2b feature-doc + CODEMAP, három elavult állítás javítva (mezo-gb1s.4)"
```

---

## Zárás

- [ ] **Whole-branch review a legerősebb modellen.** Az S2a tanulsága: a per-task review
  strukturálisan nem lát olyan hibát, ami két task METSZETÉBEN születik (ott a chip a Task 3-ban,
  a cél-kalauz a Task 5-ben — a race-t csak a teljes branch-review találta meg, miközben mind a
  hét task külön-külön zöld volt). Ez a lépés **nem elhagyható**. Amire külön nézni kell:
  a Task 4 trigger-effektje és a Task 5 `resetAll`-ja ugyanazt a `welcomeStatus`-t írja —
  reset után a `/me/beallitasok`-on `shouldWelcome` hamis, tehát a welcome CSAK a következő
  `/nap` belépéskor jöhet; ellenőrizd, hogy a `:206` guard közben nem fagyasztja be tartósan
  más oldalak kalauzait.
- [ ] Kézi ellenőrzés a `verify` skill receptjével: Beállítások → Kalauzok újranézése → `/nap`
  → a welcome négy lépése, `Kihagyom`, `Escape`, reduced-motion, és hogy a `/nap` kalauz
  **nem** ugrik fel utána, a következő belépéskor viszont igen.
- [ ] `git push -u origin feat/kalauz-s2b-welcome` → self-PR → CI mind az öt jobon zöld →
  lokális `--no-ff` merge a FŐ checkoutból → `git push` main → branch törlés.
- [ ] `bd close mezo-gb1s.4` és `bd close mezo-gb1s.2` + `bd dolt push`.
