# Tudástár egyben — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tudástár és a Tudásgráf egyesítése egyetlen, URL-vezérelt nézetekre bontott oldallá a `/mezo/knowledge` címen, a `docs/superpowers/specs/2026-09-01-tudastar-egyben-design.md` spec és a `docs/design_2.0/prototypes/tudastar-egyben.html` prototípus szerint.

**Architecture:** A `KnowledgeListPage` shell-lé válik: `?view=` paraméter választja a nézetet (alap / tenyek / kategoriak / profil / hogyan), a gráf-lánc komponensei a `me` feature-ből az `insights`-ba költöznek, a `/me/knowledge` redirectté válik. Két kis backend-kiegészítés: él-darabszám endpoint + refine-on-accept a jelölt-döntésen.

**Tech Stack:** React 19 + TanStack Query (dual-mode hookok), react-router, Mozaik UI-kit (`shared/ui/mozaik`), Vitest + RTL; Spring Boot contract-first (openapi-generator), Vitest mindkét `VITE_USE_MOCK` módban.

**Driving bd issue:** `mezo-ms9a` — a commit-üzenetek ezt hordozzák.

## Global Constraints

- Tény-lista pontosan EGY van (Tények nézet); kategória-nézet soha nem listáz tényeket (mezo-0ap9 mag-elv).
- Betöltési sorrend minden fact-alapú ágon: `isPending` → `isError` → `degraded` → tartalom; `useCountUp` és minden hook a korai return-ök FELETT.
- A két 404-szemantika nem egyesíthető: `useKnowledge` 404 → `degraded`; gráf-hookok 404 → őszinte üres lista.
- Hero-számok a TELJES (szűretlen) listán számolt vödrökből; szűrő sosem írja át.
- Vissza-affordancia nézetenként egy: a `PageHead` chip; param-törlés `replace: true`-val (mezo-ni86).
- Minden `EntranceGroup`-gyerek `.rise` + saját `--d`; nézetváltáskor `replayKey` játssza újra.
- Copy magyarul, a spec/prototípus szövegei szó szerint; „Profil" szó a felületen nem maradhat.
- FE kapuk: `VITE_USE_MOCK=true pnpm test` ÉS `VITE_USE_MOCK=false pnpm test` ÉS `pnpm build` (a `frontend/` mappában). Backend fókuszált: `./mvnw test -Dtest=<osztály>`.
- Contract-módosítás előtt kötelező elolvasni: `docs/references/api_contract_conventions.md` (a fragment ↔ `api/openapi.yml` viszony és a drift-gate miatt).
- Konvencionális commit-subject + bd id, pl. `feat(insights): ... (mezo-ms9a)`.

---

### Task 1: Contract — refine-on-accept + él-darabszám

**Files:**
- Modify: `api/feature/knowledge-graph/knowledge-graph.yml`
- Modify: `api/openapi.yml` (a konvenció-doksi szerinti módon — előbb elolvasni: `docs/references/api_contract_conventions.md`)
- Regen: `frontend/src/data/_client/api.gen.ts` (`cd frontend && pnpm generate:api`), backend generált API (`cd backend && ./mvnw compile`)

**Interfaces (Produces):**
- `GraphCandidateDecisionRequest` két új opcionális mezővel:
  ```yaml
  refinedTitle: { type: string, minLength: 1, maxLength: 160, nullable: true, description: 'User-edited title applied on accept (edit-then-approve).' }
  refinedSummary: { type: string, minLength: 1, maxLength: 500, nullable: true, description: 'User-edited summary applied on accept.' }
  ```
- Új endpoint a knowledge-graph fragmentben:
  ```yaml
  /api/companion/graph/edge/count:
    get:
      tags: [KnowledgeGraph]
      operationId: countGraphEdges
      summary: Count of active knowledge-graph edges for the current user (KnowledgeGraph)
      responses:
        '200':
          description: Active edge count
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GraphEdgeCountResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  ```
  ```yaml
  GraphEdgeCountResponse:
    type: object
    required: [count]
    properties:
      count: { type: integer }
  ```

