# Memória-obszervatórium — `/insights/memoria` (design)

**Dátum:** 2026-08-11 · **Státusz:** approved design (brainstorm session)
**Kapcsolódó:** [`companion.md`](../../features/companion.md) (L1 összefoglalók + embedding
pipeline V2.2, recall V2.3, pattern engine V3.x, LLM-audit ADR 0014),
[`insights.md`](../../features/insights.md) (tab-szerkezet),
`2026-08-11-pattern-monitor-design.md` (motor al-oldal — linkelt rokon-felület).

## 1. Probléma

A 3-4 rétegű memória (L0 nyers adat → L1 epizodikus napló + pgvector → L2 ítélet-inbox →
L3 tartós tudás) backend-oldalon kész és minden éjjel dolgozik, de a frontenden szinte
láthatatlan: a napi összefoglalókat és a vektor-réteget SEMMI nem mutatja meg, a tények
eredete és a rétegek közti áramlás nem követhető. A befektetés kihasználatlannak érződik,
mert nem látszik. Kell egy „menő és izgalmas" felület, ami élménnyé teszi a memória
működését — és mellékesen monitoring/debug nézet is.

## 2. Cél / nem cél

**Cél:** új „Memória" Insights-tab négy nézettel (Áttekintés · Napló · Kereső · Audit),
élmény-szintű vizualitással (CSS/SVG animáció, gondos kártyák — extra lib nélkül).

**Nem cél (v2-re tolt / kizárt):** 2D embedding-térkép (PCA-projekció — látványos, de
backend-projekció + canvas; külön szelet, ha kell), chat-turn vektorok listázása,
összefoglaló szerkesztés/törlés a felületről, bármilyen írás a memóriába (a felület
READ-ONLY — az ítéletek helye a Minták/Tudástár fül marad).

## 3. Elhelyezés + navigáció

8. chip az Insights al-navban: `{ id: 'memory', to: '/insights/memoria', label: 'Memória' }`;
egy `MemoryPage` leaf (`features/insights/pages/MemoryPage.tsx`), belül lokális
szegmens-váltó (Áttekintés a landing). Nincs új route-fa; a Minták-fül motor-oldala
(`/insights/motor`) és e tab kölcsönösen linkelik egymást.

## 4. Contract (contract-first — `api/feature/companion/companion.yml`; mind 401 · 404 a companion switch-re)

```yaml
GET /api/companion/memory/overview -> MemoryOverviewResponse:
  l0: { daysWithAnyData: int, windowDays: int }        # a pattern-ablak (60) napjaiból
  l1: { summaryCount: int, firstDate: date|null, lastDate: date|null,
        embeddings: { dailySummary: int, chatTurn: int } }
  l2: { patterns: [ { kind, status, count } ], pendingFactCandidates: int }
  l3: { facts: [ { source, count } ], totalReinforcements: int, factsInPrompt: int }
  jobs: { summaryCron, patternCron, hypothesisCron,     # a config cron-kifejezései
          lastSummaryDate: date|null, lastDetectedAt: instant|null }

GET /api/companion/memory/summary?from&to -> MemorySummaryListResponse:
  items: [ { date, narrative, embedded: bool } ]        # date-desc, az L1 napló

GET /api/companion/memory/similar-days?q=&k= -> SimilarDaysResponse:
  items: [ { date, excerpt, similarity, finalScore } ]  # a MemoryRecallService kimenete;
  # MINDKÉT pontszám kimegy — látszódjon a similarity × exp(-age/τ) mechanika;
  # a min-similarity floor alatti találat itt sem jön vissza (őszinte üres lista)

GET /api/companion/memory/llm-usage?days= -> LlmUsageResponse:
  enabled: bool                                          # llm-log feature switch állapota
  perDay: [ { date, calls: int, inputTokens, outputTokens, costUsd } ]
  totals: { calls, inputTokens, outputTokens, costUsd }
```

Plusz: a meglévő `KnowledgeFactResponse` bővül `lastReinforcedAt`-tal (additív; a
source / patternTitle / reinforcementCount már megy a dróton) — az Audit nézet
tény-provenanciája ebből + a meglévő fact-listából épül, új endpoint nélkül.

## 5. Backend

