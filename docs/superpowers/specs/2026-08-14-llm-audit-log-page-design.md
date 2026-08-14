# AI-napló oldal — `llm_log_history` böngésző (`/me/ai-usage`)

- **Date:** 2026-08-14
- **Driving issue:** mezo-uakh
- **Status:** design approved (implementation pending)
- **Mockup:** [`2026-08-14-llm-audit-log-page-mockup.html`](2026-08-14-llm-audit-log-page-mockup.html) — jóváhagyva
- **Related:** [ADR 0014](../../decisions/0014-llm-call-audit-log.md) (az audit-napló döntése), mezo-2zyu (a tábla + capture), mezo-h3gb (a `summary` endpoint + `AiUsageCard`), mezo-1rz9 (`CANCELLED`), mezo-58ig (per-kör usage)
- **New ADR:** nem. Ez az ADR 0014 §9 („v1 is the table only… a read API… explicitly later") kifejezetten előrejelzett folytatása; új architekturális döntés nincs benne. A meglévő ADR két állítása kötelező érvényű marad (lásd §7): a read-oldal **nem** szűr `created_by`-ra, és a null költség **nem** nulla.

## 1. Kontextus és probléma

`mezo-2zyu` óta minden LLM-hívás egy append-only `llm_log_history` sorba kerül — kérés-alak, kimenetel, provider usage-számlálók, a (64k karakternél csonkolt) prompt/válasz és a befagyasztott ártábla. A v1 **szándékosan** csak a tábla volt: a lekérdezés `psql`-en át megy.

`mezo-h3gb` hozott egy vékony read-oldalt: `GET /api/llm-usage/summary` (nap/hét/hónap hívásszám + összeg) és a Profil `AiUsageCard`-ja. Ez a „mennyit költök" kérdés első feléig jut el, és ott meg is áll:

1. **Nincs attribúció a felületen.** A kártya nem mondja meg, hogy a heti $1.86-ot a `companion_chat` vagy a `companion_hypothesis` vitte-e el, sem azt, hogy melyik modell.
2. **Nincs debug-nyom.** Amikor egy LLM-turn hülyeséget csinál, a pontos system prompt + user üzenet + nyers válasz ott van a táblában — de csak `psql`-ből.
3. **A hibák láthatatlanok.** Egy `ERROR`- vagy `CANCELLED`-hullám (429-ek, megszakadt streamek) semmilyen felületen nem jelenik meg; a `callCount` nőttön nő, a költség meg nem, és ez az összegzésből nem olvasható ki.

## 2. Döntés-összefoglaló

A tulajdonossal egyeztetve:

1. **Cél: mindkettő** — a lista a fő nézet (debug-nyom), a bontás a fejlécben (költség-attribúció). Egy oldal, nem kettő.
2. **Hely: teljes oldal `/me/ai-usage`**, Me-alnav nélkül (a `me/routines/edit` és `me/sleep/night` idióma). Belépő: a Profil meglévő **`AiUsageCard`-ja koppinthatóvá válik**. A 8 elemű Me tab-sáv nem bővül.
3. **Időablak: naptári Ma / Ez a hét / Ez a hónap** — ugyanaz a három periódus, mint a kártyáé (`mezo.llm-log.report-zone`), és **ugyanaz a választás szűri a fejlécet ÉS a listát**, hogy a két szám sose mondjon mást.
4. **Szűrés szerveroldali** — feature, státusz, call kind. A feature-sávra koppintva rászűr (a sáv kiemelve, ✕-szel törölhető). Kliensoldali szűrés nincs: a fejléc-számok a teljes periódust fedik, a lista csak egy ablakot lát belőle, tehát a kettőt csak a szerver tudja egyeztetni.
5. **Lapozás: növekvő ablak** — egyetlen `limit` paraméter (default 50, max 500), a „További hívások" gomb 50-esével emeli. **Nem offset** (a napló tetejére folyamatosan érkeznek új sorok, offsettel a lapozás duplikálna) és **nem cursor**: a `useDualQuery` egy lekérdezést kezel, a kódbázisban nincs `useInfiniteQuery`, így a cursor-akkumuláció olyan több-lapos állapotmintát hozna be, aminek nincs párja. A növekvő ablak minden válaszban egy konzisztens olvasat a lista tetejéről, tehát sem nem duplikál, sem nem hagy ki — cserébe újraolvassa az addigi sorokat, ami ≤500 sornál elhanyagolható. A plafonon a lista **kiírja**, hogy elfogyott az ablak („Szűkíts szűrővel a régebbiekhez") — néma csonkolás nincs.
6. **Részletnézet: külön oldal** `/me/ai-usage/:id`, nem sheet. A payloadok oszloponként 64 000 karakterig mehetnek — egy bottom-sheet ehhez szűk —, és így deep-linkelhető is.
7. **Három új endpoint**, contract-first, a meglévő `llm-usage` fragmentbe: `breakdown` (fejléc), `calls` (lista), `calls/{id}` (részlet). A `summary` **marad**, változatlanul — a kártya azt eszi.
8. **A payload sosem utazik a listával.** A lista-sor a metaadatot viszi; a system prompt / user üzenet / válasz csak a részlet-hívásban jön le.

