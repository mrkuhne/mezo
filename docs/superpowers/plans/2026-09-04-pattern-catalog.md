# Minták állapotfüles katalógus — Implementation Plan

**Goal:** A Minták oldal egyszerre egy életciklus-csoportot mutasson jól látható ikonos
szűréssel és ötös lapozással, miközben minden perzisztált minta — a monitor-pár nélküli
megerősített AI-hipotézis is — megnyitható marad.

**Architecture:** A változás frontend-only. Egy tiszta `patternCatalog` modul végzi az induló
állapot, domén, rendezés és lapozás derivációit; a `PatternsPage` a meglévő bucketek és Design
2.0 komponensek fölé csak interakciós állapotot tesz. A `PatternDetailPage` a jelenlegi gazdag
pár-részletet részesíti előnyben, és kizárólag pair-404 + megtalált mentett `Pattern` esetén
renderel őszinte, minta-alapú fallback részletet.

**Global Constraints:** nincs endpoint/DTO/backend változás; `PAGE_SIZE = 5`; egyszerre egy
életciklus-csoport; üres explicit választás megengedett, automatikus induló állapot csak az első
rendernél; pair-backed részlet változatlan; minta-fallback nem talál ki grafikont vagy
statisztikát; emoji nem marad a Minták doménvezérlőiben; a production UI kizárólag a meglévő
Design 2.0 tokeneket, `MozaikPage`, `Sheet`, `ClayIcon`, `Icon`, `PatternDecisionCard` és
mintacsempe-nyelvet használja.

**Spec:** [`docs/superpowers/specs/2026-09-04-pattern-catalog-design.md`](../specs/2026-09-04-pattern-catalog-design.md)

**Driving bd issue:** `mezo-szqy`

### Task 1: Tiszta katalógus-derivációk

**Files:**

- Create: `frontend/src/features/insights/logic/patternCatalog.ts`
- Create: `frontend/src/features/insights/logic/patternCatalog.test.ts`

**Interfaces:**

```ts
export const PATTERN_PAGE_SIZE = 5
export type PatternCatalogSort = 'progress' | 'domain'
export function initialBucket(buckets: Map<LifecycleBucket, LifecycleEntry[]>): LifecycleBucket
export function entryDomain(entry: LifecycleEntry): MetricDomain
export function filterSortEntries(
  entries: LifecycleEntry[], domain: MetricDomain | null, sort: PatternCatalogSort,
): LifecycleEntry[]
export function pageEntries(entries: LifecycleEntry[], page: number): {
  items: LifecycleEntry[]; page: number; pageCount: number
}
```

- [x] RED: írj tesztet arra, hogy `initialBucket` a nem üres `decide` kosarat választja, ennek
  hiányában pedig a `BUCKET_ORDER` első nem üres kosarát; teljesen üres állapotban `decide`.
- [x] RED: írj tesztet arra, hogy a pair-backed entry a `metricBDomain` értéket, a monitor-pár
  nélküli minta pedig `other` domént kap; a szűrés egyik elemet sem veszíti el a `Mind` (`null`)
  nézetben.
- [x] RED: írj tesztet a `domain` rendezésre (doménsorrend, azon belül `hu-HU` cím), valamint a
  `PATTERN_PAGE_SIZE`-os lapozásra és a tartományon túli oldal biztonságos clampelésére.
- [x] Futtasd és lásd a helyes hiány miatti bukást:

  ```bash
  cd frontend && pnpm vitest run src/features/insights/logic/patternCatalog.test.ts
  ```

- [x] GREEN: implementáld a fenti tiszta függvényeket. A `progress` rendezés másolatot adjon
  vissza az eredeti bucket-sorrendben; a `domain` rendezés használja a meglévő `DOMAIN_ORDER`
  sorrendet és `localeCompare(..., 'hu-HU')`-t.
- [x] Futtasd újra a céltesztet, majd commit:

  ```bash
  git add frontend/src/features/insights/logic/patternCatalog.ts \
    frontend/src/features/insights/logic/patternCatalog.test.ts
  git commit -m "feat(insights): derive pattern catalog views (mezo-szqy)"
  ```