- [ ] **Step 1:** Olvasd el a `docs/references/api_contract_conventions.md`-t, és a szerint vidd fel a fenti változásokat a fragmentbe ÉS az aggregátba (ugyanaz a tartalom mindkét helyen, a meglévő KnowledgeGraph-blokkok mintájára).
- [ ] **Step 2:** `cd frontend && pnpm generate:api` — az `api.gen.ts` diffjében jelenjen meg a két új mező + a `GraphEdgeCountResponse`.
- [ ] **Step 3:** `cd backend && ./mvnw compile` — a build zöld, a generált `KnowledgeGraphApi` interfész új `countGraphEdges` metódusa miatt a `GraphController` fordítási hibát dob → adj hozzá ideiglenes implementációt még ebben a taskban (ld. Step 4), hogy a task önmagában zöld legyen.
- [ ] **Step 4:** `GraphController`-be minimál-implementáció (a Task 2 teszteli és véglegesíti):
  ```java
  @Override
  public GraphEdgeCountResponse countGraphEdges() {
      return new GraphEdgeCountResponse().count(graphService.countActiveEdges(currentUserId.get()));
  }
  ```
  és `GraphService`-be:
  ```java
  public int countActiveEdges(UUID userId) {
      return graphEdgeRepository.countActiveByUserId(userId);
  }
  ```
  a `GraphEdgeRepository`-ba pedig a meglévő lekérdezés-idiómák mintájára egy `countActiveByUserId(UUID userId)` metódust (aktív = nem törölt/archivált él, pontosan úgy szűrve, ahogy a `listActiveWithTopEdges` él-forrása szűr — másold a meglévő repository-metódus WHERE-feltételeit).
- [ ] **Step 5:** `./mvnw compile` zöld; commit: `feat(api): graph edge count endpoint + refine-on-accept mezők (mezo-ms9a)`.

### Task 2: Backend — él-darabszám teszt + refine-on-accept

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/LifeEventCandidateService.java` (decide)
- Test: a meglévő graph-IT osztály mellé/belé (keresd: `grep -rln "GraphController\|LifeEventCandidate" backend/src/test/java`) — kövesd a talált osztály Testcontainers/mock idiómáját

**Interfaces:**
- Consumes: Task 1 generált DTO-i.
- Produces: accept-ágon a `refinedTitle`/`refinedSummary` felülírja a node title/summary mezőit mentés előtt; reject-ágon a mezők ignorálva. `GET /api/companion/graph/edge/count` → `{count}` a bejelentkezett user aktív éleire.

- [ ] **Step 1:** Írd meg a bukó teszteket a meglévő graph-IT mintájára: (a) elfogadás `refinedTitle="X"`-szel → a válasz-node title-je `X` és perzisztálva is az; (b) `refinedSummary` ugyanígy; (c) reject + refined mezők → a jelölt soft-deleted, a mezők nem íródnak sehova; (d) edge/count visszaadja a seedelt aktív élek számát, és a más userhez tartozó élt nem számolja.
- [ ] **Step 2:** Futtasd — az (a)–(c) bukik (a decide ma nem olvassa a mezőket), a (d) várhatóan már zöld a Task 1 minimál-implementációjával.
- [ ] **Step 3:** `LifeEventCandidateService.decide` accept-ágába, a node aktiválása ELŐTT:
  ```java
  if (request.getRefinedTitle() != null) node.setTitle(request.getRefinedTitle());
  if (request.getRefinedSummary() != null) node.setSummary(request.getRefinedSummary());
  ```
  (a pontos entity-setter neveket az entity-ből; a mentési pont a meglévő accept-folyam mentése).
- [ ] **Step 4:** Fókuszált futás zöld: `./mvnw test -Dtest=<a módosított IT osztály>`.
- [ ] **Step 5:** Commit: `feat(companion): refine-on-accept a gráf-jelölt döntésen + edge count (mezo-ms9a)`.

### Task 3: FE adat-réteg — updatedAt, conflictsWithFactId, edge-count hook, refined decide

**Files:**
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/insights/graphApi.ts`, `frontend/src/data/insights/graphHooks.ts`, `frontend/src/data/insights/graph.ts` (mock seed), `frontend/src/data/insights/knowledge.ts` (candidate seed), `frontend/src/data/hooks.ts` (re-export, ha a minta ezt kívánja)
- Test: `frontend/src/data/insights/graphHooks.test.tsx` (vagy a meglévő hook-teszt fájl neve szerint), `frontend/src/data/insights/knowledgeHooks.test.tsx`

