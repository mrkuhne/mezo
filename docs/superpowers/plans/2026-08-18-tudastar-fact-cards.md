# Tudástár fact-kártyák — érthetőség-redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/insights/knowledge` (Tudástár) lista minden eleme mondja is meg magyarul, hogy mit jelent és mit csinál — önmagyarázó, nagyobb kártyák, egy „Hogyan működik?" panel, kereső + kategória-szűrő, és prompt-státusz szerinti három szakasz.

**Architecture:** Minden felhasználónak szánt mondat egy tiszta, unit-tesztelt modulban (`features/insights/logic/factCopy.ts`) keletkezik; a kártya (`KnowledgeFactRow`), a jelölt-kártya (`FactCandidateCard`) és a magyarázó panel (`KnowledgeExplainer`) buta, prop-vezérelt feature-komponensek; a `KnowledgeListPage` csak összeszereli őket + a keresés/szűrés helyi állapotát viszi. Az adatréteg egyetlen új mezőt kap (`createdAt`, ami a dróton már kötelező), hogy a top-10 vödrözés pontosan a backend rendezését tükrözze.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + Testing Library + MSW, TanStack Query (`useDualQuery`), Tailwind v4 + a ház CSS-változói.

**Spec:** `docs/superpowers/specs/2026-08-18-tudastar-fact-cards-design.md` · **bd:** `mezo-9ryh`

## Global Constraints

- **Kötelező olvasmány munka előtt:** `docs/references/frontend_conventions.md`. A ház-szabályok, amiket ez a terv érint: deep + abszolút `@/*` importok, **soha** relatív `../`; nincs barrel a `data/hooks.ts`-en kívül; a feature-komponens `components/`-ben él, a tiszta logika `logic/`-ban; teszt a forrás mellé kolokálva; `shared/ui` primitívbe nem kerül `@/data/*` import (ezért marad minden új komponens `features/insights/`-ben).
- **Színek kizárólag `var(--token)`-nel** — nyers hex/`rgba()` tilos.
- **Minden felhasználónak látszó szöveg magyar.** A kód kommentjei/azonosítói maradhatnak angolul, ahogy a környező kód is vegyes.
- **Gate minden task végén:** az adott teszt-fájl mindkét módban zöld. A záró taskban a teljes `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Ne írd át** a `features/me/components/KnowledgeFactCard.tsx`-et (a Me graph sor-kártyája), és **ne nyúlj** a backendhez (`PatternService.promote()` nyers minta-címe szándékosan marad).
- **Commit-üzenet formátum:** conventional subject a bd id-vel, pl. `feat(insights): ... (mezo-9ryh)`.
- **`PROMPT_TOP_N = 10`** a `mezo.companion.facts.top-n` backend-konfig kézzel szinkronban tartott tükre.

---

### Task 1: Adatréteg — `createdAt` + `PROMPT_TOP_N`

A top-10 határ döntetlen `reinforced` értéknél csak akkor esik ugyanoda, mint a backendnél (`reinforcementCount DESC, createdAt DESC`), ha a FE ismeri a `createdAt`-ot. A mező a dróton már **kötelező**, csak nem képezzük le.

**Files:**
- Modify: `frontend/src/data/types.ts` (a `KnowledgeFact` interfész, ~668-680)
- Modify: `frontend/src/data/insights/knowledgeApi.ts:13-25` (`toKnowledgeFact`)
- Modify: `frontend/src/data/insights/knowledge.ts:4-20` (a 15 seed + új konstans)
- Modify: `frontend/src/data/insights/knowledgeHooks.ts:109-117` (`mockDecide` promotált ténye)
- Modify: `frontend/src/test/msw/handlers.ts:1082-1096` (a fixture a seed `createdAt`-ját adja vissza)
- Test: `frontend/src/data/insights/knowledgeApi.test.ts`

**Interfaces:**
- Consumes: semmit (első task).
- Produces: `KnowledgeFact.createdAt: string` (ISO instant) minden későbbi taskhoz; `PROMPT_TOP_N: number` a `@/data/insights/knowledge`-ből.

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/data/insights/knowledgeApi.test.ts` — az első teszt `toEqual` blokkját egészítsd ki (a `toKnowledgeFact` hívás inputja már ma tartalmazza a `createdAt`-ot, csak az elvárás nem):

```ts
    expect(fact).toEqual({
      id: 'kf-1', text: 'Laktózérzékeny', category: 'health', active: false, reinforced: 4,
      source: 'chat', lastReinforcedAt: null, createdAt: '2026-07-03T06:00:00Z',
    })
```

- [ ] **Step 2: Futtasd, hogy lássuk a bukást**

```bash
cd frontend && pnpm test src/data/insights/knowledgeApi.test.ts
```

Elvárt: FAIL — a kapott objektumból hiányzik a `createdAt`.

- [ ] **Step 3: Vidd át a mezőt a típuson és a leképzésen**

`src/data/types.ts` — a `KnowledgeFact` interfészbe, a `lastReinforcedAt` alá:

```ts
  /** A tény létrejötte (ISO instant) — a prompt-rangsor másodlagos kulcsa (reinforced DESC, createdAt DESC). */
  createdAt: string
```

`src/data/insights/knowledgeApi.ts` — a `toKnowledgeFact` visszatérésébe:

```ts
    lastReinforcedAt: f.lastReinforcedAt ?? null,
    createdAt: f.createdAt,
```

- [ ] **Step 4: Egészítsd ki a mock seedet + a promóciót + a fixture-t**

`src/data/insights/knowledge.ts` — mind a 15 tény kap `createdAt`-ot (a `reinforced`-döntetlenek — f3/f10 = 11 és f11/f15 = 6 — így kapnak stabil, a backenddel egyező sorrendet). A teljes tömb az új mezővel:

