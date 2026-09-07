# Karakter · Konzílium UX újratervezés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Konzílium oldal döntés-első felületté alakítása: megszűnik a lista-oldal és a dupla visszalépés, a lap tetején kontextus és a négy kör valódi számokkal jelenik meg, a kereszt-vita láthatóvá válik, a lánc orb-okat kap pöttyök helyett, és egy `Áttekintés / Beszélgetés` váltó adja a kronologikus kör-nézetet.

**Architecture:** A `KonziliumPage` egyetlen route marad (`me/karakter/konzilium`), de a `?id=` hiánya mostantól a legutóbbi tanácskozást nyitja, nem listát. A lap egy fejléc-léptetőből, három rétegből (Mi ez → Hogyan zajlott → Mi változott → A vita) és egy alulról felcsúszó archívum-lapból áll. Az összes kör-szám egyetlen tiszta függvényből (`deliberationStats`) származik, hogy a kör-térkép és a beszélgetés-nézet sose mondjon mást. Két additív contract-mező (`CharacterConferenceSummary.outcome`, `CharacterConferenceResponse.deliberationSource`) teszi lehetővé az archívum-sorok kimenetét és a „nem volt ilyen kör" őszinte megkülönböztetését.

**Tech Stack:** Spring Boot 4 / Hibernate 7 (backend), OpenAPI 3 fragment + generator, React 19 + TanStack Query + react-router-dom (frontend), vitest + React Testing Library, JUnit 5 + Testcontainers.

**Spec:** `docs/superpowers/specs/2026-09-07-karakter-konzilium-ux-ujratervezes-design.md`
**Driving bd:** mezo-sp9w

## Global Constraints

- **Őszinteség.** Minden szám és szó, ami megjelenik, az legyen, amit a kód kiszámolt vagy a modell ténylegesen mondott. Egy kör, ami nem hozott semmit, úgy jelenjen meg, hogy nem hozott semmit. Soha nincs kitalált verdikt, döntés vagy szám.
- **Bizonyosság csak szó.** A `chair.confidence` kizárólag `confidenceWord()`-ön keresztül jelenhet meg (`biztos` / `valószínű` / `figyeljük`), sosem nyers szám.
- **Nulla ≠ nem létezett.** Ha a `deliberationSource === 'DERIVED'`, a kereszt-vita kör szövege `nem volt ilyen kör`, nem `0 hozzászólás`.
- **Nem vonjuk össze a forrásokat.** A `changes[]` a „Mi változott a dossziédban" forrása; a `deliberation` a kör-térkép és a szálak forrása. Egyiket sem számoljuk a másikból.
- **Mozaik 2.0 designnyelv.** Színmosásos csempék, két rétegű árnyék, clay orb-ok. Soha nem emoji ikonként. Meglévő `.kr-*` / `.mz-*` osztályokból építkezünk.
- **Egyetlen visszalépés.** A részletnézeten pontosan egy visszalépő vezérlő létezhet (`PageHead`). Az archívum és a nézetváltó nem route.
- **Contract-változás egy commitban:** `api/feature/character/character.yml` + `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`.
- **Soha ne stage-eld a gyökér `issues.jsonl`-t**, és soha ne nyúlj a `backend/src/test/resources/archunit-store/` fájlokhoz.
- **Soha ne futtass két `mvnw` buildet egyszerre.**
- Backend fókuszált kapu: `cd backend && ./mvnw test -Dtest='*Character*,DetectorTest,Konzilium*,ClaimLifecycleIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
- Frontend teljes kapu **két módban**: `cd frontend && CI=true pnpm test` és `cd frontend && CI=true VITE_USE_MOCK=false pnpm test`, majd `cd frontend && pnpm build`.
- Frontend fókuszált futtatás egy fájlra: `cd frontend && CI=true pnpm exec vitest run <útvonal>` (a `pnpm test -- <fájl>` NEM szűkít ebben a repóban).

---

## File Structure

**Contract**
- `api/feature/character/character.yml` — `ConferenceOutcomeCounts` séma; `CharacterConferenceSummary.outcome`; `CharacterConferenceResponse.deliberationSource`.
- `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` — generált, ugyanabban a commitban.

**Backend**
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterConferenceRepository.java` — `Summary` projekció `getOutcome()`-mal.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java` — `conferences()` kimenet-számlálás; `conference()` `deliberationSource`.
- `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterConferenceListIT.java` — új IT.

**Frontend — új fájlok**
- `frontend/src/features/character/deliberationStats.ts` — tiszta függvény: a négy kör számai.
- `frontend/src/features/character/deliberationStats.test.ts`
- `frontend/src/features/character/components/KonziliumRoundMap.tsx` — „Hogyan zajlott" kártya.
- `frontend/src/features/character/components/KonziliumRoundMap.test.tsx`
- `frontend/src/features/character/components/ConferenceArchiveSheet.tsx` — archívum lap.
- `frontend/src/features/character/components/ConferenceArchiveSheet.test.tsx`
- `frontend/src/features/character/components/KonziliumConversationView.tsx` — Beszélgetés nézet.
- `frontend/src/features/character/components/KonziliumConversationView.test.tsx`

**Frontend — módosuló fájlok**
- `frontend/src/features/character/components/ConferenceThreadCard.tsx` (+ teszt) — orb-lánc, állásfoglalás-chipek, beszédes fejléc.
- `frontend/src/features/character/pages/KonziliumPage.tsx` (+ teszt) — léptető, rétegek, váltó; a lista-ág törlése.
- `frontend/src/features/character/character.css` — új `.kr-*` osztályok.
- `frontend/src/data/character/characterApi.ts` — új típus-exportok.
- `frontend/src/data/character/characterMock.ts` — dúsított fixtúrák.

**Dokumentáció**
- `docs/features/character.md`, `docs/CODEMAP.md`.

---

## Task 1: Contract — kimenet-számok és a szál forrása

**Files:**
- Modify: `api/feature/character/character.yml`
- Modify (generált): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `frontend/src/data/character/characterApi.ts`

**Interfaces:**
- Consumes: semmi (ez az első task).
- Produces: `ConferenceOutcomeCounts { accepted: number; retired: number; portraitRewritten: number; other: number }` séma; `CharacterConferenceSummary.outcome: ConferenceOutcomeCounts` (kötelező); `CharacterConferenceResponse.deliberationSource: 'STORED' | 'DERIVED' | null`. TS-oldalon exportált típusnév: `ConferenceOutcomeCounts`.

- [ ] **Step 1: Vedd fel a `ConferenceOutcomeCounts` sémát**

A `api/feature/character/character.yml` `components.schemas` blokkjában, közvetlenül a `CharacterConferenceSummary:` bejegyzés ELÉ szúrd be:

```yaml
    ConferenceOutcomeCounts:
      description: >-
        What one konzílium changed in the dossier, counted from its stored outcome envelope.
        `other` exists so the surface never implies these three kinds are the whole truth — it
        counts every change kind that is not one of the named three.
      type: object
      required: [accepted, retired, portraitRewritten, other]
      properties:
        accepted: { type: integer, format: int32 }
        retired: { type: integer, format: int32 }
        portraitRewritten: { type: integer, format: int32 }
        other: { type: integer, format: int32 }
```

- [ ] **Step 2: Kösd rá a `CharacterConferenceSummary`-t**

Ugyanebben a fájlban a `CharacterConferenceSummary:` blokkot írd át erre (a meglévő négy property megmarad, a `required` bővül, és jön az `outcome`):

```yaml
    CharacterConferenceSummary:
      type: object
      required: [id, kind, generatedAt, outcome]
      properties:
        id: { type: string, format: uuid }
        kind: { type: string, enum: [BOOTSTRAP, WEEKLY, MONTHLY] }
        weekStart: { type: string, format: date, nullable: true }
        generatedAt: { type: string, format: date-time }
        outcome: { $ref: '#/components/schemas/ConferenceOutcomeCounts' }
```

- [ ] **Step 3: Vedd fel a `deliberationSource` mezőt**

A `CharacterConferenceResponse:` blokkban, a `deliberation:` property UTÁN, a `changes:` property ELÉ szúrd be:

```yaml
        deliberationSource:
          description: >-
            Where `deliberation` came from. STORED — the row carries the structured envelope its
            own konzílium wrote. DERIVED — the row predates the column and the threads were read
            back out of the prose transcript, so rounds that did not exist yet (cross-talk) must
            be shown as absent, never as zero. Null when there is no deliberation at all.
          type: string
          enum: [STORED, DERIVED]
          nullable: true
```

- [ ] **Step 4: Generáld újra a szerződést**

Fuss:

```bash
cd backend && ./mvnw -q generate-sources
```

Ez frissíti az `api/openapi.yml`-t és a generált Java DTO-kat. Utána a frontend kliens:

```bash
cd frontend && pnpm gen:api
```

Ha a `gen:api` script nem létezik, nézd meg a `frontend/package.json` scriptjeit és futtasd azt, ami az `api.gen.ts`-t állítja elő. Ellenőrizd, hogy az `api.gen.ts`-ben megjelent a `ConferenceOutcomeCounts` és a `deliberationSource`:

```bash
grep -n "ConferenceOutcomeCounts\|deliberationSource" frontend/src/data/_client/api.gen.ts
```

- [ ] **Step 5: Exportáld a TS típust**

A `frontend/src/data/character/characterApi.ts`-ben, a meglévő `ConferencePeerReaction` export mellé:

```ts
export type ConferenceOutcomeCounts = components['schemas']['ConferenceOutcomeCounts']
```

- [ ] **Step 6: Fordítsd le mindkét oldalt**

```bash
cd backend && ./mvnw -q test-compile
```

Várható: sikeres fordítás. A `CharacterConferenceSummary` builder mostantól `outcome(...)`-ot is elfogad; a hívóhely (`CharacterService.conferences()`) MÉG NEM adja meg — ez rendben van, a builder nem kötelezi ki fordításidőben. A frontend oldalon:

```bash
cd frontend && pnpm build
```

Várható: sikeres build (a `CharacterConferenceSummary` mock objektumok még nem hordoznak `outcome`-ot → **TS hiba lesz** a `characterMock.ts`-ben). Ha jön a hiba, add hozzá ideiglenesen minden `MOCK_CONFERENCES` elemhez a `outcome: { accepted: 0, retired: 0, portraitRewritten: 0, other: 0 }` mezőt — a Task 3 úgyis valódi értékekre cseréli.

- [ ] **Step 7: Commit**

```bash
git add api/feature/character/character.yml api/openapi.yml frontend/src/data/_client/api.gen.ts frontend/src/data/character/characterApi.ts frontend/src/data/character/characterMock.ts
git commit -m "feat(api): konzílium lista-kimenet és szál-forrás mezők (mezo-sp9w)"
```

---

## Task 2: Backend — kimenet-számok a listában, forrás a részletben

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterConferenceRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterConferenceListIT.java` (új)

**Interfaces:**
- Consumes: a Task 1 generált DTO-i — `ConferenceOutcomeCounts` (Lombok builder: `.accepted(int).retired(int).portraitRewritten(int).other(int)`), `CharacterConferenceSummary.builder().outcome(...)`, `CharacterConferenceResponse.builder().deliberationSource(CharacterConferenceResponse.DeliberationSourceEnum.STORED)`.
- Produces: a `GET /api/character/conference` válasz minden eleme hordoz `outcome`-ot; a `GET /api/character/conference/{id}` válasz hordoz `deliberationSource`-t.

- [ ] **Step 1: Írd meg a bukó integrációs tesztet**