### Task 2: Ikonos doménjel és Design 2.0 szűrő sheet

**Files:**

- Create: `frontend/src/features/insights/components/PatternDomainMark.tsx`
- Create: `frontend/src/features/insights/components/PatternFilterSheet.tsx`
- Create: `frontend/src/features/insights/components/PatternFilterSheet.test.tsx`
- Modify: `frontend/src/features/insights/logic/domains.ts`
- Modify: `frontend/src/features/insights/components/PatternDecisionCard.tsx`
- Modify: `frontend/src/features/insights/components/PatternDetailHero.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**

```tsx
export const PATTERN_DOMAIN_ICONS: Record<MetricDomain, ClayIconName>
export function PatternDomainMark(props: { domain: MetricDomain; size?: number; showLabel?: boolean }): JSX.Element
export function PatternFilterSheet(props: {
  domain: MetricDomain | null
  sort: PatternCatalogSort
  availableDomains: MetricDomain[]
  onApply(next: { domain: MetricDomain | null; sort: PatternCatalogSort }): void
  onClose(): void
}): JSX.Element
```

- [x] RED: a sheet tesztje igazolja a jelenlegi értékek kijelölését, egy domén + rendezés draft
  módosítását, az `Alkalmazom` utáni egyetlen `onApply` hívást, valamint hogy `onClose` draft
  mentése nélkül fut.
- [x] RED: a `PatternDecisionCard` és `PatternDetailHero` meglévő tesztjében rögzítsd, hogy a
  doménjelzés SVG/clay ikont és magyar címkét tartalmaz, emojit nem.
- [x] Futtasd a három céltesztet, és ellenőrizd a bukást:

  ```bash
  cd frontend && pnpm vitest run \
    src/features/insights/components/PatternFilterSheet.test.tsx \
    src/features/insights/components/PatternDecisionCard.test.tsx \
    src/features/insights/components/PatternDetailHero.test.tsx
  ```

- [x] GREEN: készíts feature-local `PatternDomainMark` komponenst a meglévő `ClayIcon` és
  `DOMAIN_META` címke használatával. Cseréld a döntési kártya és a detail hero emoji-fogyasztását
  a komponensre; a főoldal utolsó fogyasztója és maga a mező Task 3-ban tűnik el együtt.
- [x] GREEN: készítsd el a house `Sheet`-re épülő szűrőt. Natív gombok, `aria-pressed`,
  `Icon name="insights"` a Mind opcióhoz, clay doménjelek a témákhoz, natív `select` a rendezéshez;
  a sheet saját draft state-et tart, csak Apply-kor ír vissza.
- [x] A `prototype.css`-ben kizárólag `mnt-filter-*` osztályokat és meglévő `--mz-*`/globális
  tokeneket használj; új raw szín vagy párhuzamos sheet-backdrop ne készüljön.
- [x] Futtasd újra a célteszteket, majd commit:

  ```bash
  git add frontend/src/features/insights/components/PatternDomainMark.tsx \
    frontend/src/features/insights/components/PatternFilterSheet.tsx \
    frontend/src/features/insights/components/PatternFilterSheet.test.tsx \
    frontend/src/features/insights/components/PatternDecisionCard.tsx \
    frontend/src/features/insights/components/PatternDetailHero.tsx \
    frontend/src/features/insights/logic/domains.ts frontend/src/styles/prototype.css
  git commit -m "feat(insights): add icon-based pattern filters (mezo-szqy)"
  ```

### Task 3: A Minták oldal állapotvezérelt és lapozott kompozíciója

**Files:**

- Modify: `frontend/src/features/insights/pages/PatternsPage.tsx`
- Modify: `frontend/src/features/insights/pages/PatternsPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**

- Page state: `selectedBucket: LifecycleBucket | null`, `activeDomain: MetricDomain | null`,
  `sort: PatternCatalogSort`, `page: number`, `filterOpen: boolean`.
- A `null` bucket az `initialBucket(buckets)` derivált induló értékét jelenti; explicit user
  választást a lap nem ír felül.