## 3. Architektúra

```
/me/ai-usage  (AiUsagePage)
  ├─ periódus-state (DAY|WEEK|MONTH) + szűrő-state (feature?, status?, callKind?)   ← useState, URL-be nem megy
  ├─ useLlmUsageBreakdown(period)         → GET /api/llm-usage/breakdown?period=
  │     └─ hero (totals) + feature-sávlista + modell-kockák
  └─ useLlmCalls(period, filters, limit)  → GET /api/llm-usage/calls?period=&feature=&status=&callKind=&limit=
        └─ szűrőchipek + hívás-lista + „További hívások" (limit += 50)

/me/ai-usage/:id  (AiCallDetailPage)
  └─ useLlmCall(id)                       → GET /api/llm-usage/calls/{id}
        └─ meta-rács + token-sáv + ártábla-doboz + 3 payload-blokk
```

Backend (a meglévő `feature/llmlog` csomagba, új csomag nem kell):

```
LlmUsageController  (implements LlmUsageApi)   ← már létezik, 3 metódussal bővül
   ↓
LlmUsageService     ← már létezik; summary() mellé breakdown() / listCalls() / call(id)
   ↓
LlmLogRepository    ← aggregateSince() mellé 4 új query
   ↓
llm_log_history
```

**Miért nem külön controller/service:** ugyanaz a tábla, ugyanaz a tag (`LlmUsage`), ugyanaz a két invariáns (nincs owner-szűrés, a null költség nem nulla). Egy második service ugyanezt a két szabályt duplikálná. A `LlmUsageService` a bővítés után ~180 sor — a felső határ alatt; ha később a bontás önálló életre kel, akkor válik szét.

**Új mapper-osztály:** `LlmLogMapper` (MapStruct, `feature/llmlog/mapper/`) — entity → `LlmCallDetailResponse`. A lista-elemet **nem** mapper adja: az egy JPQL-projekció (§4), hogy a payload-oszlopok el se hagyják a DB-t.

## 4. Adat-hozzáférés (`LlmLogRepository`)

Mind a négy query **szándékosan owner-szűrés nélkül** (ADR 0014 következmény-szakasz: a cron- és stream-sorok `created_by`-ja null, egy ownership-szűrő pont a legdrágább forgalmat rejtené el).