**Interfaces (Produces):**
- `KnowledgeGraphNode` += `updatedAt: string` (ISO datetime; a contract már adja — csak a mapping dobta el).
- `FactCandidate` += `conflictsWithFactId: string | null` (FE-only mező e szeletben; real módban a wire nem adja → mapping default `null`).
- `useKnowledgeGraphNodes()` a listát `updatedAt` DESC rendezve adja vissza.
- Új hook: `useGraphEdgeCount(): { count: number | null }` — mock: `edgeSeed.length`; real: `GET /api/companion/graph/edge/count`, 404/hiba → `null` (a hero ilyenkor elhagyja a szegmenst).
- `useKnowledgeGraphActions().decide(id, decision, refined?: { title?: string; summary?: string })` — real módban `refinedTitle`/`refinedSummary`-ként megy a body-ba; mock módban accept esetén a cache-be kerülő node title/summary a refined értéket kapja.

- [ ] **Step 1:** Bukó tesztek: (a) mock nodes updatedAt szerint csökkenő; (b) `useGraphEdgeCount` mock = seed-élszám; (c) real-mode 404 → `count: null` (a graphHooks 404-idióma tesztmintája már létezik — másold); (d) mock decide accept + refined → a candidate-ből lett elfogadás a refined title-lel jelenik meg a jelölt-invalidálás után; (e) candidate seed egyik tény-jelöltje hordoz `conflictsWithFactId`-t, ami egy létező seed-tény id-ja.
- [ ] **Step 2:** Futtatás — bukás igazolva (`VITE_USE_MOCK=true pnpm test -- graphHooks`).
- [ ] **Step 3:** Implementáció: `toKnowledgeGraphNode` += `updatedAt: n.updatedAt`; mock node-seedbe kézzel elosztott ISO értékek (különbözőek, hogy a rendezés tesztelhető legyen); `graphApi.edgeCount = () => apiFetch<GraphEdgeCountResponse>('/api/companion/graph/edge/count')`; az új hook a `useLifeEventCandidates` dual-mode receptjét másolja; a decide bővítése mindkét módban; a knowledge.ts candidate-seedbe pontosan egy konfliktusos jelölt (szöveg: „Esti edzésre váltottál — 18:00 után jársz." · konfliktus a „Reggel edzel a legszívesebben…" seed-ténnyel).
- [ ] **Step 4:** Mindkét módban zöld: `VITE_USE_MOCK=true pnpm test` és `VITE_USE_MOCK=false pnpm test` (legalább a data/insights szűkítéssel, a task végén teljes futás).
- [ ] **Step 5:** Commit: `feat(data): updatedAt + edge-count hook + refined decide + konfliktus-seed (mezo-ms9a)`.

### Task 4: Gráf-komponensek átköltöztetése me → insights

**Files:**
- Move: `frontend/src/features/me/components/{KindTileGrid,KindNodeList,CategoryHeader,ProfileNodeCard}.tsx` → `frontend/src/features/insights/components/`
- Move: `frontend/src/features/me/sheets/NodeDetailSheet.tsx` → `frontend/src/features/insights/sheets/NodeDetailSheet.tsx`
- Move: a hozzájuk tartozó `*.test.tsx` fájlok ugyanígy
- Modify: importok a mozgatott fájlokban + `frontend/src/features/me/pages/KnowledgePage.tsx` (ideiglenesen az új útvonalról importál — a Task 8 törli)

**Interfaces:** változatlan komponens-API-k; csak az import-útvonal változik (`@/features/insights/components/...`).

- [ ] **Step 1:** `git mv` mind a kilenc fájlra (4 komponens + 1 sheet + tesztjeik — a CategoryHeader tesztje a KindNodeList tesztjében élhet, ellenőrizd `ls`-sel).
- [ ] **Step 2:** Import-utak frissítése (mozgatott fájlok egymás közt + KnowledgePage + bármi, amit `grep -rn "me/components/Kind\|me/sheets/NodeDetail\|me/components/ProfileNode\|me/components/CategoryHeader" frontend/src` talál).
- [ ] **Step 3:** `VITE_USE_MOCK=true pnpm test` zöld + `pnpm build` zöld.
- [ ] **Step 4:** Commit: `refactor(insights): gráf-nézet komponensek átköltöztetése a me-ből (mezo-ms9a)`.

### Task 5: FactsView kivágása a mai oldalból (viselkedés-őrző refaktor)