```ts
export const facts: KnowledgeFact[] = [
  { id: 'f1', text: 'Pull Day-en a Chest Supported Row a key compound', category: 'train', active: true, reinforced: 12, source: 'chat', lastReinforcedAt: '2026-08-05T19:20:00Z', createdAt: '2026-03-02T09:00:00Z' },
  { id: 'f2', text: 'Caffeine cutoff: 14:00 hard limit', category: 'fuel', active: true, reinforced: 23, source: 'chat', lastReinforcedAt: '2026-08-11T21:05:00Z', createdAt: '2026-02-14T08:30:00Z' },
  { id: 'f3', text: 'Gyógyszer-beadás: hétfő reggel · 7-day kinetic cycle', category: 'health', active: true, reinforced: 11, source: 'chat', lastReinforcedAt: '2026-08-04T08:10:00Z', createdAt: '2026-04-20T07:15:00Z' },
  { id: 'f4', text: 'Volleyball: kedd + csütörtök + szombat', category: 'train', active: true, reinforced: 18, source: 'chat', lastReinforcedAt: '2026-08-09T18:00:00Z', createdAt: '2026-02-28T17:40:00Z' },
  { id: 'f5', text: 'Sleep target: 7.5h, evening kitchen close 21:30', category: 'health', active: true, reinforced: 21, source: 'chat', lastReinforcedAt: '2026-08-10T20:40:00Z', createdAt: '2026-03-11T21:10:00Z' },
  { id: 'f6', text: 'Right shoulder niggle, márc 18 óta intermittent', category: 'health', active: true, reinforced: 9, source: 'chat', lastReinforcedAt: '2026-07-22T09:15:00Z', createdAt: '2026-03-18T09:20:00Z' },
  { id: 'f7', text: 'Identity goal: peak performance every life domain', category: 'life', active: true, reinforced: 7, source: 'manual', lastReinforcedAt: null, createdAt: '2026-01-30T12:00:00Z' },
  { id: 'f8', text: 'Carb timing > 20:00 → sleep quality drop', category: 'fuel', active: true, reinforced: 8, source: 'pattern', lastReinforcedAt: '2026-08-02T07:30:00Z', createdAt: '2026-05-06T06:45:00Z', patternTitle: 'Késői étkezés ↔ rákövetkező alvásminőség' },
  { id: 'f9', text: 'kifli.hu primary food source', category: 'fuel', active: false, reinforced: 14, source: 'chat', lastReinforcedAt: '2026-07-18T10:05:00Z', createdAt: '2026-02-02T11:00:00Z' },
  { id: 'f10', text: 'MyProtein supplement supplier', category: 'fuel', active: true, reinforced: 11, source: 'chat', lastReinforcedAt: '2026-07-25T11:40:00Z', createdAt: '2026-02-09T11:30:00Z' },
  { id: 'f11', text: 'Niggle-aware exercise substitution preferred', category: 'train', active: true, reinforced: 6, source: 'chat', lastReinforcedAt: '2026-07-29T17:20:00Z', createdAt: '2026-04-02T16:00:00Z' },
  { id: 'f12', text: 'PR celebration moments are emotionally meaningful', category: 'life', active: true, reinforced: 5, source: 'chat', lastReinforcedAt: null, createdAt: '2026-05-19T19:30:00Z' },
  { id: 'f13', text: 'Pre-workout fueling: 2-3h előtte protein+carb', category: 'fuel', active: true, reinforced: 13, source: 'chat', lastReinforcedAt: '2026-07-30T14:10:00Z', createdAt: '2026-03-05T14:20:00Z' },
  { id: 'f14', text: "Mentor relational frame ('Mizu Velünk')", category: 'life', active: true, reinforced: 4, source: 'manual', lastReinforcedAt: null, createdAt: '2026-06-01T10:00:00Z' },
  { id: 'f15', text: 'System-elegance > rewards (rendszer-szerelem)', category: 'life', active: true, reinforced: 6, source: 'chat', lastReinforcedAt: null, createdAt: '2026-01-22T18:50:00Z' },
]
```

Ugyanebbe a fájlba, a `facts` tömb **elé**:

```ts
/**
 * Hány bekapcsolt tény fér be ténylegesen a system promptba — a backend
 * `mezo.companion.facts.top-n` (application.yml) kézzel szinkronban tartott tükre.
 * A rangsor kulcsa ugyanaz, mint a `KnowledgeFactService.renderPromptBlock()`-é:
 * reinforced DESC, createdAt DESC.
 */
export const PROMPT_TOP_N = 10
```

`src/data/insights/knowledgeHooks.ts` — a `mockDecide` promotált ténye:

```ts
    const promoted: KnowledgeFact = {
      id: `kf-${candidate.id}`,
      text: input.decision === 'refine' && input.refinedText ? input.refinedText : candidate.text,
      category: candidate.category,
      active: true,
      reinforced: 0,
      source: 'chat',
      lastReinforcedAt: null,
      createdAt: new Date().toISOString(),
    }
```

`src/test/msw/handlers.ts` — a fixture ne szintetizáljon dátumot, hanem a seedét adja (különben a `listFacts()` ↔ seed egyenlőség-teszt elbukik):

```ts
  http.get(`${API_BASE}/api/companion/fact`, () =>
    HttpResponse.json(
      knowledgeSeed.map((f) => ({
        id: f.id,
        factText: f.text,
        category: f.category,
        source: f.source,
        reinforcementCount: f.reinforced,
        includeInPrompt: f.active,
        lastReinforcedAt: f.lastReinforcedAt,
        createdAt: f.createdAt,
        patternTitle: f.patternTitle ?? null,
      })),
    ),
  ),
```

- [ ] **Step 5: Futtasd az érintett teszteket mindkét módban**

```bash
cd frontend && pnpm test src/data/insights && VITE_USE_MOCK=true pnpm test src/data/insights
```

Elvárt: PASS (a `listFacts()` ↔ seed egyenlőség is, mert a fixture már a seed `createdAt`-ját adja).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data frontend/src/test/msw/handlers.ts
git commit -m "feat(insights): KnowledgeFact createdAt leképzése + PROMPT_TOP_N konstans (mezo-9ryh)"
```

---

### Task 2: A szövegréteg — `logic/factCopy.ts`

Minden magyar mondat itt keletkezik, tisztán, DOM nélkül. Ez a task adja a következő három task teljes szótárát.

**Files:**
- Create: `frontend/src/features/insights/logic/factCopy.ts`
- Test: `frontend/src/features/insights/logic/factCopy.test.ts`

**Interfaces:**
- Consumes: `KnowledgeFact` (`@/data/types`, már `createdAt`-tal, Task 1), `PROMPT_TOP_N` (`@/data/insights/knowledge`, Task 1), `huMonthDay` (`@/shared/lib/dates`), `factCategoryLabel` (`@/data/insights/knowledge`).
- Produces:
  - `type FactBucket = 'in-prompt' | 'waiting' | 'off'`
  - `humanizeFactText(text: string): string`
  - `originSentence(fact: KnowledgeFact): string`
  - `originChipLabel(source: FactSource): string`
  - `reinforcementSentence(reinforced: number, lastReinforcedAt: string | null): string`
  - `promptStatusLabel(bucket: FactBucket): string`
  - `sortFacts(facts: KnowledgeFact[]): KnowledgeFact[]`
  - `bucketFacts(facts: KnowledgeFact[], topN?: number): { inPrompt: KnowledgeFact[]; waiting: KnowledgeFact[]; off: KnowledgeFact[] }`
  - `matchesQuery(fact: KnowledgeFact, query: string): boolean`

- [ ] **Step 1: Írd meg a bukó teszteket**

`frontend/src/features/insights/logic/factCopy.test.ts`:

```ts
import {
  humanizeFactText, originSentence, originChipLabel, reinforcementSentence,
  promptStatusLabel, bucketFacts, matchesQuery,
} from '@/features/insights/logic/factCopy'
import type { KnowledgeFact } from '@/data/types'

