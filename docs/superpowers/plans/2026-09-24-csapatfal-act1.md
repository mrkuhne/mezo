# Csapat-üzenőfal · I. felvonás („A színpad”) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/mezo` világ főoldala a jóváhagyott social-üzenőfal lesz — az 5 boop karakter posztjaiként renderelve a MÁR LÉTEZŐ rekordokat (minták, előrejelzések, kísérletek, észrevételek, konzílium, companion-üzenetek), karakter-szobákkal, új dokk-navigációval és hidegindítással; backend-változtatás nélkül.

**Architecture:** Egy tiszta, tesztelt FE-domain réteg (`teamFeed.ts` + `team.ts`) a meglévő hookok kimenetét fésüli össze poszt-folyammá karakter-routinggal; erre ülnek a nézet-komponensek (fal, szobák, csapat-oldal), amelyek a jóváhagyott `uveg-uzenofal.html` prototípus anatómiáját követik. A navigáció a `navModel`/`pageIndex`/`router` hármasban vált; minden régi útvonal redirectet kap.

**Tech Stack:** React + TS, TanStack Query (meglévő dual-mode hookok), vitest + @testing-library/react, mozaik/clay UI-kit, üveg-anyag (mezo-me75u U1 kit).

**Spec:** `docs/superpowers/specs/2026-09-23-boop-team-feed-design.md` · **Parity-referencia:** `docs/design_2.0/prototypes/uveg-uzenofal.html` (minden vizuális kérdésben ez dönt).

## Global Constraints

- **Csak sötét mód** — az üveg-kánon szerint (üveg style bible); light CSS parkol, nem törlődik.
- **Viselkedés-fagy:** route/hook/contract/mutáció nem változik, KIVÉVE a navModel/pageIndex/router e tervben felsorolt módosításait. Új API-hívás nincs.
- **Nincs kitalált tartalom (ADR 0049):** minden poszt egy létező rekord nézete; a hidegindító bemutatkozó posztok statikus UI-szövegek (spec §2.6), nem rekordok.
- **Nyelvi vasszabályok (spec §2.7):** tegeződés, zéró szaknyelv a falon; minden állítás mellett „Miből látszik?”; a bizonytalanság kimondva. Emoji CSAK karakter-mondatban (I. felvonásban csak a statikus bemutatkozókban); UI-glifa soha.
- **Egységes hármas (spec §2.8):** „Ez talál · Nem így érzem · Elmesélem” — meglévő mutációkra kötve (`usePatternActions().decide`, `useClaimFeedback`, `useObservationReply`, `useCharacterReplyDraft`).
- **Munkanevek** (owner cserélheti, egy helyen éljenek): Szunya·alvás, Mocor·mozgás, Falat·étkezés, Derű·közérzet, Mezo·a csapat + Szkeptikus.
- **Tesztfuttatás-csapdák:** `pnpm test` fájlszűrője NEM szűkít → fókuszált futáshoz `CI=true pnpm --dir frontend exec vitest run <fájl>`; `VITE_USE_MOCK` üresen = mock; a real-mode kapu csak `VITE_USE_MOCK=false`-szal fut. Kapuzáráskor MINDKÉT mód + `pnpm --dir frontend build`.
- **Üveg-kit:** ha a mezo-me75u U1 üveg-primitívje (`.glass` szekció a `prototype.css`-ben / `shared/ui/mozaik`) már main-en van, azt fogyasztjuk; ha nincs, a T2 hozza létre az EGY közös szekciót az üveg-biblia §3 receptjével — második üveg-recept tilos.
- Minden commit: konvencionális subject + `(mezo-a9bo7.<szelet>)` + a kötelező attribúció-sor.

---

## File Structure (a felvonás teljes térképe)

```
frontend/src/features/insights/logic/team.ts            ← ÚJ  karakter-regisztry + persona/domain→karakter
frontend/src/features/insights/logic/teamFeed.ts        ← ÚJ  poszt-folyam builder (tiszta függvények)
frontend/src/features/insights/logic/team.test.ts       ← ÚJ
frontend/src/features/insights/logic/teamFeed.test.ts   ← ÚJ
frontend/src/features/insights/pages/TeamFeedPage.tsx   ← ÚJ  a fal ( /mezo )
frontend/src/features/insights/pages/TeamPage.tsx       ← ÚJ  A csapat ( /mezo/csapat )
frontend/src/features/insights/pages/CharacterRoomPage.tsx ← ÚJ szoba ( /mezo/csapat/:id )
frontend/src/features/insights/components/feed/FeedPostCard.tsx   ← ÚJ csendes poszt
frontend/src/features/insights/components/feed/FeedPosterCard.tsx ← ÚJ a nap posztere
frontend/src/features/insights/components/feed/FeedTrio.tsx       ← ÚJ hármas gombsor + utóélet
frontend/src/features/insights/components/feed/StoryStrip.tsx     ← ÚJ story-sáv gyűrűkkel
frontend/src/features/insights/components/feed/*.test.tsx         ← ÚJ
frontend/src/features/insights/boop-world.css           ← MÓDOSUL: üveg-fal szekció (a Boop V3 szekció helyére)
frontend/src/features/insights/pages/BoopWorldPage.tsx  ← MÓDOSUL: vékony wrapper → TeamFeedPage
frontend/src/features/insights/logic/boopNavigation.ts  ← MÓDOSUL: a katalógus a Gépterem-menü forrása lesz
frontend/src/app/navModel.ts                            ← MÓDOSUL: Mezo-dokk = Üzenőfal·A csapat·Rólad·Emlékek
frontend/src/app/router.tsx                             ← MÓDOSUL: új route-ok + redirectek
frontend/src/app/pageIndex.ts                           ← MÓDOSUL: új oldalak felvétele
frontend/src/app/boopNavigation.test.ts                 ← MÓDOSUL: az új katalógus-állítások
frontend/src/features/insights/pages/insights.nav.test.tsx ← MÓDOSUL
docs/CODEMAP.md                                         ← regenerálva
```