**Files:**
- Create: `frontend/src/features/insights/components/FactsView.tsx`
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx`
- Test: `frontend/src/features/insights/pages/KnowledgeListPage.test.tsx` (csak import/render-szint változhat — az assertök NEM)

**Interfaces (Produces):**
```tsx
export function FactsView(props: {
  facts: KnowledgeFact[]
  buckets: { inPrompt: KnowledgeFact[]; waiting: KnowledgeFact[]; off: KnowledgeFact[] }
  onToggle: (id: string, active: boolean) => void
  highlightFactId?: string | null   // Task 10 tölti; addig undefined
}): JSX.Element
```
A kereső + kategória-chipek + `nothingMatches` + a három vödör (`KnowledgeFactRow`, `LifecycleSection`) jelenlegi JSX-e és lokális `query`/`category` state-je egy-az-egyben ide kerül; a `bucketFacts`/`visible`/`clearFilters` logika vele megy. A page a vödröket továbbra is maga számolja (a hero-nak is kellenek) és propként adja át.

- [ ] **Step 1:** Vágd ki a 3.2-es blokkot a page-ből az új fájlba a fenti prop-szerződéssel; a page a `<FactsView>`-t rendereli ugyanott.
- [ ] **Step 2:** `VITE_USE_MOCK=true pnpm test -- KnowledgeListPage` zöld VÁLTOZATLAN assertökkel (ha egy teszt DOM-szerkezetre tört, a kivágás hibás — igazítsd a kivágást, ne a tesztet).
- [ ] **Step 3:** Mindkét mód + build zöld; commit: `refactor(insights): FactsView kivágás (mezo-ms9a)`.

### Task 6: A shell — `?view=` nézetváltás, új alapnézet, hero

**Files:**
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx`
- Create: `frontend/src/features/insights/components/KnowledgeBaseView.tsx`
- Modify: `frontend/src/styles/prototype.css` (új osztályok, ld. lent)
- Test: `KnowledgeListPage.test.tsx`

**Interfaces:**
- Consumes: `useGraphEdgeCount` (T3), `FactsView` (T5), mozgatott komponensek (T4).
- Produces: URL-séma — `?view=tenyek|kategoriak|profil|hogyan` (+ `kind`, `fact` később); érvénytelen `view` → alapnézet. A shell nézet-térképe:

```tsx
type KnowledgeView = 'base' | 'tenyek' | 'kategoriak' | 'profil' | 'hogyan'
const VIEWS = new Set(['tenyek', 'kategoriak', 'profil', 'hogyan'])
const raw = params.get('view')
const view: KnowledgeView = raw && VIEWS.has(raw) ? (raw as KnowledgeView) : 'base'
```

- `TudasFrame` marad a közös keret, de nézet-függő lesz: `tone` (base/tenyek: `sage`, kategoriak: `lav`, profil: `rose`, hogyan: `gold`), `PageHead` `onBack`/`label` (base: `‹ Mezo` → `/mezo`; minden más nézet: `‹ Tudástár` → `setParams({}, { replace: true })`), és a hero nézetenként (a spec 3.1–3.5 szerint). A hero jobb felső `?` help-chip csak base nézeten: `aria-label="Hogyan működik?"`, `onClick` → `setParams({ view: 'hogyan' })`.
- Base hero sub: `` `tény rólad · ${buckets.inPrompt.length} megy a chatbe${edgeCount !== null ? ` · ${edgeCount} kapcsolat` : ''}` `` — `null` (real-mode 404/hiba) esetén a szegmens ELMARAD.
- `KnowledgeBaseView` tartalma: a jóváhagyás-inbox (a page-ből ide költözik a candidates + életesemény/szezon blokk a mai `acceptedEvents`/`pendingLifeEvents` viselkedéssel, prop-okként lekötve) + a szekció-mozaik (`Mosaic` + 3 `Tile`):
  ```tsx
  <Mosaic>
    <Tile wash="sage" icon="i-polc" eyebrow="Tények" badge={facts.length}
      line={`${buckets.inPrompt.length} a chatben · ${buckets.waiting.length} vár · ${buckets.off.length} kikapcsolva`}
      onClick={() => setParams({ view: 'tenyek' })} delayMs={100} />
    <Tile wash="lav" icon="i-retegek" eyebrow="Kategóriák" badge={kindCount}
      line={kategLine} onClick={() => setParams({ view: 'kategoriak' })} delayMs={130} />
    {profileNode && (
      <Tile wash="rose" icon="i-checkin" eyebrow="Így beszélj velem" className="mz-tile-wide"
        line={profileLine} onClick={() => setParams({ view: 'profil' })} delayMs={160} />
    )}
  </Mosaic>
  ```
  ahol `kindCount = GRAPH_KIND_GROUPS.length`, `kategLine` = a legutóbb frissült (T3 rendezés, első elem) nem-profil node címe + `· ${edgeCount ?? '–'} él` helyett: él-szegmens csak `edgeCount !== null` esetén; `profileLine` = a profil-node summary első ~40 karaktere + `· heti frissítés`.