| Query | Alak | Megjegyzés |
|---|---|---|
| `aggregateTotals(since)` | `count(*)`, `count` státuszonként, `sum(cost_usd)`, `count(*) where cost_usd is null` | Egy sor. A `summary` `aggregateSince`-e marad külön (a kártya nem kér státusz-bontást). |
| `aggregateByFeature(since)` | `group by feature` → `(feature, count, sum(cost))`, `order by sum(cost) desc nulls last, count desc` | Az `idx_llm_log_history_feature_created_at` tengelye. |
| `aggregateByModel(since)` | `group by served_model` → `(servedModel, count, sum(cost))` | `served_model` lehet null (ERROR-sor) — nem szűrjük ki, a FE „ismeretlen"-ként mutatja. |
| `findCalls(since, feature, status, callKind, Pageable)` | JPQL-projekció a `LlmCallRow` recordba, `order by createdAt desc` | A payload-oszlopok NEM szerepelnek a selectben. |

**Dinamikus szűrők:** a ház `derived → JPQL → native` sorrendje szerint JPQL, a `(:param is null or l.x = :param)` idiómával — nincs Criteria API, nincs Specification (a kódbázisban egyik sincs jelenleg).

**`hasMore` a `limit + 1` trükkel:** a service `limit + 1` sort kér, és ha ennyit kapott, `hasMore = true` (a plusz sort eldobja). Így a „További hívások" gomb sosem hazudik, és nem kell `count(*)` minden lapozásnál.

**`Pageable`:** `PageRequest.of(0, limit + 1, Sort.by(DESC, "createdAt"))` — `List`-et adunk vissza, nem `Page`-et (a `Page` egy fölösleges `count(*)`-ot is futtatna).

## 5. Kontraktus (`api/feature/llm-usage/llm-usage.yml`)

Contract-first: a fragment bővül, majd `cd api/generate && npm run generate:api`, utána `cd frontend && pnpm generate:api`. Minden nem-2xx `SystemMessageList`-re hivatkozik.

### `GET /api/llm-usage/breakdown` — `getLlmUsageBreakdown`

Query: `period` (`DAY|WEEK|MONTH`, kötelező).

```
LlmUsageBreakdownResponse {
  from: date          # a periódus kezdete a report-zone-ban (naptári)
  totals: LlmUsageTotals
  features: LlmUsageGroup[]   # költség szerint csökkenő
  models:   LlmUsageGroup[]
}
LlmUsageTotals {
  callCount, successCount, errorCount, cancelledCount, unpricedCount: int64
  costUsd: double|null        # csak az árazott sorok összege
  currency: string
}
LlmUsageGroup { key: string|null, callCount: int64, costUsd: double|null }
```

`unpricedCount` = azon sorok száma, ahol `cost_usd is null` — ez adja a hero „38 hívás árazatlan" sorát, ami megmagyarázza, miért becslés az összeg.

### `GET /api/llm-usage/calls` — `listLlmCalls`

Query: `period` (kötelező), `feature`, `status` (`SUCCESS|ERROR|CANCELLED`), `callKind`, `limit` (int, default 50, 1..500).

```
LlmCallListResponse { items: LlmCallListItem[], hasMore: boolean }
LlmCallListItem {
  id: uuid, createdAt: date-time
  feature, operation|null, callKind, status
  requestedModel, servedModel|null
  latencyMs: int, streamed: boolean, toolRounds|null
  totalTokens|null, imageCount|null, embedInputCount|null, embedDimensions|null
  costUsd|null, errorClass|null, errorCode|null
}
```

### `GET /api/llm-usage/calls/{id}` — `getLlmCall`

404 → `SystemMessageList` (`LLM_LOG_CALL_NOT_FOUND`, új kód a `message.properties`-be).

```
LlmCallDetailResponse {
  … minden lista-mező …
  entityKind|null, entityId|null, serviceTier|null, createdBy|null
  promptTokens|null, candidatesTokens|null, thoughtsTokens|null, cachedTokens|null
  embedBillableChars|null, imageBytesTotal|null, imageMime|null
  systemPrompt|null, userMessage|null, responseText|null
  truncated: boolean, payloadBytes: int
  pricingSnapshot: LlmPricingSnapshot|null
}
LlmPricingSnapshot { sourceModel, currency, inputPerMillion, outputPerMillion,
                     thinkingPerMillion, cachedPerMillion, embedPerMillionChars, pricedOn }
```