Elv: a domain-logika (routing, csoportosítás, állapot-címkék) EGY tiszta modulban él és ott van agyontesztelve; a komponensek buták. A meglévő oldalak (PatternDetailPage, ExperimentDetailPage, KonziliumPage, Rólad/Emlékek felületek) NEM épülnek újra — a fal rájuk hivatkozik; üveg-újraöltöztetésük a mezo-me75u U8/U9 szeleteké, ennek a prototípusnak mint paritás-forrásnak a használatával.

---

### Task 1: Karakter-regisztry (`team.ts`)

**Files:**
- Create: `frontend/src/features/insights/logic/team.ts`
- Test: `frontend/src/features/insights/logic/team.test.ts`

**Interfaces:**
- Produces: `type TeamCharacterId = 'szunya'|'mocor'|'falat'|'deru'|'mezo'|'szkeptikus'`
- Produces: `interface TeamCharacter { id: TeamCharacterId; name: string; area: string; boop: BoopDomain; accent: 'lav'|'sky'|'sage'|'rose'|'gold'|'slate'; postable: boolean }`
- Produces: `TEAM: Record<TeamCharacterId, TeamCharacter>` · `characterForMetricDomain(d: MetricDomain): TeamCharacterId` · `characterForPersona(personaKey: string): TeamCharacterId`
- Consumes: `MetricDomain` a `@/data/types`-ból, `BoopDomain` a `@/shared/ui/clay`-ből.

- [ ] **Step 1: Failing test**

```ts
// team.test.ts
import { TEAM, characterForMetricDomain, characterForPersona } from './team'

test('mind az 5 posztoló karakter + a nem posztoló Szkeptikus létezik', () => {
  expect(Object.keys(TEAM)).toHaveLength(6)
  expect(TEAM.szkeptikus.postable).toBe(false)
  expect(Object.values(TEAM).filter(c => c.postable)).toHaveLength(5)
})

test('metrika-domén → gazda (spec §4: pontosan egy gazda)', () => {
  expect(characterForMetricDomain('sleep')).toBe('szunya')
  expect(characterForMetricDomain('train')).toBe('mocor')
  expect(characterForMetricDomain('fuel')).toBe('falat')
  expect(characterForMetricDomain('mind')).toBe('deru')
  expect(characterForMetricDomain('body')).toBe('deru')   // mérések/egészségjelek → Közérzet
  expect(characterForMetricDomain('other')).toBe('mezo')
})

test('backend-persona → karakter beolvadás (spec §2.2)', () => {
  expect(characterForPersona('szomnologus')).toBe('szunya')
  expect(characterForPersona('edzo')).toBe('mocor')
  expect(characterForPersona('drill')).toBe('mocor')
  expect(characterForPersona('taplalkozo')).toBe('falat')
  expect(characterForPersona('pszichologus')).toBe('deru')
  expect(characterForPersona('doki')).toBe('deru')
  expect(characterForPersona('antropologus')).toBe('mezo')
  expect(characterForPersona('mezo')).toBe('mezo')
  expect(characterForPersona('szkeptikus')).toBe('szkeptikus')
  expect(characterForPersona('ismeretlen-uj-persona')).toBe('mezo') // biztonságos default
})
```

- [ ] **Step 2: Futtatás — bukjon** · `CI=true pnpm --dir frontend exec vitest run src/features/insights/logic/team.test.ts` · Expected: FAIL (module not found)
- [ ] **Step 3: Implementáció**

