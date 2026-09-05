# A nap-oldal visszajelzés-gombjai · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A napi értékelés kapjon visszajelzési hurkot — a `day_review` legyen a hetedik feedback-artifact-fajta, a `DayEvaluationResponse` hordozza a review azonosítóját, és a `DayReviewCard` kapja vissza a 👍/👎 gombokat.

**Architecture:** A `DayReviewEntity`-nek már van sor-id-je; a szerződés csak hallgatott róla. A szelet ezt teszi láthatóvá (ház-precedens: a feed-üzenet, a heti javaslat és a memoár ugyanígy kapott `id`-t), felveszi a hetedik fajtát a szerződés-regexbe és a DB CHECK-be egy csere-migrációval, és a gombokat a `WeekReviewCard` bevált mintája szerint szereli fel.

**Tech Stack:** Java 21 / Spring Boot, OpenAPI contract-first, Liquibase, React + TypeScript, Vitest + RTL, MSW, pnpm 9.

**Spec:** [`docs/superpowers/specs/2026-09-05-day-evaluation-feedback-design.md`](../specs/2026-09-05-day-evaluation-feedback-design.md)
**bd:** `mezo-jcpt.9`

## Global Constraints

- **Az artifact-azonosító a saját tábla sor-id-je, UUID.** Mind a hat mai fajta így működik; a szerződés `artifactId`-je `format: uuid`, tehát természetes kulcs nem is ábrázolható.
- **Nincs gomb artifact nélkül.** Nincs próza → nincs `reviewId` → nincs gomb-sor (nem üres gomb-sor).
- **Contract-drift kapu:** `api/feature/**/*.yml` + regenerált `api/openapi.yml` + regenerált `frontend/src/data/_client/api.gen.ts` **EGY commitban**. Regen: `cd api/generate && npm run generate:api`, majd `cd frontend && pnpm generate:api`.
- **A fajta-„enum" REGEX**, három helyen a szerződésben (`:16` GET query, `:84` DELETE path, `:109` PUT body) plusz a prózai felsorolás `:121` — mind a négy helyet frissíteni kell.
- **A DB-oldal CHECK-csere migráció**, nem új oszlop. Sablon: `202608271500_mezo-p2tr_feedback_weekly_review_kind.sql`.
- **FE tesztek KÉT módban, explicit env-vel** (`VITE_USE_MOCK=true` és `=false`). A `mezo-kr9v` hiba pontosan a „csak mock módban jelenik meg" aszimmetria volt — a MSW-handlernek is meg kell kapnia az új mezőt.
- **Fókuszált backend teszt `-Dmezo.test.use-testcontainers=true`-val**, `ArchitectureTest` külön.
- **A `FeedbackLearningService.SURFACE_KINDS`-hoz NE nyúlj** — a rollup-bővítés szándékosan külön szelet (`mezo-jcpt.17`, spec D3).
- Nincs snapshot-teszt; RTL + `data-testid` + osztály-szelektor. Mozaik 2.0; clay ikonok, soha emoji.
- Commit-tárgy hordozza a `(mezo-jcpt.9)`-et és a `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailert.
- **NE pusholj, NE nyiss PR-t, NE mergelj.** Branch: `feat/day-evaluation-feedback`.

---

### Task 1: A hetedik fajta és a `reviewId` a szerződésen + backend

**Files:**
- Modify: `api/feature/companion-feedback/companion-feedback.yml:16, 84, 109, 121`
- Modify: `api/feature/me-week/me-week.yml:199` (`DayEvaluationResponse`)
- Modify: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` (generált)
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/<YYYYMMDDHHmm>_mezo-jcpt.9_feedback_day_review_kind.sql`
- Modify: `backend/.../companion/feedback/entity/MessageFeedbackEntity.java:40-45, 67` (+ a „öt fajta öt táblán" javadoc, ami már ma is elavult — ma hat)
- Modify: `backend/.../companion/service/DayReviewService.java` (`prose` visszatérési alakja + a válasz-építés)
- Test: `DayEvaluationApiIT`, `CompanionFeedbackApiIT`, `MessageFeedbackPersistenceIT`, `DayReviewServiceTest`

**Interfaces:**
- Produces: `DayEvaluationResponse.reviewId` — `{type: string, format: uuid, nullable: true}`; **csak prózás napon** van jelen.
- Produces: `day_review` mint hetedik `FeedbackArtifactKind` érték.

- [ ] **Step 1: Írd meg a bukó backend teszteket**

`DayEvaluationApiIT`-ben:

```java
@Test
void scoredDay_carriesTheReviewId_soTheUserHasSomethingToVoteOn() {
    // A ház mintája: az artifact a SAJÁT sor-id-jét adja (feed-üzenet, heti javaslat,
    // memoár mind így kapott id-t a szerződésre). Enélkül a FE-nek nincs mire szavaznia.
    var res = getDayEvaluation(userId, scoredDate);
    assertThat(res.getReviewId()).isNotNull();
}

