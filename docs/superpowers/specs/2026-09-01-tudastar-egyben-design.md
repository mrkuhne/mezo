# Tudástár egyben — a Tudástár + Tudásgráf egyesített oldala

**Driver:** mezo-ms9a · **Dátum:** 2026-09-01 · **Hatókör:** frontend + két kis backend-kiegészítés
(él-összesítő, node-`updatedAt`) · **Prototípus:** `docs/design_2.0/prototypes/tudastar-egyben.html`
(artifact: <https://claude.ai/code/artifact/1ddf2a14-f5ce-4d4c-b125-c843e073797e>)

## 1. A probléma

A `mezo-0ap9` szerep-tisztázás („a tényeké a Tudástár, a gráfé a Tudás oldal, a kettő linkel")
megszüntette az adat-duplikációt, de a két-oldal-forma maga maradt a súrlódás forrása:

1. **A határ láthatatlan.** A két oldal hero-ja gyakorlatilag azonos (ugyanaz az `i-tudas` ikon,
   ugyanaz a tényszám) — élőben nem látszik, mitől két oldal. A tulajdonos maga sem tudta
   megmondani, melyik mire való.
2. **A Tudásgráfnak nincs önálló léte.** A hub-tile-reorg (`mezo-o486`) óta kizárólag a Tudástár
   sor-gombján át érhető el — de facto aloldal, saját route-tal és saját hero-val.
3. **Az elfogadás eredménye a másik oldalon landol.** A `LifeEventAcceptedCard` („Bekerült a
   gráfba · Megnézed? → Tudásgráf") egy foltozás arra, hogy a jóváhagyás és az eredmény két
   felületre esik szét — egy oldalon a probléma nem létezne.
4. **A Tudástár ~4,3 képernyőnyi scroll** (mock seed, 932px viewport), aminek fő oka az alapból
   nyitott 5-blokkos explainer és a mindig kibontott vödör-listák.
5. **A „Profil" szekció érthetetlen** — az eyebrow „Profil", a kártya „Rólad tanultam", és semmi
   nem mondja ki, hogy ez a társ heti kommunikációs-stílus olvasata.

## 2. A döntés

**Egyetlen oldal, a Tudástár, a `/mezo/knowledge` címen — Huawei-mintában.** A döntést kérő
jóváhagyás-inbox az egyetlen azonnal látható tartalomblokk; minden referencia-tartalom
(tények, kategóriák, profil) szekció-csempe mögül nyílik, becsúszó saját nézetként. A
`/me/knowledge` route megszűnik (redirect). A `mezo-0ap9` mag-elve — **tény-lista pontosan egy
van** — változatlanul áll: a kategória-nézetek soha nem listáznak tényeket.

A `mezo-o486` „pages don't move, only tiles do" szabályát ez a slice tudatosan írja felül: itt
maga az oldal-összevonás a feature.

## 3. Az oldal szerkezete (a prototípus szerint)

### 3.1 Alapnézet (`/mezo/knowledge`, tone `sage`)

Fentről lefelé, `PageHead` + `PageHero` + `PageBody` Mozaik-kereten:

- **PageHead** — `‹ Mezo` vissza-chip + jobbra egy **`?` help-chip** (új), ami a Hogyan-nézetet
  nyitja.
- **PageHero** — `i-tudas` + tényszám + `tény rólad · N megy a chatbe · M kapcsolat`. A számok
  a mai őszinteségi szerződések szerint: vödrök a TELJES listán, szűrő sosem írja át; az
  `M kapcsolat` real módban a 6.1 backend-kiegészítésből jön (addig a szegmens elhagyandó, nem
  nullázandó).
- **Jóváhagyás-inbox** — `Jóváhagyásra vár · N` eyebrow alatt a tény-jelöltek
  (`FactCandidateCard`) és az életesemény/szezon-jelöltek (`LifeEventCandidateCard`),
  a mai fajtánkénti csoportosítással (`CANDIDATE_COPY`). Változások:
  - **Szerkeszt-aztán-elfogad az életesemény/szezon-jelöltekre** (4.2),
  - **konfliktus-jelzés** a jelölt-kártyán (4.3),
  - elfogadás után a kártya **helyben** vált megerősítéssé — a `LifeEventAcceptedCard`
    Tudásgráf-linkje törlődik (nincs hova mutatnia), a kártya többi viselkedése
    (page-szintű `acceptedEvents`, fajtánkénti `settled` eyebrow) változatlan.
- **Szekció-mozaik** — három Mozaik `Tile`:
  - **Tények** (sage, `i-polc`): badge = tényszám, sor = `X a chatben · Y vár · Z kikapcsolva`,
  - **Kategóriák** (lav, `i-retegek`): badge = kind-szám, sor = kind-nevek + él-szám,
  - **Így beszélj velem** (rose, `i-checkin`, széles): a volt „Profil"; sor = a profil-próza
    első szavai + `heti frissítés`. Csak akkor renderel, ha van profil-node (a mai
    `profileNode` feltétel).
- **Lábjegyzet** — a mai archiválás-mondat.

Az explainer (`KnowledgeExplainer`) mint always-inline panel **törlődik**; tartalma a
Hogyan-nézetbe költözik (3.5). Az `EXPLAINER_STORAGE_KEY` localStorage-kulcs és a hozzá
tartozó teszt vele megy.

### 3.2 Tények nézet (`?view=tenyek`, tone sage)

A mai Tudástár tény-része változatlan szerződésekkel: kereső + kategória-chipek, három vödör
(`Most ezeket kapja meg a társ · N` kibontva, `Bekapcsolva, de most kimarad` és `Kikapcsolva`
`LifecycleSection`-ként), `KnowledgeFactRow` + toggle, vödör-lábjegyzetek. A `PageHead` chipje
`‹ Tudástár`, a param törlése `replace:true` (a `mezo-ni86` egy-vissza-affordancia elv).

### 3.3 Kategóriák nézet (`?view=kategoriak`, tone lav) és a kind-lánc

A mai Tudásgráf-lánc egy szinttel beljebb tolva, kód-mozgatással (a `KindTileGrid`,
`KindNodeList`, `NodeDetailSheet`, `CategoryHeader` komponensek az `insights` feature-be
költöznek):

- `?view=kategoriak` → `KindTileGrid` (üres kind bent marad, halványan),
- `?view=kategoriak&kind=<GraphNodeKind>` → `KindNodeList` (chip: `‹ Kategóriák`),
- sor-koppintás → `NodeDetailSheet` (lokális `selectedId` state, a mai archiválás-viselkedéssel).

Érvénytelen `kind` a rács-nézetre esik vissza; érvénytelen `view` az alapnézetre. A tónus a
drill-láncban lav marad (gráf-örökség) — az alap sage/drill lav váltás a prototípusban
szándékos döntés.

### 3.4 Így beszélj velem nézet (`?view=profil`, tone rose)

A `ProfileNodeCard` új kerete: cím **„Így beszélj velem"**, a kártyán `Rólad tanultam` +
proveniencia-sor (`frissítve hétfőn 03:45 · a heted szövegeiből`) + Archivál, alatta egy
rövid magyarázó kártya („Ez a bekezdés minden beszélgetés elé odakerül… Az Archiválás a
felejtsd-el kar…"). A „Profil" szó a felületről eltűnik.

### 3.5 Hogyan-nézet (`?view=hogyan`, tone gold)

Az explainer 5 blokkja + egy hatodik („Mik a kategóriák?") Q&A-kártyákként. Nem perzisztál
összecsukott állapotot — külön nézet, nem áll az útban.

## 4. Viselkedési változások

### 4.1 URL-vezérelt drillek + `?fact=` deep link

- Minden nézetváltás `useSearchParams`-derivált (a `KnowledgePage` mai idiómája), lokális
  nézet-state nélkül; vissza-chip `replace:true`-val törli a paramot.
- A **`?fact=<id>`** paramétert — amit a `WeekDiscoveries` ma is gyárt, de senki nem fogyaszt —
  az oldal fogyasztja: `?fact=` jelenlétekor a Tények nézet nyílik, a tény-sor a viewportba
  görgetve és vizuálisan kiemelve (egyszeri highlight, a paraméter fogyasztás után
  `replace:true`-val törlődik). Ismeretlen id → sima Tények nézet.
- A `feedMock.ts` halott `/insights/knowledge` deeplinkjei `/mezo/knowledge`-ra javítandók.

### 4.2 Szerkeszt-aztán-elfogad (életesemény/szezon)

A `LifeEventCandidateCard` a tény-jelölt `Pontosít` mintáját kapja: a cím és az összefoglaló
elfogadás előtt szerkeszthető (inline szerkesztő-állapot a kártyán), és a döntés-hívás a
szerkesztett szöveggel megy. Backend: a kind-agnosztikus döntés-végpont opcionális
`refinedTitle`/`refinedSummary` mezőt kap (a tény-jelölt `refinedText` mintája —
[companion.md] §4); a mock ág ugyanígy viselkedik.

### 4.3 Konfliktus-jelzés a jelölt-kártyán

Minden tény-jelölthöz a backend jelölt-extrakciós köre (olcsó-tier, a meglévő éjszakai LLM-kör
kiegészítése) legfeljebb egy `conflictsWithFactId`-t adhat. A kártya ekkor egy
figyelmeztető sort renderel („Ellentmond ennek: »…«"), és elfogadáskor egy opcionális
„A régit archiválom" checkboxot kínál (default: be). Nincs konfliktus → semmi nem látszik;
a mező hiánya visszafelé kompatibilis. Ha a backend-kör e slice-ban nem fér bele, a mező és a
UI-szerződés akkor is definiálandó, mock-seeddel — a real-mode mező szállítása külön issue-ként
leválasztható.

## 5. Navigáció-migráció

- `router.tsx`: `me/knowledge` → redirect `/mezo/knowledge`-ra (a `?kind=` átfordítása
  `?view=kategoriak&kind=`-re); a `KnowledgePage.tsx` törlődik.
- Frissítendő linkelők: `LifeEventAcceptedCard` (link törlés), a Tudástár Tudásgráf-sor-gombja
  (törlés — a Kategóriák csempe váltja), `weekHighlight.ts`, `WeekDiscoveries` (`?fact=` marad,
  most már működik), `MemoryLayersPanel`, `PatternJournal`, `PatternImpactCard` (mind
  `/mezo/knowledge`-ra mutatnak — változatlanok maradhatnak).
- Betöltési sorrend változatlan: `isPending` → `isError` → `degraded` → tartalom; a
  404-szemantika kettőssége megmarad (companion-off degradálja a tény-részeket, a gráf-hookok
  404-e őszinte üres lista — a Kategóriák csempe ekkor üres-állapotot mutat, nem hibát).

## 6. Backend-kiegészítések

1. **Él-összesítő** — a hero `M kapcsolat` real-mode forrása: vagy egy `edgeCount` a graph
   node-lista válaszán (aggregát), vagy a node-ok `topEdges`-eiből derivált szám; a mock
   `edges` réteg számával azonos szerződés. Amíg nincs, a hero real módban elhagyja a
   szegmenst (nem nullát ír).
2. **`updatedAt` a graph node DTO-ban** — a kategória-csempe „legutóbbi elem" sora és a
   kind-lista frissesség-rendezése ehhez kötött; hiányában a mai „első elem" viselkedés marad.

## 7. Tesztek és kapuk

- A `KnowledgeListPage.test.tsx` szerződései (hero-számok, vödrök, toggle, kereső/szűrő,
  L2-jelölt flow, életesemény/szezon-csoportok, degraded/loading/500/üres real-mode ágak)
  átköltöznek az új nézet-struktúrába; a `KnowledgePage.test.tsx` kontraktjai a Kategóriák
  nézet tesztjeivé válnak (`?kind=` deep link + invalid fallback, sheet-archiválás,
  profil-leválasztás).
- Új tesztek: `?view=`/`?fact=` deep linkek + invalid fallback-ok, redirect `/me/knowledge`-ról,
  szerkeszt-aztán-elfogad, konfliktus-sor + checkbox, help-nézet.
- Nav-pin tesztek frissítése: `insights.nav.test.tsx`, `weekHighlight.test.ts`,
  `WeekAnalysisPage/WeekDiscoveriesPage` célok.
- `useCountUp` a korai return-ök FELETT marad (hooks-szabály); FE tesztek mindkét
  `VITE_USE_MOCK` módban + build; CODEMAP-regenerálás (fájlok mozognak/törlődnek);
  `insights.md` §2.4 + `me.md` §`Tudás` + `companion.md` érintett szakaszainak koordinált
  átírása (a `mezo-0ap9` prózát is beleértve).

## 8. Prior art

A researcher-kör (5 forrás) eredménye, ami a designt formálta:

- **ChatGPT memory** — a lapos memória-lista skálázódási kudarca után kategória-szervezett
  áttekintő + drill-down irányba ment; a top-szinten nincs per-tény kapcsoló. Átvettük:
  overview-first szerkezet, per-tény vezérlők a drillben.
  (<https://help.openai.com/en/articles/8590148-memory-faq>)
- **Claude memory** — téma-csempés top-szint, szerkeszthető téma-összefoglalók. Átvettük a
  csempe-gerincet; a szenzitív-kategória opt-in default később megfontolandó.
  (<https://support.claude.com/en/articles/11817273>)
- **Shape of AI: Memory pattern** — „a memória sosem fekete doboz"; a prompt-hatás
  láthatósága ritka erősség. Átvettük: a „N megy a chatbe" a hero-ban marad, nem dugjuk el.
  (<https://www.shapeof.ai/patterns/memory>)
- **CHI 2025 (Users' Expectations with Agent Memory)** — jóváhagyás-inbox + szerkeszt-aztán-
  elfogad + konfliktus-jelzés ajánlása; ez adja a 4.2/4.3 szakaszt.
  (<https://dl.acm.org/doi/10.1145/3706599.3720158>)
- **Obsidian gráf-vita** — a globális gráf-vizualizáció ~50 node felett dísz; a lokális
  (node-szintű) él-nézet a hasznos. Elvetettük a gráf-rajzolást (a `mezo-2m4` stub törölve
  marad), a kapcsolatok a `NodeDetailSheet`-ben élnek.
  (<https://codeculture.store/blogs/developer-culture/obsidian-graph-view-useful>)

## 9. Codebase terrain

Az investigator-kör kulcs-megállapításai (részletek a recon-jelentésben):

- **Oldalak:** `features/insights/pages/KnowledgeListPage.tsx` (Tudástár, sage) és
  `features/me/pages/KnowledgePage.tsx` (Tudásgráf, lav; törlendő). Mozgó komponensek:
  `KindTileGrid`, `KindNodeList`, `NodeDetailSheet`, `ProfileNodeCard`, `CategoryHeader`
  (`me` → `insights`).
- **Route-ok/linkelők:** `router.tsx:211,284`; a teljes linkelő-lista az 5. szakaszban.
- **Adat-réteg változatlan:** `useKnowledge` (404→degraded), `useKnowledgeGraphNodes` /
  `useLifeEventCandidates` (404→üres lista — a két 404-szemantika NEM egyesíthető),
  `GRAPH_KIND_GROUPS`, `PROFILE_SOURCE_KIND`, `CANDIDATE_COPY`, `PROMPT_TOP_N`.
- **Ismert csapdák:** mock `isPending` mindig false (real-mode guard tesztje kötelező);
  `edges` real módban üres (→ 6.1); a wire-node-nak nincs időbélyege (→ 6.2);
  `acceptedEvents`/`pendingLifeEvents` flicker-fix megőrzendő; CSS-struktúra tesztek
  (`prototypeCssStructure.test.ts`, `mozaikCssTokens.test.ts`) az új `tud-*`/nézet-osztályokra.
- **Felülírt döntések, kimondva:** `mezo-0ap9` két-oldal formája (a mag-elv marad),
  `mezo-o486` „pages don't move" e slice erejéig, a `mezo-2243` „insights-hoz nem nyúlunk"
  megkötése.

## 10. Ami tudatosan NEM része (külön bd issue-k)

Relevancia-alapú tény-injektálás a statikus top-10 helyett; tény-öregedés/recency-decay a
rangsorban; duplikátum-összevonó éjszakai kör; profil-verziótörténet + heti diff; az elvetés
mint tanítójel az extraktornak; proveniencia-link a forrás-naphoz. Mind fájlolva a brainstorm
zárásaként — a driving issue (mezo-ms9a) hivatkozza őket.