```ts
// team.ts
import type { MetricDomain } from '@/data/types'
import type { BoopDomain } from '@/shared/ui/clay'

export type TeamCharacterId = 'szunya' | 'mocor' | 'falat' | 'deru' | 'mezo' | 'szkeptikus'

export interface TeamCharacter {
  id: TeamCharacterId
  /** Munkanév — owner-döntésre cserélhető, KIZÁRÓLAG itt él. */
  name: string
  area: string
  boop: BoopDomain
  accent: 'lav' | 'sky' | 'sage' | 'rose' | 'gold' | 'slate'
  /** A Szkeptikus sosem posztol és nincs story-köre (spec §2.2). */
  postable: boolean
}

export const TEAM: Record<TeamCharacterId, TeamCharacter> = {
  szunya: { id: 'szunya', name: 'Szunya', area: 'alvás', boop: 'mezo', accent: 'lav', postable: true },
  mocor: { id: 'mocor', name: 'Mocor', area: 'mozgás', boop: 'train', accent: 'sky', postable: true },
  falat: { id: 'falat', name: 'Falat', area: 'étkezés', boop: 'fuel', accent: 'sage', postable: true },
  deru: { id: 'deru', name: 'Derű', area: 'közérzet', boop: 'me', accent: 'rose', postable: true },
  mezo: { id: 'mezo', name: 'Mezo', area: 'a csapat', boop: 'nap', accent: 'gold', postable: true },
  szkeptikus: { id: 'szkeptikus', name: 'Szkeptikus', area: '', boop: 'mezo', accent: 'slate', postable: false },
}

const DOMAIN_OWNER: Record<MetricDomain, TeamCharacterId> = {
  sleep: 'szunya', train: 'mocor', fuel: 'falat', mind: 'deru', body: 'deru', other: 'mezo',
}
export function characterForMetricDomain(d: MetricDomain): TeamCharacterId {
  return DOMAIN_OWNER[d] ?? 'mezo'
}

const PERSONA_OWNER: Record<string, TeamCharacterId> = {
  szomnologus: 'szunya', edzo: 'mocor', drill: 'mocor', taplalkozo: 'falat',
  pszichologus: 'deru', doki: 'deru', antropologus: 'mezo', mezo: 'mezo', szkeptikus: 'szkeptikus',
}
export function characterForPersona(personaKey: string): TeamCharacterId {
  return PERSONA_OWNER[personaKey] ?? 'mezo'
}
```

Megjegyzés a `boop` mezőhöz: az agyag-készlet mai 5 figurája app-területhez kötött (`nap|train|fuel|mezo|me`). Az arany Mezo- és a palaszürke Szkeptikus-figura a prototípus saját rajza — a figura-változatok felvétele a clay-sprite-ba a T7 (story-sáv) 1. lépésének része; ADDIG a fenti legközelebbi meglévő változat a fallback, és a teszt csak a leképezés létét állítja, színt nem.

- [ ] **Step 4: Futtatás — zöld** · ugyanaz a parancs · Expected: PASS
- [ ] **Step 5: Commit** · `git add … && git commit -m "feat(insights): csapat-regisztry — 5 karakter + persona/domén-routing (mezo-a9bo7.7)"`

---

### Task 2: Üveg-fal CSS-szekció (kánon-szinkron)

**Files:**
- Modify: `frontend/src/features/insights/boop-world.css` (a `boop-world-social` szekció cseréje `team-feed` szekcióra)
- Modify (ha kell): `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` — csak ha a szekció a `prototype.css`-be kerül; alapesetben NEM oda kerül.

**Interfaces:**
- Produces: `.tf-*` osztálycsalád a prototípus 1:1 átiratával: `.tf-cast/.tf-ring/.tf-dot` (story-sáv), `.tf-post` (halk panel), `.tf-poster` (üveg), `.tf-well/.tf-chart/.tf-bar/.tf-days/.tf-chips` (média), `.tf-sum/.tf-acts/.tf-cmt/.tf-after` (social sor), `.tf-day` (napelválasztó), `.tf-case/.tf-flatc` (ügy-kártya), `.tf-gauges/.tf-matwell/.tf-tlist` (szoba).
- Consumes: az U1 üveg-primitív (`.glass` a bibliából), a sötét „Pulse” tokenek.

- [ ] **Step 1: Ellenőrizd az U1 állapotát** · `git log origin/main --oneline -20 | grep -i uveg` és `grep -n "\.glass" frontend/src/styles/prototype.css | head`. Ha az üveg-primitív main-en van → import/összekötés; ha nincs → a `.glass` recept BEMÁSOLÁSA az üveg-biblia §3-ból a boop-world.css tetejére, `/* TODO-U1-MERGE: az U1 landolásakor ez a blokk törlendő, a közös primitívre váltunk */` jelöléssel (ez az egyetlen megengedett „ideiglenes második példány”, és bd-jegyet kap: lásd Step 5).
- [ ] **Step 2: Vizuális forrás** · Nyisd meg a prototípust és a stílus-értékeket ONNAN másold (fidelity-szabály): `docs/design_2.0/prototypes/uveg-uzenofal.html` — a `.post/.poster/.fp-*/.case/.tcmt/.rgauges/.matwell/.tlist` blokkok. Prefix-csere `tf-`-re, tokenekre írva (`--dv-lav` stb. a literálok helyett, üveg-biblia §1–2).
- [ ] **Step 3: Guard-teszt** — a szekció-jelenlét gyors őre:

```ts
// frontend/src/features/insights/teamFeedCss.test.ts  (ÚJ)
import { readFileSync } from 'node:fs'
test('a team-feed CSS-szekció létezik és kiegyensúlyozott', () => {
  const css = readFileSync('src/features/insights/boop-world.css', 'utf8')
  for (const cls of ['.tf-cast', '.tf-poster', '.tf-post', '.tf-acts', '.tf-day', '.tf-matwell'])
    expect(css).toContain(cls)
  expect((css.match(/\{/g) ?? []).length).toBe((css.match(/\}/g) ?? []).length)
})
```

- [ ] **Step 4: Futtatás zöldre** · `CI=true pnpm --dir frontend exec vitest run src/features/insights/teamFeedCss.test.ts`
- [ ] **Step 5: Commit + bd-jegy** · commit `feat(insights): üveg-fal CSS-szekció a prototípusból (mezo-a9bo7.7)`; ha a Step 1 TODO-U1-MERGE ágra futott: `bd create "Üveg-primitív dedup a team-feed CSS-ben az U1 landolása után" --deps mezo-me75u.1 -l epic:boop-team-feed`.

---

### Task 3: Poszt-folyam builder (`teamFeed.ts`) — a felvonás szíve

**Files:**
- Create: `frontend/src/features/insights/logic/teamFeed.ts`
- Test: `frontend/src/features/insights/logic/teamFeed.test.ts`

**Interfaces:**
- Consumes: `Pattern`, `Prediction`, `Experiment`, `Observation`, `CharacterFeedItem`, `PatternMonitor` típusok a `@/data/types`-ból; `TEAM`, `characterForMetricDomain`, `characterForPersona` a T1-ből.
- Produces:

```ts
export type FeedPostKind = 'kerdes' | 'megfigyeles' | 'sejtes' | 'kiserlet' | 'ertekeles'
  | 'elorejelzes' | 'konzilium' | 'keres' | 'bemutatkozas'
export interface FeedPost {
  id: string                       // stabil: `<forrás>:<rekordId>` — kulcs + seen-állapot horgony
  kind: FeedPostKind
  author: TeamCharacterId
  guest?: TeamCharacterId          // két-területes ügynél a bevont fél (spec §4/1)
  occurredAt: string               // ISO — a nap-csoportosítás kulcsa
  title?: string
  body: string                     // a REKORD saját szövege — a builder nem fogalmaz (ADR 0049)
  honesty?: { n: number; minN: number; label: string }   // sejtés/gyűlik sáv
  decision?: { patternId: string } // hármas = pattern-döntés ezen a poszton
  sourceRoute: string              // „Miből látszik?” / címzett mélyoldal
  waiting: boolean                 // Rád vár (story-pötty + szűrő forrása)
}
export interface FeedDay { key: string; label: string; posts: FeedPost[]; poster?: FeedPost }
export function buildTeamFeed(input: {
  patterns: Pattern[]; monitorPairs: PatternMonitorPair[]; predictions: Prediction[]
  experiments: Experiment[]; observations: Observation[]; characterItems: CharacterFeedItem[]
  today: string
}): { days: FeedDay[]; waitingCount: number; freshByCharacter: Record<TeamCharacterId, boolean> }
export function ownerForPattern(p: Pattern, pairs: PatternMonitorPair[]): { author: TeamCharacterId; guest?: TeamCharacterId }
```

- [ ] **Step 1: Fixture-fájl** — a mock-seedekből másolt, LERÖGZÍTETT minimál-rekordok (1 proposed pattern sleep×fuel párral, 1 monitoring n<minN, 1 active experiment, 1 pending+1 missed prediction, 2 observation, 2 CharacterFeedItem, 1 konzílium-item). A mock-seed forrása: `frontend/src/data/insights/insights.ts` és `frontend/src/data/character/characterMock.ts` — onnan idézd a mező-formákat, ne találj ki újat.
- [ ] **Step 2: Failing tesztek** — a spec kulcs-szabályai egyenként:

```ts
test('minden posztnak pontosan egy gazdája van; cross-domain → author+guest', () => {
  const { author, guest } = ownerForPattern(lateMealPattern, pairs) // fuel→sleep pár
  expect(author).toBe('falat'); expect(guest).toBe('szunya')        // metricA gazdája posztol, B a vendég
})
test('proposed pattern → kerdes + waiting=true + decision horgony', () => {
  const feed = buildTeamFeed(input)
  const q = feed.days.flatMap(d => d.posts).find(p => p.kind === 'kerdes')!
  expect(q.waiting).toBe(true)
  expect(q.decision).toEqual({ patternId: lateMealPattern.id })
  expect(q.sourceRoute).toBe(`/mezo/patterns/${lateMealPattern.pairKey}`)
})
test('monitoring n<minN → sejtes, őszinteség-sávval', () => {
  const s = buildTeamFeed(input).days.flatMap(d => d.posts).find(p => p.kind === 'sejtes')!
  expect(s.honesty).toEqual({ n: 5, minN: 8, label: 'még kevés adat' })
})
test('napi csoportosítás: naponta LEGFELJEBB egy poszter, a waiting előnyt kap', () => {
  for (const day of buildTeamFeed(input).days) {
    if (day.poster) expect(day.posts).not.toContain(day.poster)
    expect([day.poster].filter(Boolean).length).toBeLessThanOrEqual(1)
  }
})
test('a builder sosem fogalmaz: body a rekord saját szövege', () => {
  const q = buildTeamFeed(input).days.flatMap(d => d.posts).find(p => p.id === `pattern:${lateMealPattern.id}`)!
  expect(q.body).toBe(lateMealPattern.mechanism)
})
test('a Szkeptikus sosem author', () => {
  for (const p of buildTeamFeed(input).days.flatMap(d => d.posts)) expect(p.author).not.toBe('szkeptikus')
})
test('freshByCharacter: csak a MAI posztok gazdái igazak', () => {
  // fixture: a proposed pattern occurredAt=today (falat), az experiment tegnapi (mocor)
  const { freshByCharacter } = buildTeamFeed(input)
  expect(freshByCharacter.falat).toBe(true)
  expect(freshByCharacter.mocor).toBe(false)
  expect(freshByCharacter.szkeptikus).toBe(false)
})
```

- [ ] **Step 3: Futtatás — bukjon** · `CI=true pnpm --dir frontend exec vitest run src/features/insights/logic/teamFeed.test.ts`
- [ ] **Step 4: Implementáció** — tiszta függvények, mellékhatás nélkül. Vázlat:

```ts
export function ownerForPattern(p: Pattern, pairs: PatternMonitorPair[]) {
  const pair = pairs.find(x => x.key === p.pairKey)
  if (!pair) return { author: 'mezo' as const }
  const a = characterForMetricDomain(pair.metricADomain)
  const b = characterForMetricDomain(pair.metricBDomain)
  return a === b ? { author: a } : { author: a, guest: b }
}
// buildTeamFeed: rekordtípusonként map → FeedPost; kind-szabályok:
//  pattern: proposed→'kerdes'(waiting, decision) · monitoring&&n<minN→'sejtes'(honesty) · confirmed friss reinforced→'megfigyeles'
//  experiment: active→'kiserlet' (occurredAt = ma, sourceRoute=/mezo/experiments/<id>)
//  prediction: resolved (validated|missed) → 'elorejelzes'; pending NEM poszt (zaj — spec §2.3)
//  observation (Észrevételek): card==='fresh' → a kártya kind-je szerint 'kerdes'/'megfigyeles'
//  CharacterFeedItem: CONFERENCE_* → 'konzilium' (author 'mezo'); OBSERVATION → persona-routing
//  keres: Derű adat-éhség posztja CSAK Act II-ben generálódik — itt NEM szintetizálunk (ADR 0049)
// nap-csoportosítás occurredAt szerint (ma/tegnap/dátum-címke), poszter-választás:
//  a nap posztjaiból 1 kiemelt: waiting > kiserlet > konzilium > első; a többi quiet marad.
```

- [ ] **Step 5: Futtatás — zöld**, majd a TELJES logic-mappa: `CI=true pnpm --dir frontend exec vitest run src/features/insights/logic/`
- [ ] **Step 6: Commit** · `feat(insights): team-feed builder — rekordokból karakterposzt-folyam (mezo-a9bo7.7)`

---

### Task 4: Hármas gombsor + utóélet (`FeedTrio.tsx`)

**Files:**
- Create: `frontend/src/features/insights/components/feed/FeedTrio.tsx`
- Test: `frontend/src/features/insights/components/feed/FeedTrio.test.tsx`

**Interfaces:**
- Consumes: `usePatternActions()` (`decide({ id, decision })`, decision: `'confirmed'|'rejected'` a meglévő `DECISION_TO_STATUS` szerint — OLVASD EL a `frontend/src/data/insights/patternsHooks.ts:61-100` blokkot a pontos szignatúráért az implementálás előtt), `useObservationReply()`, `useCharacterReplyDraft(source)`.
- Produces: `<FeedTrio post={FeedPost} />` — 'kerdes'+decision esetén a talál/nem-talál PATTERN-DÖNTÉS (utóélet-címkével a helyén), különben könnyű visszajelzés; az „Elmesélem” mindig a válasz-lapot nyitja (T5 sheet).

- [ ] **Step 1: Failing testek**