- **`MemoryObservatoryService`** (`feature/companion/service`, companion-switch feltétellel):
  csak olvas; count-query-k a meglévő repository-kon (hiányzó count-metódusok pótlása),
  az L0 `daysWithAnyData` a `MetricSeriesService`-ből (bármely metrika ad-e adatot aznap —
  a katalógus-spec futás-szintű sorozat-cache-ével olcsó).
- **Kereső:** a V2.3 `MemoryRecallService` változatlan újrahasznosítása (embed query → ANN →
  recency re-rank) — a tool és a felület garantáltan ugyanazt a memóriát látja.
- **LLM-usage:** rollup az `llm_log_history`-n (napi GROUP BY + összesen, a frozen price
  snapshot mezőkből); a feature-switch állapota a válasz `enabled` mezője — kikapcsolt
  audit-lognál `enabled: false` + üres sorok, a FE őszinte „audit kikapcsolva" állapotot mutat.
- Controller a companion pattern szerint, generált `<Tag>Api` + `api.dto` + `CompanionMapper`.

## 6. Frontend — a négy nézet (élmény-szint)

- **Áttekintés (landing):** függőleges réteg-folyam — 4 réteg-kártya (L0 nyers napok →
  L1 napló + vektorok → L2 ítélet-inbox → L3 tartós tudás), köztük CSS-animált
  áramlás-konnektorok (pulzáló szaggatott vonal, `prefers-reduced-motion` tisztelettel);
  kártyánként nagy szám + 2-3 alstatisztika + „utoljára: …"; a konnektorokon a cron-idők
  (02:20 · 02:40 · vas 03:00) — látszik, MIKOR folyik az adat lefelé. Koppintás: L1-kártya →
  Napló szegmens, L2 → Minták fül, L3 → Tudástár fül.
- **Napló:** narratíva-kártyák date-desc, hónap-elválasztókkal, memoir-tipográfiával
  (a `memoir-card` stílusvilág újrahasznosítva), embedding-pötty a sarokban; üres állapot
  őszintén („az első éjszakai összefoglaló még nem készült el").
- **Kereső:** szabadszöveges input + keresés-gomb (lusta query — nem gépelésre tüzel);
  találati kártya: dátum + kivonat + similarity-sáv + a két pontszám (`cos 0.81 · végső
  0.64`); koppintva a nap naplóbejegyzésére ugrik. Üres találat: „nincs elég hasonló nap
  a memóriában" — sosem kényszerített találat.
- **Audit:** tény-provenancia lista (forrás-chip `chat`/`minta`/`kézi`, ×N reinforced,
  utolsó megerősítés dátuma, minta-eredetnél a `minta: {cím}` chip) + LLM-használat
  mini-grafikon (napi token-oszlopok, 30 napos össz-költség). A grafikon implementálásakor
  a `dataviz` skill az irányadó.
- **Hooks:** `data/insights/memoryHooks.ts` — `useMemoryOverview` / `useMemorySummaries` /
  `useSimilarDays` (lusta) / `useLlmUsage`; `useDualQuery` kézzel írt, a mock-világgal
  konzisztens seeddel; 404 → degraded kártya (a PatternsPage hangvételében); barrel-re-export.

## 7. Tesztek

- **Backend IT-k:** overview — populált rétegekből elvárt számok (üres user → nullák);
  summary-lista tartomány-szűréssel; similar-days a determinisztikus fake-embedding
  adapterrel (ismert vektor → ismert sorrend + floor-vágás); llm-usage rollup ismert
  log-sorokból + `enabled:false` ág; mind: switch-off → 404.
- **FE (vitest, mindkét mód):** nézetenként render-teszt a hook-adatokból; a kereső lusta
  indítása; degraded állapotok.

## 8. Docs-hatás

`companion.md` (observatory endpointok + service), `insights.md` (8. tab + nézetek),
contract regen mindkét oldalon.

## 9. Implementációs szeletelés (a plan váza)

① contract + `MemoryObservatoryService` + Áttekintés + Napló (a tab születése) →
② Kereső (recall-újrahasznosítás) → ③ Audit (fact-bővítés + llm-usage). Mindhárom szelet
önállóan zöld + dokumentált.