Hozd létre: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterConferenceListIT.java`

Nézd meg egy meglévő Karakter IT fejlécét mintaként (`backend/src/test/java/io/mrkuhne/mezo/feature/character/` alatt bármelyik `*IT.java`), és vedd át tőle az osztály-annotációkat, a `ResetDatabase` használatát és a demo-owner feloldás módját — ne találj ki új teszt-infrastruktúrát. A teszt-törzs:

```java
    @Test
    void conferenceList_countsOutcomeKinds() {
        UUID owner = ownerId();
        conferenceRepository.save(CharacterConferenceEntity.builder()
                .kind("WEEKLY")
                .weekStart(LocalDate.of(2026, 8, 24))
                .transcript(new ConferenceTranscriptEnvelope(List.of()))
                .outcome(new ConferenceOutcomeEnvelope(List.of(
                        new ConferenceOutcomeEnvelope.Change("CLAIM_ACCEPTED", "physical", null, "a"),
                        new ConferenceOutcomeEnvelope.Change("CLAIM_ACCEPTED", "mental", null, "b"),
                        new ConferenceOutcomeEnvelope.Change("CLAIM_RETIRED", "nutrition", null, "c"),
                        new ConferenceOutcomeEnvelope.Change("PORTRAIT_REWRITTEN", null, null, "d"),
                        new ConferenceOutcomeEnvelope.Change("CHAPTER_OPENED", "recovery", null, "e"))))
                .generatedAt(Instant.parse("2026-08-30T07:00:00Z"))
                .createdBy(owner)
                .build());

        List<CharacterConferenceSummary> list = characterService.conferences(owner);

        assertThat(list).hasSize(1);
        ConferenceOutcomeCounts counts = list.get(0).getOutcome();
        assertThat(counts.getAccepted()).isEqualTo(2);
        assertThat(counts.getRetired()).isEqualTo(1);
        assertThat(counts.getPortraitRewritten()).isEqualTo(1);
        assertThat(counts.getOther()).isEqualTo(1);
    }

    @Test
    void conferenceDetail_reportsStoredSource_whenTheColumnIsFilled() {
        UUID owner = ownerId();
        CharacterConferenceEntity saved = conferenceRepository.save(CharacterConferenceEntity.builder()
                .kind("WEEKLY")
                .weekStart(LocalDate.of(2026, 8, 24))
                .transcript(new ConferenceTranscriptEnvelope(List.of()))
                .outcome(new ConferenceOutcomeEnvelope(List.of()))
                .deliberation(new ConferenceDeliberationEnvelope(List.of(
                        new ConferenceDeliberationEnvelope.Thread("physical", "Fizikai", List.of()))))
                .generatedAt(Instant.parse("2026-08-30T07:00:00Z"))
                .createdBy(owner)
                .build());

        CharacterConferenceResponse response = characterService.conference(owner, saved.getId());

        assertThat(response.getDeliberationSource())
                .isEqualTo(CharacterConferenceResponse.DeliberationSourceEnum.STORED);
    }

    @Test
    void conferenceDetail_reportsDerivedSource_whenTheColumnIsNull() {
        UUID owner = ownerId();
        CharacterConferenceEntity saved = conferenceRepository.save(CharacterConferenceEntity.builder()
                .kind("WEEKLY")
                .weekStart(LocalDate.of(2026, 8, 17))
                .transcript(new ConferenceTranscriptEnvelope(List.of(
                        new ConferenceTranscriptEnvelope.Turn("doki", "Doki: 1 javaslat\n[1] A testzsír-trend rekompozícióra utal.", List.of()))))
                .outcome(new ConferenceOutcomeEnvelope(List.of()))
                .generatedAt(Instant.parse("2026-08-23T07:00:00Z"))
                .createdBy(owner)
                .build());

        CharacterConferenceResponse response = characterService.conference(owner, saved.getId());

        assertThat(response.getDeliberationSource())
                .isEqualTo(CharacterConferenceResponse.DeliberationSourceEnum.DERIVED);
        assertThat(response.getDeliberation()).isNotNull();
    }
```

> **Megjegyzés az implementernek:** a `ConferenceTranscriptEnvelope.Turn` és a `ConferenceDeliberationEnvelope.Thread` pontos konstruktor-aritását olvasd ki a rekordokból (`backend/.../character/entity/`), és igazítsd a hívásokat ahhoz. A harmadik teszt tranzskript-szövege azért ilyen alakú, mert a `LegacyTranscriptParser` a `^.*: (\d+) javaslat\b` fejlécből bizonyítja a darabszámot — ha a parser mégis `null`-t adna vissza erre a bemenetre, olvasd el a `LegacyTranscriptParser`-t és igazítsd a fixtúrát ahhoz, amit ténylegesen elfogad. A teszt lényege a forrás-jelölés, nem a parser újratesztelése.

- [ ] **Step 2: Futtasd, hogy bukjon**

```bash
cd backend && ./mvnw test -Dtest='CharacterConferenceListIT' -Dmezo.test.use-testcontainers=true
```

Várható: fordítási hiba (`getOutcome()` / `getDeliberationSource()` nem létezik a DTO-n VAGY mindig `null`).

- [ ] **Step 3: Vedd fel az `outcome`-ot a projekcióba**

A `CharacterConferenceRepository.Summary` interfészbe (`:31-39`) vedd fel:

```java
        ConferenceOutcomeEnvelope getOutcome();
```

Szükséges import: `io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope`.

> A `transcript` és a `deliberation` szándékosan NEM kerül a projekcióba — a lista továbbra sem tölti be a nagy jsonb oszlopokat.

- [ ] **Step 4: Számolj a service-ben**

A `CharacterService`-ben vedd fel ezt a privát statikus segédfüggvényt a `conferences()` metódus MÖGÉ:

```java
    private static final String CHANGE_ACCEPTED = "CLAIM_ACCEPTED";
    private static final String CHANGE_RETIRED = "CLAIM_RETIRED";
    private static final String CHANGE_PORTRAIT = "PORTRAIT_REWRITTEN";

    /** The dossier effect of one konzílium, counted from its stored change list. `other` keeps the
     *  surface honest: the three named kinds are not the whole set a konzílium can emit. */
    private static ConferenceOutcomeCounts outcomeCounts(ConferenceOutcomeEnvelope outcome) {
        List<ConferenceOutcomeEnvelope.Change> changes =
                outcome == null || outcome.changes() == null ? List.of() : outcome.changes();
        int accepted = 0;
        int retired = 0;
        int portrait = 0;
        int other = 0;
        for (ConferenceOutcomeEnvelope.Change change : changes) {
            switch (change.kind() == null ? "" : change.kind()) {
                case CHANGE_ACCEPTED -> accepted++;
                case CHANGE_RETIRED -> retired++;
                case CHANGE_PORTRAIT -> portrait++;
                default -> other++;
            }
        }
        return ConferenceOutcomeCounts.builder()
                .accepted(accepted)
                .retired(retired)
                .portraitRewritten(portrait)
                .other(other)
                .build();
    }
```

Majd a `conferences()` mapperében (`:254-260`) egészítsd ki a buildert:

```java
                        .generatedAt(toOffset(summary.getGeneratedAt()))
                        .outcome(outcomeCounts(summary.getOutcome()))
                        .build())
```

Importok: `io.mrkuhne.mezo.api.dto.ConferenceOutcomeCounts`, `io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope`.

- [ ] **Step 5: Jelöld a szál forrását**

A `CharacterService.conference()`-ben a `:284-289` blokkot írd át erre:

```java
        boolean stored = conf.getDeliberation() != null;
        ConferenceDeliberationEnvelope deliberation = stored
                ? conf.getDeliberation()
                : LegacyTranscriptParser.parse(conf.getTranscript().turns());
        List<ConferenceThread> threads = deliberation == null ? null : deliberation.threads().stream()
                .map(CharacterService::toThreadDto)
                .toList();
        CharacterConferenceResponse.DeliberationSourceEnum source = threads == null
                ? null
                : stored
                        ? CharacterConferenceResponse.DeliberationSourceEnum.STORED
                        : CharacterConferenceResponse.DeliberationSourceEnum.DERIVED;
```

És a válasz-builderbe (`:296` környéke), a `.deliberation(threads)` UTÁN:

```java
                .deliberationSource(source)
```

> A `source` akkor és csak akkor `null`, ha nincs szál egyáltalán — ezért a `threads == null` az első ág.

- [ ] **Step 6: Futtasd a tesztet**

```bash
cd backend && ./mvnw test -Dtest='CharacterConferenceListIT' -Dmezo.test.use-testcontainers=true
```

Várható: mindhárom teszt zöld.

- [ ] **Step 7: Futtasd a fókuszált kaput**

```bash
cd backend && ./mvnw test -Dtest='*Character*,DetectorTest,Konzilium*,ClaimLifecycleIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Várható: minden zöld. Ha az `ArchitectureTest` a `backend/src/test/resources/archunit-store/` fájljaira panaszkodik, **ne** írd át a store-t — állítsd vissza (`git checkout -- backend/src/test/resources/archunit-store/`) és futtasd újra egyedül.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterConferenceRepository.java backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterConferenceListIT.java
git commit -m "feat(character): kimenet-számok a konzílium-listában, szál-forrás a részletben (mezo-sp9w)"
```

---

## Task 3: A kör-statisztika tiszta függvénye

**Files:**
- Create: `frontend/src/features/character/deliberationStats.ts`
- Test: `frontend/src/features/character/deliberationStats.test.ts`

**Interfaces:**
- Consumes: `ConferenceThread` a `@/data/character/characterApi`-ból.
- Produces:
  ```ts
  export interface DeliberationStats {
    proposals: number
    reactions: number
    skepticVerdicts: number
    accepted: number
    rejected: number
  }
  export function deliberationStats(threads: ConferenceThread[] | null | undefined): DeliberationStats
  ```
  Ezt a Task 5 (`KonziliumRoundMap`) és a Task 8 (`KonziliumPage`) is használja.

- [ ] **Step 1: Írd meg a bukó tesztet**

Hozd létre: `frontend/src/features/character/deliberationStats.test.ts`

```ts
import { describe, expect, test } from 'vitest'
import { deliberationStats } from './deliberationStats'
import type { ConferenceThread } from '@/data/character/characterApi'

const THREADS: ConferenceThread[] = [
  {
    dimensionKey: 'physical',
    title: 'Fizikai',
    items: [
      {
        index: 0, expertKey: 'doki', text: 'a', kind: 'NEW', claimId: null, sensitive: false,
        reactions: [
          { expertKey: 'edzo', stance: 'SUPPORT', argument: 's' },
          { expertKey: 'drill', stance: 'CHALLENGE', argument: 'c' },
        ],
        skeptic: { verdict: 'KEEP', argument: 'k' },
        chair: { accepted: true, confidence: 0.8, reason: 'r' },
      },
      {
        index: 1, expertKey: 'doki', text: 'b', kind: 'NEW', claimId: null, sensitive: false,
        reactions: [],
        skeptic: null,
        chair: { accepted: false, confidence: null, reason: 'r2' },
      },
    ],
  },
  {
    dimensionKey: null,
    title: 'Egyéb javaslatok',
    items: [
      {
        index: 2, expertKey: 'drill', text: 'c', kind: 'NEW', claimId: null, sensitive: false,
        reactions: [{ expertKey: 'doki', stance: 'NUANCE', argument: 'n' }],
        skeptic: { verdict: 'KILL', argument: 'k2' },
        chair: null,
      },
    ],
  },
]