const fact = (over: Partial<KnowledgeFact>): KnowledgeFact => ({
  id: 'x', text: 'Alapszöveg', category: 'health', active: true, reinforced: 0,
  source: 'chat', lastReinforcedAt: null, createdAt: '2026-01-01T00:00:00Z', ...over,
})

describe('humanizeFactText', () => {
  it('az "A ↔ B" minta-címből emberi mondatot képez', () => {
    expect(humanizeFactText('Gyógyszer-ciklusnap ↔ napi kalória'))
      .toBe('A gyógyszer-ciklusnap és a napi kalória együtt mozognak.')
  })

  it('magánhangzós kezdetnél "az" névelőt tesz', () => {
    expect(humanizeFactText('Alvásóra ↔ másnapi súlyváltozás'))
      .toBe('Az alvásóra és a másnapi súlyváltozás együtt mozognak.')
  })

  it('a csupa nagybetűs rövidítést nem kisbetűsíti', () => {
    expect(humanizeFactText('HRV ↔ aznapi terhelés'))
      .toBe('A HRV és az aznapi terhelés együtt mozognak.')
  })

  it('nyíl nélküli mondatot változatlanul hagy', () => {
    expect(humanizeFactText('Caffeine cutoff: 14:00 hard limit')).toBe('Caffeine cutoff: 14:00 hard limit')
  })

  it('kettőnél több nyílnál nem találgat', () => {
    expect(humanizeFactText('a ↔ b ↔ c')).toBe('a ↔ b ↔ c')
  })
})

describe('originSentence', () => {
  it('minta-tényt magyaráz', () => {
    expect(originSentence(fact({ source: 'pattern', text: 'X ↔ Y', patternTitle: 'X ↔ Y' })))
      .toBe('Megerősített mintából tanultam — amikor az egyik változik, a másik jellemzően követi.')
  })

  it('eltérő minta-címet evidenciaként hozzáfűz', () => {
    expect(originSentence(fact({ source: 'pattern', text: 'Este eszik', patternTitle: 'Késői étkezés ↔ alvás' })))
      .toBe('Megerősített mintából tanultam — amikor az egyik változik, a másik jellemzően követi. (A minta: „Késői étkezés ↔ alvás".)')
  })

  it('chat és kézi eredetet is megnevez', () => {
    expect(originSentence(fact({ source: 'chat' }))).toBe('A beszélgetéseitekből szűrtem ki.')
    expect(originSentence(fact({ source: 'manual' }))).toBe('Te vetted fel kézzel.')
    expect(originChipLabel('pattern')).toBe('mintából')
  })
})

describe('reinforcementSentence', () => {
  it('nulla megerősítésnél őszinte', () => {
    expect(reinforcementSentence(0, null)).toBe('Még nem jött vissza megerősítés.')
  })

  it('dátummal és anélkül is beszédes', () => {
    expect(reinforcementSentence(2, '2026-08-05T19:20:00Z')).toBe('2× visszaigazolva · utoljára Aug 5')
    expect(reinforcementSentence(3, null)).toBe('3× visszaigazolva')
  })
})

describe('bucketFacts', () => {
  const facts = [
    fact({ id: 'a', reinforced: 5 }),
    fact({ id: 'b', reinforced: 9 }),
    fact({ id: 'c', reinforced: 1, active: false }),
    fact({ id: 'd', reinforced: 5, createdAt: '2026-06-01T00:00:00Z' }),
  ]

  it('a bekapcsoltakat megerősítés szerint rangsorolja, döntetlennél a frissebb nyer', () => {
    const { inPrompt } = bucketFacts(facts, 10)
    expect(inPrompt.map((f) => f.id)).toEqual(['b', 'd', 'a'])
  })

  it('a topN fölötti bekapcsoltak várakoznak, a kikapcsoltak külön vödörbe kerülnek', () => {
    const { inPrompt, waiting, off } = bucketFacts(facts, 2)
    expect(inPrompt.map((f) => f.id)).toEqual(['b', 'd'])
    expect(waiting.map((f) => f.id)).toEqual(['a'])
    expect(off.map((f) => f.id)).toEqual(['c'])
  })
})

describe('promptStatusLabel + matchesQuery', () => {
  it('minden vödörnek van kimondott címkéje', () => {
    expect(promptStatusLabel('in-prompt')).toBe('Most benne van a chatben')
    expect(promptStatusLabel('waiting')).toBe('Bekapcsolva, de most kimarad')
    expect(promptStatusLabel('off')).toBe('Kikapcsolva — a társ nem látja')
  })

  it('a keresés a megjelenített szövegre és a kategória-címkére illeszkedik', () => {
    const f = fact({ text: 'Gyógyszer-ciklusnap ↔ napi kalória', category: 'health' })
    expect(matchesQuery(f, 'kalória')).toBe(true)
    expect(matchesQuery(f, 'EGÉSZSÉG')).toBe(true)
    expect(matchesQuery(f, 'bench')).toBe(false)
    expect(matchesQuery(f, '')).toBe(true)
  })
})
```

- [ ] **Step 2: Futtasd, hogy lássuk a bukást**

```bash
cd frontend && pnpm test src/features/insights/logic/factCopy.test.ts
```

Elvárt: FAIL — „Failed to resolve import … factCopy".

- [ ] **Step 3: Írd meg a modult**

`frontend/src/features/insights/logic/factCopy.ts`:

```ts
import type { FactSource, KnowledgeFact } from '@/data/types'
import { PROMPT_TOP_N, factCategoryLabel } from '@/data/insights/knowledge'
import { huMonthDay } from '@/shared/lib/dates'

/** A tény prompt-státusza — ez a három vödör adja a lista három szakaszát is. */
export type FactBucket = 'in-prompt' | 'waiting' | 'off'

const VOWELS = 'aáeéiíoóöőuúüű'

/** Magyar határozott névelő a szó kezdőhangja szerint. */
function article(word: string): string {
  return VOWELS.includes(word.charAt(0).toLowerCase()) ? 'az' : 'a'
}