```tsx
test('döntés-poszton az Ez talál a pattern-décide-ot hívja és utóéletet renderel', async () => {
  const decide = vi.fn().mockResolvedValue(undefined)
  vi.mocked(usePatternActions).mockReturnValue({ decide, isPending: false } as never)
  render(<FeedTrio post={kerdesPost} />)
  await userEvent.click(screen.getByRole('button', { name: /ez talál/i }))
  expect(decide).toHaveBeenCalledWith({ id: kerdesPost.decision!.patternId, decision: 'confirmed' })
  expect(await screen.findByText(/bekerült a rólad szóló képbe/i)).toBeInTheDocument()
})
test('nem-döntés poszton a hármas csak visszajelzés (nincs decide-hívás)', async () => {
  const decide = vi.fn()
  vi.mocked(usePatternActions).mockReturnValue({ decide, isPending: false } as never)
  render(<FeedTrio post={megfigyelesPost} />)          // post.decision === undefined
  await userEvent.click(screen.getByRole('button', { name: /ez talál/i }))
  expect(decide).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /ez talál/i })).toHaveAttribute('aria-pressed', 'true')
})
test('a gombfeliratok pontosan a spec szerint', () => {
  render(<FeedTrio post={megfigyelesPost} />)
  for (const name of ['Ez talál', 'Nem így érzem', 'Elmesélem'])
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
})
```

- [ ] **Step 2: bukik** → **Step 3: implementáció** (a prototípus `.tf-acts` anatómiája; ikonok az U1 Titanium-sprite 4 új szimbólumával — `i-thumb-up`, `i-thumb-down`, `i-send`, `i-flask` — ezek sprite-ba emelése az U1/„Új ikonok” jóváhagyás nyomán ennek a tasknak az 1. commitja: a 4 `<symbol>` a prototípusból másolva a clay-sprite forrásába + `sync-clay-assets.sh` futtatás) → **Step 4: zöld** → **Step 5: commit** `feat(insights): egységes hármas gombsor pattern-döntéssel és utóélettel (mezo-a9bo7.8)`.

---

### Task 5: A fal (`TeamFeedPage`) + válasz-lap

**Files:**
- Create: `TeamFeedPage.tsx`, `FeedPostCard.tsx`, `FeedPosterCard.tsx`, `StoryStrip.tsx` (+ testek)
- Modify: `BoopWorldPage.tsx` → `export function BoopWorldPage(){ return <TeamFeedPage/> }` (a route-horgony marad)

**Interfaces:**
- Consumes: `usePatterns`, `usePatternMonitor`, `usePredictions`, `useExperiments`, `useObservations`, `useCharacterFeed(60)` + T3 `buildTeamFeed` + T4 `FeedTrio`.
- Produces: a `/mezo` főoldal: kicker+cím → `StoryStrip` → „Rád vár” sáv (waitingCount>0) → nap-szekciók (poszter üvegben, csendes posztok `.tf-post` panelben) → „Ennyi történt”. Loading-gate az üres-állapot ELŐTT (mezo-yew osztály!); degraded → őszinte üzenet.
- Produces: `FeedReplySheet` — az „Elmesélem” lapja `useCharacterReplyDraft` forrással, küldés után a 3 lépéses folyamat-előnézettel (prototípus szerint).

- [ ] **Step 1: Failing render-teszt (mock mód)**

```tsx
test('a fal a mock-seed rekordjait karakterposztként rendereli', async () => {
  renderWithProviders(<TeamFeedPage />)                    // a repo meglévő test-wrapperével
  expect(await screen.findByRole('heading', { name: 'Üzenőfal' })).toBeInTheDocument()
  expect(screen.getAllByText(/Falat|Szunya|Mocor|Derű|Mezo/).length).toBeGreaterThan(2)
  expect(screen.getByLabelText('A csapat')).toBeInTheDocument()          // story-sáv
  expect(document.querySelectorAll('.tf-poster').length).toBeLessThanOrEqual(  // naponta max 1 üveg
    document.querySelectorAll('.tf-day').length)
})
test('loading alatt nincs üres-állapot felvillanás', () => { /* isPending gate */ })
test('Miből látszik? minden poszton a sourceRoute-ra visz', () => { /* link href-ek */ })
```

- [ ] **Step 2: bukik** → **Step 3: implementáció** (a prototípus DOM-sorrendje kötelez: fejléc → cast → strip → napok; a poszter media-blokkja a meglévő `TrendChart`/ring receptekkel, ÜRES media esetén media-blokk nélkül — semmi placeholder-grafikon) → **Step 4: zöld** → **Step 5:** `StoryStrip` seen-logika: `localStorage['tf-seen:<charId>:<yyyy-mm-dd>']`, try/catch-ben, kiesésekor minden gyűrű „új” (ártalmatlan default) + teszt rá → **Step 6: mindkét mód**: `CI=true pnpm --dir frontend exec vitest run src/features/insights/components/feed src/features/insights/pages/TeamFeedPage.test.tsx` és ugyanez `VITE_USE_MOCK=false`-szal → **Step 7: commit** `feat(insights): a csapat-üzenőfal váltja a Boop-hub főoldalt (mezo-a9bo7.8)`.