- A `KnowledgeExplainer` render kikerül a page-ből (a komponens törlése a Task 9-ben), a Tudásgráf sor-gomb (mai 118–128. sor) törlődik.
- Betöltés/degraded/hiba ágak változatlan sorrendben, a keretben; degraded esetén a Kategóriák/Profil csempe attól még renderel, ha a gráf-hook adott adatot (a két 404-szemantika szétválik: a degraded kártya csak a tény-részt fedi — a spec 5. pontja).
- CSS (`prototype.css`, a `tud-*` blokk mellé, a CSS-struktúra tesztek konvenciói szerint): `.tud-help` (a `?` chip — 30px kör, `background: var(--card-veil)`-jellegű, a `.mz-decbtn` tónusában), `.mz-tile-wide { grid-column: 1 / -1; }` ha még nincs széles-csempe osztály (előbb `grep -n "grid-column" frontend/src/styles/prototype.css` — ha van meglévő wide-idióma, azt használd).

- [ ] **Step 1:** Bukó tesztek: (a) alapnézeten látszik a 3 csempe (`getByRole('button', { name: 'Tények' })` stb.) és NEM látszik a kereső; (b) `?view=tenyek` → kereső + vödrök látszanak, csempék nem; (c) `?view=rossz` → alapnézet; (d) help-chip → `?view=hogyan` (a hogyan-nézet tartalma T9-ig üres keret lehet — assert a PageHead `‹ Tudástár` chipre); (e) hero real-mode edgeCount `null` → nincs „kapcsolat" szöveg; mock → van; (f) a Tudásgráf sor-gomb NINCS többé (`queryByLabelText('Tudásgráf')` null); (g) inbox az alapnézeten renderel (meglévő candidate-assertök átcímzése).
- [ ] **Step 2:** Bukás igazolása, majd implementáció a fenti szerződéssel.
- [ ] **Step 3:** Mindkét mód + build zöld; commit: `feat(insights): egyesített Tudástár shell + alapnézet (mezo-ms9a)`.

### Task 7: Kategóriák nézet + kind-lánc + Profil + Hogyan nézetek

**Files:**
- Create: `frontend/src/features/insights/components/{KategoriakView,ProfileView,HowItWorksView}.tsx`
- Modify: `KnowledgeListPage.tsx` (nézet-térkép bekötése), `prototype.css` (ha kell)
- Test: `KnowledgeListPage.test.tsx` + a mozgatott `KindTileGrid/KindNodeList/NodeDetailSheet` tesztek érintetlenek

**Interfaces:**
- `KategoriakView({ nodes, kind, onOpenKind, onClearKind, onOpenNode })` — `kind === null` → `KindTileGrid` (a T3 rendezés miatt a csempe-line már a legutóbbi node címét mutatja); `kind` érvényes → `KindNodeList` `updatedAt` DESC sorrendben. Érvénytelen `kind` param → rács (a `KnowledgePage` mai validálása: `KIND_LABELS.has(...)`).
- A shellben: `?view=kategoriak&kind=X`; kind-nézetben a PageHead `‹ Kategóriák` és `setParams({ view: 'kategoriak' }, { replace: true })`; a sheet a shell `selectedId` state-jén (a mai `KnowledgePage` idióma, arch-viselkedéssel együtt átemelve).
- `ProfileView({ node, onArchive })` — a `ProfileNodeCard` + alá egy magyarázó kártya (copy a spec 3.4-ből); a nézet csak akkor érhető el, ha van profil-node (nincs node + `?view=profil` → alapnézetre esés).
- `HowItWorksView()` — statikus, a `KnowledgeExplainer` `PARAGRAPHS` tömbje ide költözik (a `PROMPT_TOP_N`/`PATTERN_ACK_DAYS` interpoláció marad) + hatodik blokk: „Mik a kategóriák?" (copy a prototípusból).