@Test
void aDayWithoutProse_carriesNoReviewId_soNoChipsCanAppear() {
    var res = getDayEvaluation(userId, thinDate);
    assertThat(res.getReviewId()).isNull();
}
```

`CompanionFeedbackApiIT`-ben: a `day_review` fajta **elfogadva**, és egy kitalált fajta
(pl. `not_a_kind`) továbbra is **elutasítva** — ez utóbbi a bizonyíték, hogy a CHECK nem lazult.

- [ ] **Step 2: Futtasd — bukjanak.**

- [ ] **Step 3: Szerződés — a fajta-regex mind a HÁROM helyen**

`companion-feedback.yml` `:16`, `:84`, `:109`: a mintába vedd fel a `|day_review`-t. A `:121`-es
prózai felsorolást is egészítsd ki. **Mind a négyet**, különben a GET és a PUT eltérő halmazt
enged — pontosan az a fajta csendes eltérés, amit ez az epic egész éjjel irtott.

`me-week.yml` a `DayEvaluationResponse`-ban:

```yaml
        reviewId:
          type: string
          format: uuid
          nullable: true
          description: >-
            A naphoz tartozó LLM-próza (day_review) sor-azonosítója — a visszajelzés-gombok
            artifact-id-je (mezo-jcpt.9). CSAK prózás (pontozott) napon van jelen: nincs próza
            → nincs id → nincs gomb, mert artifact nélkül nincs mire szavazni.
```

- [ ] **Step 4: Regeneráld a contractot**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

- [ ] **Step 5: CHECK-csere migráció**

**Olvasd el a precedenst** (`202608271500_mezo-p2tr_feedback_weekly_review_kind.sql`) és kövesd a
formáját, a changelog-beillesztést is. A changeset kommentje mondja ki, hogy ez a hetedik fajta,
és hogy adatmigráció nincs (a meglévő sorokat egy bővített CHECK nem érinti).

- [ ] **Step 6: Entitás + `DayReviewService`**

`MessageFeedbackEntity`: új `KIND_DAY_REVIEW` konstans, és a `@Pattern` mirror bővítése. A
javadoc „öt fajta öt táblán" állítása **már ma is elavult** (hat van) — igazítsd hétre.

`DayReviewService`: a `prose(...)` ma csak a `DayReviewJson` envelope-ot adja vissza, az entitás
id-jét nem. Vezesd ki az id-t is (a legkisebb változtatással — pl. egy kis rekord-visszatérés),
és a válasz-építésnél tedd rá a `reviewId`-t. **Prózátlan napon `null`.**

- [ ] **Step 7: Futtasd**

```bash
cd backend && ./mvnw -q test -Dtest='DayEvaluationApiIT,CompanionFeedbackApiIT,MessageFeedbackPersistenceIT,DayReviewServiceTest,DayReviewRepositoryIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
cd .. && node scripts/lint-liquibase.mjs && node scripts/gen-codemap.mjs --check
```

- [ ] **Step 8: Commit** — `feat(companion): day_review a hetedik feedback-fajta + reviewId a napi válaszon (mezo-jcpt.9)`

---

### Task 2: A gombok vissza a nap-oldalra

**Files:**
- Modify: `frontend/src/data/feedback/feedbackTypes.ts:5-11` (a `FeedbackArtifactKind` unió)
- Modify: `frontend/src/data/me/dayEvaluation.ts` (a normalizált alak + a mock fixture-ök)
- Modify: `frontend/src/features/me/components/week/DayReviewCard.tsx`
- Modify: `frontend/src/test/msw/handlers.ts:1544` (a real-módú nap-válasz)
- Modify: `frontend/src/features/me/logic/weekDay.ts` (a `DAY_COPY.noNote`/`noReview` árvaság)
- Test: `WeekDayPage.test.tsx`

**Interfaces:**
- Consumes: `DayEvaluationResponse.reviewId` (Task 1), `day_review` mint fajta.

- [ ] **Step 1: Írd meg a bukó FE teszteket**

`WeekDayPage.test.tsx` — a fájlnak **már van** mock- és real-módú blokkja; mindkettőbe:

```tsx
it('pontozott napon megjelennek a visszajelzés-gombok', async () => {
  renderDayPage(SCORED_DATE)
  expect(await screen.findByRole('button', { name: /hasznos volt/i })).toBeInTheDocument()
})