- Minden `PatternTile` célja `/mezo/patterns/${entry.key}`, mert az entry pair-backed vagy
  perzisztált pattern-backed; a részletoldal kezeli a két esetet.

- [ ] RED: módosítsd a mock page tesztet úgy, hogy induláskor csak az aktív bucket tartalma
  látszik; `Megerősítve` cellára kattintva eltűnik a döntési inbox és megjelenik a megerősített
  lista; a cellák `button` + `aria-pressed` szerződése rögzített.
- [ ] RED: rögzítsd, hogy a monitor-pár nélküli megerősített minta is részletlink, és a korábbi
  „plain row/no link” tesztet cseréld ennek ellenkezőjére. Ugyanez igaz a pair nélküli döntési
  hipotézis `Részletek és előzmények` linkjére.
- [ ] RED: adj 6+ elemű cél-fixture-t vagy real-mode MSW fixture-t, és teszteld az öt elem/oldal
  lapozást, az oldaljelzőt, valamint az első oldalra visszaállást állapot- és filter-alkalmazáskor.
- [ ] RED: nyisd meg a filter sheetet a jól látható `Szűrés` gombbal; válassz domént, alkalmazd,
  és igazold, hogy csak az adott domén elemei maradnak, a számlálók pedig továbbra is a teljes
  motorállapotot mutatják.
- [ ] Futtasd a lap tesztjét és lásd a bukást:

  ```bash
  cd frontend && pnpm vitest run src/features/insights/pages/PatternsPage.test.tsx
  ```

- [ ] GREEN: alakítsd a hat `.mnt-lcel` elemet natív gombbá, a meglévő skin/hot stílusok és
  mozgás változatlan megtartásával. A kiválasztás kapjon külön, tokenes selected ringet.
- [ ] GREEN: a jelenlegi hat egymás alatti JSX szekció helyett renderelj egy kiválasztott
  bucket-kompozíciót. A `decide` továbbra is `PatternDecisionCard`, a többi a meglévő
  `PatternTile`/`mnt-mosaic`; a buckethez tartozó jelenlegi footnote szövegek maradjanak.
- [ ] GREEN: kösd be `PatternFilterSheet`, `filterSortEntries` és `pageEntries`; több oldalnál
  jelenjen meg tokenes előző/következő lapozó `N–M / összes` jelzéssel.
- [ ] Az Adat-egészség és a Memória-link maradjon a katalógus után. A status/filter/pager új
  CSS-e a jelenlegi `mnt-*` blokkban, a meglévő tokenekkel készüljön.
- [ ] Futtasd újra a page tesztet mindkét módban, majd commit:

  ```bash
  cd frontend
  pnpm vitest run src/features/insights/pages/PatternsPage.test.tsx
  VITE_USE_MOCK=true pnpm vitest run src/features/insights/pages/PatternsPage.test.tsx
  cd ..
  git add frontend/src/features/insights/pages/PatternsPage.tsx \
    frontend/src/features/insights/pages/PatternsPage.test.tsx frontend/src/styles/prototype.css
  git commit -m "feat(insights): make pattern states navigable (mezo-szqy)"
  ```

### Task 4: Monitor-pár nélküli mentett minták részletnézete

**Files:**