- [ ] **Step 1:** Bukó tesztek: (a) `?view=kategoriak` → 6 kind-csempe, üres kind halványan, nem kattintható; (b) `&kind=PATTERN` → kompakt sorok, PageHead `‹ Kategóriák`; (c) érvénytelen kind → rács; (d) sor-klikk → sheet nyílik, Archivál → node eltűnik + sheet záródik (a `KnowledgePage.test.tsx` meglévő assertjeinek átemelése); (e) `?view=profil` → „Így beszélj velem" cím + „Rólad tanultam" kártya + Archivál; (f) `?view=hogyan` → mind a 6 kérdés-cím látszik; (g) profil-node nélkül `?view=profil` → alapnézet.
- [ ] **Step 2:** Implementáció; az `EntranceGroup` `replayKey`-e a shellben: `` `${view}:${kind ?? ''}` ``.
- [ ] **Step 3:** Mindkét mód + build zöld; commit: `feat(insights): kategóriák/profil/hogyan nézetek (mezo-ms9a)`.

### Task 8: Router-redirect, KnowledgePage törlés, linkelők

**Files:**
- Modify: `frontend/src/app/router.tsx` (`me/knowledge` sor), `frontend/src/features/insights/components/LifeEventAcceptedCard.tsx`, `frontend/src/features/me/logic/weekHighlight.ts` (csak ellenőrzés — `/mezo/knowledge`-ra mutat, marad), `frontend/src/data/notification/feedMock.ts`
- Delete: `frontend/src/features/me/pages/KnowledgePage.tsx` + `KnowledgePage.test.tsx`
- Test: `frontend/src/app/` router-teszt ha van, különben a `KnowledgeListPage.test.tsx`-be redirect-teszt

**Interfaces (Produces):** `/me/knowledge` → `/mezo/knowledge?view=kategoriak` (+ a bejövő `?kind=X` átfordítva `&kind=X`-re). A redirect komponens:
```tsx
function MeKnowledgeRedirect() {
  const [params] = useSearchParams()
  const kind = params.get('kind')
  return <Navigate to={`/mezo/knowledge?view=kategoriak${kind ? `&kind=${kind}` : ''}`} replace />
}
// router sor: { path: 'me/knowledge', element: <MeKnowledgeRedirect /> },
```