it('próza nélküli napon NINCS gomb — artifact nélkül nincs mire szavazni', async () => {
  renderDayPage(THIN_DATE)
  expect(screen.queryByRole('button', { name: /hasznos volt/i })).not.toBeInTheDocument()
})
```

A pontos elérhetőségi nevet a `FeedbackChips` meglévő implementációjából és a `WeekReviewCard`
tesztjéből vedd — **ne találd ki**.

- [ ] **Step 2: Futtasd — bukjanak.**

- [ ] **Step 3: Vezesd át a típust és a mockot**

`feedbackTypes.ts`: az unió kap egy `'day_review'` tagot. `dayEvaluation.ts`: a normalizált alak
kapja a `reviewId`-t, és a **pontozott** mock fixture kapjon **stabil, kitalált UUID-t** (a
mock-feedback seed szándékosan üres, ezért a gombok mock módban a query-cache-ből élnek — ehhez
kell egy nem változó id). A prózátlan fixture-ök `reviewId`-je maradjon hiányzó.

`handlers.ts:1544`: a real-módú válasz is kapja meg a mezőt, különben a real-módú teszt id
nélküli válaszra assertálna.

- [ ] **Step 4: Szereld fel a gombokat**

`DayReviewCard`-ban, a `WeekReviewCard.tsx:27` mintája szerint:

```tsx
const { value, vote } = useFeedback('day_review', evaluation.reviewId ? [evaluation.reviewId] : [])
```

és a `children` slot mellé a `FeedbackChips` — a chat-átadó gomb marad. `reviewId` nélkül
**semmit** ne rendereljen.

- [ ] **Step 5: A `DAY_COPY.noNote` / `noReview` árvasága**

Nézd meg **tényadatként**, van-e ma fogyasztójuk. Ha nincs, és a felület nem is mutat olyan
esetet, amiben szerepelnének → **töröld** őket. Ha a gombok visszatérésével értelmet nyernek →
kösd be. A jelentésben írd le, melyiket találtad, és mit tettél.

- [ ] **Step 6: Futtasd mindkét módban**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

- [ ] **Step 7: Futásidejű ellenőrzés a `verify` skillel** — mock módban nyiss meg egy pontozott
nap-oldalt, szavazz, és nézd meg, hogy a jelölés megmarad (optimista írás) és a lenyomott
állapot visszatöltődik. Egy `thin` napon győződj meg róla, hogy **nincs** gomb-sor. Írd le, mit láttál.

- [ ] **Step 8: Commit** — `feat(me): visszajelzés-gombok a nap-oldalon (mezo-jcpt.9)`

---

### Task 3: Doksik + a felderítés által talált három elavulás

**Files:** `docs/features/companion.md`, `docs/features/me.md`, `docs/CODEMAP.md`

- [ ] **Step 1: `companion.md` — a szelet által érintett HÁROM elavult hely**

A felderítés találta, mind a visszajelzés-fajtákról szól, tehát ez a szelet a helyük:

1. **§5.7 táblázata öt fajtát sorol**, a `weekly_review` hiányzik belőle — pedig a `mezo-p2tr`
   óta él, benne van a regexben, az entitásban és a CHECK-ben. Vedd fel, **és** vedd fel az új
   `day_review`-t is → hét.
2. A **„Backend tables (W4.1 feedback)"** szakasz „öt fajta öt táblán"-t ír; a valóság ma hat,
   ezzel a szelettel hét.
3. A **§10 fájllistából hiányzik** a `202608271500_mezo-p2tr_feedback_weekly_review_kind.sql` —
   vedd fel, az újjal együtt.

Emellett írd le a spec **D2** vállalt korlátját (a szavazat túléli a próza újragenerálását, mert
az `upsert` helyben ír) és a **D3** halasztást (`mezo-jcpt.17`: a `weekly_review` **és** a
`day_review` szavazatai egyelőre nem folynak a tanuló-rollupba).

- [ ] **Step 2: `me.md` — „Day page"** a visszajelzési affordanciával; és ha a Task 2 törölte a
`DAY_COPY.noNote`/`noReview`-t, az is vezetődjön át.

- [ ] **Step 3: CODEMAP-regen** — `node scripts/gen-codemap.mjs` (ne kézzel).

- [ ] **Step 4: Teljes helyi kapu-sor**

```bash
node scripts/gen-codemap.mjs --check && node scripts/lint-liquibase.mjs
cd backend && ./mvnw -q test -Dtest='DayEvaluationApiIT,CompanionFeedbackApiIT,MessageFeedbackPersistenceIT,DayReviewServiceTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true
cd ../frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

**Ismert, NEM hozzánk tartozó bukások** (ne javítsd, ne engedd blokkolni):
`data/fuel/timelineHooks.test.tsx` (`mezo-a89u`, PR #446) és `HybridMemoryRetrieverIT`
(`mezo-bjxt`) — mindkettő a `main`-ről öröklött.

- [ ] **Step 5: Commit** — `docs: nap-oldali visszajelzés + a fajta-lista elavulásai (mezo-jcpt.9)`

## Self-Review

**Spec-lefedettség.** D1 (sor-id, opcionális mező) → Task 1 Step 3/6. D2 (vállalt korlát) →
Task 3 Step 1. D3 (rollup halasztva) → Global Constraints + Task 3 Step 1. D4 (csak prózás
napon) → Task 1 Step 1 második tesztje + Task 2 Step 1/4. Doksi-elavulások → Task 3 Step 1.

**Placeholder-ellenőrzés.** Két helyen adok „olvasd ki, ne találd ki" utasítást (a gombok
elérhetőségi neve, a precedens-migráció formája) — ezek konkrét forrásmegjelölések, mert a
pontos szöveget a meglévő kód határozza meg, és kitalálni félrevezető lenne.

**Típus-konzisztencia.** A `reviewId` név azonos a szerződésben (Task 1 Step 3), a
normalizált FE-alakban és a hook-hívásban (Task 2 Step 3/4). A fajta-literál `day_review`
azonos a regexben, a DB CHECK-ben, az entitás-konstansban és a FE unióban.