---

### Task 6: Szobák + A csapat oldal

**Files:**
- Create: `TeamPage.tsx`, `CharacterRoomPage.tsx` (+ testek)

**Interfaces:**
- Consumes: T1/T3 + `useCharacterDimensions()`/`useCharacterDimension(key)` (érettség — OLVASD EL a `characterHooks.ts` pontos visszatérési alakját), `useClaimFeedback` (Talál/Pontosítom a karakter-állításokon).
- Produces: `/mezo/csapat` — 5 üveg-sor (név·terület, „most figyeli” = a szoba első nyitott ügye, érettség-jelvény) + Szkeptikus-magyarázó + Gépterem-ajtó; `/mezo/csapat/:id` — a prototípus szoba-ritmusa: hero → gyűrű+2 szám → ügyek (első üveg, többi lapos) → érettség-görbe (normált! a prototípus képlete) → tudás-lista → jegyzet. A szoba ügylistája = `buildTeamFeed` kimenetének az adott gazdára szűrt, waiting-first rendezése.

- [ ] **Step 1: failing teszt** — `CharacterRoomPage` a szunya route-on a sleep-domén mintáit listázza; első ügy `.glass`, a többi `.tf-flatc`; a görbe SVG jelen van; ismeretlen `:id` → 404-oldal (a repo NotFound-mintája).
- [ ] **Step 2: bukik** → **Step 3: implementáció** → **Step 4: zöld** → **Step 5: commit** `feat(insights): karakter-szobák és A csapat oldal (mezo-a9bo7.9)`.

---

### Task 7: Story-sáv figurák — arany Mezo + palaszürke Szkeptikus a sprite-ban

**Files:**
- Modify: `docs/design_2.0/assets/…/clay` sprite-forrás (a repo clay-forrás fájlja — a `frontend/scripts/sync-clay-assets.sh` fejlécében megnevezett út), majd `sync-clay-assets.sh` futtatás
- Modify: `frontend/src/shared/ui/clay/boop/Boop.tsx` — `BoopDomain` bővítés `'gold' | 'slate'` variánssal (CSAK új variáns, meglévő nem változik)
- Test: meglévő Boop-teszt bővítése a két új variánsra

- [ ] **Step 1:** a két figura `<symbol>`-jának átmásolása a prototípus `ug-*` blokkjából a sprite-forrásba (recept-azonos, ez volt az „Új ikonok” jóváhagyás része) → sync-script → **Step 2:** failing variáns-teszt → **Step 3:** `Boop.tsx` variáns-map bővítés → **Step 4:** zöld → **Step 5:** T1 `TEAM.mezo.boop='gold'`, `TEAM.szkeptikus.boop='slate'` átállítás + teszt-frissítés → commit `feat(clay): arany Mezo és palaszürke Szkeptikus boop-variáns (mezo-a9bo7.9)`.

---

### Task 8: Navigáció-váltás + redirectek

**Files:**
- Modify: `frontend/src/app/navModel.ts` (Mezo-domén tabjai + `owns` prefixek), `router.tsx`, `pageIndex.ts`, `frontend/src/features/insights/logic/boopNavigation.ts`
- Modify: `frontend/src/app/boopNavigation.test.ts`, `frontend/src/features/insights/pages/insights.nav.test.tsx`

**Interfaces:**
- Produces: Mezo-dokk = `Üzenőfal(/mezo) · A csapat(/mezo/csapat) · Rólad(/mezo/rolad → a mai Rólad-oldal route-ja) · Emlékek(/mezo/emlekek)`; `owns`: a `/mezo/csapat/*`, `/mezo/patterns/*`, `/mezo/experiments/*`, `/mezo/predictions/*`, `/mezo/karakter/*` mélyutak az **Üzenőfal**, ill. **A csapat** tab alá sorolva a spec §2.5 szerint („a kijelölés nem ugrál”: poszt-mélyoldal → Üzenőfal; szoba-mélyoldal → A csapat).
- Produces: redirectek a `LegacyPathRedirect` mintájával: `/mezo/menu → /mezo/karakter/gepterem` (a régi rács a Gépterem-menü), a többi mélyút változatlan.
- A `BOOP_DESTINATIONS` katalógus MARAD (a Gépterem-menü forrása lesz) — a tesztjei az új felhasználási helyre igazodnak.

- [ ] **Step 1:** a két nav-teszt átírása failing állapotra (az ÚJ elvárt tabokra/owns-ra) → **Step 2:** bukik → **Step 3:** navModel+router+pageIndex módosítás → **Step 4:** a TELJES nav-teszt-készlet zöldre: `CI=true pnpm --dir frontend exec vitest run src/app/ src/features/insights/pages/insights.nav.test.tsx` → **Step 5:** commit `feat(app): Mezo-dokk = Üzenőfal·A csapat·Rólad·Emlékek + menü-redirect (mezo-a9bo7.10)`.