**`enum` vs `pattern` — ellenőrizve, nem feltételezve.** A `GlobalExceptionHandler`
(`techcore/exception/GlobalExceptionHandler.java`) **nem** kezel
`MethodArgumentTypeMismatchException`-t, és nem is `ResponseEntityExceptionHandler`-leszármazott:
egy érvénytelen enum query-paraméter (`?period=FOO`) a `@ExceptionHandler(Exception.class)` ágra
esne, azaz **500 `INTERNAL_ERROR`** — pont az a hibamód, amitől az `api_contract_conventions.md`
óv. Ezért:

- **Query-paraméterek** (`period`, `status`, `callKind`) → **`pattern`**-nel validált `string`
  (`^(DAY|WEEK|MONTH)$` stb.), a service parse-olja enummá. Érvénytelen érték ⇒ bean validation ⇒
  **400 `VALIDATION_INVALID_VALUE`**, a ház szabálya szerint.
- **Válasz-mezők** (`callKind`, `status` a DTO-kon) → maradhatnak **`enum`**: ezeket a szerver
  állítja elő, sosem konvertálódnak bejövő adatból, és így a FE generált típusa is szűk unió lesz.

A hiányzó `MethodArgumentTypeMismatchException`-kezelő önmagában valós, de ezen a feature-ön kívüli
hiányosság (bármely enum/UUID/szám query-paraméter 500-zik tőle) — külön bd-ben (mezo-x0nb) van rögzítve, nem
ennek a körnek a hatóköre.

## 6. Frontend

Réteg-szabályok szerint (`docs/references/frontend_conventions.md` — implementáció előtt kötelező olvasmány).

**`data/` (a FE↔BE határ):**
- `data/me/llmUsageApi.ts` — `getBreakdown(period)`, `listCalls(params)`, `getCall(id)` a meglévő `getSummary` mellé.
- `data/me/llmUsageHooks.ts` — `useLlmUsageBreakdown(period)`, `useLlmCalls(period, filters)`, `useLlmCall(id)`. Mind `useDualQuery`; a mock-mód kap egy hihető seedet (`LLM_BREAKDOWN_MOCK`, `LLM_CALLS_MOCK` — ~12 sor a valós feature-slugokból, benne 1 ERROR és 1 CANCELLED, plusz 1 árazatlan), a real-mód `realEmpty`-je **üres lista / nulla totals null költséggel** — a seed sosem szivárog át.
- A lapozás a hívó oldal `useState<number>` `limit`-je, ami a `queryKey` része — egy lekérdezés, nulla akkumuláció (§2.5).
- `data/hooks.ts` barrel: a három új hook re-exportja.