- [ ] **Step 1:** Bukó tesztek: (a) `/me/knowledge` render → a Kategóriák nézet DOM-ja; (b) `/me/knowledge?kind=PATTERN` → kind-lista; (c) `LifeEventAcceptedCard` nem renderel linket (a „Megnézed? → Tudásgráf" sor törlődik — a kártya csík + szöveg marad); (d) `feedMock` deeplinkjei `/mezo/knowledge`-ra mutatnak.
- [ ] **Step 2:** Implementáció + törlés; `grep -rn "me/knowledge\|KnowledgePage" frontend/src` maradéktalanul tiszta (a redirect-komponensen kívül).
- [ ] **Step 3:** Mindkét mód + build zöld; commit: `feat(insights): /me/knowledge redirect + KnowledgePage törlés (mezo-ms9a)`.

### Task 9: KnowledgeExplainer törlés + me-oldali maradékok

**Files:**
- Delete: `frontend/src/features/insights/components/KnowledgeExplainer.tsx` + tesztje
- Modify: bárki, aki még importálja (`grep -rn "KnowledgeExplainer\|EXPLAINER_STORAGE_KEY" frontend/src`)

- [ ] **Step 1:** Törlés + import-takarítás (a `HowItWorksView` már T7-ben átvette a copy-t — ellenőrizd, hogy nem az Explainerből importál).
- [ ] **Step 2:** Mindkét mód + build zöld; commit: `chore(insights): KnowledgeExplainer törlés — a Hogyan-nézet váltja (mezo-ms9a)`.

### Task 10: `?fact=` deep link + kiemelés

**Files:**
- Modify: `KnowledgeListPage.tsx`, `FactsView.tsx`, `frontend/src/features/insights/components/KnowledgeFactRow.tsx` (highlight prop), `prototype.css` (highlight osztály)
- Test: `KnowledgeListPage.test.tsx`

**Interfaces:** `?fact=<id>` (view-tól függetlenül) → a shell `view`-t `tenyek`-re kényszeríti, a `FactsView` `highlightFactId`-t kap; a `KnowledgeFactRow` `highlight?: boolean` propra `.mz-fact-hl` osztályt tesz (CSS: egyszeri, ~1.6s sárgás háttér-lecsengés `@keyframes`, `prefers-reduced-motion` alatt animáció nélkül) és mountkor `scrollIntoView({ block: 'center' })`-t hív (`useEffect`, ref). A shell a paramot az első render után `replace:true`-val törli (`useEffect`), hogy a highlight egyszeri legyen. Ismeretlen id → sima Tények nézet.

- [ ] **Step 1:** Bukó tesztek: (a) `?fact=<seed-id>` → Tények nézet + a sor highlight-osztályt visel; (b) a param a render után eltűnik az URL-ből; (c) ismeretlen id → nincs highlight, nincs hiba.
- [ ] **Step 2:** Implementáció (jsdom-ban `scrollIntoView` mock — a repo tesztjeiben keress precedens-t: `grep -rn "scrollIntoView" frontend/src`).
- [ ] **Step 3:** Mindkét mód + build zöld; commit: `feat(insights): ?fact= deep link + kiemelés (mezo-ms9a)`.

### Task 11: Szerkeszt-aztán-elfogad az életesemény/szezon-jelölten

**Files:**
- Modify: `frontend/src/features/insights/components/LifeEventCandidateCard.tsx`, `KnowledgeBaseView.tsx` (decide-hívás átvezetés)
- Test: `LifeEventCandidateCard.test.tsx` + `KnowledgeListPage.test.tsx`

**Interfaces:** a kártya új `Pontosít` ghost-gombja szerkesztő-állapotba vált: cím-input (max 160) + összefoglaló-textarea (max 500), `Elfogad így` + `Mégse`. `onDecide` szignatúra-bővítés: `(decision, refined?: { title?: string; summary?: string })` → `useLifeEventActions().decide(id, decision, refined)` (T3). Az `acceptedEvents` bejegyzés title-je a refined címet kapja.

- [ ] **Step 1:** Bukó tesztek: (a) Pontosít → inputok a seed-értékekkel előtöltve; (b) átírás + `Elfogad így` → a decide refined objektummal hívódik és a megerősítő kártya az új címet mutatja; (c) Mégse → vissza a kártya, döntés nem ment el; (d) sima Elfogad változatlanul refined nélkül hív.
- [ ] **Step 2:** Implementáció; a szerkesztő a kártyán belül marad (nem sheet), a `.mz-decbtn`/meglévő input-idiómákkal.
- [ ] **Step 3:** Mindkét mód + build zöld; commit: `feat(insights): szerkeszt-aztán-elfogad a gráf-jelölteken (mezo-ms9a)`.

### Task 12: Konfliktus-jelzés a tény-jelölt kártyán

**Files:**
- Modify: `frontend/src/features/insights/components/FactCandidateCard.tsx`, `KnowledgeBaseView.tsx`
- Test: `FactCandidateCard.test.tsx` + `KnowledgeListPage.test.tsx`

**Interfaces:** a kártya új propja `conflictFact?: KnowledgeFact | null` (a base view keresi ki: `facts.find(f => f.id === c.conflictsWithFactId)`). Ha van: figyelmeztető sor „⚠ Ellentmond ennek: »{conflictFact.text}«" + checkbox „A régit kikapcsolom" (default: bejelölve). Elfogadáskor bejelölt checkbox mellett a decide UTÁN `onToggle(conflictFact.id, false)` is hívódik (a meglévő `useKnowledgeActions().toggle`). Nincs konfliktus vagy az id nem található → semmi extra nem renderel.

- [ ] **Step 1:** Bukó tesztek: (a) konfliktusos seed-jelöltnél látszik a sor + checkbox bejelölve; (b) elfogadás → decide ÉS toggle(off) hívódik; (c) checkbox kivéve → csak decide; (d) elvetés → egyik sem; (e) konfliktus-mentes jelöltnél semmi nem látszik.
- [ ] **Step 2:** Implementáció.
- [ ] **Step 3:** Mindkét mód + build zöld; commit: `feat(insights): konfliktus-jelzés a tény-jelölt kártyán (mezo-ms9a)`.

### Task 13: Nav-pin tesztek + teljes FE kapu

**Files:**
- Modify: `frontend/src/features/insights/pages/insights.nav.test.tsx`, `frontend/src/features/me/logic/weekHighlight.test.ts`, `frontend/src/features/me/pages/WeekAnalysisPage.test.tsx`, `frontend/src/features/me/components/WeekDiscoveries.test.tsx` (vagy ahol a `/mezo/knowledge?fact=` pin él — `grep -rn "mezo/knowledge" frontend/src --include=*.test.*`)

- [ ] **Step 1:** Frissítsd a pineket az új valóságra (a `?fact=` linkek változatlanok — most már működnek; a `/me/knowledge` hrefek eltűntek). Minden pin-teszt zölden rögzítse az új célokat.
- [ ] **Step 2:** TELJES kapu: `VITE_USE_MOCK=true pnpm test` · `VITE_USE_MOCK=false pnpm test` · `pnpm build` — mind zöld.
- [ ] **Step 3:** Commit: `test(insights): nav-pinek az egyesített Tudástárra (mezo-ms9a)`.

### Task 14: Vizuális ellenőrzés mock módban

- [ ] **Step 1:** `VITE_USE_MOCK=true pnpm dev` + browser: `/mezo/knowledge` alapnézet (inbox + 3 csempe, nincs explainer), drill mind a 4 nézetbe és vissza, kind-lánc + sheet + archiválás, életesemény Pontosít→Elfogad így, konfliktus-checkbox, `?fact=` highlight a Heti felfedezésekből, `/me/knowledge` redirect. Képernyőképek a végállapotokról.
- [ ] **Step 2:** Ha eltérés van a prototípustól, itt javítsd (kis CSS/copy igazítások), újrafuttatott tesztekkel; commit: `fix(insights): vizuális finomítások az egyesített Tudástáron (mezo-ms9a)`.

### Task 15: Dokumentáció + CODEMAP

**Files:**
- Modify: `docs/features/insights.md` (§2.4 teljes átírás: az egyesített oldal nézet-térképe; §5.5 „két nézet két tabon" mondat), `docs/features/me.md` (§`Tudás` szakasz → egy bekezdésnyi utaló + a fájltérkép-sorok), `docs/features/companion.md` (Tudástár-hivatkozású pontok: W2.6, W4.3, W5.3, mezo-0ap9 próza — az új címekre/nézetekre), `docs/CODEMAP.md` (regen)
- Modify: `.beads`/bd — follow-up: fájlolj bd issue-t „Konfliktus-mező real-mode szállítása: conflictsWithFactId a FactCandidateResponse-ban + extraktor-kör" címmel (a spec 4.3 leválasztott fele)

- [ ] **Step 1:** Doksik átírása a knowledge-base skill 10-szekciós konvenciói szerint (a meglévő szakasz-stílust követve, a döntés-történetet — mezo-0ap9 → mezo-ms9a — kimondva).
- [ ] **Step 2:** `node scripts/gen-codemap.mjs` + `node scripts/gen-codemap.mjs --check` zöld.
- [ ] **Step 3:** bd issue fájlolása; commit: `docs(insights): egyesített Tudástár doksik + codemap (mezo-ms9a)`.

### Task 16: Zárás — PR, CI, merge, deploy

- [ ] **Step 1:** `bd dolt push` (ha bd-változás van) + `git push -u origin claude/mezo-tudastar-tudasgraf-f3d59f`.
- [ ] **Step 2:** Self-PR nyitása (`gh pr create`) — a PR csak CI-trigger; body a spec-re + mezo-ms9a-ra hivatkozik.
- [ ] **Step 3:** CI zöldre várás (`gh pr checks --watch`); hibánál javítás + push, újra.
- [ ] **Step 4:** Merge a `superpowers:finishing-a-development-branch` skill szerint: main frissítése (`git fetch origin main`), `git merge --no-ff` a feature-branchre main-ből NEM — a main-re kell merge-ölni; mivel a main a primary checkoutban van kivéve, a merge-t óvatosan, a skill worktree-forgatókönyve szerint végezd (jellemzően: primary checkoutban `git pull --rebase && git merge --no-ff claude/mezo-tudastar-tudasgraf-f3d59f && git push`, ANÉLKÜL, hogy ott bármi mást csinálnál — a worktree-munka-tilalom a fejlesztésre vonatkozik, a merge-push főágon pont ott történik). A push után a PR magától záródik, a deploy.yml main-push-ra indul.
- [ ] **Step 5:** `bd close mezo-ms9a` + `bd dolt push`; a deploy workflow figyelése (`gh run watch` a deploy.yml legutóbbi futására) — zöld deploy = kész.
