# Tudástár fact-kártyák — érthető szövegek, nagyobb kártyák, kereső + prompt-státusz szakaszok — design

**Date:** 2026-08-18 · **Driving issue:** `mezo-9ryh` ·
**Status:** approved by Daniel (brainstorm 2026-08-18)

## Context

A `/insights/knowledge` (Tudástár) lista kártyái technikai maradványokat mutatnak, amiket a
felhasználó nem tud értelmezni. Daniel szó szerinti panasza a képernyőképe alapján: *"ebből nem
értem pl ez mit takar: Gyógyszer-ciklusnap ↔ napi kalória és hogy mit jelent a 2x reinforced és
mit jelent a minta: Gyógyszer-ciklusnap ↔ napi kalória"*.

A mai kártya (`frontend/src/features/insights/pages/KnowledgeListPage.tsx:98-122`) négy dolgot
mutat magyarázat nélkül:

| Ma a képernyőn | Mit jelent valójában (a kód szerint) |
|---|---|
| `×2 reinforced` | `KnowledgeFactEntity.reinforcementCount` — hányszor jött vissza a tény **magától**: a chat-kivonat ugyanarra a normalizált szövegre futott rá (`FactExtractionService:96-105`), vagy a minta-motor újra kimérte ugyanazt az irányt (`PatternDetectionService:148-172`, 7 napos cooldown). Egyben a prompt-rangsor elsődleges kulcsa. |
| `minta: {title}` chip | `patternTitle` — a tényt előléptető minta címe. **A promóció a minta címét másolja a tény szövegébe** (`PatternService.promote():86` → `fact.setFactText(pattern.getTitle())`), ezért a chip szó szerint megismétli a kártya címét. |
| néma `Toggle` | `include_in_prompt` — a felhasználó kill-switch-e; kikapcsolva a tény **egyik** injektálási csatornába sem kerül be (sem a top-N blokk, sem a V3.3 acknowledgment). |
| `5 aktív promptban` | félrevezető: az `activeCount` az összes bekapcsolt tény, de a system promptba **csak a top 10** kerül be (`mezo.companion.facts.top-n: 10`, `KnowledgeFactService.renderPromptBlock()`), `reinforcementCount DESC, createdAt DESC` sorrendben. |

Daniel kérése: *"tegyük ezeket a kártyákat egyértelműbbé szövegesen, minden pont rajta legyen
érthetőbb és értsük meg miért és mit csinál. a kártyák legyenek nagyobbak, legyen kereshető /
szűrhető, rendezzük el okosan."*

## Decisions (brainstorm, in order)

1. **Önmagyarázó kártya + egyszeri panel** — minden kártya teljes mondatokban beszél (eredet,
   visszaigazolás, kimondott kapcsoló-címke), és fölötte egy összecsukható „Hogyan működik a
   tudástár?" panel magyarázza el egyszer, hosszan a rendszert.
2. **Prompt-státusz szerinti csoportosítás** — három szakasz („Most ezeket kapja meg a társ" /
   „Bekapcsolva, de most kimarad" / „Kikapcsolva"), mert ez az egyetlen elrendezés, ami
   megmutatja, mi történik valójában. Szakaszon belül a backend rendezése.
3. **A minta-tények szövegét a frontend írja át emberi mondattá** — a már mentett soroknál is
   hat, nincs migráció. A backend `promote()` nyers címe **szándékosan változatlan marad** (külön
   bd issue, ha kell) — az LLM tehát továbbra is a nyers címet látja a promptban.

## §1 Szövegréteg — `features/insights/logic/factCopy.ts` (tiszta modul)

Minden felhasználónak szánt mondat egyetlen tiszta modulban keletkezik, unit-tesztelve. Négy
exportált függvény:

### `humanizeFactText(text: string): string`
Az `"A ↔ B"` alakú (minta-promóció) szövegből beszédes mondatot képez:

- `"Gyógyszer-ciklusnap ↔ napi kalória"` → `"A gyógyszer-ciklusnap és a napi kalória együtt mozognak."`
- Szabály: `↔` mentén kettévág, mindkét oldalt trimmeli és a kezdőbetűjét kisbetűsíti (kivéve, ha
  a szó **csupa nagybetűvel** kezdődő rövidítés, pl. `HRV` — az marad), mindkét oldal elé magyar
  határozott névelőt tesz (`az`, ha magánhangzóval kezdődik — `aáeéiíoóöőuúüű` —, egyébként `a`),
  a sablon: `"{Névelő} {A} és {névelő} {B} együtt mozognak."`
- **Nincs `↔` a szövegben → a szöveg változatlanul megy tovább** (chat-kivonat és kézi tények
  már ma is emberi mondatok). Kettőnél több `↔` esetén szintén változatlan (nem találgatunk).

### `originSentence(fact): string`
A `source` (+ `patternTitle`) szerinti eredet-mondat:

| `source` | mondat |
|---|---|
| `pattern` | „Megerősített mintából tanultam — amikor az egyik változik, a másik jellemzően követi." |
| `chat` | „A beszélgetéseitekből szűrtem ki." |
| `manual` | „Te vetted fel kézzel." |

A `minta: {title}` chip **megszűnik** — önismétlő volt.

A minta címe **evidenciaként megmarad**, de csak akkor íródik ki (az eredet-mondat végén,
`(A minta: „{title}".)` alakban), ha eltér a tény szövegétől — pontosan az az eset, amikor
hordoz is információt.

### `reinforcementSentence(reinforced, lastReinforcedAt): string`
- `0` → „Még nem jött vissza megerősítés."
- `N > 0`, van dátum → `"{N}× visszaigazolva · utoljára {huMonthDay}"`
- `N > 0`, nincs dátum → `"{N}× visszaigazolva"`

A dátum a meglévő `@/shared/lib/dates` `huMonthDay()`-jel készül; a `lastReinforcedAt` teljes ISO
instant, ezért `slice(0, 10)`-zel megy be.

### `promptStatusLabel(bucket): string`
- `in-prompt` → „Most benne van a chatben"
- `waiting` → „Bekapcsolva, de most kimarad"
- `off` → „Kikapcsolva — a társ nem látja"

## §2 Csoportosítás — `bucketFacts(facts, topN)` ugyanabban a modulban

A backend rendezését tükrözi: `reinforced DESC, createdAt DESC`, majd az első `topN` bekapcsolt
tény az `inPrompt` vödörbe kerül, a maradék bekapcsolt a `waiting`-be, a kikapcsoltak az `off`-ba
(szintén rendezve). Visszatérés: `{ inPrompt, waiting, off }`.

**`PROMPT_TOP_N = 10`** konstans a `data/insights/knowledge.ts`-ben, kommentben hivatkozva a
`mezo.companion.facts.top-n` konfigra (a kettő kézzel tartott szinkron — ha a backend értéke
változik, ezt is át kell írni).

## §3 Adatréteg — a hiányzó `createdAt`

A `KnowledgeFactResponse` **kötelező** `createdAt` mezőjét ma nem képezzük le. Enélkül a top-10
határ döntetlen megerősítés-számnál máshova esne, mint a backendnél. Változás:

- `data/types.ts` → `KnowledgeFact.createdAt: string`
- `data/insights/knowledgeApi.ts` `toKnowledgeFact()` → `createdAt: f.createdAt`
- `data/insights/knowledge.ts` mock seed → minden `f1..f15` kap `createdAt`-ot
- `knowledgeHooks.ts` `mockDecide()` → az előléptetett tény `createdAt: new Date().toISOString()`

Szerződés-változás **nincs** (a mező már a dróton van).

## §4 Oldal-felépítés — `KnowledgeListPage.tsx`

Fentről lefelé:

1. **Fejléc** — balra `Tudástár · {facts.length} tény`, jobbra `{inPrompt.length} megy a chatbe`
   (a mai félrevezető „N aktív promptban" helyett).
2. **`KnowledgeExplainer`** — összecsukható panel, „Hogyan működik a tudástár?". Első
   megnyitáskor **nyitva**; az összecsukott állapot `localStorage`-ben él
   (`mezo.knowledge.explainer.collapsed`, a `mezo.*` kulcs-idióma szerint). Öt bekezdés: mi az a
   tény · mit csinál a kapcsoló · mit jelent a megerősítés · miért csak 10 fér be · mik a
   jóváhagyásra váró tények.
3. **Jóváhagyásra vár · N** — a mai `CandidateCard` kiemelve `components/FactCandidateCard.tsx`-be,
   nagyobb kártyával, plusz egy magyarázó sorral a gombok alatt: „Elfogad → bekerül a tudástárba ·
   Pontosít → átírod a szövegét · Elvet → eldobom". A Pontosít inline input viselkedése változatlan.
4. **Kereső + kategória-chipek** — a `ExercisesPage` idiómája: `.searchfield` (`Icon name="search"`
   + input, `aria-label="Keresés a tények között"`) és egy `chip tapchip` sor
   (`Mind · Edzés · Étkezés · Egészség · Élet`). A szűrés **mindhárom szakaszra** hat; a keresés a
   megjelenített (humanizált) szövegre és a kategória-címkére illeszkedik, kisbetűsítve.
5. **Három szakasz**:
   - **„Most ezeket kapja meg a társ · {n}/{PROMPT_TOP_N}"** — mindig nyitva, lábjegyzet: „Minden
     beszélgetés elején ezek a mondatok mennek elé."
   - **„Bekapcsolva, de most kimarad · {n}"** — összecsukható, alap: **nyitva** (`defaultOpen`) —
     egy frissen elfogadott tény-jelölt `reinforced: 0`-val ide sorolódik, csukott alapállapot
     mellett a jóváhagyás pillanatában tűnne el a DOM-ból. Lábjegyzet: „Ha megerősödnek vagy egy
     erősebb tény kiesik, bekerülnek."
   - **„Kikapcsolva · {n}"** — összecsukható, alap: csukva. Lábjegyzet: „Megőrzöm őket, de a társ
     nem használja."

   A 2–3. szakasz a meglévő `features/insights/components/LifecycleSection.tsx`-et használja
   újra (title + count + chevron, 0 elemnél nem renderel).
6. **Lábléc** — a mai „A graph nézethez · Me → Knowledge." sor változatlan.

**Üres állapotok:** aktív szűrő mellett nulla találat → „Nincs találat a keresésre." + egy
„Szűrők törlése" chip. A `degraded` (companion kikapcsolva) ág változatlan.

## §5 Kártya — `features/insights/components/KnowledgeFactRow.tsx`

```
┌────────────────────────────────────────────┐
│ EGÉSZSÉG · mintából                         │  kategória-chip (factCategoryColor) + eredet-chip
│ A gyógyszer-ciklusnap és a napi kalória     │  15px, humanizeFactText()
│ együtt mozognak.                            │
│ Megerősített mintából tanultam — amikor     │  12px, originSentence()
│ az egyik változik, a másik jellemzően követi│
│ 2× visszaigazolva · utoljára aug. 5.        │  11px, reinforcementSentence()
│ ────────────────────────────────────────    │
│ Most benne van a chatben          [ ●——]    │  promptStatusLabel() + a meglévő Toggle
└────────────────────────────────────────────┘
```

- Bal oldali színes akcentus-sáv marad (`factCategoryColor`), a kikapcsolt kártya `opacity`-je is.
- A `Toggle` `ariaLabel`-je marad beszédes (`"{text} aktív a promptban"` → az új szöveggel).
- A kártya kizárólag propokat kap (`fact`, `bucket`, `onToggle`) — nincs benne `@/data/*` import,
  így feature-komponens marad, nem `shared/ui`.

> A `features/me/components/KnowledgeFactCard.tsx` (a Me graph sor-kártyája) **változatlan** —
> más felület, más idióma.

## §6 Fájlok

| Fájl | Változás |
|---|---|
| `features/insights/logic/factCopy.ts` | **új** — a §1–§2 tiszta modul |
| `features/insights/logic/factCopy.test.ts` | **új** — unit tesztek (humanizálás, vödrözés, dátumok) |
| `features/insights/components/KnowledgeFactRow.tsx` | **új** — a §5 kártya |
| `features/insights/components/FactCandidateCard.tsx` | **új** — a page-ből kiemelt jelölt-kártya |
| `features/insights/components/KnowledgeExplainer.tsx` | **új** — a §4/2 panel |
| `features/insights/pages/KnowledgeListPage.tsx` | átírva — fejléc, panel, kereső/szűrő, 3 szakasz |
| `features/insights/pages/KnowledgeListPage.test.tsx` | bővítve — szakaszok, keresés, szűrés, kapcsoló |
| `data/types.ts` · `data/insights/knowledgeApi.ts` · `data/insights/knowledge.ts` · `data/insights/knowledgeHooks.ts` | `createdAt` + `PROMPT_TOP_N` (§3) |
| `docs/features/insights.md` §2.4 | átírva a friss viselkedésre |

## §7 Tesztelés

- **Unit** (`factCopy.test.ts`): `↔`-es szöveg humanizálása; `↔` nélküli szöveg érintetlen; 2-nél
  több `↔` érintetlen; a három eredet-mondat; `reinforced: 0` / dátum nélküli / dátumos
  visszaigazolás-mondat; `bucketFacts` határesete (pont 10 aktív, 11 aktív, döntetlen
  `reinforced`-nél `createdAt` dönt).
- **Komponens** (`KnowledgeListPage.test.tsx`): a három szakaszcím és a darabszámok; keresés
  szűkíti a listát; kategória-chip szűr; „Nincs találat" ág; a `Toggle` továbbra is hívja a
  `toggle(id, active)`-ot; a `degraded` ág változatlanul a honest bannert adja.
- **Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (mindkét mód
  zöld), majd `node scripts/lint-docs.mjs`.

## Szándékosan kihagyva (YAGNI)

- **Eredet szerinti szűrőchip-sor** (chat/minta/kézi) — a kategória + keresés fedi az igényt.
- **Kézi tény-felvétel** a felületről — a backend `POST /api/companion/fact` létezik, de nincs rá
  most kérés.
- **A backend `PatternService.promote()` szövegének átírása** — a promptba így továbbra is a nyers
  minta-cím megy; ha ez zavaró lesz, külön bd issue viszi (backend + IT-tesztek).
- **A top-N érték API-n való kiadása** — kézzel szinkronban tartott FE konstans, kommentelve.

## Addendum — a záró egész-branch code review javító hulláma (`mezo-9ryh`, 2026-08-18)

A fenti terv a `main`-en (`git log -p`) végig visszakereshető marad; ez az addendum a review 9
találatából a ténylegesen szállított, a tervhez képesti eltéréseket rögzíti — a friss állapotot
`docs/features/insights.md` §2.4 írja le, ez csak a delta:

- **A `useKnowledge()` most `isPending`/`isError`/`refetch`-et is forwardol** (`useDualQuery`
  már úgyis visszaadta őket) — a fejléc és a szakaszok `isPending` alatt `GhostState`-et adnak
  („A tudástár betöltése…"), `isError`-nál egy retry `GhostState`-et, **mielőtt** bármelyik
  ágon kiírnánk a fabrikált „0 tény / 0 megy a chatbe" számot. A tervben ez nem szerepelt —
  a review a `PatternsPage.tsx`-ben már bevezetett mintát kérte számon.
- **`bucketFacts` a backend MÁSODIK injektálási csatornáját is modellezi.** A terv §2 csak a
  top-N rangsoros blokkot vette figyelembe; a backend `renderNewPatternFactsBlock()`-ja emellett
  minden `PATTERN_ACK_DAYS` (= 3, `mezo.companion.facts.pattern-ack-days` tükre) napon belül
  létrejött, bekapcsolt `source: 'pattern'` tényt is beinjektál, rangsortól függetlenül.
  `bucketFacts(facts, topN?, now?)` ezt figyelembe véve sorolja az ilyen tényt az `inPrompt`
  vödörbe, `waiting` helyett. Az 1. szakasz fejléce emiatt elvesztette a `· N/{PROMPT_TOP_N}`
  utótagot (mert az hazudna, ha egy friss minta-tény a sapkán felül kerül be) — helyette a cím
  a SZŰRT darabszámot mutatja (l. lent), a `PROMPT_TOP_N` + a kivétel szövegesen a lábjegyzetben
  és a `KnowledgeExplainer` „Miért marad ki néhány?" bekezdésében él.
- **Az 1. szakasz darabszáma a szűrt listát mutatja**, konzisztensen a másik két szakasszal — a
  globális fejléc (`N megy a chatbe`) marad a szűretlen igazság.
- **A `LifecycleSection` kapott egy opcionális, visszafelé kompatibilis `forceOpen` propot** —
  a Tudástár lista aktív szűrő alatt mindkét (`Bekapcsolva, de most kimarad` / `Kikapcsolva`)
  szekciónak átadja, hogy egy csak az egyik vödörre illeszkedő keresés (pl. egy kikapcsolt
  tényre) ne mutasson hazug „Nincs találat"-ot egy csukott szakasz mögött.
- **A „Mind" chip a tervezettől eltérően CSAK a kategóriát törli**, a keresőmezőt nem — az eredeti
  terv nem szólt a kettő viszonyáról, a review ezt tisztázta. A „Szűrők törlése" gomb (amit a
  terv szintén nem részletezett) a nulla-találat kártyán jelenik meg, és mindkettőt törli.
- **A keresés (`matchesQuery`) a `patternTitle`-re is illeszkedik** — a terv §1 csak a humanizált
  szöveget + kategória-címkét említette; az eredet-mondatba fűzött minta-cím (l. `originSentence`)
  szövege korábban nem volt kereshető.
- **`humanizeFactText` három konkrét hibáját javította a review** (nem szerepeltek a tervben):
  a csupa-nagybetűs rövidítés-felismerés mostantól a szó ELSŐ KÉT karakterén dönt (a toldalékolt
  „HRV-alapú" korábban hibásan kisbetűsödött volna); mindkét oldalról levágja a záró mondatvégi
  írásjelet (elkerülve a duplázott pontot); és rövidítésnél a névelőt a magyar betűnév kiejtése
  (nem az írott alak) alapján választja — innen az „az RPE", nem „a RPE".
- **Egy genuinely üres tudásbázis** (`facts.length === 0`, real mode, nem pending/error/degraded)
  most egy őszinte sort ad a kereső/kategória-chip sor helyett — a tervben ez az eset nem volt
  külön kezelve, a lista + kereső korábban kiürült felület fölött jelent meg.
- **A `KnowledgeExplainer` `localStorage` hívásai try/catch-csomagolva** (`morningWindow.ts` /
  `nightTrace.ts` idiómája) — letiltott site-storage-nál a natív hívás korábban az egész route-ot
  elvitte volna egy `SecurityError`-ral.

A §7 tesztelési lista értelemszerűen bővült ezekkel az esetekkel — a friss lista a tesztfájlokban
él (`factCopy.test.ts`, `KnowledgeListPage.test.tsx`, `KnowledgeExplainer.test.tsx`), nem itt.