**`features/me/`:**
- `pages/AiUsagePage.tsx` — a periódus- és szűrő-state gazdája, összerakja a részeket.
- `pages/AiCallDetailPage.tsx` — `useParams` → `useLlmCall`.
- `components/AiUsageHero.tsx` — a korall hero (két szám + státusz-bontás + árazatlan-lábjegyzet).
- `components/AiFeatureBreakdown.tsx` — a sávlista (top 8 + „Mind" kinyitó), koppintás → `onSelect(feature)`.
- `components/AiModelBreakdown.tsx` — a modell-kockák.
- `components/AiCallRow.tsx` — egy lista-sor (kétsoros kártya, státusz-él, kind-badge).
- `components/AiCallFilters.tsx` — a szűrőchip-sor.
- `components/AiTokenBar.tsx` — a négyszínű token-csík + legenda (részletoldal).
- `components/AiPayloadBlock.tsx` — cím + karakterszám + Másolás + a sötét monospace blokk.
- `logic/llmCallFormat.ts` — **pure**, tesztelt: `formatTokens`, `formatLatency`, `formatCallCost` (null ⇒ `—`, újrahasznosítva a meglévő `formatUsageCost` szabályát), `callKindLabel`, `statusTone`, `tokenSegments(detail)` (a sáv százalékai).

**Belépő:** az `AiUsageCard` kap egy `<Link to="/me/ai-usage">` burkot + egy `›` affordanciát. A kártya belső szerkezete és a `formatUsageCost` nem változik (a `me.md`-ben leírt viselkedés marad).

**Router:** `{ path: 'me/ai-usage', element: <AiUsagePage /> }` és `{ path: 'me/ai-usage/:id', element: <AiCallDetailPage /> }` — **testvér útvonalak** a `me` csoport mellett (nem gyerekei), a `me/routines/edit` idióma szerint, hogy ne kapjanak Me-alnav-krómot.

**Design-tokenek:** a mockup hardkódolt hexei helyett a meglévő CSS-változók (`--wash-*`, `--sage-deep`, `--text-tertiary`, a `.card` / `.biocard` / `.eyebrow` osztályok). Új globális CSS-osztály nem születik; ami kell, az komponens-lokális inline stílus, ahogy a szomszédos Me-komponensek is csinálják.

## 7. Két invariáns, amit a felület nem ronthat el

Mindkettő ADR 0014-ből jön, és mindkettő **teszttel őrzött** (§9):

1. **A null költség „ismeretlen", nem nulla.** Végig: `costUsd: null` ⇒ `—` a soron, a bontásban és a heróban is. A hero ezért mutatja az `unpricedCount`-ot: az összeg attól becslés, hogy ennyi sor kimaradt belőle.
2. **Nincs owner-szűrés.** A cron- és `CHAT_STREAM`-sorok `created_by`-ja null; ha a lista `created_by = currentUser`-re szűrne, pont a láthatatlan háttér-forgalom tűnne el — az, ami miatt a feature készült. A részletoldal „Hívó" mezője ezért `null` esetén **„háttérfolyamat"**-ot ír, nem üres helyet.

## 8. Hibakezelés

- **Backend:** ismeretlen `id` ⇒ `SystemRuntimeErrorException` + `SystemMessage.error("LLM_LOG_CALL_NOT_FOUND")` (új kulcs a `message.properties`-ben, magyar szöveg), 404. Érvénytelen `period`/`status`/`callKind` ⇒ `pattern`-sértés ⇒ 400 (§5). `limit` a kontraktusban `minimum: 1, maximum: 500`.
- **Ismert szélső eset:** egy **szintaktikailag rossz UUID** a `/calls/{id}` útvonalon a fenti hiányzó
  típus-konverziós kezelő miatt 500-at ad, nem 400-at. A felület sosem állít elő ilyen linket (az
  id-k a lista-válaszból jönnek), ezért ez itt nem kerül megkerülésre — a javítás a külön bd-ben
  rögzített `GlobalExceptionHandler`-bővítés (mezo-x0nb) dolga.
- **Frontend:** a `useDualQuery` meglévő `isPending`/`isError` mintája — a lista üres állapota `GhostState` („Ebben az időszakban nincs naplózott hívás."), a hiba `GhostState` + „Újra" CTA (a `MotorPage` idiómája). A részletoldal 404-re: „Ez a hívás már nem elérhető." + vissza-link.
- A napló **kikapcsolható** (`mezo.feature.llm-log.enabled=false`, ez a lokális default): az endpointok **nem** gated-ek (ahogy a `summary` sem), csak nulla sort adnak vissza. Az oldal így lokálisan is megnyílik, üres állapottal — nem 404-el.

## 9. Tesztelés

**Backend** (`integration_test_framework.md`, `ApiIntegrationTest`, AssertJ, `test{Method}_should{Result}_when{Condition}`):
- `LlmUsageBreakdownIT` — feature/modell-bontás rendezése; `unpricedCount` és a `costUsd = null` üres periódusra; a null `served_model`-es ERROR-sor saját csoportként jelenik meg; **owner nélküli (cron) sor benne van** a bontásban.
- `LlmCallListIT` — periódus-vágás; mind a három szűrő külön-külön és együtt; a növekvő ablak (12 sor: `limit=5` ⇒ 5 elem + `hasMore=true`, `limit=20` ⇒ mind a 12 + `hasMore=false`) és a `createdAt desc` rendezés; **a lista-válasz nem tartalmaz payloadot**.
- `LlmCallDetailIT` — teljes sor visszaolvasása a `pricingSnapshot`-tal együtt; csonkolt payload `truncated=true` + `payloadBytes`; ismeretlen id ⇒ 404 + `LLM_LOG_CALL_NOT_FOUND`; token nélküli árazott sor ⇒ `costUsd = null`.
- Adat: a meglévő `LlmLogPopulator` bővítése (feature/status/kind/időpont paraméterezhetőség). Új tábla nincs ⇒ `ResetDatabase` nem változik.

**Frontend** (vitest, mindkét mód zöld):
- `llmCallFormat.test.ts` — a pure formázók, kiemelten a `null ⇒ —` és a `tokenSegments` (nulla összes token ⇒ nincs osztás nullával).
- `AiUsagePage.test.tsx` — periódusváltás újrakéri a bontást ÉS a listát; feature-sávra koppintva megjelenik a szűrőchip és szűkül a lista; „További hívások" hozzáfűz.
- `AiCallDetailPage.test.tsx` — token-sáv szegmensek, `—` az árazatlan sorra, „háttérfolyamat" a null hívóra, csonkolás-jelzés.
- `AiUsageCard.test.tsx` kiegészítés — a kártya linkel a `/me/ai-usage`-ra (a meglévő asszertek maradnak).

## 10. Docs

- **`docs/features/me.md`** — §5 (`AiUsageCard` mostantól belépő) + új szakasz az `AiUsagePage`/`AiCallDetailPage`-ről; §3 a három új hookkal.
- **`docs/features/companion.md`** — az „LLM call audit log" szakasz read-oldala: a v1 „DB-only, query with SQL" mondat már nem igaz.
- **`docs/features/_platform-api-backend.md`** — a `LlmUsage` sor + az endpoint-tábla három új sorral.
- **ADR nem készül** (§ fejléc). `node scripts/lint-docs.mjs` a végén.

## 11. Nem-cél (ebben a körben)

- **Retention/pruning** — továbbra sincs; a tábla nő. Külön bd (az ADR 0014 „első follow-up"-ja).
- **Az árak reconciliation-je** a valós Gemini-rátákkal — külön munka; az oldal `~ becslés` lábjegyzete pont ezt mondja ki.
- **Napi trend-chart és token-típus bontás a fejlécben** — a tulajdonos a „teljes műszerfal" opciót nem választotta; a token-bontás a *részletoldalon* megvan, periódus-szinten nem.
- **Exportálás / szabad szöveges keresés a promptokban** — később, ha hiányzik.
- **URL-be szinkronizált szűrő-state** — a részletoldal deep-linkelhető, a lista szűrői nem.

## 12. Amit az implementációs tervnek rögzítenie kell

1. A `LlmUsageGroup.key` nullable (a `served_model` null ERROR-soroknál) — az OpenAPI `nullable: true` és a generált FE-típus is `string | null`, a rendezés `nulls last`.
2. A JPQL-projekció konstruktor-kifejezése a generált `api.dto` osztályra **nem** mehet (a generált DTO-k Lombok `@Builder`-esek, konstruktor-szignatúrájuk generátor-függő) — a projekció egy repository-szintű `record`-ba megy (`LlmCallRow`), és a service mappeli DTO-ra.
3. A `report-zone` (`Europe/Budapest`) egyetlen helyen dől el: a service számolja a `from` instantot, a repository már `Instant`-ot kap. A FE nem számol dátumot.
4. A `limit + 1` trükk a `hasMore`-hoz — a plusz sort a service dobja el, nem a controller; a FE `limit`-je 50-esével nő 500-ig, a plafonon magyarázó sorral (§2.5).
5. `AiUsageCard` linkké alakítása nem törheti a meglévő `role="status"` skeleton-ágat.