---

### Task 9: Hidegindítás + Kalauz-kivezetés

**Files:**
- Create: `frontend/src/features/insights/components/feed/IntroPosts.tsx` (+ teszt)
- Modify: `TeamFeedPage.tsx` (üres-fal ág), a Mezo-oldali kalauz-regisztráció helye (grep: `kalauz` + `mezo` a tutorial-registryben — OLVASD EL, melyik fájl regisztrálja a /mezo kalauzt, és CSAK a /mezo bejegyzést vedd ki; a többi oldal kalauza marad)

**Interfaces:**
- Produces: ha `buildTeamFeed` 0 posztot ad ÉS a karakter-dosszié üres → a fal az 5 statikus bemutatkozó posztot mutatja (szövegek SZÓ SZERINT a prototípus `elsonap` 1. napi posztjaiból — spec-jóváhagyott copy), a „Kezdjük el a dossziét” CTA-val a meglévő indító-mutációra kötve (OLVASD EL: `KarakterHubPage` indító-gombjának hookját, azt hívd).

- [ ] **Step 1:** failing teszt: üres feed-fixture → 5 bemutatkozó jelenik meg, egyik sem rekord-alapú poszt; kalauz-overlay nem renderelődik a /mezo-n → **Step 2:** bukik → **Step 3:** implementáció → **Step 4:** zöld → **Step 5:** commit `feat(insights): bemutatkozó fal-hidegindítás, a /mezo kalauz-buborék kivezetése (mezo-a9bo7.10)`.

---

### Task 10: Kapuk, paritás, dokumentáció

**Files:**
- Modify: `docs/features/insights.md` (§ a team-feedről), `docs/CODEMAP.md` (generált)

- [ ] **Step 1: teljes FE-teszt mindkét módban** · `CI=true pnpm --dir frontend test` és `CI=true VITE_USE_MOCK=false pnpm --dir frontend test` · Expected: PASS mindkettő
- [ ] **Step 2: build** · `pnpm --dir frontend build` · Expected: sikeres
- [ ] **Step 3: runtime-pass a `verify` skillel, CSAK sötétben** — minden új route végigkattintva (fal, csapat, 5 szoba, redirectek), 320px szélesség, reduced-motion ág, a chrome (fejléc+dokk) az U1 utáni állapottal azonos
- [ ] **Step 4: fordított paritás-checklist a bd-be** — a 2026-09-21-es audit §2 táblájának Mezo-sorai: minden régi képesség elérhető az új világból (fal → mélyoldal, Gépterem-menü). A checklist a záró bead kommentjébe kerül.
- [ ] **Step 5: CODEMAP + docs** · `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` — 0 új hiba
- [ ] **Step 6: hangkönyv-vázlat (spec §7/6)** — `docs/features/insights.md` új alszakasza: az 5 karakter hang-szabályai (1-1 bekezdés: hangnem, tiltások, emoji-készlet, 2 példamondat a prototípusból idézve) — ez lesz az Act II generátor-promptjainak magja. A fal Act I-ben látható MINDEN új UI-copy e szabályok szerint íródik (a rekord-szövegekhez nem nyúlunk).
- [ ] **Step 7: záró commit** `docs(insights): team-feed feature-doc + hangkönyv-vázlat + codemap (mezo-a9bo7.10)`

---

## Merge-stratégia

Szeletenként (T1–T3 = alap, T4–T5 = fal, T6–T7 = szobák, T8–T9 = nav+hidegindítás, T10 = kapuk) a ház „no-wait, net stays” szabálya szerint: lokális kapuk → `git pull --rebase` → detached-HEAD merge `--no-ff` → `push origin HEAD:main` → branch törlés. A T8 (nav-váltás) és T5 (főoldal-csere) EGY merge-ben menjen main-re (különben fél-kész világ látszana élesben); a többi mehet külön. Minden merge után CODEMAP-regen (merge-drop csapda!).

## Az U8/U9 koordináció (mezo-me75u)

A mélyoldalak (minta/kísérlet/előrejelzés/konzílium/Rólad/Emlékek) üveg-újraöltöztetése az üvegesítés U8/U9 szeleteié — paritás-forrásuk ez a prototípus. A két epic ütközésmentes: ez a terv új felületeket ad + navigációt vált; U8/U9 meglévő oldalakat öltöztet. A bd-ben: U8/U9 leírásába kereszthivatkozás került (lásd zárás).

## II. felvonás (nem e terv része)

A hang — cross-engine témaszál + esti kurátor + hipotézis-kritikus újrahangolás + Derű adat-éhség posztjai + Falat napi három szólama — saját specifikáció-finomítást és saját tervet kap az I. felvonás élesedése után (`mezo-a9bo7` epicben követve; a kritikus-újrahangolás előrehozható önálló hibajegyként).