- Create: `frontend/src/features/insights/components/PatternArtifactDetail.tsx`
- Modify: `frontend/src/features/insights/pages/PatternDetailPage.tsx`
- Modify: `frontend/src/features/insights/pages/PatternDetailPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**

```tsx
export function PatternArtifactDetail(props: {
  pattern: Pattern
  onDecide(status: PatternStatus): void
}): JSX.Element
```

- [ ] RED mock: nyisd meg a meglévő monitor-pár nélküli `ai_hypothesis` seed `pairKey`-ét. A
  lap ne „Nincs ilyen minta” legyen, hanem mutassa a mentett címet, kategóriát, állapotot,
  mechanizmust és evidence sorokat; ha proposed, a három meglévő döntési gomb is működjön.
- [ ] RED real: MSW-ben a pair detail adjon 404-et, a pattern list pedig egy megerősített
  `ai_hypothesis` sort. A lap jelenítse meg a „Megerősítve” állapotot és a társban való
  felhasználás emberi magyarázatát, grafikon/technikai számok nélkül.
- [ ] Regresszió: a pair-backed showcase továbbra is a teljes öt blokkot rendereli; pair 500
  továbbra is retry; mindkét forráson ismeretlen kulcs továbbra is „Nincs ilyen minta”.
- [ ] Futtasd a lap tesztjét és lásd a fallback-esetek bukását:

  ```bash
  cd frontend && pnpm vitest run src/features/insights/pages/PatternDetailPage.test.tsx
  ```

- [ ] GREEN: a `PatternDetailPage` hívja a `usePatterns()` hookot is, keresse a `pairKey`-et,
  és tartsa ezt a prioritást: pending bármely szükséges readen → loading; pair error → retry;
  pair detail → meglévő story flow; pair 404 + pattern → `PatternArtifactDetail`; különben not
  found.
- [ ] GREEN: a fallback komponens a meglévő `PatternDecisionCard`-ot használja proposed sorhoz,
  megítélt sornál read-only Design 2.0 hero-t. Alatta csak a mentett mechanizmus, evidence és az
  állapot következménye jelenjen meg; nincs kitalált statisztikai blokk.
- [ ] A CSS a meglévő `pdt-*` blokkot bővítse Design 2.0 tokenekkel, raw szín nélkül.
- [ ] Futtasd újra a detail és page teszteket mindkét módban, majd commit:

  ```bash
  cd frontend
  pnpm vitest run src/features/insights/pages/PatternDetailPage.test.tsx \
    src/features/insights/pages/PatternsPage.test.tsx
  VITE_USE_MOCK=true pnpm vitest run src/features/insights/pages/PatternDetailPage.test.tsx \
    src/features/insights/pages/PatternsPage.test.tsx
  cd ..
  git add frontend/src/features/insights/components/PatternArtifactDetail.tsx \
    frontend/src/features/insights/pages/PatternDetailPage.tsx \
    frontend/src/features/insights/pages/PatternDetailPage.test.tsx frontend/src/styles/prototype.css
  git commit -m "feat(insights): open every persisted pattern (mezo-szqy)"
  ```

### Task 5: Élő dokumentáció, teljes verifikáció és self-PR

**Files:**

- Modify: `docs/features/insights.md`
- Regenerate if changed: `docs/CODEMAP.md`

- [ ] Írd át az Insights §2.1 és §9/§10 releváns részeit: állapotválasztó katalógus, ikonos
  filter sheet, ötös lapozás, pair-backed és pattern-backed részlet kettős útja. A korábbi
  „dead-detail-link guard” leírásokat töröld vagy cseréld a fallback szerződésre.
- [ ] Generáld/ellenőrizd a CODEMAP-et és linteld a dokumentációt:

  ```bash
  node scripts/gen-codemap.mjs
  node scripts/gen-codemap.mjs --check
  node scripts/lint-docs.mjs
  ```

- [ ] Futtasd a teljes frontend kaput friss kimenettel:

  ```bash
  cd frontend
  pnpm build
  pnpm test
  VITE_USE_MOCK=true pnpm test
  ```

- [ ] Ellenőrizd a diffet, a generált fájlokat és a whitespace-t:

  ```bash
  git diff --check
  git status --short
  ```

- [ ] Commitold a living doc/CODEMAP változást:

  ```bash
  git add docs/features/insights.md docs/CODEMAP.md
  git commit -m "docs(insights): document pattern catalog flow (mezo-szqy)"
  ```

- [ ] Zárd a beadet, szinkronizáld, pushold a branchet, majd nyiss self-PR-t a commitok, kapuk
  és eltérések felsorolásával:

  ```bash
  bd close mezo-szqy
  bd dolt push
  git push -u origin feat/pattern-catalog
  gh pr create --base main --head feat/pattern-catalog \
    --title "feat(insights): add navigable pattern catalog (mezo-szqy)" \
    --body-file /tmp/mezo-szqy-pr.md
  ```

- [ ] Várd meg a teljes CI-t. Ne merge-elj; a user végzi a merge-et.