describe('deliberationStats', () => {
  test('counts every round from the threads', () => {
    expect(deliberationStats(THREADS)).toEqual({
      proposals: 3,
      reactions: 3,
      skepticVerdicts: 2,
      accepted: 1,
      rejected: 1,
    })
  })

  test('a missing chair ruling counts as neither accepted nor rejected', () => {
    const stats = deliberationStats(THREADS)
    expect(stats.accepted + stats.rejected).toBe(2)
    expect(stats.proposals).toBe(3)
  })

  test('null and empty input yield all zeros', () => {
    const zero = { proposals: 0, reactions: 0, skepticVerdicts: 0, accepted: 0, rejected: 0 }
    expect(deliberationStats(null)).toEqual(zero)
    expect(deliberationStats([])).toEqual(zero)
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/deliberationStats.test.ts
```

Várható: `Failed to resolve import "./deliberationStats"`.

- [ ] **Step 3: Írd meg a modult**

Hozd létre: `frontend/src/features/character/deliberationStats.ts`

```ts
// ============================================================
// Mezo · Karakter — deliberationStats (mezo-sp9w)
// A konzílium négy körének számai, EGYETLEN forrásból. A kör-térkép és a beszélgetés-nézet
// ugyanezt hívja, hogy a két felület sose mondjon egymásnak ellentmondó számot.
//
// Őszinteség: egy hiányzó elnöki döntés (`chair: null`) sem elfogadottnak, sem elvetettnek nem
// számít — a kör egyszerűen nem adott választ arra az állításra, és a felület ezt így mutatja.
// ============================================================
import type { ConferenceThread } from '@/data/character/characterApi'

export interface DeliberationStats {
  /** Hány felvetés hangzott el összesen. */
  proposals: number
  /** Hány kereszt-vita hozzászólás született összesen. */
  reactions: number
  /** Hány állítást vizsgált meg a Szkeptikus (a válasz nélküliek nem számítanak bele). */
  skepticVerdicts: number
  /** Hány állítást fogadott el Mezo. */
  accepted: number
  /** Hány állítást vetett el Mezo. */
  rejected: number
}

const ZERO: DeliberationStats = {
  proposals: 0, reactions: 0, skepticVerdicts: 0, accepted: 0, rejected: 0,
}

export function deliberationStats(threads: ConferenceThread[] | null | undefined): DeliberationStats {
  if (threads == null || threads.length === 0) return { ...ZERO }
  const stats: DeliberationStats = { ...ZERO }
  for (const thread of threads) {
    for (const item of thread.items) {
      stats.proposals += 1
      stats.reactions += item.reactions.length
      if (item.skeptic != null) stats.skepticVerdicts += 1
      if (item.chair != null) {
        if (item.chair.accepted) stats.accepted += 1
        else stats.rejected += 1
      }
    }
  }
  return stats
}
```

- [ ] **Step 4: Futtasd, hogy zöld legyen**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/deliberationStats.test.ts
```

Várható: 3 teszt zöld.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/character/deliberationStats.ts frontend/src/features/character/deliberationStats.test.ts
git commit -m "feat(character): a konzílium köreinek számait adó tiszta függvény (mezo-sp9w)"
```

---

## Task 4: Mock-fixtúrák dúsítása

**Files:**
- Modify: `frontend/src/data/character/characterMock.ts`

**Interfaces:**
- Consumes: a Task 1 `ConferenceOutcomeCounts` típusa; a Task 1 `deliberationSource` mezője.
- Produces: `MOCK_CONFERENCES` hat elemmel, mindegyiken valódi `outcome`; `DELIBERATION_W2` az összes megjelenítendő állapotot lefedve; `MOCK_CONFERENCE_DETAIL['w1']` `deliberationSource: 'DERIVED'`-del. Ezekre a Task 5–8 tesztjei és a kézi ellenőrzés épül.

- [ ] **Step 1: Cseréld le a `MOCK_CONFERENCES` tömböt**

A `frontend/src/data/character/characterMock.ts:408-413` blokk helyére:

```ts
export const MOCK_CONFERENCES: CharacterConferenceSummary[] = [
  { id: 'w2', kind: 'WEEKLY', weekStart: '2026-08-24', generatedAt: '2026-08-30T07:00:00Z',
    outcome: { accepted: 2, retired: 1, portraitRewritten: 1, other: 0 } },
  { id: 'w1', kind: 'WEEKLY', weekStart: '2026-08-17', generatedAt: '2026-08-23T07:00:00Z',
    outcome: { accepted: 2, retired: 0, portraitRewritten: 0, other: 1 } },
  { id: 'w0', kind: 'WEEKLY', weekStart: '2026-08-10', generatedAt: '2026-08-16T07:00:00Z',
    outcome: { accepted: 0, retired: 0, portraitRewritten: 0, other: 0 } },
  { id: 'm1', kind: 'MONTHLY', weekStart: null, generatedAt: '2026-08-01T07:00:00Z',
    outcome: { accepted: 5, retired: 2, portraitRewritten: 1, other: 0 } },
  { id: 'j1', kind: 'WEEKLY', weekStart: '2026-07-20', generatedAt: '2026-07-26T07:00:00Z',
    outcome: { accepted: 1, retired: 0, portraitRewritten: 0, other: 0 } },
  { id: 'b0', kind: 'BOOTSTRAP', weekStart: null, generatedAt: '2025-12-20T09:00:00Z',
    outcome: { accepted: 9, retired: 0, portraitRewritten: 1, other: 0 } },
]
```

> A `w0` sor szándékosan mindenütt nulla — ez az archívum „üres kimenetű sor" ága (spec §11). A `b0` 2025-ös, hogy az év-elválasztó látszódjon.

- [ ] **Step 2: Igazítsd a `b0` részlet-fixtúra dátumát**

A `MOCK_BOOTSTRAP_CONFERENCE` `generatedAt` mezője ma `'2026-07-15T09:00:00Z'`. Írd át `'2025-12-20T09:00:00Z'`-re, hogy egyezzen a listával. Ha bármelyik meglévő teszt erre a dátumra állít, igazítsd a tesztet is.

- [ ] **Step 3: Cseréld le a `DELIBERATION_W2` tömböt**

A `frontend/src/data/character/characterMock.ts:464-517` közötti `DELIBERATION_W2` definíciót (a `physical`, `discipline`, `nutrition` és a `mental` szálakat) cseréld erre a négy szálra:

```ts
const DELIBERATION_W2: ConferenceThread[] = [
  {
    dimensionKey: 'recovery',
    title: 'Regeneráció',
    items: [
      {
        index: 0,
        expertKey: 'szomnologus',
        text: 'A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.',
        kind: 'NEW',
        claimId: null,
        sensitive: false,
        reactions: [
          { expertKey: 'doki', stance: 'SUPPORT', argument: 'A pulzusvariancia is ezt a két napot mutatja gyengébbnek.' },
          { expertKey: 'drill', stance: 'CHALLENGE', argument: 'Szerintem ez nem alvás, hanem hétvégi program — nem viselkedési minta.' },
          { expertKey: 'pszichologus', stance: 'NUANCE', argument: 'A kettő nem zárja ki egymást: a program tolja ki, a hatása viszont alvás.' },
        ],
        skeptic: { verdict: 'KEEP', argument: 'Hat hét adat, konzisztens. Drill ellenvetése nem cáfolja a mintát.' },
        chair: { accepted: true, confidence: BIZTOS, reason: 'Bekerül a dossziéba — a Szkeptikus érvét fogadom el.' },
      },
      {
        index: 1,
        expertKey: 'doki',
        text: 'Egy korábbi regenerációs állítás már nem áll: a délutáni fáradtság megszűnt.',
        kind: 'RETIRE',
        claimId: 'c-recovery-old',
        sensitive: false,
        reactions: [],
        skeptic: { verdict: 'KEEP', argument: 'Négy hete nincs rá jel, a nyugdíjazás indokolt.' },
        chair: { accepted: true, confidence: VALOSZINU, reason: 'Nyugdíjazom, nem viszem tovább.' },
      },
    ],
  },
  {
    dimensionKey: 'physical',
    title: 'Fizikai',
    items: [
      {
        index: 2,
        expertKey: 'doki',
        text: 'A testzsír-trend és a stagnáló testsúly rekompozícióra utal.',
        kind: 'NEW',
        claimId: null,
        sensitive: false,
        reactions: [
          { expertKey: 'edzo', stance: 'SUPPORT', argument: 'Az edzésterhelés is ezt támasztja alá.' },
        ],
        skeptic: { verdict: 'KEEP', argument: 'Három adatpont kevés a "biztos" szinthez.' },
        chair: { accepted: true, confidence: VALOSZINU, reason: 'Elfogadom, a Szkeptikus érve helytálló.' },
      },
    ],
  },
  {
    dimensionKey: 'nutrition',
    title: 'Táplálkozási',
    items: [
      {
        index: 3,
        expertKey: 'taplalkozo',
        text: 'A hétvégi fehérje-elmaradás három hete következetes mintázat.',
        kind: 'NEW',
        claimId: null,
        sensitive: false,
        reactions: [],
        skeptic: { verdict: 'KILL', argument: 'Három hét túl kevés, és két hétvége nyaralás volt.' },
        chair: { accepted: false, confidence: null, reason: 'Elvetem — a Szkeptikus kifogása megalapozott.' },
      },
    ],
  },
  {
    dimensionKey: 'discipline',
    title: 'Motiváció & fegyelem',
    items: [
      {
        index: 4,
        expertKey: 'drill',
        text: 'A heti fókuszok teljesítési aránya négy hete 80% felett.',
        kind: 'NEW',
        claimId: null,
        sensitive: false,
        reactions: [],
        skeptic: null,
        chair: null,
      },
    ],
  },
]
```

> Ez a fixtúra lefedi: több állítást egy szálban; három reakciót egy állításon mindhárom állásfoglalással; vita nélküli szálat; `KILL` verdiktet elvetéssel; `RETIRE` kindot; és egy állítást, amire sem a Szkeptikus, sem Mezo nem válaszolt.

- [ ] **Step 4: Igazítsd a `w2` `changes` tömbjét**

A `w2` konzílium `changes` mezője (`:549-554` környéke) most ellentmond a fenti szálaknak. Cseréld erre:

```ts
    changes: [
      { kind: 'CLAIM_ACCEPTED', dimensionKey: 'recovery', summary: 'Szomnológus állítása elfogadva "biztos" szinttel.' },
      { kind: 'CLAIM_ACCEPTED', dimensionKey: 'physical', summary: 'Doki állítása elfogadva "valószínű" szinttel.' },
      { kind: 'CLAIM_RETIRED', dimensionKey: 'recovery', summary: 'Egy korábbi regenerációs állítás nyugdíjazva.' },
      { kind: 'PORTRAIT_REWRITTEN', dimensionKey: 'recovery', summary: 'Portré átírva: a hétvégi eltolódás mostantól „biztos” szintű állítás.' },
    ],
```

> Ellenőrizd, hogy ez a lista pontosan azt adja, amit a `MOCK_CONFERENCES` `w2` sorának `outcome`-ja állít (`{ accepted: 2, retired: 1, portraitRewritten: 1, other: 0 }`): két `CLAIM_ACCEPTED`, egy `CLAIM_RETIRED`, egy `PORTRAIT_REWRITTEN`. **Ez az egyezés kötelező** — a mock ne mondjon mást, mint amit a backend ugyanezekből a `changes`-ekből számolna. Figyeld meg, hogy a szálakban HÁROM elfogadott döntés van, a `changes[]`-ben mégis KETTŐ `CLAIM_ACCEPTED` — mert a harmadik elfogadás egy `RETIRE` volt, ami `CLAIM_RETIRED`-ként jelenik meg. Pontosan ezt a különbséget teszi olvashatóvá a spec §6.3 címkézése.

- [ ] **Step 5: Vedd fel a `deliberationSource` mezőt a részlet-fixtúrákra**

Minden `MOCK_CONFERENCE_DETAIL` bejegyzésre és a `MOCK_BOOTSTRAP_CONFERENCE`-re add hozzá:
- `w2`: `deliberationSource: 'STORED'`
- `w1`: `deliberationSource: 'DERIVED'` (ez az a konzílium, ami a kereszt-vita kör előtt zajlott). Ha `w1`-nek ma nincs `deliberation` mezője, adj neki egy egyszálas, reakciómentes szálat, hogy a „nem volt ilyen kör" ág renderelhető legyen:

```ts
    deliberationSource: 'DERIVED',
    deliberation: [
      {
        dimensionKey: null,
        title: 'Doki felvetései',
        items: [
          {
            index: 0, expertKey: 'doki', text: 'A hétvégi lépésszám tartósan alacsonyabb.',
            kind: 'NEW', claimId: null, sensitive: false, reactions: [],
            skeptic: { verdict: 'KEEP', argument: 'Elfogadható jel.' },
            chair: { accepted: true, confidence: VALOSZINU, reason: 'Felveszem.' },
          },
        ],
      },
    ],
```

- `b0` (`MOCK_BOOTSTRAP_CONFERENCE`): marad `deliberation` nélkül, és kap `deliberationSource: null`-t.
- Minden további bejegyzés, aminek van `deliberation`-je: `'STORED'`.

- [ ] **Step 6: Fordítsd le és futtasd a Karakter-teszteket**

```bash
cd frontend && pnpm build
```

Várható: sikeres. Ezután:

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character
```

Várható: **néhány meglévő teszt bukik**, mert a fixtúra szövegei megváltoztak (pl. a `KonziliumPage.test.tsx` a „Mentális & érzelmi" címre vagy a régi Kimenet-számokra állít). Igazítsd ŐKET az új fixtúrához — ne a fixtúrát vissza. Ha egy teszt olyan állapotot állított, ami az új fixtúrában nem létezik, írd át a legközelebbi valódi állapotra.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/character/characterMock.ts frontend/src/features/character
git commit -m "test(character): a konzílium mock-fixtúrái lefedik az összes megjelenítendő állapotot (mezo-sp9w)"
```

---

## Task 5: A szálkártya — orb-lánc, állásfoglalás-chipek, beszédes fejléc

**Files:**
- Modify: `frontend/src/features/character/components/ConferenceThreadCard.tsx`
- Modify: `frontend/src/features/character/components/ConferenceThreadCard.test.tsx`
- Modify: `frontend/src/features/character/character.css`

**Interfaces:**
- Consumes: `PersonaOrb` (`@/features/character/components/PersonaOrb`), `expertColor`, `confidenceWord`.
- Produces: `ConferenceThreadCard` új kötelező propja: `crossTalkRan: boolean`. A `KonziliumPage` (Task 8) ezt `conference.deliberationSource === 'STORED'`-ként adja át.

- [ ] **Step 1: Írd meg a bukó teszteket**

A `ConferenceThreadCard.test.tsx`-be vedd fel ezeket (a fájl meglévő render-segédjét használd; ha nincs, írj egyet, ami `experts={MOCK_EXPERTS}`-szel rendereli a kártyát):

```tsx
  test('a fejléc a hozzászólások számát mutatja, ha volt kereszt-vita', () => {
    render(<ConferenceThreadCard thread={THREAD_WITH_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan />)
    expect(screen.getByText('3 hozzászólás')).toBeInTheDocument()
  })

  test('a fejléc "nem vitatták"-at mond, ha a kör lefutott, de nem volt reakció', () => {
    render(<ConferenceThreadCard thread={THREAD_NO_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan />)
    expect(screen.getByText(/nem vitatták/)).toBeInTheDocument()
    expect(screen.queryByText(/hozzászólás/)).not.toBeInTheDocument()
  })

  test('ha a kereszt-vita kör nem is létezett, a régi elfogadás-számláló marad', () => {
    render(<ConferenceThreadCard thread={THREAD_NO_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan={false} />)
    expect(screen.getByText(/elfogadva/)).toBeInTheDocument()
    expect(screen.queryByText(/nem vitatták/)).not.toBeInTheDocument()
  })

  test('a lenyitott lánc orb-ot rajzol, nem pöttyöt', async () => {
    const { container } = render(
      <ConferenceThreadCard thread={THREAD_WITH_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan defaultOpen />,
    )
    expect(container.querySelector('.kr-thdot')).toBeNull()
    expect(container.querySelectorAll('.kr-thstep .kr-thorb').length).toBeGreaterThan(0)
  })

  test('a reakciók állásfoglalás-chipet kapnak', () => {
    render(<ConferenceThreadCard thread={THREAD_WITH_REACTIONS} experts={MOCK_EXPERTS} crossTalkRan defaultOpen />)
    expect(screen.getByText('támogatja')).toBeInTheDocument()
    expect(screen.getByText('vitatja')).toBeInTheDocument()
    expect(screen.getByText('árnyalja')).toBeInTheDocument()
  })

  test('Mezo döntése a javaslat fajtájához illő címkét kap, bizonyossággal', () => {
    render(<ConferenceThreadCard thread={THREAD_RETIRE} experts={MOCK_EXPERTS} crossTalkRan defaultOpen />)
    expect(screen.getByText('Nyugdíjazva · valószínű')).toBeInTheDocument()
  })
```

A fixtúrák a teszt tetején (a `frontend/src/data/character/characterMock.ts` `DELIBERATION_W2`-jéből vedd őket, hogy egy forrásból éljenek):

```tsx
import { MOCK_CONFERENCE_DETAIL, MOCK_EXPERTS } from '@/data/character/characterMock'

const W2_THREADS = MOCK_CONFERENCE_DETAIL.w2.deliberation!
const THREAD_WITH_REACTIONS = { ...W2_THREADS[0], items: [W2_THREADS[0].items[0]] }
const THREAD_RETIRE = { ...W2_THREADS[0], items: [W2_THREADS[0].items[1]] }
const THREAD_NO_REACTIONS = W2_THREADS[2]
```

- [ ] **Step 2: Futtasd, hogy bukjon**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/components/ConferenceThreadCard.test.tsx
```

Várható: TypeScript hiba a `crossTalkRan` propra és bukó állítások.

- [ ] **Step 3: Írd át a komponenst**

A `ConferenceThreadCard.tsx`-ben:

**a) Vedd fel a stance-chip címkéket és a `ChainStep` új alakját.** A meglévő `STANCE_LABEL` konstans marad. A `ChainStep`-et cseréld erre:

```tsx
type ChipTone = 'sup' | 'cha' | 'nua' | 'acc' | 'rej' | 'non'

function ChainStep({ expertKey, who, chip, chipTone, children }: {
  expertKey: string
  who: string
  chip?: string
  chipTone?: ChipTone
  children: React.ReactNode
}) {
  return (
    <div className="kr-thstep" style={{ '--c': expertColor(expertKey) } as CSSProperties}>
      <span className="kr-thorb" aria-hidden="true"><PersonaOrb expertKey={expertKey} size={22} /></span>
      <div className="kr-thwho">
        {who}
        {chip != null && <span className={`kr-thchip ${chipTone ?? 'non'}`}>{chip}</span>}
      </div>
      <div className="kr-thsaid">{children}</div>
    </div>
  )
}
```

**b) Írd át az `ItemChain`-t**, hogy chipeket adjon át:

```tsx
const STANCE_TONE: Record<string, ChipTone> = { SUPPORT: 'sup', CHALLENGE: 'cha', NUANCE: 'nua' }

function ItemChain({ item, experts }: { item: ConferenceItem; experts: CharacterExpertDto[] }) {
  const badge = outcomeBadge(item)
  const confidence = item.chair?.accepted === true && item.chair.confidence != null
    ? ` · ${confidenceWord(item.chair.confidence)}`
    : ''
  return (
    <div className="kr-thitem">
      <ChainStep expertKey={item.expertKey} who={displayName(experts, item.expertKey)} chip="felvetette">
        {item.text}
      </ChainStep>
      {item.reactions.map((reaction, i) => (
        <ChainStep
          key={i}
          expertKey={reaction.expertKey}
          who={displayName(experts, reaction.expertKey)}
          chip={STANCE_LABEL[reaction.stance] ?? 'hozzászólt'}
          chipTone={STANCE_TONE[reaction.stance]}
        >
          {reaction.argument}
        </ChainStep>
      ))}
      <ChainStep
        expertKey="szkeptikus"
        who="Szkeptikus"
        chip={item.skeptic == null ? undefined : item.skeptic.verdict === 'KILL' ? 'kukázta' : 'meghagyta'}
        chipTone={item.skeptic?.verdict === 'KILL' ? 'cha' : 'sup'}
      >
        {item.skeptic == null ? NO_ANSWER : item.skeptic.argument}
      </ChainStep>
      <ChainStep
        expertKey="mezo"
        who="Mezo"
        chip={item.chair == null ? undefined : `${badge.label}${confidence}`}
        chipTone={badge.tone}
      >
        {item.chair == null ? NO_ANSWER : item.chair.reason}
      </ChainStep>
    </div>
  )
}
```

> A `badge.tone` értékei (`'acc' | 'rej' | 'non'`) részhalmazai a `ChipTone`-nak, tehát típushelyes.

**c) Vedd fel a `crossTalkRan` propot és a beszédes alsort.** A `ConferenceThreadCardProps`-ba:

```tsx
export interface ConferenceThreadCardProps {
  thread: ConferenceThread
  experts: CharacterExpertDto[]
  /** Lefutott-e egyáltalán a kereszt-vita kör ezen a konzíliumon (a szál TÁROLT, nem visszafejtett).
   *  Ha nem, a fejléc nem mondhat "nem vitatták"-at — az azt sugallná, hogy volt kör és senki nem szólt. */
  crossTalkRan: boolean
  defaultOpen?: boolean
}
```

Vedd fel a reakció-számlálót a `acceptedCount` mellé:

```tsx
function reactionCount(thread: ConferenceThread): number {
  return thread.items.reduce((sum, item) => sum + item.reactions.length, 0)
}
```

És a fejléc alsorát (`.kr-thts`) cseréld erre:

```tsx
        <span className="kr-thtitle">
          <span className="kr-thtt">{thread.title}</span>
          <span className="kr-thts">
            {`${thread.items.length} állítás`}
            {reactions > 0
              ? <> · <span className="kr-thdeb">{`${reactions} hozzászólás`}</span></>
              : crossTalkRan
                ? ' · nem vitatták'
                : ` · ${accepted} elfogadva`}
          </span>
        </span>
```

ahol a komponens törzsében:

```tsx
  const accepted = acceptedCount(thread)
  const reactions = reactionCount(thread)
```

- [ ] **Step 4: Vedd fel a CSS-t**

A `frontend/src/features/character/character.css`-ben cseréld a `.kr-thstep` / `.kr-thdot` blokkot (`:504-509`) erre:

```css
.kr-thstep { position: relative; padding: 8px 0 9px 32px; }
.kr-thstep::before { content: ''; position: absolute; left: 11px; top: 30px; bottom: -8px; width: 1px; background: var(--divider); }
.kr-thitem .kr-thstep:last-child::before { display: none; }
.kr-thstep .kr-thorb {
  position: absolute; left: 0; top: 7px; width: 23px; height: 23px; border-radius: 50%;
  display: grid; place-items: center; overflow: hidden; margin-left: 0; border: none;
  box-shadow: 0 3px 7px -3px var(--c);
}
.kr-thwho { font-size: 10.5px; font-weight: 800; color: var(--c); display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.kr-thsaid { font-size: 11.5px; line-height: 1.55; font-weight: 300; margin-top: 3px; color: var(--text-primary); }
.kr-thchip { font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 20px; letter-spacing: 0.02em; }
.kr-thchip.sup { background: rgba(78, 107, 66, 0.16); color: #4E6B42; }
.kr-thchip.cha { background: rgba(192, 86, 58, 0.15); color: #C0563A; }
.kr-thchip.nua { background: rgba(168, 128, 31, 0.16); color: #A8801F; }
.kr-thchip.acc { background: rgba(255, 91, 54, 0.14); color: #C0442A; }
.kr-thchip.rej { background: rgba(43, 33, 24, 0.08); color: var(--text-secondary); }
.kr-thchip.non { background: transparent; box-shadow: inset 0 0 0 1px var(--divider); color: var(--text-secondary); }
.kr-thdeb { background: rgba(255, 91, 54, 0.13); color: #C0442A; font-weight: 800; padding: 2px 8px; border-radius: 20px; font-size: 9.5px; }
```

> A `.kr-thdot` szabály **teljesen törlendő** — nincs több hívóhelye. Ellenőrizd: `grep -rn "kr-thdot" frontend/src` üres kell legyen (a teszten kívül, ami épp a hiányát állítja).
> Ha a `--text-primary` változó nem létezik ebben a fájlban, hagyd el a `color` sort a `.kr-thsaid`-ból — az öröklődik.

- [ ] **Step 5: Futtasd, hogy zöld legyen**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/components/ConferenceThreadCard.test.tsx
```

Várható: minden zöld. A `KonziliumPage.test.tsx` most bukni fog a hiányzó `crossTalkRan` propra — azt a Task 8 javítja.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/character/components/ConferenceThreadCard.tsx frontend/src/features/character/components/ConferenceThreadCard.test.tsx frontend/src/features/character/character.css
git commit -m "feat(character): a konzílium-szál lánca orb-okat és állásfoglalás-chipeket kap (mezo-sp9w)"
```

---

## Task 6: A „Mi ez" és a „Hogyan zajlott" kártya

**Files:**
- Create: `frontend/src/features/character/components/KonziliumRoundMap.tsx`
- Create: `frontend/src/features/character/components/KonziliumRoundMap.test.tsx`
- Modify: `frontend/src/features/character/character.css`

**Interfaces:**
- Consumes: `deliberationStats` (Task 3), `ConferenceThread`.
- Produces:
  ```tsx
  export function KonziliumWhatIs({ kind }: { kind: 'WEEKLY' | 'MONTHLY' | 'BOOTSTRAP' }): JSX.Element
  export function KonziliumRoundMap({ threads, crossTalkRan }:
    { threads: ConferenceThread[] | null; crossTalkRan: boolean }): JSX.Element
  ```
  Mindkettőt a `KonziliumPage` (Task 8) rendereli. Egy fájlban élnek, mert együtt alkotják a lap kontextus-rétegét.

- [ ] **Step 1: Írd meg a bukó tesztet**

Hozd létre: `frontend/src/features/character/components/KonziliumRoundMap.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { KonziliumRoundMap, KonziliumWhatIs } from './KonziliumRoundMap'
import { MOCK_CONFERENCE_DETAIL } from '@/data/character/characterMock'

const THREADS = MOCK_CONFERENCE_DETAIL.w2.deliberation!

describe('KonziliumWhatIs', () => {
  test('a heti konzílium szövege a hetente szóval kezdődik', () => {
    render(<KonziliumWhatIs kind="WEEKLY" />)
    expect(screen.getByText(/^Hetente/)).toBeInTheDocument()
  })

  test('a havi konzílium szövege a havonta szóval kezdődik', () => {
    render(<KonziliumWhatIs kind="MONTHLY" />)
    expect(screen.getByText(/^Havonta/)).toBeInTheDocument()
  })

  test('a bootstrap konzílium az első beolvasásról beszél', () => {
    render(<KonziliumWhatIs kind="BOOTSTRAP" />)
    expect(screen.getByText(/első beolvasás/)).toBeInTheDocument()
  })
})

describe('KonziliumRoundMap', () => {
  test('mind a négy kör számai a szálakból számolódnak', () => {
    render(<KonziliumRoundMap threads={THREADS} crossTalkRan />)
    expect(screen.getByText('5 felvetés')).toBeInTheDocument()
    expect(screen.getByText('4 hozzászólás')).toBeInTheDocument()
    expect(screen.getByText('4 vizsgálat')).toBeInTheDocument()
    expect(screen.getByText('3 be · 1 el')).toBeInTheDocument()
  })

  test('a kereszt-vita cella kiemelt, ha volt hozzászólás', () => {
    const { container } = render(<KonziliumRoundMap threads={THREADS} crossTalkRan />)
    expect(container.querySelector('.kr-rst.hot')).not.toBeNull()
  })

  test('visszafejtett szálnál a kereszt-vita kör nem létezőnek látszik, nem nullának', () => {
    render(<KonziliumRoundMap threads={[]} crossTalkRan={false} />)
    expect(screen.getByText('nem volt ilyen kör')).toBeInTheDocument()
    expect(screen.queryByText('0 hozzászólás')).not.toBeInTheDocument()
  })

  test('tárolt, de üres kereszt-vita kör nullát mutat', () => {
    render(<KonziliumRoundMap threads={[]} crossTalkRan />)
    expect(screen.getByText('0 hozzászólás')).toBeInTheDocument()
  })
})
```

> A várt számok a Task 4 fixtúrájából jönnek: 5 állítás, 4 reakció (3 + 1), 4 szkeptikus verdikt (a `discipline` szál `skeptic: null`-ja nem számít bele), 3 elfogadás és 1 elvetés (a `chair: null` egyikbe sem). Ha a fixtúrát az implementer bármiért másképp írta meg, számold újra ezeket a számokat a tényleges fixtúrából — a teszt attól még ugyanazt bizonyítja.

- [ ] **Step 2: Futtasd, hogy bukjon**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/components/KonziliumRoundMap.test.tsx
```

Várható: `Failed to resolve import "./KonziliumRoundMap"`.

- [ ] **Step 3: Írd meg a komponenseket**

Hozd létre: `frontend/src/features/character/components/KonziliumRoundMap.tsx`

```tsx
// ============================================================
// Mezo · Karakter — a Konzílium kontextus-rétege (mezo-sp9w)
// Két kártya, ami belépéskor megválaszolja a két kérdést, amire a szál-nézet nem tudott
// válaszolni: MI EZ, és HOGYAN ZAJLOTT.
//
// Őszinteség: a négy kör minden száma a megnyitott konzílium saját szálaiból számolódik
// (`deliberationStats`). Egy kör, ami nem hozott semmit, 0-t mutat — DE egy kör, ami akkor még
// nem is létezett (visszafejtett szál), "nem volt ilyen kör"-t, mert a 0 azt sugallná, hogy
// lefutott és senki nem szólt hozzá.
// ============================================================
import { deliberationStats } from '@/features/character/deliberationStats'
import type { ConferenceThread } from '@/data/character/characterApi'

const WHAT_IS: Record<'WEEKLY' | 'MONTHLY' | 'BOOTSTRAP', string> = {
  WEEKLY: 'Hetente a szakértői csapat átnézi az adataidat, megvitatja egymás felvetéseit, '
    + 'a Szkeptikus kikérdezi őket, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.',
  MONTHLY: 'Havonta a szakértői csapat átnézi a hónap egészét, megvitatja egymás felvetéseit, '
    + 'a Szkeptikus kikérdezi őket, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.',
  BOOTSTRAP: 'Az első beolvasáskor a szakértői csapat átnézte a teljes eddigi történetedet, '
    + 'megvitatta egymás felvetéseit, a Szkeptikus kikérdezte őket, és Mezo döntött arról, '
    + 'mi került be a rólad szóló dossziéba.',
}

export function KonziliumWhatIs({ kind }: { kind: 'WEEKLY' | 'MONTHLY' | 'BOOTSTRAP' }) {
  return (
    <div className="kr-konzcard">
      <div className="kr-konzcap">Mi ez</div>
      <p className="kr-whatis">{WHAT_IS[kind]}</p>
    </div>
  )
}

function RoundCell({ n, label, value, hot }: { n: number; label: string; value: string; hot?: boolean }) {
  return (
    <div className={`kr-rst${hot === true ? ' hot' : ''}`}>
      <span className="kr-rn">{n}</span>
      <b>{label}</b>
      <i>{value}</i>
    </div>
  )
}

export function KonziliumRoundMap({ threads, crossTalkRan }: {
  threads: ConferenceThread[] | null
  crossTalkRan: boolean
}) {
  const stats = deliberationStats(threads)
  const crossTalkValue = crossTalkRan ? `${stats.reactions} hozzászólás` : 'nem volt ilyen kör'
  return (
    <div className="kr-konzcard">
      <div className="kr-konzcap">Hogyan zajlott</div>
      <div className="kr-rail">
        <RoundCell n={1} label="Javaslat" value={`${stats.proposals} felvetés`} />
        <RoundCell n={2} label="Kereszt-vita" value={crossTalkValue} hot={crossTalkRan && stats.reactions > 0} />
        <RoundCell n={3} label="Szkeptikus" value={`${stats.skepticVerdicts} vizsgálat`} />
        <RoundCell n={4} label="Mezo dönt" value={`${stats.accepted} be · ${stats.rejected} el`} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Vedd fel a CSS-t**

A `frontend/src/features/character/character.css` végére:

```css
/* ── konzílium kontextus-réteg (mezo-sp9w) ── */
.kr-konzcard { background: var(--surface-card); border-radius: 22px; margin: 0 12px 11px; overflow: hidden; box-shadow: 0 12px 26px -20px rgba(43, 33, 24, 0.65), 0 1px 3px -2px rgba(43, 33, 24, 0.22); }
.kr-konzcap { font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); padding: 13px 16px 8px; }
.kr-whatis { margin: 0; padding: 0 16px 15px; font-size: 12.5px; line-height: 1.6; font-weight: 300; color: var(--text-secondary); }
.kr-rail { display: flex; gap: 6px; padding: 0 12px 14px; }
.kr-rst { flex: 1; background: rgba(43, 33, 24, 0.04); border-radius: 13px; padding: 9px 5px 8px; text-align: center; }
.kr-rst.hot { background: rgba(255, 91, 54, 0.10); box-shadow: inset 0 0 0 1px rgba(255, 91, 54, 0.28); }
.kr-rn { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: rgba(43, 33, 24, 0.12); font-size: 9px; font-weight: 800; margin-bottom: 4px; }
.kr-rst.hot .kr-rn { background: var(--primary, #FF5B36); color: #fff; }
.kr-rst b { display: block; font-size: 9.5px; font-weight: 800; letter-spacing: -0.01em; }
.kr-rst i { display: block; font-style: normal; font-size: 8.5px; color: var(--text-muted); margin-top: 2px; font-weight: 600; }
```

- [ ] **Step 5: Futtasd, hogy zöld legyen**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/components/KonziliumRoundMap.test.tsx
```

Várható: mind a 7 teszt zöld.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/character/components/KonziliumRoundMap.tsx frontend/src/features/character/components/KonziliumRoundMap.test.tsx frontend/src/features/character/character.css
git commit -m "feat(character): Mi ez és Hogyan zajlott kártya a Konzíliumon (mezo-sp9w)"
```

---

## Task 7: Az archívum lap

**Files:**
- Create: `frontend/src/features/character/components/ConferenceArchiveSheet.tsx`
- Create: `frontend/src/features/character/components/ConferenceArchiveSheet.test.tsx`
- Modify: `frontend/src/features/character/character.css`

**Interfaces:**
- Consumes: `Sheet` a `@/shared/ui/Sheet`-ből (`{ children, onClose, className?, labelledBy? }`; a `children` lehet `(close) => ReactNode`), `CharacterConferenceSummary`.
- Produces:
  ```tsx
  export function ConferenceArchiveSheet({ conferences, currentId, onPick, onClose }: {
    conferences: CharacterConferenceSummary[]
    currentId: string | null
    onPick: (id: string) => void
    onClose: () => void
  }): JSX.Element
  ```
  Az `onPick` a lap ANIMÁLT bezárása UTÁN hívódik — a komponens a `Sheet` render-prop `close()`-át használja, majd az `onPick`-et.

- [ ] **Step 1: Írd meg a bukó tesztet**

Hozd létre: `frontend/src/features/character/components/ConferenceArchiveSheet.test.tsx`

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { ConferenceArchiveSheet } from './ConferenceArchiveSheet'
import { MOCK_CONFERENCES } from '@/data/character/characterMock'

function renderSheet(overrides: Partial<Parameters<typeof ConferenceArchiveSheet>[0]> = {}) {
  const onPick = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <ConferenceArchiveSheet
      conferences={MOCK_CONFERENCES}
      currentId="w2"
      onPick={onPick}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { ...utils, onPick, onClose }
}

describe('ConferenceArchiveSheet', () => {
  test('a sorok hónapok szerint csoportosulnak', () => {
    renderSheet()
    expect(screen.getByText('2026 · augusztus')).toBeInTheDocument()
    expect(screen.getByText('2026 · július')).toBeInTheDocument()
    expect(screen.getByText('2025 · december')).toBeInTheDocument()
  })

  test('évváltásnál év-elválasztó jelenik meg', () => {
    const { container } = renderSheet()
    const years = Array.from(container.querySelectorAll('.kr-arcyr')).map((el) => el.textContent)
    expect(years).toEqual(['2025'])
  })

  test('a nyitott konzílium sora kiemelt', () => {
    const { container } = renderSheet()
    const on = container.querySelectorAll('.kr-arcrow.on')
    expect(on).toHaveLength(1)
    expect(on[0].textContent).toContain('augusztus 30.')
  })

  test('a sor a nem nulla kimenetet mutatja', () => {
    renderSheet()
    const row = screen.getByRole('button', { name: /augusztus 30/ })
    expect(within(row).getByText('2 bekerült · 1 nyugdíjazva · 1 portré átírva')).toBeInTheDocument()
  })

  test('a csupa nulla kimenetű sor nem ír ki nullát', () => {
    renderSheet()
    const row = screen.getByRole('button', { name: /augusztus 16/ })
    expect(within(row).queryByText(/0 /)).toBeNull()
    expect(row.textContent).not.toContain('bekerült')
  })

  test('választáskor a lap bezáródik és jelzi a választott konzíliumot', async () => {
    const { onPick } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: /augusztus 23/ }))
    await waitFor(() => expect(onPick).toHaveBeenCalledWith('w1'))
  })
})
```

> A várt kimenet-szöveg (`2 bekerült · 1 nyugdíjazva · 1 portré átírva`) a Task 4 `w2` sorának `outcome`-jából jön. Ha az implementer ott mást írt, igazítsd a tesztet a tényleges fixtúrához.

- [ ] **Step 2: Futtasd, hogy bukjon**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/components/ConferenceArchiveSheet.test.tsx
```

Várható: `Failed to resolve import "./ConferenceArchiveSheet"`.

- [ ] **Step 3: Írd meg a komponenst**

Hozd létre: `frontend/src/features/character/components/ConferenceArchiveSheet.tsx`

```tsx
// ============================================================
// Mezo · Karakter — ConferenceArchiveSheet (mezo-sp9w)
// A régi konzílium-LISTAOLDAL utódja. Alulról felcsúszó lap, nem route — így a Konzíliumon
// pontosan egy visszalépő vezérlő marad (`PageHead`), és a lista-oldal dupla vissza-gombja
// nem jön vissza a hátsó ajtón.
//
// Fix magasság, akárhány év: a hónap-fejlécek a lap BELSEJÉBEN görögnek.
//
// Őszinteség: a sor kimenete csak a nem-nulla tételeket sorolja. Egy konzílium, ami semmit nem
// változtatott a dossziéban, kimenet nélküli sorként jelenik meg — üresen, nem "0 bekerült"-tel.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import type { CharacterConferenceSummary } from '@/data/character/characterApi'

const KIND_BADGE: Record<CharacterConferenceSummary['kind'], string> = {
  WEEKLY: 'HETI',
  MONTHLY: 'HAVI',
  BOOTSTRAP: 'BOOTSTRAP',
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}`
}

function monthLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()} · ${d.toLocaleDateString('hu-HU', { month: 'long' })}`
}

function yearOf(iso: string): number {
  return new Date(iso).getFullYear()
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })
}

/** Only the non-zero counts, in dossier-effect order. Empty string when nothing changed —
 *  the row then carries no outcome text at all, which is the truth, not a missing value. */
export function outcomeLabel(outcome: CharacterConferenceSummary['outcome']): string {
  const parts: string[] = []
  if (outcome.accepted > 0) parts.push(`${outcome.accepted} bekerült`)
  if (outcome.retired > 0) parts.push(`${outcome.retired} nyugdíjazva`)
  if (outcome.portraitRewritten > 0) parts.push(`${outcome.portraitRewritten} portré átírva`)
  return parts.join(' · ')
}

export function ConferenceArchiveSheet({ conferences, currentId, onPick, onClose }: {
  conferences: CharacterConferenceSummary[]
  currentId: string | null
  onPick: (id: string) => void
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} className="kr-arcsheet" labelledBy="kr-arctitle">
      {(close) => (
        <>
          <div className="kr-archd" id="kr-arctitle">
            Korábbi tanácskozások
            <span className="kr-arccnt">{conferences.length}</span>
          </div>
          <div className="kr-arcscroll">
            {conferences.map((conf, i) => {
              const prev = i > 0 ? conferences[i - 1] : null
              const newMonth = prev == null || monthKey(prev.generatedAt) !== monthKey(conf.generatedAt)
              const newYear = prev != null && yearOf(prev.generatedAt) !== yearOf(conf.generatedAt)
              const outcome = outcomeLabel(conf.outcome)
              return (
                <div key={conf.id}>
                  {newYear && <div className="kr-arcyr">{yearOf(conf.generatedAt)}</div>}
                  {newMonth && <div className="kr-arcmh">{monthLabel(conf.generatedAt)}</div>}
                  <button
                    type="button"
                    className={`kr-arcrow${conf.id === currentId ? ' on' : ''}`}
                    onClick={() => { close(); onPick(conf.id) }}
                  >
                    <span className="kr-arcday">{dayLabel(conf.generatedAt)}</span>
                    {outcome !== '' && <span className="kr-arcout">{outcome}</span>}
                    <span className={`kr-kbadge ${conf.kind.toLowerCase()}`}>{KIND_BADGE[conf.kind]}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}
```

> A `conferences` tömb a lista-végpont `generatedAt DESC` sorrendjében érkezik — a komponens NEM rendezi újra, csak csoportosít. Ha a hívó más sorrendet ad, a fejlécek is annak megfelelően keletkeznek.

- [ ] **Step 4: Vedd fel a CSS-t**

A `frontend/src/features/character/character.css` végére:

```css
/* ── konzílium archívum lap (mezo-sp9w) ── */
.kr-archd { font-size: 15px; font-weight: 800; padding: 4px 18px 10px; display: flex; align-items: center; gap: 8px; }
.kr-arccnt { font-size: 10px; font-weight: 800; background: rgba(43, 33, 24, 0.07); color: var(--text-muted); padding: 3px 9px; border-radius: 20px; }
.kr-arcscroll { max-height: 62vh; overflow: auto; padding: 0 12px 4px; }
.kr-arcmh { font-size: 9.5px; font-weight: 800; letter-spacing: 0.11em; text-transform: uppercase; color: var(--text-muted); padding: 11px 6px 5px; }
.kr-arcyr { font-size: 11px; font-weight: 800; color: var(--text-secondary); text-align: center; padding: 14px 0 4px; border-top: 0.5px solid var(--divider); margin-top: 10px; }
.kr-arcrow { display: flex; align-items: center; gap: 9px; width: 100%; padding: 11px 12px; border: none; background: none; font-family: inherit; text-align: left; color: inherit; border-radius: 14px; cursor: pointer; }
.kr-arcrow.on { background: rgba(255, 91, 54, 0.10); box-shadow: inset 0 0 0 1px rgba(255, 91, 54, 0.25); }
.kr-arcday { font-size: 13.5px; font-weight: 600; flex: none; }
.kr-arcrow.on .kr-arcday { font-weight: 800; }
.kr-arcout { flex: 1; font-size: 10px; font-weight: 600; color: var(--text-secondary); }
```

- [ ] **Step 5: Futtasd, hogy zöld legyen**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/components/ConferenceArchiveSheet.test.tsx
```

Várható: mind a 6 teszt zöld. Ha a `close()` utáni `onPick` nem fut le a `waitFor` ablakán belül, ellenőrizd a `Sheet` `EXIT_MS` értékét (300 ms) — a `waitFor` alapértelmezett timeoutja ennél nagyobb, tehát elégnek kell lennie.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/character/components/ConferenceArchiveSheet.tsx frontend/src/features/character/components/ConferenceArchiveSheet.test.tsx frontend/src/features/character/character.css
git commit -m "feat(character): konzílium archívum lap a lista-oldal helyett (mezo-sp9w)"
```

---

## Task 8: A Beszélgetés nézet

**Files:**
- Create: `frontend/src/features/character/components/KonziliumConversationView.tsx`
- Create: `frontend/src/features/character/components/KonziliumConversationView.test.tsx`
- Modify: `frontend/src/features/character/character.css`

**Interfaces:**
- Consumes: `PersonaOrb`, `expertColor`, `confidenceWord`, `ConferenceThread`, `CharacterExpertDto`.
- Produces:
  ```tsx
  export function KonziliumConversationView({ threads, experts, crossTalkRan }: {
    threads: ConferenceThread[]
    experts: CharacterExpertDto[]
    crossTalkRan: boolean
  }): JSX.Element
  ```

- [ ] **Step 1: Írd meg a bukó tesztet**

Hozd létre: `frontend/src/features/character/components/KonziliumConversationView.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { KonziliumConversationView } from './KonziliumConversationView'
import { MOCK_CONFERENCE_DETAIL, MOCK_EXPERTS } from '@/data/character/characterMock'

const THREADS = MOCK_CONFERENCE_DETAIL.w2.deliberation!

describe('KonziliumConversationView', () => {
  test('mind a négy kör szekciója látszik', () => {
    render(<KonziliumConversationView threads={THREADS} experts={MOCK_EXPERTS} crossTalkRan />)
    for (const label of ['Javaslatok', 'Kereszt-vita', 'Szkeptikus', 'Mezo dönt']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  test('a kereszt-vita blokk idézi, mire reagáltak', () => {
    render(<KonziliumConversationView threads={THREADS} experts={MOCK_EXPERTS} crossTalkRan />)
    expect(screen.getByText(/A hétvégi lefekvés két órával kitolódik/)).toBeInTheDocument()
    expect(screen.getByText('támogatja')).toBeInTheDocument()
    expect(screen.getByText('vitatja')).toBeInTheDocument()
  })

  test('üres kereszt-vita kör megmarad szekcióként és megmondja, hogy nem volt hozzászólás', () => {
    render(<KonziliumConversationView threads={[THREADS[2]]} experts={MOCK_EXPERTS} crossTalkRan />)
    expect(screen.getByText('Kereszt-vita')).toBeInTheDocument()
    expect(screen.getByText('Ebben a körben senki nem szólt hozzá más felvetéséhez.')).toBeInTheDocument()
  })

  test('a kereszt-vita kör előtti konzíliumnál a szekció ezt mondja, nem azt hogy senki nem szólt', () => {
    render(<KonziliumConversationView threads={[THREADS[2]]} experts={MOCK_EXPERTS} crossTalkRan={false} />)
    expect(screen.getByText('Ez a konzílium a kereszt-vita kör bevezetése előtt zajlott.')).toBeInTheDocument()
  })

  test('a válasz nélküli körök is megmaradnak, saját magyarázattal', () => {
    render(<KonziliumConversationView threads={[THREADS[3]]} experts={MOCK_EXPERTS} crossTalkRan />)
    expect(screen.getByText('A Szkeptikus ebben a körben nem adott választ.')).toBeInTheDocument()
    expect(screen.getByText('Ebben a körben nem született döntés.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/components/KonziliumConversationView.test.tsx
```

Várható: `Failed to resolve import "./KonziliumConversationView"`.

- [ ] **Step 3: Írd meg a komponenst**

Hozd létre: `frontend/src/features/character/components/KonziliumConversationView.tsx`

```tsx
// ============================================================
// Mezo · Karakter — KonziliumConversationView (mezo-sp9w)
// Ugyanaz a konzílium, időrendben: a négy kör a fő szerkezet. Az Áttekintés arra válaszol,
// MI történt; ez arra, HOGYAN.
//
// Őszinteség: mind a négy szekció MINDIG látszik. Egy kör, ami nem hozott semmit, a saját
// magyarázatával jelenik meg — sosem tűnik el némán, és a kereszt-vita kör "nem volt ilyen kör"
// és "senki nem szólt hozzá" esete külön szöveget kap.
// ============================================================
import type { CSSProperties } from 'react'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'
import { confidenceWord } from '@/data/character/characterApi'
import type { CharacterExpertDto, ConferenceItem, ConferenceThread } from '@/data/character/characterApi'

const STANCE_LABEL: Record<string, string> = {
  SUPPORT: 'támogatja',
  CHALLENGE: 'vitatja',
  NUANCE: 'árnyalja',
}
const STANCE_TONE: Record<string, string> = { SUPPORT: 'sup', CHALLENGE: 'cha', NUANCE: 'nua' }

const ACCEPTED_LABEL: Record<string, string> = {
  NEW: 'Bekerült',
  UP: 'Megerősítve',
  DOWN: 'Gyengítve',
  RETIRE: 'Nyugdíjazva',
}

const EMPTY_PROPOSALS = 'Ez a konzílium nem tartalmaz felvetést.'
const EMPTY_CROSSTALK_RAN = 'Ebben a körben senki nem szólt hozzá más felvetéséhez.'
const EMPTY_CROSSTALK_ABSENT = 'Ez a konzílium a kereszt-vita kör bevezetése előtt zajlott.'
const EMPTY_SKEPTIC = 'A Szkeptikus ebben a körben nem adott választ.'
const EMPTY_CHAIR = 'Ebben a körben nem született döntés.'

function displayName(experts: CharacterExpertDto[], key: string): string {
  return experts.find((e) => e.key === key)?.displayName ?? key
}

function Turn({ expertKey, name, chip, chipTone, children }: {
  expertKey: string
  name: string
  chip?: string
  chipTone?: string
  children: React.ReactNode
}) {
  return (
    <div className="kr-cvturn" style={{ '--c': expertColor(expertKey) } as CSSProperties}>
      <span className="kr-cvorb"><PersonaOrb expertKey={expertKey} size={23} /></span>
      <div>
        <div className="kr-thwho">
          {name}
          {chip != null && <span className={`kr-thchip ${chipTone ?? 'non'}`}>{chip}</span>}
        </div>
        <div className="kr-thsaid">{children}</div>
      </div>
    </div>
  )
}

function Section({ n, label, hot, empty, children }: {
  n: number
  label: string
  hot?: boolean
  empty?: string
  children?: React.ReactNode
}) {
  return (
    <>
      <div className={`kr-cvlbl${hot === true ? ' hot' : ''}`}>
        <span className="kr-rn">{n}</span>{label}
      </div>
      {empty != null ? <div className="kr-cvempty">{empty}</div> : children}
    </>
  )
}

export function KonziliumConversationView({ threads, experts, crossTalkRan }: {
  threads: ConferenceThread[]
  experts: CharacterExpertDto[]
  crossTalkRan: boolean
}) {
  const items: ConferenceItem[] = threads.flatMap((thread) => thread.items)
  const debated = items.filter((item) => item.reactions.length > 0)
  const audited = items.filter((item) => item.skeptic != null)
  const ruled = items.filter((item) => item.chair != null)

  return (
    <div className="kr-cv">
      <Section n={1} label="Javaslatok" empty={items.length === 0 ? EMPTY_PROPOSALS : undefined}>
        {items.map((item) => (
          <div className="kr-konzcard kr-cvcard" key={`p-${item.index}`}>
            <Turn expertKey={item.expertKey} name={displayName(experts, item.expertKey)}>{item.text}</Turn>
          </div>
        ))}
      </Section>

      <Section
        n={2}
        label="Kereszt-vita"
        hot={debated.length > 0}
        empty={debated.length > 0 ? undefined : crossTalkRan ? EMPTY_CROSSTALK_RAN : EMPTY_CROSSTALK_ABSENT}
      >
        {debated.map((item) => (
          <div className="kr-konzcard kr-cvcard" key={`x-${item.index}`}>
            <div className="kr-cvquote">{`„${item.text}" — ${displayName(experts, item.expertKey)}`}</div>
            {item.reactions.map((reaction, i) => (
              <Turn
                key={i}
                expertKey={reaction.expertKey}
                name={displayName(experts, reaction.expertKey)}
                chip={STANCE_LABEL[reaction.stance] ?? 'hozzászólt'}
                chipTone={STANCE_TONE[reaction.stance]}
              >
                {reaction.argument}
              </Turn>
            ))}
          </div>
        ))}
      </Section>

      <Section n={3} label="Szkeptikus" empty={audited.length === 0 ? EMPTY_SKEPTIC : undefined}>
        {audited.map((item) => (
          <div className="kr-konzcard kr-cvcard" key={`s-${item.index}`}>
            <Turn
              expertKey="szkeptikus"
              name="Szkeptikus"
              chip={item.skeptic!.verdict === 'KILL' ? 'kukázta' : 'meghagyta'}
              chipTone={item.skeptic!.verdict === 'KILL' ? 'cha' : 'sup'}
            >
              {item.skeptic!.argument}
            </Turn>
          </div>
        ))}
      </Section>

      <Section n={4} label="Mezo dönt" empty={ruled.length === 0 ? EMPTY_CHAIR : undefined}>
        {ruled.map((item) => {
          const chair = item.chair!
          const label = chair.accepted
            ? `${(item.kind != null && ACCEPTED_LABEL[item.kind]) || 'Elfogadva'}${
                chair.confidence != null ? ` · ${confidenceWord(chair.confidence)}` : ''}`
            : 'Elvetve'
          return (
            <div className="kr-konzcard kr-cvcard kr-cvmezo" key={`r-${item.index}`}>
              <Turn expertKey="mezo" name="Mezo" chip={label} chipTone={chair.accepted ? 'acc' : 'rej'}>
                {chair.reason}
              </Turn>
            </div>
          )
        })}
      </Section>
    </div>
  )
}
```

- [ ] **Step 4: Vedd fel a CSS-t**

A `frontend/src/features/character/character.css` végére:

```css
/* ── konzílium beszélgetés-nézet (mezo-sp9w) ── */
.kr-cvlbl { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); padding: 14px 16px 8px; }
.kr-cvlbl.hot { color: #C0442A; }
.kr-cvlbl .kr-rn { margin-bottom: 0; }
.kr-cvlbl.hot .kr-rn { background: var(--primary, #FF5B36); color: #fff; }
.kr-cvcard { padding: 12px 15px 13px; }
.kr-cvmezo { box-shadow: 0 12px 26px -20px rgba(255, 91, 54, 0.9), inset 0 0 0 1px rgba(255, 91, 54, 0.2); }
.kr-cvturn { display: flex; gap: 11px; align-items: flex-start; padding: 7px 0; }
.kr-cvturn + .kr-cvturn { border-top: 0.5px solid var(--divider); }
.kr-cvorb { flex: none; width: 23px; height: 23px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; box-shadow: 0 3px 7px -3px var(--c); }
.kr-cvquote { font-size: 11px; font-weight: 600; color: var(--text-muted); border-left: 2px solid var(--divider); padding-left: 9px; margin-bottom: 8px; line-height: 1.45; }
.kr-cvempty { margin: 0 12px 11px; padding: 13px 16px; border-radius: 18px; background: rgba(43, 33, 24, 0.04); font-size: 11.5px; font-weight: 400; line-height: 1.5; color: var(--text-secondary); }
```

- [ ] **Step 5: Futtasd, hogy zöld legyen**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/components/KonziliumConversationView.test.tsx
```

Várható: mind az 5 teszt zöld.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/character/components/KonziliumConversationView.tsx frontend/src/features/character/components/KonziliumConversationView.test.tsx frontend/src/features/character/character.css
git commit -m "feat(character): Beszélgetés nézet a konzílium négy körével (mezo-sp9w)"
```

---

## Task 9: A Konzílium oldal átírása

**Files:**
- Modify: `frontend/src/features/character/pages/KonziliumPage.tsx`
- Modify: `frontend/src/features/character/pages/KonziliumPage.test.tsx`
- Modify: `frontend/src/features/character/character.css`

**Interfaces:**
- Consumes: `KonziliumWhatIs` + `KonziliumRoundMap` (Task 6), `ConferenceArchiveSheet` (Task 7), `KonziliumConversationView` (Task 8), `ConferenceThreadCard` a `crossTalkRan` proppal (Task 5), `deliberationStats` (Task 3).
- Produces: az átírt oldal. Ez az utolsó kódtask.

- [ ] **Step 1: Írd meg a bukó teszteket**

A `KonziliumPage.test.tsx`-be — a fájl meglévő `renderAt(path)` segédjét és hook-mockjait használva — vedd fel:

```tsx
  test('id nélkül a legutóbbi konzílium nyílik, nem lista', () => {
    renderAt('/me/karakter/konzilium')
    expect(screen.getByText('Hogyan zajlott')).toBeInTheDocument()
    expect(screen.queryByText(/vissza a listához/)).not.toBeInTheDocument()
  })

  test('pontosan egy visszalépő vezérlő van a lapon', () => {
    renderAt('/me/karakter/konzilium')
    expect(screen.getAllByRole('button', { name: 'Vissza' })).toHaveLength(1)
  })

  test('a legutóbbi konzíliumon a későbbi-nyíl le van tiltva', () => {
    renderAt('/me/karakter/konzilium')
    expect(screen.getByRole('button', { name: 'Későbbi tanácskozás' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Korábbi tanácskozás' })).toBeEnabled()
  })

  test('a legrégebbi konzíliumon a korábbi-nyíl le van tiltva', () => {
    renderAt('/me/karakter/konzilium?id=b0')
    expect(screen.getByRole('button', { name: 'Korábbi tanácskozás' })).toBeDisabled()
  })

  test('a dátum-gomb megnyitja az archívum lapot', async () => {
    renderAt('/me/karakter/konzilium')
    await userEvent.click(screen.getByRole('button', { name: /augusztus 30/ }))
    expect(await screen.findByText('Korábbi tanácskozások')).toBeInTheDocument()
  })

  test('a Beszélgetés váltó a kör-nézetre vált', async () => {
    renderAt('/me/karakter/konzilium')
    await userEvent.click(screen.getByRole('button', { name: 'Beszélgetés' }))
    expect(screen.getByText('Javaslatok')).toBeInTheDocument()
    expect(screen.queryByText('Hogyan zajlott')).not.toBeInTheDocument()
  })

  test('visszafejtett szálnál a kereszt-vita kör nem létezőként jelenik meg', () => {
    renderAt('/me/karakter/konzilium?id=w1')
    expect(screen.getByText('nem volt ilyen kör')).toBeInTheDocument()
  })
```

A meglévő, lista-viselkedést állító tesztek (pl. „a lista sorára kattintva megnyílik a transzkript") **törlendők** — az a viselkedés megszűnt. A tranzskript-fallback teszteket (`deliberation == null`) tartsd meg.

- [ ] **Step 2: Futtasd, hogy bukjon**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character/pages/KonziliumPage.test.tsx
```

Várható: bukás — nincs léptető, van „vissza a listához".

- [ ] **Step 3: Írd át az oldalt**

Cseréld a `frontend/src/features/character/pages/KonziliumPage.tsx` teljes tartalmát erre:

```tsx
// ============================================================
// Mezo · Karakter — KonziliumPage (mezo-sp9w)
// Döntés-első felület. A régi lista+részlet kettősség megszűnt: `?id=` nélkül a LEGUTÓBBI
// tanácskozás nyílik, a korábbiakat a fejléc léptetője és az archívum lap éri el. Ezért van a
// lapon pontosan EGY visszalépő vezérlő (`PageHead`) — a "vissza a listához" gomb megszűnt.
//
// A lap három rétege, ebben a sorrendben: kontextus (Mi ez + Hogyan zajlott) → eredmény
// (Mi változott a dossziédban) → a vita (szálak, vagy a Beszélgetés nézet köreiben).
//
// Két forrás, két címke, soha nem összevonva:
// - "Mi változott a dossziédban" a `changes[]`-ből számol — ez a TARTÓS hatás;
// - a kör-térkép 4. cellája a `deliberation`-ből — ezek a tanácskozás DÖNTÉSEI.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { PageHead } from '@/shared/ui/mozaik'
import { useCharacterConference, useCharacterConferences, useCharacterExperts } from '@/data/hooks'
import { TranscriptTurn } from '@/features/character/components/TranscriptTurn'
import { ConferenceThreadCard } from '@/features/character/components/ConferenceThreadCard'
import { ConferenceArchiveSheet } from '@/features/character/components/ConferenceArchiveSheet'
import { KonziliumRoundMap, KonziliumWhatIs } from '@/features/character/components/KonziliumRoundMap'
import { KonziliumConversationView } from '@/features/character/components/KonziliumConversationView'
import { expertColor } from '@/features/character/expertColors'
import type { CharacterConferenceSummary, CharacterExpertDto, ConferenceTurn } from '@/data/character/characterApi'

const KIND_WORD: Record<CharacterConferenceSummary['kind'], string> = {
  WEEKLY: 'heti',
  MONTHLY: 'havi',
  BOOTSTRAP: 'első beolvasás',
}

const HONESTY_NOTE = 'A fenti a valódi beszélgetés, ami lezajlott — a felület sosem dramatizálja '
  + 'utólag; amit itt olvasol, azt a csapat pontosan így mondta.'

const ACCEPTED = 'CLAIM_ACCEPTED'
const RETIRED = 'CLAIM_RETIRED'
const REWRITTEN = 'PORTRAIT_REWRITTEN'

function headerDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })
}

type TurnKind = 'EXPERT' | 'SKEPTIC' | 'CHAIR'

function turnKindOf(persona: string, experts: CharacterExpertDto[]): TurnKind {
  const kind = experts.find((e) => e.key === persona)?.kind
  return kind === 'SKEPTIC' ? 'SKEPTIC' : kind === 'CHAIR' ? 'CHAIR' : 'EXPERT'
}

function phaseOf(kind: TurnKind): string {
  if (kind === 'SKEPTIC') return 'A Szkeptikus'
  if (kind === 'CHAIR') return 'Döntés'
  return 'Javaslatok'
}

type Block =
  | { block: 'phase'; label: string }
  | { block: 'group'; turns: ConferenceTurn[]; kinds: TurnKind[] }
  | { block: 'ruling'; turn: ConferenceTurn }

/** The prose fallback for a conference whose threads could not be derived at all. */
function buildBlocks(turns: ConferenceTurn[], experts: CharacterExpertDto[]): Block[] {
  const blocks: Block[] = []
  let lastPhase: string | null = null
  let group: (Block & { block: 'group' }) | null = null

  for (const turn of turns) {
    const kind = turnKindOf(turn.persona, experts)
    const phase = phaseOf(kind)
    if (phase !== lastPhase) {
      group = null
      blocks.push({ block: 'phase', label: phase })
      lastPhase = phase
    }
    if (kind === 'CHAIR') {
      blocks.push({ block: 'ruling', turn })
      group = null
    } else {
      if (group == null) {
        group = { block: 'group', turns: [], kinds: [] }
        blocks.push(group)
      }
      group.turns.push(turn)
      group.kinds.push(kind)
    }
  }
  return blocks
}

export function KonziliumPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { conferences, isLoading: listLoading } = useCharacterConferences()
  const { experts, isLoading: expertsLoading } = useCharacterExperts()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [view, setView] = useState<'overview' | 'conversation'>('overview')

  // `?id=` absent means "the latest" — the list arrives generatedAt DESC, so index 0 is it.
  const requestedId = params.get('id')
  const currentId = requestedId ?? (conferences.length > 0 ? conferences[0].id : null)
  const { conference, isLoading: detailLoading } = useCharacterConference(currentId)

  // Folding expertsLoading in matters: without it the window between the conference settling and
  // the expert catalog arriving misclassifies every turn as a plain EXPERT (mezo-xlvr, I5).
  if (listLoading || (currentId != null && detailLoading) || expertsLoading) return null

  const index = conferences.findIndex((c) => c.id === currentId)
  const olderId = index >= 0 && index + 1 < conferences.length ? conferences[index + 1].id : null
  const newerId = index > 0 ? conferences[index - 1].id : null

  function go(id: string | null) {
    if (id == null) return
    setParams({ id })
    setView('overview')
  }

  if (conferences.length === 0) {
    return (
      <div className="kr-hub">
        <PageHead onBack={() => navigate('/me/karakter')} label="‹ Karakter" />
        <div className="mz-page-hero"><div className="mz-hero-nm">Konzílium</div></div>
        <div className="mz-page-body">
          <div className="kr-konz-empty">Egyelőre nincs konzílium — a csapat hetente tanácskozik, ez az első hét még nem zajlott le.</div>
        </div>
      </div>
    )
  }

  const summary = index >= 0 ? conferences[index] : null
  const crossTalkRan = conference?.deliberationSource === 'STORED'
  const threads = conference?.deliberation ?? null

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/me/karakter')} label="‹ Karakter" />
      <div className="mz-page-hero">
        <div className="mz-hero-nm">Konzílium</div>
        {summary != null && (
          <div className="kr-stepper">
            <button
              type="button"
              className="kr-navbtn"
              aria-label="Korábbi tanácskozás"
              disabled={olderId == null}
              onClick={() => go(olderId)}
            >‹</button>
            <button
              type="button"
              className="kr-datebtn"
              aria-haspopup="dialog"
              onClick={() => setArchiveOpen(true)}
            >
              {`${headerDate(summary.generatedAt)} · ${KIND_WORD[summary.kind]}`}
              <span className="kr-datecv" aria-hidden="true">⌄</span>
            </button>
            <button
              type="button"
              className="kr-navbtn"
              aria-label="Későbbi tanácskozás"
              disabled={newerId == null}
              onClick={() => go(newerId)}
            >›</button>
          </div>
        )}
      </div>

      {conference == null && (
        <div className="mz-page-body">
          <div className="kr-konz-empty">Ez a konzílium nem található.</div>
        </div>
      )}

      {conference != null && (
        <div className="mz-page-body">
          {threads != null && (
            <div className="kr-seg" role="group" aria-label="Nézet">
              <button
                type="button"
                className={view === 'overview' ? 'on' : ''}
                onClick={() => setView('overview')}
              >Áttekintés</button>
              <button
                type="button"
                className={view === 'conversation' ? 'on' : ''}
                onClick={() => setView('conversation')}
              >Beszélgetés</button>
            </div>
          )}

          {view === 'conversation' && threads != null
            ? <KonziliumConversationView threads={threads} experts={experts} crossTalkRan={crossTalkRan} />
            : (
                <>
                  <KonziliumWhatIs kind={conference.kind} />
                  {threads != null && <KonziliumRoundMap threads={threads} crossTalkRan={crossTalkRan} />}

                  {(() => {
                    const accepted = conference.changes.filter((c) => c.kind === ACCEPTED).length
                    const retired = conference.changes.filter((c) => c.kind === RETIRED).length
                    const rewritten = conference.changes.filter((c) => c.kind === REWRITTEN).length
                    const extras = conference.changes.filter((c) => ![ACCEPTED, RETIRED, REWRITTEN].includes(c.kind))
                    return (
                      <div className="kr-outcomehd">
                        <div className="kr-oh-title">Mi változott a dossziédban</div>
                        <div className="kr-outcells">
                          <div className="kr-outcell" style={{ '--ow': 'rgba(143,175,126,0.2)', '--oc': '#4E6B42' } as CSSProperties}>
                            <b>{accepted}</b><small>bekerült</small>
                          </div>
                          <div className="kr-outcell" style={{ '--ow': 'rgba(201,150,46,0.18)', '--oc': '#A8801F' } as CSSProperties}>
                            <b>{retired}</b><small>nyugdíjazva</small>
                          </div>
                          <div className="kr-outcell" style={{ '--ow': 'rgba(138,118,204,0.16)', '--oc': '#5D4FA0' } as CSSProperties}>
                            <b>{rewritten}</b><small>portré átírva</small>
                          </div>
                        </div>
                        {extras.map((c, i) => <div className="kr-outcome-extra" key={i}>{c.summary}</div>)}
                      </div>
                    )
                  })()}

                  {threads != null
                    ? threads.map((thread, i) => (
                        <ConferenceThreadCard
                          key={`${thread.title}-${i}`}
                          thread={thread}
                          experts={experts}
                          crossTalkRan={crossTalkRan}
                        />
                      ))
                    : buildBlocks(conference.transcript, experts).map((b, i) => {
                        if (b.block === 'phase') return <div className="kr-phaselbl" key={i}>{b.label}</div>
                        if (b.block === 'ruling') {
                          return (
                            <TranscriptTurn
                              key={i}
                              turn={b.turn}
                              kind="CHAIR"
                              displayName={experts.find((e) => e.key === b.turn.persona)?.displayName ?? 'Mezo'}
                              color={expertColor(b.turn.persona)}
                              delayMs={i * 90}
                            />
                          )
                        }
                        return (
                          <div className="kr-turnsgroup" key={i}>
                            {b.turns.map((turn, ti) => (
                              <TranscriptTurn
                                key={ti}
                                turn={turn}
                                kind={b.kinds[ti]}
                                displayName={experts.find((e) => e.key === turn.persona)?.displayName ?? turn.persona}
                                color={expertColor(turn.persona)}
                                delayMs={(i + ti) * 90}
                              />
                            ))}
                          </div>
                        )
                      })}
                </>
              )}

          <p className="kr-honestynote">{HONESTY_NOTE}</p>
        </div>
      )}

      {archiveOpen && (
        <ConferenceArchiveSheet
          conferences={conferences}
          currentId={currentId}
          onPick={(id) => go(id)}
          onClose={() => setArchiveOpen(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Vedd fel a CSS-t**

A `frontend/src/features/character/character.css` végére:

```css
/* ── konzílium fejléc-léptető és nézetváltó (mezo-sp9w) ── */
.kr-stepper { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 6px; }
.kr-navbtn { border: none; background: var(--surface-card); width: 30px; height: 30px; border-radius: 50%; font-size: 16px; font-family: inherit; color: var(--text-secondary); box-shadow: 0 6px 14px -11px rgba(43, 33, 24, 0.9); cursor: pointer; }
.kr-navbtn:disabled { opacity: 0.32; cursor: default; }
.kr-datebtn { border: none; background: var(--surface-card); border-radius: 20px; padding: 7px 14px; font-family: inherit; font-size: 12.5px; font-weight: 700; color: inherit; box-shadow: 0 6px 14px -11px rgba(43, 33, 24, 0.9); cursor: pointer; }
.kr-datecv { color: var(--text-muted); margin-left: 3px; }
.kr-seg { display: flex; gap: 4px; margin: 2px 12px 12px; background: rgba(43, 33, 24, 0.06); border-radius: 20px; padding: 3px; }
.kr-seg button { flex: 1; border: none; background: none; font-family: inherit; text-align: center; font-size: 12px; font-weight: 700; padding: 7px 0; border-radius: 18px; color: var(--text-secondary); cursor: pointer; }
.kr-seg button.on { background: var(--surface-card); color: inherit; box-shadow: 0 4px 10px -8px rgba(43, 33, 24, 0.8); }
```

Emellett a `.kr-konzrow` / `.kr-kd` / `.kr-konzlist` szabályok a lista-oldalhoz tartoztak. A `.kr-kbadge*` szabályokat **tartsd meg** (az archívum lap használja őket); a `.kr-konzrow`, `.kr-kd` és `.kr-konzlist` szabályokat töröld, ha a `grep -rn "kr-konzrow\|kr-konzlist" frontend/src` már nem talál hívóhelyet.

- [ ] **Step 5: Futtasd a teljes Karakter-tesztkört**

```bash
cd frontend && CI=true pnpm exec vitest run src/features/character
```

Várható: minden zöld. Ha egy meglévő teszt a törölt lista-viselkedésre állít, töröld azt a tesztet — a viselkedés szándékosan szűnt meg.

- [ ] **Step 6: Futtasd mindkét FE kaput és a buildet**

```bash
cd frontend && CI=true pnpm test
```

```bash
cd frontend && CI=true VITE_USE_MOCK=false pnpm test
```

```bash
cd frontend && pnpm build
```

Várható: mindhárom zöld. **Ha egy bukó teszt nem a Karakterhez tartozik**, futtasd le ugyanazt egy tiszta `git worktree add --detach /tmp/mainctl origin/main` fán — ha ott is bukik, a main piros és nem a te diffed hibája.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/character/pages/KonziliumPage.tsx frontend/src/features/character/pages/KonziliumPage.test.tsx frontend/src/features/character/character.css
git commit -m "feat(character): döntés-első Konzílium oldal léptetővel és nézetváltóval (mezo-sp9w)"
```

---

## Task 10: Dokumentáció

**Files:**
- Modify: `docs/features/character.md`
- Modify: `docs/CODEMAP.md`

**Interfaces:**
- Consumes: minden korábbi task eredménye.
- Produces: naprakész feature-dokumentáció és kódtérkép.

- [ ] **Step 1: Frissítsd a feature-dokumentációt**

A `docs/features/character.md`-ben:

1. A frontmatter `updated:` mezőjét állítsd `2026-09-07`-re.
2. Abban a szakaszban, ami a Konzílium felületét írja le (keresd a „Konzílium" szót), írd le az új szerkezetet: `?id=` nélkül a legutóbbi tanácskozás nyílik; a lista-oldal megszűnt, helyette fejléc-léptető és archívum lap; a lap három rétege (Mi ez → Hogyan zajlott → Mi változott a dossziédban → a vita); `Áttekintés / Beszélgetés` váltó.
3. Rögzítsd a két őszinteség-szabályt saját bekezdésben: **(a)** a kör-térkép minden száma a `deliberation`-ből számolódik, a „Mi változott a dossziédban" pedig a `changes[]`-ből — a kettő szándékosan külön él és külön címkét visel; **(b)** a `deliberationSource: DERIVED` konzíliumokon a kereszt-vita kör „nem volt ilyen kör"-t mutat, mert a `0 hozzászólás` azt sugallná, hogy a kör lefutott.
4. Vedd fel a két új contract-mezőt (`CharacterConferenceSummary.outcome`, `CharacterConferenceResponse.deliberationSource`) a szerződést leíró szakaszba.
5. Ha a doc `key_files` listát vezet, vedd fel az új komponenseket: `KonziliumRoundMap.tsx`, `ConferenceArchiveSheet.tsx`, `KonziliumConversationView.tsx`, `deliberationStats.ts`.

- [ ] **Step 2: Generáld újra a kódtérképet**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 3: Futtasd a doc-kapukat**

```bash
node scripts/gen-codemap.mjs --check
```

```bash
node scripts/lint-docs.mjs --errors-only
```

```bash
node scripts/lint-liquibase.mjs
```

Várható: mindhárom zöld. A `lint-docs.mjs`-t **pontosan ezzel a kapcsolóval** futtasd — a csupasz alak a mainen is meglévő stale-doc alapvonalon bukik, és az nem merge-blokkoló.

- [ ] **Step 4: Commit**

```bash
git add docs/features/character.md docs/CODEMAP.md
git commit -m "docs(character): a Konzílium döntés-első felülete (mezo-sp9w)"
```

---

## Self-Review

**Spec-lefedettség**

| Spec szakasz | Task |
|---|---|
| §5 fejléc-léptető, egyetlen visszalépés | Task 9 |
| §5 archívum lap, hónap/év tagolás, kimenet a sorban | Task 7 (+ Task 1–2 a kimenet forrásához) |
| §6.1 „Mi ez" három szöveggel | Task 6 |
| §6.2 kör-térkép, „nem volt ilyen kör" | Task 3 + Task 6 |
| §6.3 „Mi változott a dossziédban" címkézés | Task 9 |
| §6.4 `Áttekintés / Beszélgetés` váltó | Task 9 |
| §6.5a beszédes szálfejléc | Task 5 |
| §6.5b orb-lánc pötty helyett | Task 5 |
| §6.5c állásfoglalás-chipek | Task 5 |
| §6.6 Beszélgetés nézet négy körrel | Task 8 |
| §7a `ConferenceOutcomeCounts` | Task 1 + Task 2 |
| §7b `deliberationSource` | Task 1 + Task 2 |
| §8 mock-fixtúrák | Task 4 |
| §9 tesztelés | minden task saját tesztciklusa |
| §10 amit nem csinálunk | nincs task — a terv nem is tartalmaz ilyet |

**Típus-konzisztencia**
- `deliberationStats(threads)` → `DeliberationStats` — definiálva Task 3, használva Task 6.
- `ConferenceThreadCard` `crossTalkRan: boolean` — definiálva Task 5, átadva Task 9.
- `KonziliumWhatIs({ kind })` / `KonziliumRoundMap({ threads, crossTalkRan })` — definiálva Task 6, hívva Task 9.
- `ConferenceArchiveSheet({ conferences, currentId, onPick, onClose })` — definiálva Task 7, hívva Task 9.
- `KonziliumConversationView({ threads, experts, crossTalkRan })` — definiálva Task 8, hívva Task 9.
- `ConferenceOutcomeCounts` — sémanév Task 1, Java builder Task 2, TS mező Task 4 és Task 7.
- `.kr-thchip` tone-készlet (`sup`/`cha`/`nua`/`acc`/`rej`/`non`) — CSS Task 5, használva Task 5 és Task 8.