/** Kisbetűsíti a kezdőbetűt — kivéve a csupa nagybetűs rövidítéseket (HRV, RPE, PR). */
function lowerFirst(text: string): string {
  const first = text.split(/\s+/)[0] ?? ''
  if (first.length > 1 && first === first.toUpperCase() && first !== first.toLowerCase()) return text
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/**
 * A minta-promóció a minta CÍMÉT másolja a tény szövegébe (`PatternService.promote()`),
 * ezért az „A ↔ B" alakú tények technikai párcímként jelennek meg. Itt lesz belőlük mondat.
 * Bármi más (chat-kivonat, kézi tény) változatlanul megy tovább.
 */
export function humanizeFactText(text: string): string {
  const parts = text.split('↔')
  if (parts.length !== 2) return text
  const a = lowerFirst(parts[0].trim())
  const b = lowerFirst(parts[1].trim())
  if (!a || !b) return text
  const lead = article(a)
  return `${lead.charAt(0).toUpperCase()}${lead.slice(1)} ${a} és ${article(b)} ${b} együtt mozognak.`
}

const ORIGIN_SENTENCE: Record<FactSource, string> = {
  pattern: 'Megerősített mintából tanultam — amikor az egyik változik, a másik jellemzően követi.',
  chat: 'A beszélgetéseitekből szűrtem ki.',
  manual: 'Te vetted fel kézzel.',
}

const ORIGIN_CHIP: Record<FactSource, string> = {
  pattern: 'mintából',
  chat: 'beszélgetésből',
  manual: 'kézzel',
}

/**
 * Honnan tudja a társ ezt a tényt. A minta-címet CSAK akkor fűzzük hozzá, ha eltér a tény
 * szövegétől — a régi `minta: {title}` chip azért volt értelmetlen, mert a promóció miatt
 * jellemzően szó szerint megismételte a kártya címét.
 */
export function originSentence(fact: KnowledgeFact): string {
  const base = ORIGIN_SENTENCE[fact.source]
  if (fact.source === 'pattern' && fact.patternTitle && fact.patternTitle.trim() !== fact.text.trim()) {
    return `${base} (A minta: „${fact.patternTitle}".)`
  }
  return base
}

export function originChipLabel(source: FactSource): string {
  return ORIGIN_CHIP[source]
}

/** ×N reinforced emberi nyelven: hányszor jött vissza magától, és mikor utoljára. */
export function reinforcementSentence(reinforced: number, lastReinforcedAt: string | null): string {
  if (reinforced <= 0) return 'Még nem jött vissza megerősítés.'
  const base = `${reinforced}× visszaigazolva`
  return lastReinforcedAt ? `${base} · utoljára ${huMonthDay(lastReinforcedAt.slice(0, 10))}` : base
}

const STATUS_LABEL: Record<FactBucket, string> = {
  'in-prompt': 'Most benne van a chatben',
  waiting: 'Bekapcsolva, de most kimarad',
  off: 'Kikapcsolva — a társ nem látja',
}

export function promptStatusLabel(bucket: FactBucket): string {
  return STATUS_LABEL[bucket]
}

/** A backend prompt-rangsora: reinforced DESC, createdAt DESC. */
export function sortFacts(facts: KnowledgeFact[]): KnowledgeFact[] {
  return [...facts].sort((a, b) => b.reinforced - a.reinforced || b.createdAt.localeCompare(a.createdAt))
}

/** A három prompt-státusz vödör — a lista szakaszai. */
export function bucketFacts(facts: KnowledgeFact[], topN: number = PROMPT_TOP_N) {
  const active = sortFacts(facts.filter((f) => f.active))
  return {
    inPrompt: active.slice(0, topN),
    waiting: active.slice(topN),
    off: sortFacts(facts.filter((f) => !f.active)),
  }
}

/** A keresés arra illeszkedik, amit a felhasználó LÁT: a humanizált szövegre + a kategória-címkére. */
export function matchesQuery(fact: KnowledgeFact, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${humanizeFactText(fact.text)} ${factCategoryLabel(fact.category)}`.toLowerCase().includes(q)
}
```

- [ ] **Step 4: Futtasd a teszteket mindkét módban**

```bash
cd frontend && pnpm test src/features/insights/logic/factCopy.test.ts && VITE_USE_MOCK=true pnpm test src/features/insights/logic/factCopy.test.ts
```

Elvárt: PASS, 15 teszt.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/logic/factCopy.ts frontend/src/features/insights/logic/factCopy.test.ts
git commit -m "feat(insights): tudástár szövegréteg — humanizált minta-tények, eredet- és megerősítés-mondatok (mezo-9ryh)"
```

---

### Task 3: A kártya — `components/KnowledgeFactRow.tsx`

**Files:**
- Create: `frontend/src/features/insights/components/KnowledgeFactRow.tsx`
- Test: `frontend/src/features/insights/components/KnowledgeFactRow.test.tsx`

**Interfaces:**
- Consumes: a Task 2 teljes exportkészlete; `factCategoryColor`, `factCategoryLabel` (`@/data/insights/knowledge`); `Toggle` (`@/shared/ui/Toggle`, propjai: `on`, `onToggle`, `ariaLabel`, `disabled?`).
- Produces: `KnowledgeFactRow({ fact, bucket, onToggle }: { fact: KnowledgeFact; bucket: FactBucket; onToggle: () => void })`.

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/features/insights/components/KnowledgeFactRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeFactRow } from '@/features/insights/components/KnowledgeFactRow'
import type { KnowledgeFact } from '@/data/types'

const patternFact: KnowledgeFact = {
  id: 'f1', text: 'Gyógyszer-ciklusnap ↔ napi kalória', category: 'health', active: true,
  reinforced: 2, source: 'pattern', patternTitle: 'Gyógyszer-ciklusnap ↔ napi kalória',
  lastReinforcedAt: '2026-08-05T19:20:00Z', createdAt: '2026-04-20T07:15:00Z',
}

test('a minta-tény emberi mondatként, eredettel és megerősítéssel jelenik meg', () => {
  render(<KnowledgeFactRow fact={patternFact} bucket="in-prompt" onToggle={() => {}} />)
  expect(screen.getByText('A gyógyszer-ciklusnap és a napi kalória együtt mozognak.')).toBeInTheDocument()
  expect(screen.getByText(/Megerősített mintából tanultam/)).toBeInTheDocument()
  expect(screen.getByText('2× visszaigazolva · utoljára Aug 5')).toBeInTheDocument()
  expect(screen.getByText('Most benne van a chatben')).toBeInTheDocument()
  expect(screen.getByText('Egészség')).toBeInTheDocument()
  expect(screen.getByText('mintából')).toBeInTheDocument()
  // az önismétlő „minta: …" chip megszűnt
  expect(screen.queryByText(/^minta: /)).not.toBeInTheDocument()
})

test('a kikapcsolt tény kimondja, hogy a társ nem látja, és a kapcsoló hívható', async () => {
  const onToggle = vi.fn()
  render(<KnowledgeFactRow fact={{ ...patternFact, active: false, reinforced: 0, lastReinforcedAt: null }} bucket="off" onToggle={onToggle} />)
  expect(screen.getByText('Kikapcsolva — a társ nem látja')).toBeInTheDocument()
  expect(screen.getByText('Még nem jött vissza megerősítés.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('switch'))
  expect(onToggle).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Futtasd, hogy lássuk a bukást**

```bash
cd frontend && pnpm test src/features/insights/components/KnowledgeFactRow.test.tsx
```

Elvárt: FAIL — „Failed to resolve import … KnowledgeFactRow".

- [ ] **Step 3: Írd meg a komponenst**

`frontend/src/features/insights/components/KnowledgeFactRow.tsx`:

```tsx
import { Toggle } from '@/shared/ui/Toggle'
import { factCategoryColor, factCategoryLabel } from '@/data/insights/knowledge'
import {
  humanizeFactText, originChipLabel, originSentence, promptStatusLabel, reinforcementSentence,
  type FactBucket,
} from '@/features/insights/logic/factCopy'
import type { KnowledgeFact } from '@/data/types'

/**
 * Egy tény a Tudástárban (mezo-9ryh) — önmagyarázó kártya: mit tud rólad a társ, honnan tudja,
 * hányszor jött vissza magától, és hogy épp bekerül-e a chat elé. Minden mondat a
 * `logic/factCopy` tiszta moduljából jön; a komponens csak propokat kap.
 */
export function KnowledgeFactRow({ fact, bucket, onToggle }: {
  fact: KnowledgeFact
  bucket: FactBucket
  onToggle: () => void
}) {
  const color = factCategoryColor(fact.category)
  const title = humanizeFactText(fact.text)

  return (
    <div
      className="card"
      style={{ padding: '12px 14px 12px 16px', position: 'relative', opacity: fact.active ? 1 : 0.6 }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />

      <div className="row gap-sm" style={{ alignItems: 'center', marginBottom: 6 }}>
        <span className="label-mono" style={{ fontSize: 9, color }}>{factCategoryLabel(fact.category)}</span>
        <span className="text-tertiary" style={{ fontSize: 9 }}>·</span>
        <span className="text-tertiary" style={{ fontSize: 9.5 }}>{originChipLabel(fact.source)}</span>
      </div>

      <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)', margin: 0 }}>{title}</p>

      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>
        {originSentence(fact)}
      </p>

      <p className="text-tertiary" style={{ fontSize: 11, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
        {reinforcementSentence(fact.reinforced, fact.lastReinforcedAt)}
      </p>

      <div
        className="row"
        style={{
          justifyContent: 'space-between', alignItems: 'center', gap: 10,
          marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)',
        }}
      >
        <span style={{ fontSize: 12, color: fact.active ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
          {promptStatusLabel(bucket)}
        </span>
        <Toggle on={fact.active} onToggle={onToggle} ariaLabel={`${title} — bekerül a chatbe`} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Futtasd a tesztet mindkét módban**

```bash
cd frontend && pnpm test src/features/insights/components/KnowledgeFactRow.test.tsx && VITE_USE_MOCK=true pnpm test src/features/insights/components/KnowledgeFactRow.test.tsx
```

Elvárt: PASS, 2 teszt.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/components/KnowledgeFactRow.tsx frontend/src/features/insights/components/KnowledgeFactRow.test.tsx
git commit -m "feat(insights): önmagyarázó tudástár-kártya (mezo-9ryh)"
```

---

### Task 4: A jelölt-kártya + a magyarázó panel

Két buta komponens, egy taskban: mindkettő csak a `KnowledgeListPage`-nek szállít, és külön-külön nem lenne értelmes review-egység.

**Files:**
- Create: `frontend/src/features/insights/components/FactCandidateCard.tsx` (a mai page-be ágyazott `CandidateCard` kiemelve + magyarázó sor)
- Create: `frontend/src/features/insights/components/KnowledgeExplainer.tsx`
- Test: `frontend/src/features/insights/components/KnowledgeExplainer.test.tsx`
- Modify: — (a `KnowledgeListPage` a Task 5-ben kapcsolja be őket; a régi belső `CandidateCard` ott tűnik el)

**Interfaces:**
- Consumes: `FactCandidate`, `FactDecision` (`@/data/types`), `factCategoryColor`/`factCategoryLabel`, `PROMPT_TOP_N` (`@/data/insights/knowledge`), `Icon` (`@/shared/ui/Icon`, propjai: `name`, `size`, `color`).
- Produces:
  - `FactCandidateCard({ candidate, onDecide }: { candidate: FactCandidate; onDecide: (decision: FactDecision, refinedText?: string) => void })`
  - `KnowledgeExplainer()` — nincs propja, a nyitott/csukott állapotot maga viszi.

- [ ] **Step 1: Írd meg a bukó tesztet a panelre**

`frontend/src/features/insights/components/KnowledgeExplainer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeExplainer, EXPLAINER_STORAGE_KEY } from '@/features/insights/components/KnowledgeExplainer'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('elsőre nyitva van és elmagyarázza a top-10 korlátot', () => {
  render(<KnowledgeExplainer />)
  expect(screen.getByText(/Csak a 10 legerősebb bekapcsolt tény fér be/)).toBeInTheDocument()
})

test('összecsukható, és az állapot túléli az újrarenderelést', async () => {
  const { unmount } = render(<KnowledgeExplainer />)
  await userEvent.click(screen.getByRole('button', { name: /Hogyan működik a tudástár/ }))
  expect(screen.queryByText(/Csak a 10 legerősebb bekapcsolt tény fér be/)).not.toBeInTheDocument()
  expect(localStorage.getItem(EXPLAINER_STORAGE_KEY)).toBe('1')

  unmount()
  render(<KnowledgeExplainer />)
  expect(screen.queryByText(/Csak a 10 legerősebb bekapcsolt tény fér be/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Futtasd, hogy lássuk a bukást**

```bash
cd frontend && pnpm test src/features/insights/components/KnowledgeExplainer.test.tsx
```

Elvárt: FAIL — „Failed to resolve import … KnowledgeExplainer".

- [ ] **Step 3: Írd meg a panelt**

`frontend/src/features/insights/components/KnowledgeExplainer.tsx`:

```tsx
import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { PROMPT_TOP_N } from '@/data/insights/knowledge'

/** A `mezo.*` kulcs-idióma szerint: '1' = a felhasználó összecsukta a panelt. */
export const EXPLAINER_STORAGE_KEY = 'mezo.knowledge.explainer.collapsed'

const PARAGRAPHS = [
  ['Mi az a tény?', 'Egy rólad szóló mondat, amit a társ megjegyzett. Vagy a beszélgetéseitekből szűrte ki, vagy egy megerősített mintából tanulta, vagy te vetted fel kézzel.'],
  ['Mit csinál a kapcsoló?', 'Bekapcsolva a tény versenyben van azért, hogy bekerüljön minden beszélgetés elé. Kikapcsolva a társ soha nem látja — sem a válaszaiban, sem a felismeréseiben.'],
  ['Mit jelent a visszaigazolás?', 'Hányszor jött vissza ugyanez magától: vagy újra elmondtad a chatben, vagy a minta-motor újra kimérte. Minél többször, annál előrébb sorolódik.'],
  ['Miért marad ki néhány?', `Csak a ${PROMPT_TOP_N} legerősebb bekapcsolt tény fér be egy beszélgetésbe. A többi bekapcsolva marad és várakozik — ha megerősödik, bekerül.`],
  ['Mi vár jóváhagyásra?', 'A beszélgetésből kiszűrt javaslatok. Amíg nem fogadod el őket, semmi nem történik velük — a társ nem használja őket.'],
] as const

/** „Hogyan működik a tudástár?" — a felület egyszeri, hosszú magyarázata (mezo-9ryh). */
export function KnowledgeExplainer() {
  const [open, setOpen] = useState(() => localStorage.getItem(EXPLAINER_STORAGE_KEY) !== '1')

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(EXPLAINER_STORAGE_KEY, next ? '0' : '1')
      return next
    })
  }

  return (
    <div className="card">
      <button
        type="button"
        onClick={toggle}
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '13px 16px' }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lav-deep)' }}>Hogyan működik a tudástár?</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={11} color="var(--text-tertiary)" />
      </button>
      {open && (
        <div className="col gap-sm" style={{ padding: '0 16px 14px' }}>
          {PARAGRAPHS.map(([title, body]) => (
            <div key={title}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
              <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.55, margin: '2px 0 0' }}>{body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Írd meg a jelölt-kártyát**

`frontend/src/features/insights/components/FactCandidateCard.tsx` — a mai `KnowledgeListPage.tsx:7-57` `CandidateCard`-ja kiemelve, nagyobb tipográfiával és a gombokat magyarázó sorral:

```tsx
import { useState } from 'react'
import { factCategoryColor, factCategoryLabel } from '@/data/insights/knowledge'
import type { FactCandidate, FactDecision } from '@/data/types'

/**
 * Egy jóváhagyásra váró jelölt (mezo-9ryh) — a mai kártya kiemelve a page-ből, kiírva, hogy
 * honnan jött és hogy a három gomb pontosan mit tesz. A „Pontosít" inline input viselkedése
 * változatlan (V1.2 L2 döntés, a confirm sosem néma).
 */
export function FactCandidateCard({ candidate, onDecide }: {
  candidate: FactCandidate
  onDecide: (decision: FactDecision, refinedText?: string) => void
}) {
  const [refining, setRefining] = useState(false)
  const [refinedText, setRefinedText] = useState(candidate.text)
  const color = factCategoryColor(candidate.category)

  return (
    <div className="card" style={{ padding: '12px 14px 12px 16px', position: 'relative', borderColor: 'var(--line)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />

      <span className="label-mono" style={{ fontSize: 9, color }}>{factCategoryLabel(candidate.category)}</span>
      <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)', margin: '6px 0 0' }}>{candidate.text}</p>
      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>
        Ezt a beszélgetésből szűrtem ki — csak akkor jegyzem meg, ha elfogadod.
      </p>

      {refining ? (
        <div className="row gap-sm" style={{ alignItems: 'center', marginTop: 10 }}>
          <input
            aria-label="Pontosított tény"
            value={refinedText}
            onChange={(e) => setRefinedText(e.target.value)}
            style={{
              flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 6,
              border: '1px solid var(--border-default)', background: 'var(--surface-0)', color: 'var(--text-primary)',
            }}
          />
          <button className="chip" disabled={!refinedText.trim()} onClick={() => onDecide('refine', refinedText.trim())} style={{ fontSize: 11 }}>
            Mentés
          </button>
        </div>
      ) : (
        <>
          <div className="row gap-sm" style={{ marginTop: 10 }}>
            <button className="chip" onClick={() => onDecide('accept')} style={{ fontSize: 11, color: 'var(--lav-deep)' }}>
              Elfogad
            </button>
            <button className="chip" onClick={() => setRefining(true)} style={{ fontSize: 11 }}>
              Pontosít
            </button>
            <button className="chip" onClick={() => onDecide('reject')} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Elvet
            </button>
          </div>
          <p className="text-tertiary" style={{ fontSize: 10.5, lineHeight: 1.5, margin: '6px 0 0' }}>
            Elfogad → bekerül a tudástárba · Pontosít → átírod a szövegét · Elvet → eldobom.
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Futtasd a panel tesztjét mindkét módban**

```bash
cd frontend && pnpm test src/features/insights/components/KnowledgeExplainer.test.tsx && VITE_USE_MOCK=true pnpm test src/features/insights/components/KnowledgeExplainer.test.tsx
```

Elvárt: PASS, 2 teszt. (A `FactCandidateCard`-ot a Task 5 page-tesztje fedi le, ahogy ma is.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/insights/components/FactCandidateCard.tsx frontend/src/features/insights/components/KnowledgeExplainer.tsx frontend/src/features/insights/components/KnowledgeExplainer.test.tsx
git commit -m "feat(insights): jelölt-kártya kiemelése + 'Hogyan működik a tudástár?' panel (mezo-9ryh)"
```

---

### Task 5: A lap újraszerelése — `KnowledgeListPage`

**Files:**
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx` (teljes átírás; a belső `CandidateCard` törlődik)
- Test: `frontend/src/features/insights/pages/KnowledgeListPage.test.tsx`

**Interfaces:**
- Consumes: `useKnowledge`, `useKnowledgeActions` (`@/data/hooks`); `bucketFacts`, `matchesQuery` (Task 2); `KnowledgeFactRow` (Task 3); `FactCandidateCard`, `KnowledgeExplainer` (Task 4); `LifecycleSection` (`@/features/insights/components/LifecycleSection`, propjai: `title`, `accent`, `count?`, `defaultOpen?`, `footNote?`, `children` — **0 `count`-nál nem renderel**); `FACT_CATEGORIES`, `PROMPT_TOP_N` (`@/data/insights/knowledge`); `Icon` (`@/shared/ui/Icon`); `cn` (`@/shared/lib/cn`).
- Produces: — (végpont).

- [ ] **Step 1: Írd át a page tesztjét**

`frontend/src/features/insights/pages/KnowledgeListPage.test.tsx` — a mock-módú blokk első két tesztje és a V3.3 chip-teszt a régi szövegre néz, azok cserélődnek; a jelölt-tesztek (`Jóváhagyásra vár`, Elfogad/Pontosít/Elvet) **szövegükben változatlanok**, de a „Tudás · N fact" elvárások az új fejlécre íródnak át. A cserélendő/új tesztek:

```tsx
  test('a fejléc a tényszámot és a ténylegesen promptba kerülő darabszámot mutatja', () => {
    renderPage()
    // 15 seed, ebből 14 bekapcsolt → a top 10 megy a chatbe
    expect(screen.getByText('Tudástár · 15 tény')).toBeInTheDocument()
    expect(screen.getByText('10 megy a chatbe')).toBeInTheDocument()
  })

  test('a három prompt-státusz szakasz a helyes darabszámokkal jelenik meg', () => {
    renderPage()
    expect(screen.getByText(/Most ezeket kapja meg a társ · 10\/10/)).toBeInTheDocument()
    expect(screen.getByText(/Bekapcsolva, de most kimarad · 4/)).toBeInTheDocument()
    expect(screen.getByText(/Kikapcsolva · 1/)).toBeInTheDocument()
  })

  test('a kapcsoló átmozgatja a tényt a kikapcsolt szakaszba', async () => {
    renderPage()
    // az első switch a legerősebb aktív tényé (f2, ×23) — kikapcsolva 13 aktív marad, így a
    // top-10 továbbra is tele van, de a várakozók száma 4→3, a kikapcsoltaké 1→2 lesz
    await userEvent.click(screen.getAllByRole('switch')[0])
    expect(await screen.findByText(/Kikapcsolva · 2/)).toBeInTheDocument()
    expect(screen.getByText(/Bekapcsolva, de most kimarad · 3/)).toBeInTheDocument()
    expect(screen.getByText('10 megy a chatbe')).toBeInTheDocument()
  })

  test('a keresés a látható szövegre szűr', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'caffeine')
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
    expect(screen.queryByText('Volleyball: kedd + csütörtök + szombat')).not.toBeInTheDocument()
  })

  test('a kategória-chip szűr, és a törlés visszaadja a teljes listát', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Élet' }))
    expect(screen.queryByText('Caffeine cutoff: 14:00 hard limit')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mind' }))
    expect(screen.getByText('Caffeine cutoff: 14:00 hard limit')).toBeInTheDocument()
  })

  test('a találat nélküli keresés őszinte üres állapotot ad', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Keresés a tények között'), 'zzzz')
    expect(screen.getByText('Nincs találat a keresésre.')).toBeInTheDocument()
  })
```

A valós-módú V3.3 tesztben a chip-elvárás az új eredet-mondatra cserélődik (a fixture `factText`-je eltér a `patternTitle`-től, ezért a minta-cím evidenciaként megjelenik):

```tsx
    expect(await screen.findByText('Stressz rontja az alvást')).toBeInTheDocument()
    expect(screen.getByText(/A minta: „Stressz-szint ↔ aznapi alvásminőség"/)).toBeInTheDocument()
```

A valós-módú „renders the fetched facts + pending candidates" teszt fejléc-elvárása:

```tsx
    expect(await screen.findByText('Tudástár · 15 tény')).toBeInTheDocument()
```

A jelölt-promóciós tesztek `'Tudás · 16 fact'` elvárásai `'Tudástár · 16 tény'`-re cserélődnek, a `'Tudás · 15 fact'` pedig `'Tudástár · 15 tény'`-re. A `degraded` teszt változatlan.

- [ ] **Step 2: Futtasd, hogy lássuk a bukást**

```bash
cd frontend && pnpm test src/features/insights/pages/KnowledgeListPage.test.tsx
```

Elvárt: FAIL — a régi „Tudás · 15 fact" fejléc és a hiányzó szakaszcímek miatt.

- [ ] **Step 3: Írd át a lapot**

`frontend/src/features/insights/pages/KnowledgeListPage.tsx` **teljes tartalma**:

```tsx
import { useMemo, useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { useKnowledge, useKnowledgeActions } from '@/data/hooks'
import { FACT_CATEGORIES, PROMPT_TOP_N } from '@/data/insights/knowledge'
import { LifecycleSection } from '@/features/insights/components/LifecycleSection'
import { KnowledgeExplainer } from '@/features/insights/components/KnowledgeExplainer'
import { FactCandidateCard } from '@/features/insights/components/FactCandidateCard'
import { KnowledgeFactRow } from '@/features/insights/components/KnowledgeFactRow'
import { bucketFacts, matchesQuery, type FactBucket } from '@/features/insights/logic/factCopy'
import type { FactCategory, KnowledgeFact } from '@/data/types'

export function KnowledgeListPage() {
  const { facts, candidates, degraded } = useKnowledge()
  const { toggle, decide } = useKnowledgeActions()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FactCategory | 'all'>('all')

  // A vödrözés a TELJES listán fut (a „10 megy a chatbe" a valóságot mondja), a szűrés csak
  // a megjelenítést szűkíti — különben egy aktív szűrő átírná a prompt-státuszokat.
  const buckets = useMemo(() => bucketFacts(facts, PROMPT_TOP_N), [facts])
  const visible = (list: KnowledgeFact[]) =>
    list.filter((f) => (category === 'all' || f.category === category) && matchesQuery(f, query))

  if (degraded) {
    return (
      <div className="col gap-md">
        <div className="card" style={{ padding: 14 }}>
          <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.
          </span>
        </div>
      </div>
    )
  }

  const inPrompt = visible(buckets.inPrompt)
  const waiting = visible(buckets.waiting)
  const off = visible(buckets.off)
  const nothingMatches = facts.length > 0 && inPrompt.length + waiting.length + off.length === 0

  const rows = (list: KnowledgeFact[], bucket: FactBucket) =>
    list.map((f) => (
      <KnowledgeFactRow key={f.id} fact={f} bucket={bucket} onToggle={() => toggle(f.id, !f.active)} />
    ))

  return (
    <div className="col gap-md">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Tudástár · {facts.length} tény</span>
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{buckets.inPrompt.length} megy a chatbe</span>
      </div>

      <KnowledgeExplainer />

      {candidates.length > 0 && (
        <div className="col gap-sm">
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
            Jóváhagyásra vár · {candidates.length}
          </span>
          {candidates.map((c) => (
            <FactCandidateCard
              key={c.id}
              candidate={c}
              onDecide={(decision, refinedText) => decide(c.id, decision, refinedText)}
            />
          ))}
        </div>
      )}

      <div>
        <div className="searchfield" style={{ marginBottom: 8 }}>
          <Icon name="search" size={16} color="var(--text-tertiary)" />
          <input
            aria-label="Keresés a tények között"
            placeholder="Keresés · pl. alvás, kávé, váll"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="row gap-xs" style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
          <button
            type="button"
            className={cn('chip tapchip', category === 'all' && 'brand')}
            onClick={() => { setCategory('all'); setQuery('') }}
          >
            Mind
          </button>
          {FACT_CATEGORIES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn('chip tapchip', category === id && 'brand')}
              onClick={() => setCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {nothingMatches ? (
        <div className="card" style={{ padding: 14 }}>
          <span className="text-secondary" style={{ fontSize: 12 }}>Nincs találat a keresésre.</span>
        </div>
      ) : (
        <div className="col gap-sm">
          {inPrompt.length > 0 && (
            <div className="col gap-sm">
              <span className="eyebrow" style={{ color: 'var(--sage)' }}>
                Most ezeket kapja meg a társ · {buckets.inPrompt.length}/{PROMPT_TOP_N}
              </span>
              {rows(inPrompt, 'in-prompt')}
              <p className="text-tertiary" style={{ fontSize: 11, lineHeight: 1.5, padding: '0 4px' }}>
                Minden beszélgetés elején ezek a mondatok mennek elé.
              </p>
            </div>
          )}

          <LifecycleSection
            title="Bekapcsolva, de most kimarad"
            accent="var(--text-secondary)"
            count={waiting.length}
            footNote="Ha megerősödnek, vagy egy erősebb tény kiesik, bekerülnek a chatbe."
          >
            {rows(waiting, 'waiting')}
          </LifecycleSection>

          <LifecycleSection
            title="Kikapcsolva"
            accent="var(--text-tertiary)"
            count={off.length}
            footNote="Megőrzöm őket, de a társ nem használja."
          >
            {rows(off, 'off')}
          </LifecycleSection>
        </div>
      )}

      <p className="text-tertiary mt-md" style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5, padding: '0 20px' }}>
        A graph nézethez · Me → Knowledge.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Futtasd a page tesztjét mindkét módban**

```bash
cd frontend && pnpm test src/features/insights/pages/KnowledgeListPage.test.tsx && VITE_USE_MOCK=true pnpm test src/features/insights/pages/KnowledgeListPage.test.tsx
```

Elvárt: PASS. Ha a „szakasz darabszáma" teszt bukik, a `LifecycleSection` fejléce a `count`-ot `· N` utótagként fűzi a címhez — a regexes elvárás (`/Kikapcsolva · 1/`) ezért egy csomópontra illeszkedik.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights/pages/KnowledgeListPage.tsx frontend/src/features/insights/pages/KnowledgeListPage.test.tsx
git commit -m "feat(insights): tudástár lap — kereső, kategória-szűrő, prompt-státusz szakaszok (mezo-9ryh)"
```

---

### Task 6: Teljes gate + dokumentáció

**Files:**
- Modify: `docs/features/insights.md` (§2.4 Knowledge)
- Modify: `docs/superpowers/specs/2026-08-18-tudastar-fact-cards-design.md` (a Task 2-ben hozott finomítás rögzítése)

**Interfaces:**
- Consumes: minden korábbi task.
- Produces: — (végpont).

- [ ] **Step 1: Futtasd a teljes gate-et**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Elvárt: a `tsc -b` és mindkét teszt-futás zöld. Bukás esetén javítsd, mielőtt továbbmész — a `MemoryAuditPanel`/`me` felületek is olvasnak `KnowledgeFact`-et, a `createdAt` új kötelező mező miatt ott is kellhet fixture-bővítés.

- [ ] **Step 2: Írd át a feature-doc §2.4-et**

`docs/features/insights.md` — a „### 2.4 Knowledge" szakasz teljes cseréje:

```markdown
### 2.4 Knowledge (`pages/KnowledgeListPage.tsx`) — **real dual-mode since companion V1.2, érthetőség-redesign `mezo-9ryh`**
A companion fact-memóriájának L2 confirm felülete ([`companion.md`](companion.md) §4). A lap fentről lefelé:
- **Fejléc** — `Tudástár · N tény` + `M megy a chatbe`, ahol M a ténylegesen injektált tények száma (**nem** az összes bekapcsolté): a `bucketFacts()` a backend rangsorát tükrözi (`reinforced DESC, createdAt DESC`, top `PROMPT_TOP_N = 10` — a `mezo.companion.facts.top-n` kézzel szinkronban tartott tükre `data/insights/knowledge.ts`-ben).
- **`KnowledgeExplainer`** (`components/`) — összecsukható „Hogyan működik a tudástár?" panel; elsőre nyitva, az összecsukott állapot `localStorage`-ben (`mezo.knowledge.explainer.collapsed`).
- **„Jóváhagyásra vár · N"** — `FactCandidateCard` (`components/`, a page-ből kiemelve): **Elfogad** / **Pontosít** (inline input → Mentés) / **Elvet** → `useKnowledgeActions().decide(...)`, alatta a három gomb hatását kiíró sor. Confirm sosem néma (IDENT-6).
- **Kereső + kategória-chipek** — `.searchfield` + `chip tapchip` sor (`Mind` + `FACT_CATEGORIES`); a szűrés csak a megjelenítést szűkíti, a vödrözés mindig a TELJES listán fut (különben egy aktív szűrő átírná a prompt-státuszokat). Nulla találat → „Nincs találat a keresésre."
- **Három prompt-státusz szakasz** — „Most ezeket kapja meg a társ · N/10" (mindig látszik), majd két `LifecycleSection` (újrahasznosítva a Minták dashboardról): „Bekapcsolva, de most kimarad", „Kikapcsolva".
- **`KnowledgeFactRow`** (`components/`) — önmagyarázó kártya: kategória + eredet-chip, humanizált cím, eredet-mondat, visszaigazolás-mondat, és a `Toggle` mellett kimondott státusz-címke („Most benne van a chatben" / „Bekapcsolva, de most kimarad" / „Kikapcsolva — a társ nem látja").

**Minden felhasználói mondat a `logic/factCopy.ts` tiszta moduljából jön** (unit-tesztelt): `humanizeFactText()` az „A ↔ B" alakú minta-tényekből mondatot képez (a promóció a minta CÍMÉT másolja a tény szövegébe — `PatternService.promote()`), `originSentence()`/`originChipLabel()` a `source`-ot fordítja, `reinforcementSentence()` a `×N reinforced`-et. **A régi önismétlő `minta: {title}` chip megszűnt** — a minta-cím már csak akkor jelenik meg (evidenciaként, az eredet-mondat végén), ha eltér a tény szövegétől.

Real mode a companion switch-off 404-en változatlanul az őszinte degraded bannert adja (*"A társ jelenleg nincs bekapcsolva…"*). Lábléc: *"A graph nézethez · Me → Knowledge."* (§5).
```

- [ ] **Step 3: Rögzítsd a spec-finomítást**

`docs/superpowers/specs/2026-08-18-tudastar-fact-cards-design.md` — a `originSentence(fact)` szakasz alatti „A `minta: {title}` chip **megszűnik** — önismétlő volt." mondat után egy sor:

```markdown
A minta címe **evidenciaként megmarad**, de csak akkor íródik ki (az eredet-mondat végén,
`(A minta: „{title}".)` alakban), ha eltér a tény szövegétől — pontosan az az eset, amikor
hordoz is információt.
```

- [ ] **Step 4: Futtasd a doc-lintet**

```bash
node scripts/lint-docs.mjs
```

Elvárt: nincs hiba, és az `insights.md` staleness-flagje eltűnik.

- [ ] **Step 5: Commit + bd zárás**

```bash
git add docs/features/insights.md docs/superpowers/specs/2026-08-18-tudastar-fact-cards-design.md
git commit -m "docs(insights): §2.4 Knowledge átírása az érthetőség-redesignra (mezo-9ryh)"
bd close mezo-9ryh
```

---

## Végállapot — mit lát a felhasználó

Mock módban (15 seed tény): a fejléc `Tudástár · 15 tény` / `10 megy a chatbe`; a „Most ezeket kapja meg a társ · 10/10" szakaszban f2, f5, f4, f13, f1, f3, f10, f6, f8, f7; a „Bekapcsolva, de most kimarad · 4" szakaszban f11, f15, f12, f14; a „Kikapcsolva · 1" szakaszban f9. Minden kártya kimondja, honnan tudja a társ a tényt, hányszor jött vissza magától, és hogy épp bekerül-e a chat elé.
