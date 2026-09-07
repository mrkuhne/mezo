# Karakter konzílium szál-nézet + kereszt-vita kör — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A heti konzílium tanácskozása strukturáltan mentődik és szálakban olvasható, egy valódi kereszt-vita körrel kiegészítve, plusz két apró hiba javítása (azonosító a megfigyelés szövegében, végtelen Feed).

**Architecture:** A `character_conference` sor új `deliberation` jsonb oszlopot kap a meglévő `transcript` mellett. A javaslat-kör és a verdikt-kör közé új `KonziliumCrossTalkRound` kerül, ami csak a 2+ szakértő által érintett fejezetekre hív modellt, és állásfoglalásokat ad vissza; ezeket Mezo prompt-ja megkapja. A `DeliberationAssembler` a javaslatokból, reakciókból, Szkeptikus-verdiktekből és Mezo döntéseiből építi a szálakat. Régi sorokra a `LegacyTranscriptParser` olvasáskor fejti vissza ugyanezt a szerkezetet, mentés nélkül. A felület szál-nézetre vált, ha van `deliberation`, különben a mai átirat-nézetet mutatja.

**Tech Stack:** Spring Boot 4 (Jackson 3, `tools.jackson`), Hibernate 7 jsonb envelope recordok, Liquibase, OpenAPI-generált DTO-k, React + TanStack Query + vitest.

**bd:** mezo-xlvr · **Spec:** `docs/superpowers/specs/2026-09-06-karakter-konzilium-szal-nezet-design.md`

## Global Constraints

- Minden commit üzenete hordozza a bd id-t: `feat(character): ... (mezo-xlvr)`, és `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` sorral zárul.
- **Soha ne stage-eld a repó gyökerében lévő `issues.jsonl` fájlt.** Commit előtt `git status --short` és ha ott van, `git rm --cached issues.jsonl`.
- Fókuszált backend kapu (a teljes suite CI-ban fut):
  `./mvnw test -Dtest='*Character*,DetectorTest,Konzilium*,ClaimLifecycleIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` a `backend/` könyvtárból. Soha ne futtass két mvnw buildet egyszerre.
- A `-Dtest` szűrő kihagyja a `@Nested` belső osztályokat; egy 0 tesztet jelentő IT nem zöld, csak nem futott. A CI teljes suite-ja fedi.
- Frontend kapu a `frontend/` könyvtárból: `pnpm test` ÉS `VITE_USE_MOCK=false pnpm test` ÉS `pnpm build`.
- Szerződés-változás után mindkét generátor egy commitban: `cd api/generate && npm run generate:api`, majd `cd frontend && pnpm generate:api`.
- `node scripts/gen-codemap.mjs` a strukturális változások után; `node scripts/lint-docs.mjs --errors-only` (pontosan ezzel a kapcsolóval); `node scripts/lint-liquibase.mjs`.
- **Ha az `ArchitectureTest` új vagy szélesített befagyasztott ciklust jelent: ÁLLJ MEG, jelentsd BLOCKED-ként.** A `backend/src/test/resources/archunit-store/` fájljaihoz soha ne nyúlj.
- A magabiztosság a felületen sosem nyers szám: `confidenceWord()` (frontend) és `CharacterConfidenceWords` (backend).
- Új LLM-kör markere LITERÁLIS sztringként tükröződik a `FakeCompanionLlm`-ben (feature-ciklus szabály), és egy IT ellenőrzi az egyezést.
- Minden új osztály a `feature/character` szeleten belül marad; új kereszt-feature import tilos.
- A jsonb mezők mindig tipizált envelope recordot használnak, soha nem nyers `List<String>`-et.

---

## File Structure

**Backend — új fájlok**

- `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ConferenceDeliberationEnvelope.java` — a strukturált tanácskozás jsonb alakja.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumCrossTalkRound.java` — a kereszt-vita LLM-kör.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/DeliberationAssembler.java` — a szálak összeállítása a kör kimeneteiből.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/LegacyTranscriptParser.java` — régi próza-átirat visszafejtése.
- `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/ObservationText.java` — az azonosító-előtag levágása olvasáskor.
- `backend/src/main/resources/db/changelog/1.0.0/script/202609070900_mezo-xlvr_conference_deliberation.sql`

**Backend — módosuló fájlok**

- `entity/CharacterConferenceEntity.java` — új `deliberation` mező.
- `service/KonziliumVerdictRound.java` — reakciók a Mezo prompt-ba, a Szkeptikus verdiktjei a `Result`-ban.
- `service/CharacterConferenceService.java` — a kereszt-vita kör beillesztése, a deliberation mentése.
- `service/CharacterService.java` — `deliberation` a DTO-ban, előtag-levágás a feed és futás nézetben.
- `service/CharacterFeedbackService.java` — az előtag már nem kerül a mentett szövegbe.
- `service/KonziliumProposalRound.java` — az előtag a bizonyíték-sorba kerül, a jel-hivatkozásból.
- `feature/companion/llm/FakeCompanionLlm.java` — kereszt-vita marker, sentinel, konzerv válasz.

**Frontend**

- `frontend/src/features/character/components/ConferenceThreadCard.tsx` — új szál-kártya.
- `frontend/src/features/character/pages/KonziliumPage.tsx` — szál-nézet vagy legacy fallback.
- `frontend/src/features/character/pages/CharacterFeedPage.tsx` — nap-összecsukás.
- `frontend/src/features/character/character.css` — szál-kártya és nap-fejléc stílusok.
- `frontend/src/data/character/characterApi.ts` — új típus-exportok.
- `frontend/src/data/character/characterMock.ts` — deliberation fixture.

**Szerződés**

- `api/feature/character/character.yml` — új sémák + `deliberation` mező.

**Docs**

- `docs/features/character.md`, `docs/decisions/0037-konzilium-cross-talk-round.md`, `docs/CODEMAP.md`.

---

### Task 1: A deliberation envelope és az oszlop

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ConferenceDeliberationEnvelope.java`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609070900_mezo-xlvr_conference_deliberation.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/changelog-1.0.0.yml` (a fájl végére, az utolsó changeSet mintájára)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/CharacterConferenceEntity.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/ConferenceDeliberationEnvelopeIT.java`

**Interfaces:**
- Produces: `ConferenceDeliberationEnvelope(List<Thread> threads)`, `Thread(String dimensionKey, String title, List<Item> items)`, `Item(int index, String expertKey, String text, String kind, String claimId, boolean sensitive, List<PeerReaction> reactions, SkepticVerdict skeptic, ChairRuling chair)`, `PeerReaction(String expertKey, String stance, String argument)`, `SkepticVerdict(String verdict, String argument)`, `ChairRuling(boolean accepted, BigDecimal confidence, String reason)`; `CharacterConferenceEntity#getDeliberation()` / `#setDeliberation(...)` (nullable).

- [ ] **Step 1: Írd meg a bukó tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/character/ConferenceDeliberationEnvelopeIT.java`:

```java
package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The new deliberation jsonb column round-trips, and stays null on rows that never had one. */
class ConferenceDeliberationEnvelopeIT extends ApiIntegrationTest {

    @Autowired private CharacterConferenceRepository conferenceRepository;
    @Autowired private OwnerProperties ownerProperties;

    private CharacterConferenceEntity newConference(UUID owner) {
        CharacterConferenceEntity conference = new CharacterConferenceEntity();
        conference.setCreatedBy(owner);
        conference.setKind("WEEKLY");
        conference.setWeekStart(LocalDate.of(2026, 8, 24));
        conference.setGeneratedAt(Instant.now());
        conference.setTranscript(new ConferenceTranscriptEnvelope(List.of()));
        conference.setOutcome(new ConferenceOutcomeEnvelope(List.of()));
        return conference;
    }

    @Test
    void deliberation_roundTripsThroughJsonb() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        CharacterConferenceEntity conference = newConference(owner);
        conference.setDeliberation(new ConferenceDeliberationEnvelope(List.of(
                new ConferenceDeliberationEnvelope.Thread("recovery", "Regeneráció", List.of(
                        new ConferenceDeliberationEnvelope.Item(0, "szomnologus", "Romlik az alvás.", "NEW",
                                null, false,
                                List.of(new ConferenceDeliberationEnvelope.PeerReaction(
                                        "pszichologus", "CHALLENGE", "Lehet stressz is.")),
                                new ConferenceDeliberationEnvelope.SkepticVerdict("KILL", "Kevés adat."),
                                new ConferenceDeliberationEnvelope.ChairRuling(
                                        false, new BigDecimal("0.40"), "Nem engedem be."))))));

        UUID id = conferenceRepository.saveAndFlush(conference).getId();
        conferenceRepository.flush();
        CharacterConferenceEntity loaded = conferenceRepository.findById(id).orElseThrow();

        assertThat(loaded.getDeliberation().threads()).hasSize(1);
        ConferenceDeliberationEnvelope.Thread thread = loaded.getDeliberation().threads().get(0);
        assertThat(thread.dimensionKey()).isEqualTo("recovery");
        assertThat(thread.title()).isEqualTo("Regeneráció");
        assertThat(thread.items()).hasSize(1);
        ConferenceDeliberationEnvelope.Item item = thread.items().get(0);
        assertThat(item.index()).isZero();
        assertThat(item.expertKey()).isEqualTo("szomnologus");
        assertThat(item.reactions()).singleElement()
                .satisfies(reaction -> assertThat(reaction.stance()).isEqualTo("CHALLENGE"));
        assertThat(item.skeptic().verdict()).isEqualTo("KILL");
        assertThat(item.chair().accepted()).isFalse();
        assertThat(item.chair().confidence()).isEqualByComparingTo(new BigDecimal("0.40"));
    }

    @Test
    void deliberation_staysNull_whenNeverSet() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());

        UUID id = conferenceRepository.saveAndFlush(newConference(owner)).getId();
        conferenceRepository.flush();

        assertThat(conferenceRepository.findById(id).orElseThrow().getDeliberation()).isNull();
    }
}
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run (a `backend/` könyvtárból): `./mvnw test -Dtest='ConferenceDeliberationEnvelopeIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `ConferenceDeliberationEnvelope` nem létezik (fordítási hiba).

- [ ] **Step 3: Írd meg az envelope-ot**

`backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ConferenceDeliberationEnvelope.java`:

```java
package io.mrkuhne.mezo.feature.character.entity;

import java.math.BigDecimal;
import java.util.List;

/**
 * The konzílium's exchange as a STRUCTURE (mezo-xlvr): one thread per dossier chapter the
 * council touched, one item per proposal, each item carrying the whole chain that happened to
 * it — the peers who reacted, the Szkeptikus's verdict, the chair's ruling. The prose
 * {@link ConferenceTranscriptEnvelope} stays alongside it: this record does not replace what
 * was said, it stops the round from throwing away HOW it hung together.
 *
 * <p>{@code skeptic} and {@code chair} are nullable on purpose: a round whose answer failed to
 * parse produced no verdict, and fabricating a default one would misreport the meeting.
 */
public record ConferenceDeliberationEnvelope(List<Thread> threads) {

    /** One dossier chapter's thread. {@code dimensionKey} is null for a legacy, expert-grouped
     *  thread (see {@code LegacyTranscriptParser}); {@code title} is then the expert's name. */
    public record Thread(String dimensionKey, String title, List<Item> items) {
    }

    /**
     * One proposal with its chain. {@code index} is the proposal's position in the round's flat
     * proposal list — the same index the Szkeptikus and the chair answered on. {@code kind} is
     * one of {@code NEW}, {@code UP}, {@code DOWN}, {@code RETIRE}; {@code claimId} is the
     * targeted claim for the last three and null for {@code NEW}.
     */
    public record Item(int index, String expertKey, String text, String kind, String claimId,
                       boolean sensitive, List<PeerReaction> reactions,
                       SkepticVerdict skeptic, ChairRuling chair) {
    }

    /** One peer expert's stance on somebody else's proposal: {@code SUPPORT}, {@code CHALLENGE}
     *  or {@code NUANCE}. */
    public record PeerReaction(String expertKey, String stance, String argument) {
    }

    /** {@code verdict} is {@code KEEP} or {@code KILL}. */
    public record SkepticVerdict(String verdict, String argument) {
    }

    public record ChairRuling(boolean accepted, BigDecimal confidence, String reason) {
    }
}
```

- [ ] **Step 4: Írd meg a migrációt**

`backend/src/main/resources/db/changelog/1.0.0/script/202609070900_mezo-xlvr_conference_deliberation.sql`:

```sql
-- The konzílium's structured exchange (bd mezo-xlvr, spec 2026-09-06 §5): the rounds already
-- hold the shape (proposal index, KEEP/KILL, ELFOGADVA/ELUTASÍTVA) in memory and flatten it into
-- prose before saving, so the transcript can only be read speaker-by-speaker. This column keeps
-- the shape. Nullable on purpose: rows written before this change have no deliberation, and the
-- read path derives one from their prose transcript instead of back-filling here.

alter table character_conference add column deliberation jsonb;
```

Majd vedd fel a changeSetet a `changelog-1.0.0.yml` végére, pontosan az utolsó bejegyzés mintájára:

```yaml
  - changeSet:
      id: "1.0.0:202609070900_mezo-xlvr_conference_deliberation"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609070900_mezo-xlvr_conference_deliberation.sql
```

- [ ] **Step 5: Vedd fel a mezőt az entitáson**

A `CharacterConferenceEntity` `outcome` mezője után, ugyanazzal a mintával (a `@JdbcTypeCode(SqlTypes.JSON)` annotációt az `outcome` mezőről másold, hogy az importok is stimmeljenek):

```java
    /** The structured exchange (mezo-xlvr) — null on rows written before the column existed;
     *  the read path derives one from {@link #transcript} for those. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private ConferenceDeliberationEnvelope deliberation;
```

- [ ] **Step 6: Futtasd a tesztet**

Run: `./mvnw test -Dtest='ConferenceDeliberationEnvelopeIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS (2 teszt).

- [ ] **Step 7: Liquibase lint**

Run (a repó gyökeréből): `node scripts/lint-liquibase.mjs`
Expected: hibátlan kimenet.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ConferenceDeliberationEnvelope.java backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/CharacterConferenceEntity.java backend/src/main/resources/db/changelog/1.0.0/script/202609070900_mezo-xlvr_conference_deliberation.sql backend/src/main/resources/db/changelog/1.0.0/changelog-1.0.0.yml backend/src/test/java/io/mrkuhne/mezo/feature/character/ConferenceDeliberationEnvelopeIT.java
git commit -m "feat(character): structured deliberation envelope + jsonb column (mezo-xlvr)"
```

---

### Task 2: A kereszt-vita kör

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumCrossTalkRound.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumCrossTalkRoundIT.java`

**Interfaces:**
- Consumes: `ClaimProposal(String expertKey, String kind, String dimensionKey, UUID claimId, String text, BigDecimal confidence, boolean sensitive, String rationale)`; `CharacterExpertCatalog.byKey(String)` → `Expert(key, displayName, primaryDimensionKey, systemPersona)`.
- Produces: `KonziliumCrossTalkRound.Reaction(int index, String expertKey, String stance, String argument)`; `KonziliumCrossTalkRound.Result(List<Reaction> reactions)`; `KonziliumCrossTalkRound#run(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals)`; `KonziliumCrossTalkRound.CROSS_TALK_MARKER` (`"KARAKTER-KERESZTVITA-FELADAT"`); `FakeCompanionLlm.CROSS_TALK_MARKER_MIRROR`, `FakeCompanionLlm.CHAR_CROSS_TALK_SENTINEL`.

- [ ] **Step 1: Írd meg a bukó tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumCrossTalkRoundIT.java`:

```java
package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.KonziliumCrossTalkRound;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the cross-talk round (mezo-xlvr): only contested chapters trigger a call, an expert
 * never reacts to its own proposal, an unparseable answer yields no reaction (and never breaks
 * the round), and the per-conference call cap holds.
 */
@ActiveProfiles("companion-fake")
class KonziliumCrossTalkRoundIT extends ApiIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24);

    @Autowired private KonziliumCrossTalkRound crossTalkRound;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private CharacterDimensionEntity seedDimension(UUID owner, String key, String expertKey) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle(key);
        entity.setKind("CORE");
        entity.setExpertKey(expertKey);
        return dimensionRepository.save(entity);
    }

    private CharacterClaimEntity seedClaim(UUID owner, UUID dimensionId, String text) {
        CharacterClaimEntity entity = new CharacterClaimEntity();
        entity.setCreatedBy(owner);
        entity.setDimensionId(dimensionId);
        entity.setText(text);
        entity.setConfidence(new BigDecimal("0.50"));
        entity.setStatus("ACTIVE");
        entity.setProposedBy("szomnologus");
        entity.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        entity.setSensitive(false);
        entity.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        entity.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(
                List.of(new ClaimConfidenceHistoryEnvelope.Point(new BigDecimal("0.50"), "kezdet", Instant.now()))));
        return claimRepository.save(entity);
    }

    private static ClaimProposal newProposal(String expertKey, String dimensionKey, String text) {
        return new ClaimProposal(expertKey, "NEW", dimensionKey, null, text,
                new BigDecimal("0.50"), false, "Indoklás.");
    }

    @Test
    void marker_mirroredInFakeLlm_staysInSync() {
        assertThat(FakeCompanionLlm.CROSS_TALK_MARKER_MIRROR).isEqualTo(KonziliumCrossTalkRound.CROSS_TALK_MARKER);
    }

    @Test
    void run_singleExpertPerChapter_makesNoCall() {
        UUID owner = ownerId();
        int before = fakeCompanionLlm.completeCallCount();

        KonziliumCrossTalkRound.Result result = crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("szomnologus", "recovery", "Romlik az alvás."),
                newProposal("drill", "discipline", "Kimarad a napló.")));

        assertThat(result.reactions()).isEmpty();
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
    }

    @Test
    void run_twoExpertsOnOneChapter_bothReactToTheOther_neverToTheirOwn() {
        UUID owner = ownerId();

        KonziliumCrossTalkRound.Result result = crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("szomnologus", "recovery", "Romlik az alvás."),
                newProposal("pszichologus", "recovery", "Feszült hét áll mögötted.")));

        assertThat(result.reactions()).hasSize(2);
        assertThat(result.reactions()).anySatisfy(reaction -> {
            assertThat(reaction.expertKey()).isEqualTo("szomnologus");
            assertThat(reaction.index()).isEqualTo(1);
        });
        assertThat(result.reactions()).anySatisfy(reaction -> {
            assertThat(reaction.expertKey()).isEqualTo("pszichologus");
            assertThat(reaction.index()).isZero();
        });
        assertThat(result.reactions()).allSatisfy(reaction ->
                assertThat(reaction.stance()).isIn("SUPPORT", "CHALLENGE", "NUANCE"));
    }

    @Test
    void run_claimTargetingProposals_groupByTheClaimsOwnChapter() {
        UUID owner = ownerId();
        CharacterDimensionEntity recovery = seedDimension(owner, "recovery", "szomnologus");
        CharacterClaimEntity claim = seedClaim(owner, recovery.getId(), "Korábban jól aludtál.");

        KonziliumCrossTalkRound.Result result = crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("pszichologus", "recovery", "Feszült hét áll mögötted."),
                new ClaimProposal("szomnologus", "DOWN", null, claim.getId(), "Ez már nem áll.",
                        new BigDecimal("0.40"), false, "Az adatok mást mutatnak.")));

        assertThat(result.reactions()).hasSize(2);
    }

    @Test
    void run_unparseableAnswer_yieldsNoReactionForThatExpert_andNeverThrows() {
        UUID owner = ownerId();

        KonziliumCrossTalkRound.Result result = crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("szomnologus", "recovery", "Romlik az alvás. [fake-char-crosstalk:nem-json]"),
                newProposal("pszichologus", "recovery", "Feszült hét áll mögötted.")));

        assertThat(result.reactions()).allSatisfy(reaction ->
                assertThat(reaction.expertKey()).isNotEqualTo("szomnologus"));
    }

    @Test
    void run_callCap_stopsAfterTheCappedNumberOfCalls() {
        UUID owner = ownerId();
        int before = fakeCompanionLlm.completeCallCount();

        crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("szomnologus", "recovery", "A."),
                newProposal("pszichologus", "recovery", "B."),
                newProposal("doki", "physical", "C."),
                newProposal("edzo", "physical", "D."),
                newProposal("taplalkozo", "nutrition", "E."),
                newProposal("drill", "nutrition", "F."),
                newProposal("antropologus", "life", "G."),
                newProposal("szkeptikus", "life", "H.")));

        assertThat(fakeCompanionLlm.completeCallCount() - before)
                .isLessThanOrEqualTo(KonziliumCrossTalkRound.MAX_CROSS_TALK_CALLS);
    }
}
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run: `./mvnw test -Dtest='KonziliumCrossTalkRoundIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `KonziliumCrossTalkRound` nem létezik.

- [ ] **Step 3: Írd meg a kört**

`backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumCrossTalkRound.java`:

```java
package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * The konzílium's cross-talk round (mezo-xlvr, spec §6): between the proposal round and the
 * verdict round, every chapter that TWO OR MORE experts touched this week gets a real debate —
 * each involved expert sees its peers' proposals for that chapter (never its own) and takes a
 * stance on them, in its own persona. The stances reach the Integrátor's prompt alongside the
 * Szkeptikus's verdicts; nothing here mutates a proposal, and the Szkeptikus round is untouched.
 *
 * <p>Isolation mirrors {@link KonziliumProposalRound}: a failed or unparseable answer drops only
 * that expert's reactions, never the round. Chapters are visited most-contested first and the
 * round stops at {@link #MAX_CROSS_TALK_CALLS} calls — an uncalled chapter honestly has no
 * reactions rather than a fabricated one.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class KonziliumCrossTalkRound {

    /** The cross-talk prompt's first line — the fake LLM keys its deterministic answer on it. */
    public static final String CROSS_TALK_MARKER = "KARAKTER-KERESZTVITA-FELADAT";

    /** Hard cap on cross-talk LLM calls per conference — the Sunday run must stay bounded. */
    public static final int MAX_CROSS_TALK_CALLS = 6;

    private static final String NEW_KIND = "NEW";
    private static final Set<String> VALID_STANCES = Set.of("SUPPORT", "CHALLENGE", "NUANCE");

    private final CharacterClaimRepository claimRepository;
    private final CharacterDimensionRepository dimensionRepository;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;

    /** One reaction as the LLM returns it, before validation. */
    record Draft(Integer index, String stance, String argument) {}

    /** One peer expert's stance on the proposal at {@code index} of the round's flat list. */
    public record Reaction(int index, String expertKey, String stance, String argument) {}

    /** The round's output — empty when nothing was contested or every call failed. */
    public record Result(List<Reaction> reactions) {}

    @Transactional(readOnly = true)
    public Result run(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals) {
        if (proposals.size() < 2) {
            return new Result(List.of());
        }

        Map<String, List<Integer>> byChapter = groupByChapter(owner, proposals);
        List<Map.Entry<String, List<Integer>>> contested = byChapter.entrySet().stream()
                .filter(entry -> distinctExperts(proposals, entry.getValue()).size() >= 2)
                .sorted(Comparator.comparingInt(
                        (Map.Entry<String, List<Integer>> entry) -> distinctExperts(proposals, entry.getValue()).size())
                        .reversed())
                .toList();

        List<Reaction> reactions = new ArrayList<>();
        int calls = 0;
        for (Map.Entry<String, List<Integer>> chapter : contested) {
            for (String expertKey : distinctExperts(proposals, chapter.getValue())) {
                if (calls >= MAX_CROSS_TALK_CALLS) {
                    return new Result(List.copyOf(reactions));
                }
                calls++;
                reactions.addAll(runExpert(owner, weekStart, expertKey, chapter.getKey(),
                        chapter.getValue(), proposals));
            }
        }
        return new Result(List.copyOf(reactions));
    }

    /** Chapter key -> the proposal indexes that belong to it. A NEW proposal carries its own
     *  dimensionKey; UP/DOWN/RETIRE carry a claim id instead, so the claim's own dimension
     *  decides — a proposal whose claim or dimension cannot be resolved joins no chapter at all
     *  (it simply gets no cross-talk, never a wrong one). */
    private Map<String, List<Integer>> groupByChapter(UUID owner, List<ClaimProposal> proposals) {
        Map<UUID, String> dimensionKeyById = new LinkedHashMap<>();
        for (CharacterDimensionEntity dimension : dimensionRepository.findByCreatedBy(owner)) {
            dimensionKeyById.put(dimension.getId(), dimension.getKey());
        }
        Map<String, List<Integer>> byChapter = new LinkedHashMap<>();
        for (int i = 0; i < proposals.size(); i++) {
            ClaimProposal proposal = proposals.get(i);
            String chapterKey;
            if (NEW_KIND.equals(proposal.kind())) {
                chapterKey = proposal.dimensionKey();
            } else {
                chapterKey = claimRepository.findByIdAndCreatedBy(proposal.claimId(), owner)
                        .map(CharacterClaimEntity::getDimensionId)
                        .map(dimensionKeyById::get)
                        .orElse(null);
            }
            if (chapterKey != null) {
                byChapter.computeIfAbsent(chapterKey, key -> new ArrayList<>()).add(i);
            }
        }
        return byChapter;
    }

    private static List<String> distinctExperts(List<ClaimProposal> proposals, List<Integer> indexes) {
        Set<String> experts = new LinkedHashSet<>();
        for (int index : indexes) {
            experts.add(proposals.get(index).expertKey());
        }
        return List.copyOf(experts);
    }

    /** One expert's reactions to its PEERS' proposals in one chapter. Any failure here drops
     *  only this expert's reactions. */
    private List<Reaction> runExpert(UUID owner, LocalDate weekStart, String expertKey, String chapterKey,
                                      List<Integer> chapterIndexes, List<ClaimProposal> proposals) {
        List<Integer> peerIndexes = chapterIndexes.stream()
                .filter(index -> !expertKey.equals(proposals.get(index).expertKey()))
                .toList();
        if (peerIndexes.isEmpty()) {
            return List.of();
        }

        String raw;
        try {
            CharacterExpertCatalog.Expert expert = CharacterExpertCatalog.byKey(expertKey);
            String systemPrompt = promptPersona.render(owner,
                    CROSS_TALK_MARKER + "\n" + expert.systemPersona() + "\n" + crossTalkInstruction() + "\n"
                            + outputContract());
            String userMessage = promptPersona.render(owner,
                    userMessage(weekStart, chapterKey, peerIndexes, proposals));
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("character", "crosstalk", "expert", null),
                    () -> companionLlm.complete(systemPrompt, userMessage));
        } catch (Exception e) {
            log.warn("Cross-talk call failed for owner {} expert {} chapter {}", owner, expertKey, chapterKey, e);
            return List.of();
        }
        if (raw == null || raw.isBlank()) {
            log.warn("Cross-talk answer was blank for owner {} expert {} chapter {}", owner, expertKey, chapterKey);
            return List.of();
        }

        List<Draft> drafts;
        try {
            drafts = objectMapper.readValue(stripArrayFences(raw), new TypeReference<List<Draft>>() {});
        } catch (Exception e) {
            log.warn("Cross-talk answer was not parseable JSON for owner {} expert {} — {}", owner, expertKey, raw, e);
            return List.of();
        }

        List<Reaction> reactions = new ArrayList<>();
        for (Draft draft : drafts) {
            if (draft.index() == null || !peerIndexes.contains(draft.index())) {
                continue;
            }
            if (draft.stance() == null || !VALID_STANCES.contains(draft.stance())) {
                continue;
            }
            if (draft.argument() == null || draft.argument().isBlank()) {
                continue;
            }
            reactions.add(new Reaction(draft.index(), expertKey, draft.stance(), draft.argument()));
        }
        return reactions;
    }

    private static String crossTalkInstruction() {
        return """
                A heti konzíliumon a saját fejezetedhez MÁS szakértők is tettek javaslatot. \
                Mondd el róluk a szakmai álláspontodat: támogatod, vitatod vagy árnyalod. \
                Egy javaslathoz legfeljebb egy álláspontot adj, és mindig indokold egy mondatban. \
                A saját javaslataidról nem nyilatkozol — azok nincsenek is felsorolva.""";
    }

    private static String outputContract() {
        return """
                Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat és formázás nélkül, pontosan ebben \
                a formában: [{"index":0,"stance":"SUPPORT|CHALLENGE|NUANCE","argument":"..."}]. \
                Az "index" a felsorolt javaslat sorszáma (P0, P1, …).""";
    }

    private static String userMessage(LocalDate weekStart, String chapterKey, List<Integer> peerIndexes,
                                       List<ClaimProposal> proposals) {
        String periodLabel = weekStart != null
                ? "Hét: " + weekStart + " – " + weekStart.plusDays(6)
                : "Teljes eddigi történet";
        StringBuilder sb = new StringBuilder(periodLabel)
                .append("\nFejezet: ").append(chapterKey)
                .append("\nA társak javaslatai ebben a fejezetben:");
        for (int index : peerIndexes) {
            ClaimProposal proposal = proposals.get(index);
            sb.append("\nP").append(index).append(". ")
                    .append(CharacterExpertCatalog.byKey(proposal.expertKey()).displayName())
                    .append(" — ").append(proposal.text())
                    .append(proposal.sensitive() ? " (ÉRZÉKENY)" : "")
                    .append(" indoklás: ").append(proposal.rationale());
        }
        return sb.toString();
    }

    /** Strips optional ```json fences (and surrounding prose) around a JSON ARRAY — same shape
     *  {@link KonziliumVerdictRound} uses for its own array answers. */
    private static String stripArrayFences(String raw) {
        String trimmed = raw.strip();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline > 0) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            int fence = trimmed.lastIndexOf("```");
            if (fence >= 0) {
                trimmed = trimmed.substring(0, fence);
            }
        }
        int start = trimmed.indexOf('[');
        int end = trimmed.lastIndexOf(']');
        return start >= 0 && end > start ? trimmed.substring(start, end + 1) : trimmed.strip();
    }
}
```

- [ ] **Step 4: Tükrözd a markert a fake LLM-ben**

A `FakeCompanionLlm`-ben, az `INTEGRATOR_MARKER_MIRROR` mellé:

```java
    /** Mirror of KonziliumCrossTalkRound.CROSS_TALK_MARKER (feature/character) — LITERAL, cycle
     *  rule (see OBSERVATION_MARKER_MIRROR). Drift is caught by KonziliumCrossTalkRoundIT. */
    public static final String CROSS_TALK_MARKER_MIRROR = "KARAKTER-KERESZTVITA-FELADAT";

    /** Scripted cross-talk answer: {@code [fake-char-crosstalk:<payload>]} planted in a proposal's
     *  TEXT (the user message renders every peer proposal's text) is returned verbatim — a
     *  non-JSON payload drills the unparseable path. */
    public static final Pattern CHAR_CROSS_TALK_SENTINEL =
            Pattern.compile("\\[fake-char-crosstalk:([^\\]]*)]", Pattern.DOTALL);
```

Az ágat a `SKEPTIC_MARKER_MIRROR` ág elé tedd (a `complete` dispatcherben, ugyanabban a stílusban):

```java
        if (systemPrompt.startsWith(CROSS_TALK_MARKER_MIRROR)) {
            Matcher m = CHAR_CROSS_TALK_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : crossTalkCannedAnswer(userMessage);
        }
```

És a `skepticCannedAnswer` mellé a konzerv válasz:

```java
    /** Canned cross-talk answer: one SUPPORT stance per listed peer proposal. The CHALLENGE and
     *  NUANCE paths are exercised only through {@link #CHAR_CROSS_TALK_SENTINEL}. */
    private static String crossTalkCannedAnswer(String userMessage) {
        Matcher idx = CHAR_PROPOSAL_INDEX.matcher(userMessage);
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        while (idx.find()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append("{\"index\":").append(idx.group(1))
                    .append(",\"stance\":\"SUPPORT\",\"argument\":\"Fake állásfoglalás: egyetértek.\"}");
        }
        return sb.append(']').toString();
    }
```

Figyelem: a `CHAR_PROPOSAL_INDEX` mintája `(?m)^P(\d+)\. ` — a `userMessage` fenti formátuma (`\nP0. Név — szöveg`) pontosan illeszkedik rá.

- [ ] **Step 5: Futtasd a tesztet**

Run: `./mvnw test -Dtest='KonziliumCrossTalkRoundIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS (6 teszt).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumCrossTalkRound.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumCrossTalkRoundIT.java
git commit -m "feat(character): konzílium cross-talk round — peers take a stance on a contested chapter (mezo-xlvr)"
```

---

### Task 3: A verdikt-kör megkapja a reakciókat és visszaadja a Szkeptikus verdiktjeit

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java`

**Interfaces:**
- Consumes: `KonziliumCrossTalkRound.Reaction(int index, String expertKey, String stance, String argument)`.
- Produces: `KonziliumVerdictRound.SkepticVerdict(int index, String verdict, String argument)` (publikus record); `KonziliumVerdictRound.Result(List<ClaimRuling> rulings, List<ChapterProposal> chapters, List<ConferenceTranscriptEnvelope.Turn> turns, List<SkepticVerdict> verdicts)`; `KonziliumVerdictRound#run(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals, List<KonziliumCrossTalkRound.Reaction> reactions)`.

- [ ] **Step 1: Írd meg a bukó teszteket**

A `KonziliumVerdictRoundIT` végére (az osztályon belül):

```java
    @Test
    void run_peerReactions_reachTheIntegratorPrompt() {
        UUID owner = ownerId();
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("szomnologus", "NEW", "recovery", null, "Romlik az alvás.",
                        new BigDecimal("0.50"), false, "Három rossz éjszaka."),
                new ClaimProposal("pszichologus", "NEW", "mental", null, "Feszült hét.",
                        new BigDecimal("0.40"), false, "Napló jelzi."));
        List<KonziliumCrossTalkRound.Reaction> reactions = List.of(
                new KonziliumCrossTalkRound.Reaction(0, "pszichologus", "CHALLENGE",
                        "A feszültség is okozhatta, nem csak az alvás."));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, reactions);

        assertThat(result.rulings()).hasSize(2);
        assertThat(fakeCompanionLlm.lastUserMessage()).contains("A feszültség is okozhatta");
    }

    @Test
    void run_parsedSkepticAnswer_exposesItsVerdictsPerProposalIndex() {
        UUID owner = ownerId();
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Elmarad a logolás.",
                        new BigDecimal("0.50"), false, "3 nap kihagyás."));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, List.of());

        assertThat(result.verdicts()).singleElement().satisfies(verdict -> {
            assertThat(verdict.index()).isZero();
            assertThat(verdict.verdict()).isEqualTo("KEEP");
            assertThat(verdict.argument()).isNotBlank();
        });
    }
```

Az osztály tetején vedd fel az importot: `import io.mrkuhne.mezo.feature.character.service.KonziliumCrossTalkRound;`.

A meglévő hívásokat (`verdictRound.run(owner, WEEK_START, ...)`) egészítsd ki a negyedik, `List.of()` paraméterrel.

Ha a `FakeCompanionLlm`-nek nincs `lastUserMessage()` gettere, vedd fel: egy `private volatile String lastUserMessage;` mezőt, amit a `complete`/`completeSmart` belépéskor beállít, és egy `public String lastUserMessage()` gettert — ugyanaz a megfigyelő-idióma, mint a `completeCallCount()`.

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run: `./mvnw test -Dtest='KonziliumVerdictRoundIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — a négyparaméteres `run` és a `verdicts()` nem létezik.

- [ ] **Step 3: Bővítsd a `Result`-ot és a `run` szignatúrát**

A `KonziliumVerdictRound`-ban:

```java
    /** One Szkeptikus verdict as it will be SHOWN — index-aligned with the proposal list.
     *  Only produced when the Szkeptikus round actually parsed (mezo-xlvr). */
    public record SkepticVerdict(int index, String verdict, String argument) {}

    /** The round's output: every proposal's final ruling, at most one chapter proposal, one
     *  transcript turn per persona that answered, and the Szkeptikus's per-proposal verdicts
     *  (empty when that round failed to parse — never a fabricated KEEP). */
    public record Result(List<ClaimRuling> rulings, List<ChapterProposal> chapters,
                         List<ConferenceTranscriptEnvelope.Turn> turns, List<SkepticVerdict> verdicts) {}
```

A `run` szignatúrája:

```java
    public Result run(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals,
                      List<KonziliumCrossTalkRound.Reaction> reactions) {
        if (proposals.isEmpty()) {
            return new Result(List.of(), List.of(), List.of(), List.of());
        }
```

A metódus végén a `Result` építése:

```java
        List<SkepticVerdict> verdicts = new ArrayList<>();
        if (skepticResult.parsed()) {
            for (int i = 0; i < proposals.size(); i++) {
                SkepticVerdictDraft draft = skepticResult.verdicts().get(i);
                String verdict = draft != null && KILL.equals(draft.verdict()) ? KILL : KEEP;
                String argument = draft != null && draft.argument() != null && !draft.argument().isBlank()
                        ? draft.argument() : DEFAULT_ARGUMENT;
                verdicts.add(new SkepticVerdict(i, verdict, argument));
            }
        }
        return new Result(rulings, chapters, turns, List.copyOf(verdicts));
```

A `runIntegrator` hívása kapja meg a reakciókat, és a felhasználói üzenet végére kerüljön a blokkjuk:

```java
        IntegratorResult integratorResult = runIntegrator(owner, weekStart, proposals,
                skepticResult.verdicts(), reactions);
```

```java
    private IntegratorResult runIntegrator(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals,
                                            Map<Integer, SkepticVerdictDraft> verdicts,
                                            List<KonziliumCrossTalkRound.Reaction> reactions) {
        String systemPrompt = INTEGRATOR_MARKER + "\n" + integratorPersona() + "\n" + integratorContract();
        String userMessage = numberedProposals(weekStart, proposals) + "\n"
                + skepticVerdictsBlock(proposals, verdicts) + peerReactionsBlock(reactions);
```

Az új blokk-építő (a `skepticVerdictsBlock` mellé), üres listánál üres sztringet ad, hogy a prompt ne hordozzon üres fejlécet:

```java
    /** The peers' stances, grouped by the proposal they are about (mezo-xlvr). Empty input yields
     *  an EMPTY string — an empty "Szakértői állásfoglalások:" header would suggest a debate that
     *  never happened. */
    private static String peerReactionsBlock(List<KonziliumCrossTalkRound.Reaction> reactions) {
        if (reactions == null || reactions.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder("\nSzakértői állásfoglalások:");
        for (KonziliumCrossTalkRound.Reaction reaction : reactions) {
            sb.append("\nP").append(reaction.index()).append(": ")
                    .append(CharacterExpertCatalog.byKey(reaction.expertKey()).displayName())
                    .append(" ").append(reaction.stance()).append(" — ").append(reaction.argument());
        }
        return sb.toString();
    }
```

Az `integratorPersona()` szövegét egészítsd ki egy mondattal, hogy a modell tudja, mit kapott:

```java
                a Szkeptikus ellenérveivel együtt mérlegelsz — és ahol a szakértők egymás \
                javaslatára is állást foglaltak, azt is figyelembe veszed —, és csak azt fogadod \
                el, amit a bizonyíték tényleg alátámaszt. Új fejezetet (chapter) csak akkor \
                javasolsz, ha valóban önálló, tartós témáról van szó — ritkán.""";
```

Vedd fel az importot: `import io.mrkuhne.mezo.feature.character.service.KonziliumCrossTalkRound;` nem kell (azonos csomag).

- [ ] **Step 4: Igazítsd a hívókat**

A `CharacterConferenceService`, `CharacterBootstrapService` és `CharacterMonthlyService` `verdictRound.run(...)` hívásait egészítsd ki `List.of()` negyedik paraméterrel — a Task 4 cseréli le a heti ág hívását a valódi reakciókra. Keresd meg őket:

Run: `grep -rn "verdictRound.run(" backend/src/main/java`

- [ ] **Step 5: Futtasd a tesztet**

Run: `./mvnw test -Dtest='KonziliumVerdictRoundIT,CharacterConferenceServiceIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java
git commit -m "feat(character): the chair weighs peer stances; the skeptic's verdicts leave the round (mezo-xlvr)"
```

---

### Task 4: A szálak összeállítása és mentése

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/DeliberationAssembler.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterConferenceService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/DeliberationAssemblerTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterConferenceServiceIT.java` (bővítés)

**Interfaces:**
- Consumes: `ClaimProposal`, `ClaimRuling`, `KonziliumCrossTalkRound.Reaction`, `KonziliumVerdictRound.SkepticVerdict`, `ConferenceDeliberationEnvelope`.
- Produces: `DeliberationAssembler.assemble(List<ClaimProposal> proposals, List<KonziliumCrossTalkRound.Reaction> reactions, List<KonziliumVerdictRound.SkepticVerdict> verdicts, List<ClaimRuling> rulings, Map<String, String> chapterKeyToTitle, Map<UUID, String> claimIdToChapterKey)` → `ConferenceDeliberationEnvelope`; `CharacterConferenceEntity#getDeliberation()` kitöltve minden új heti konzíliumon.

- [ ] **Step 1: Írd meg a bukó tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/character/DeliberationAssemblerTest.java` (sima unit teszt, nincs Spring):

```java
package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.ClaimRuling;
import io.mrkuhne.mezo.feature.character.service.DeliberationAssembler;
import io.mrkuhne.mezo.feature.character.service.KonziliumCrossTalkRound;
import io.mrkuhne.mezo.feature.character.service.KonziliumVerdictRound;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DeliberationAssemblerTest {

    private static ClaimProposal newProposal(String expertKey, String dimensionKey, String text) {
        return new ClaimProposal(expertKey, "NEW", dimensionKey, null, text,
                new BigDecimal("0.50"), false, "Indoklás.");
    }

    @Test
    void assemble_groupsByChapter_andCarriesTheWholeChain() {
        ClaimProposal sleep = newProposal("szomnologus", "recovery", "Romlik az alvás.");
        ClaimProposal mind = newProposal("pszichologus", "recovery", "Feszült hét.");
        ClaimProposal log = newProposal("drill", "discipline", "Kimarad a napló.");

        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(sleep, mind, log),
                List.of(new KonziliumCrossTalkRound.Reaction(0, "pszichologus", "CHALLENGE", "Lehet stressz is.")),
                List.of(new KonziliumVerdictRound.SkepticVerdict(0, "KILL", "Kevés adat."),
                        new KonziliumVerdictRound.SkepticVerdict(1, "KEEP", "Elfogadható."),
                        new KonziliumVerdictRound.SkepticVerdict(2, "KEEP", "Elfogadható.")),
                List.of(new ClaimRuling(sleep, false, new BigDecimal("0.40"), "Nem engedem be."),
                        new ClaimRuling(mind, true, new BigDecimal("0.60"), "Rendben."),
                        new ClaimRuling(log, true, new BigDecimal("0.70"), "Rendben.")),
                Map.of("recovery", "Regeneráció", "discipline", "Fegyelem"),
                Map.of());

        assertThat(envelope.threads()).hasSize(2);
        ConferenceDeliberationEnvelope.Thread recovery = envelope.threads().get(0);
        assertThat(recovery.dimensionKey()).isEqualTo("recovery");
        assertThat(recovery.title()).isEqualTo("Regeneráció");
        assertThat(recovery.items()).hasSize(2);
        ConferenceDeliberationEnvelope.Item first = recovery.items().get(0);
        assertThat(first.expertKey()).isEqualTo("szomnologus");
        assertThat(first.reactions()).singleElement()
                .satisfies(reaction -> assertThat(reaction.expertKey()).isEqualTo("pszichologus"));
        assertThat(first.skeptic().verdict()).isEqualTo("KILL");
        assertThat(first.chair().accepted()).isFalse();
        assertThat(recovery.items().get(1).reactions()).isEmpty();
    }

    @Test
    void assemble_missingSkepticVerdicts_leaveTheItemOpen_neverFabricated() {
        ClaimProposal sleep = newProposal("szomnologus", "recovery", "Romlik az alvás.");

        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(sleep), List.of(), List.of(),
                List.of(new ClaimRuling(sleep, true, new BigDecimal("0.60"), "Rendben.")),
                Map.of("recovery", "Regeneráció"), Map.of());

        ConferenceDeliberationEnvelope.Item item = envelope.threads().get(0).items().get(0);
        assertThat(item.skeptic()).isNull();
        assertThat(item.chair()).isNotNull();
    }

    @Test
    void assemble_claimTargetingProposal_joinsItsClaimsChapter_andKeepsTheClaimId() {
        UUID claimId = UUID.randomUUID();
        ClaimProposal down = new ClaimProposal("szomnologus", "DOWN", null, claimId, "Ez már nem áll.",
                new BigDecimal("0.40"), false, "Az adatok mást mutatnak.");

        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(down), List.of(), List.of(),
                List.of(new ClaimRuling(down, true, new BigDecimal("0.40"), "Rendben.")),
                Map.of("recovery", "Regeneráció"), Map.of(claimId, "recovery"));

        assertThat(envelope.threads()).singleElement().satisfies(thread -> {
            assertThat(thread.dimensionKey()).isEqualTo("recovery");
            assertThat(thread.items().get(0).claimId()).isEqualTo(claimId.toString());
        });
    }

    @Test
    void assemble_unresolvableChapter_stillGetsAThread_titledByItsKey() {
        ClaimProposal orphan = newProposal("drill", "discipline", "Kimarad a napló.");

        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(orphan), List.of(), List.of(),
                List.of(new ClaimRuling(orphan, true, new BigDecimal("0.60"), "Rendben.")),
                Map.of(), Map.of());

        assertThat(envelope.threads()).singleElement()
                .satisfies(thread -> assertThat(thread.title()).isEqualTo("discipline"));
    }
}
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run: `./mvnw test -Dtest='DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `DeliberationAssembler` nem létezik.

- [ ] **Step 3: Írd meg az assemblert**

`backend/src/main/java/io/mrkuhne/mezo/feature/character/service/DeliberationAssembler.java`:

```java
package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds the {@link ConferenceDeliberationEnvelope} from what the konzílium's three rounds
 * actually produced (mezo-xlvr): proposals, peer stances, the Szkeptikus's verdicts and the
 * chair's rulings, all index-aligned on the round's flat proposal list. Pure function, no I/O —
 * every lookup it needs (chapter titles, a claim's chapter) is passed in by the caller.
 *
 * <p>A missing verdict or ruling stays {@code null} on the item: a round that produced nothing
 * must not be shown as if it had ruled.
 */
public final class DeliberationAssembler {

    private static final String NEW_KIND = "NEW";

    private DeliberationAssembler() {
    }

    public static ConferenceDeliberationEnvelope assemble(
            List<ClaimProposal> proposals,
            List<KonziliumCrossTalkRound.Reaction> reactions,
            List<KonziliumVerdictRound.SkepticVerdict> verdicts,
            List<ClaimRuling> rulings,
            Map<String, String> chapterKeyToTitle,
            Map<UUID, String> claimIdToChapterKey) {

        Map<Integer, List<ConferenceDeliberationEnvelope.PeerReaction>> reactionsByIndex = new LinkedHashMap<>();
        for (KonziliumCrossTalkRound.Reaction reaction : reactions) {
            reactionsByIndex
                    .computeIfAbsent(reaction.index(), index -> new ArrayList<>())
                    .add(new ConferenceDeliberationEnvelope.PeerReaction(
                            reaction.expertKey(), reaction.stance(), reaction.argument()));
        }

        Map<Integer, ConferenceDeliberationEnvelope.SkepticVerdict> verdictByIndex = new LinkedHashMap<>();
        for (KonziliumVerdictRound.SkepticVerdict verdict : verdicts) {
            verdictByIndex.put(verdict.index(),
                    new ConferenceDeliberationEnvelope.SkepticVerdict(verdict.verdict(), verdict.argument()));
        }

        Map<String, List<ConferenceDeliberationEnvelope.Item>> itemsByChapter = new LinkedHashMap<>();
        for (int i = 0; i < proposals.size(); i++) {
            ClaimProposal proposal = proposals.get(i);
            String chapterKey = chapterKeyOf(proposal, claimIdToChapterKey);
            ConferenceDeliberationEnvelope.ChairRuling chair = i < rulings.size()
                    ? new ConferenceDeliberationEnvelope.ChairRuling(
                            rulings.get(i).accepted(), rulings.get(i).ruledConfidence(), rulings.get(i).reason())
                    : null;
            itemsByChapter
                    .computeIfAbsent(chapterKey, key -> new ArrayList<>())
                    .add(new ConferenceDeliberationEnvelope.Item(
                            i,
                            proposal.expertKey(),
                            proposal.text(),
                            proposal.kind(),
                            proposal.claimId() == null ? null : proposal.claimId().toString(),
                            proposal.sensitive(),
                            List.copyOf(reactionsByIndex.getOrDefault(i, List.of())),
                            verdictByIndex.get(i),
                            chair));
        }

        List<ConferenceDeliberationEnvelope.Thread> threads = new ArrayList<>();
        for (Map.Entry<String, List<ConferenceDeliberationEnvelope.Item>> entry : itemsByChapter.entrySet()) {
            String chapterKey = entry.getKey();
            String title = chapterKeyToTitle.getOrDefault(chapterKey, chapterKey);
            threads.add(new ConferenceDeliberationEnvelope.Thread(chapterKey, title, List.copyOf(entry.getValue())));
        }
        return new ConferenceDeliberationEnvelope(List.copyOf(threads));
    }

    /** A NEW proposal names its chapter; the others are placed by the claim they target. An
     *  unresolvable claim falls back to the literal {@code "egyeb"} chapter — never silently
     *  merged into somebody else's chapter. */
    private static String chapterKeyOf(ClaimProposal proposal, Map<UUID, String> claimIdToChapterKey) {
        if (NEW_KIND.equals(proposal.kind()) && proposal.dimensionKey() != null) {
            return proposal.dimensionKey();
        }
        if (proposal.claimId() != null) {
            String chapterKey = claimIdToChapterKey.get(proposal.claimId());
            if (chapterKey != null) {
                return chapterKey;
            }
        }
        return "egyeb";
    }
}
```

- [ ] **Step 4: Futtasd a unit tesztet**

Run: `./mvnw test -Dtest='DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (4 teszt).

- [ ] **Step 5: Kösd be a szolgáltatásba**

A `CharacterConferenceService`-ben vedd fel a mezőt a `verdictRound` mellé:

```java
    private final KonziliumCrossTalkRound crossTalkRound;
```

A `runWeekly`-ben, a javaslat-kör után:

```java
        KonziliumProposalRound.Result proposalResult = proposalRound.run(owner, weekStart, weekObservations);
        KonziliumCrossTalkRound.Result crossTalkResult =
                crossTalkRound.run(owner, weekStart, proposalResult.proposals());
        KonziliumVerdictRound.Result verdictResult =
                verdictRound.run(owner, weekStart, proposalResult.proposals(), crossTalkResult.reactions());
```

A `persistConferenceAndApplyOutcome` kapjon egy új, utolsó paramétert (`ConferenceDeliberationEnvelope deliberation`), és állítsa be a soron a `transcript` mellett:

```java
        conference.setDeliberation(deliberation);
```

A `runWeekly` hívása építse meg az envelope-ot. A fejezet-címek és a claim-fejezetek feloldása a szolgáltatás meglévő repóival:

```java
        Map<String, String> chapterTitles = new LinkedHashMap<>();
        Map<UUID, String> claimChapters = new LinkedHashMap<>();
        Map<UUID, String> dimensionKeyById = new LinkedHashMap<>();
        for (CharacterDimensionEntity dimension : dimensionRepository.findByCreatedBy(owner)) {
            chapterTitles.put(dimension.getKey(), dimension.getTitle());
            dimensionKeyById.put(dimension.getId(), dimension.getKey());
        }
        for (ClaimProposal proposal : proposalResult.proposals()) {
            if (proposal.claimId() != null) {
                claimRepository.findByIdAndCreatedBy(proposal.claimId(), owner)
                        .map(CharacterClaimEntity::getDimensionId)
                        .map(dimensionKeyById::get)
                        .ifPresent(chapterKey -> claimChapters.put(proposal.claimId(), chapterKey));
            }
        }
        ConferenceDeliberationEnvelope deliberation = DeliberationAssembler.assemble(
                proposalResult.proposals(), crossTalkResult.reactions(), verdictResult.verdicts(),
                verdictResult.rulings(), chapterTitles, claimChapters);
```

A `CharacterBootstrapService` és `CharacterMonthlyService` hívásai `null` deliberationt adnak át: ott nincs kereszt-vita kör, és a régi-visszafejtő olvasáskor úgyis kiszolgálja őket. Keresd meg a hívásokat:

Run: `grep -rn "persistConferenceAndApplyOutcome(" backend/src/main/java`

- [ ] **Step 6: Írj IT-t a mentésre**

A `CharacterConferenceServiceIT` végére:

```java
    @Test
    void runWeekly_persistsAStructuredDeliberation_threadedByChapter() {
        UUID owner = ownerId();
        seedObservation(owner, "szomnologus", List.of("recovery"), "Három rossz éjszaka.");
        seedObservation(owner, "pszichologus", List.of("mental"), "Feszült hét.");

        CharacterConferenceEntity conference = conferenceService.runWeekly(owner, WEEK_START);

        assertThat(conference.getDeliberation()).isNotNull();
        assertThat(conference.getDeliberation().threads()).isNotEmpty();
        assertThat(conference.getDeliberation().threads())
                .allSatisfy(thread -> assertThat(thread.items()).isNotEmpty());
        assertThat(conference.getDeliberation().threads().stream()
                .flatMap(thread -> thread.items().stream()))
                .allSatisfy(item -> {
                    assertThat(item.expertKey()).isNotBlank();
                    assertThat(item.chair()).isNotNull();
                });
    }
```

Használd az osztályban már meglévő seed-segédeket; ha a nevük más (`seedObservation` helyett), igazítsd hozzá — a lényeg két KÜLÖNBÖZŐ szakértő megfigyelése, hogy a javaslat-kör két javaslatot adjon.

- [ ] **Step 7: Futtasd a fókuszált kaput**

Run: `./mvnw test -Dtest='*Character*,DetectorTest,Konzilium*,ClaimLifecycleIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS. Ha az `ArchitectureTest` új ciklust jelent: ÁLLJ MEG, BLOCKED.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/test/java/io/mrkuhne/mezo/feature/character
git commit -m "feat(character): assemble and persist the konzílium's threads (mezo-xlvr)"
```

---

### Task 5: Régi átiratok visszafejtése

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/LegacyTranscriptParser.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/LegacyTranscriptParserTest.java`

**Interfaces:**
- Consumes: `ConferenceTranscriptEnvelope.Turn(String persona, String text, List<String> refIds)`.
- Produces: `LegacyTranscriptParser.parse(List<ConferenceTranscriptEnvelope.Turn> turns)` → `ConferenceDeliberationEnvelope` vagy `null`.

- [ ] **Step 1: Írd meg a bukó tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/character/LegacyTranscriptParserTest.java`:

```java
package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.service.LegacyTranscriptParser;
import java.util.List;
import org.junit.jupiter.api.Test;

class LegacyTranscriptParserTest {

    private static ConferenceTranscriptEnvelope.Turn turn(String persona, String text) {
        return new ConferenceTranscriptEnvelope.Turn(persona, text, List.of());
    }

    private static List<ConferenceTranscriptEnvelope.Turn> realTranscript() {
        return List.of(
                turn("drill", "Drill: 2 javaslat a hét 9 megfigyeléséből.\n"
                        + "A naplóbejegyzések hiánya rendszerszintű kihívást jelent.\n"
                        + "A Cink & Magnézium bevitele 13 napon át elmaradt."),
                turn("szomnologus", "Szomnológus: 1 javaslat a hét 8 megfigyeléséből.\n"
                        + "Az alvásminőség romlása összefügg a teljesítménnyel."),
                turn("szkeptikus", "Szkeptikus: 3 javaslat véleményezve.\n"
                        + "P0: KILL — Egy hét naplóhiány nem elegendő bizonyíték.\n"
                        + "P1: KEEP — Az adatok igazolják az eltérést.\n"
                        + "P2: KILL — A korreláció nem jelent kauzalitást."),
                turn("mezo", "Mezo: 1/3 javaslat elfogadva.\n"
                        + "P0: ELUTASÍTVA (0.9) — Túlinterpretáció.\n"
                        + "P1: ELFOGADVA (0.90) — A 13 napos elmaradás egyértelmű.\n"
                        + "P2: ELUTASÍTVA (0.9) — Megalapozatlan ok-okozat.\n"
                        + "Új fejezet: Quest Rendszer Kalibráció — Kritikusan alacsony teljesítés."));
    }

    @Test
    void parse_realTranscript_threadsByExpert_withVerdictsAndRulings() {
        ConferenceDeliberationEnvelope envelope = LegacyTranscriptParser.parse(realTranscript());

        assertThat(envelope).isNotNull();
        assertThat(envelope.threads()).hasSize(2);
        ConferenceDeliberationEnvelope.Thread drill = envelope.threads().get(0);
        assertThat(drill.dimensionKey()).isNull();
        assertThat(drill.title()).isEqualTo("Drill");
        assertThat(drill.items()).hasSize(2);

        ConferenceDeliberationEnvelope.Item first = drill.items().get(0);
        assertThat(first.index()).isZero();
        assertThat(first.expertKey()).isEqualTo("drill");
        assertThat(first.text()).isEqualTo("A naplóbejegyzések hiánya rendszerszintű kihívást jelent.");
        assertThat(first.skeptic().verdict()).isEqualTo("KILL");
        assertThat(first.chair().accepted()).isFalse();
        assertThat(first.reactions()).isEmpty();

        ConferenceDeliberationEnvelope.Item second = drill.items().get(1);
        assertThat(second.skeptic().verdict()).isEqualTo("KEEP");
        assertThat(second.chair().accepted()).isTrue();
        assertThat(second.chair().confidence()).isEqualByComparingTo(new java.math.BigDecimal("0.90"));

        ConferenceDeliberationEnvelope.Item third = envelope.threads().get(1).items().get(0);
        assertThat(third.index()).isEqualTo(2);
        assertThat(third.expertKey()).isEqualTo("szomnologus");
    }

    @Test
    void parse_withoutASkepticTurn_stillParses_leavingTheVerdictOpen() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("drill", "Drill: 1 javaslat a hét 3 megfigyeléséből.\nKimarad a napló."),
                turn("mezo", "Mezo: 1/1 javaslat elfogadva.\nP0: ELFOGADVA (0.70) — Rendben."));

        ConferenceDeliberationEnvelope envelope = LegacyTranscriptParser.parse(turns);

        assertThat(envelope).isNotNull();
        ConferenceDeliberationEnvelope.Item item = envelope.threads().get(0).items().get(0);
        assertThat(item.skeptic()).isNull();
        assertThat(item.chair().accepted()).isTrue();
    }

    @Test
    void parse_noExpertTurns_returnsNull() {
        List<ConferenceTranscriptEnvelope.Turn> turns = List.of(
                turn("mezo", "A teljes eddigi történet beolvasva — 9 kezdő állítás felvéve."));

        assertThat(LegacyTranscriptParser.parse(turns)).isNull();
    }

    @Test
    void parse_emptyTranscript_returnsNull() {
        assertThat(LegacyTranscriptParser.parse(List.of())).isNull();
    }
}
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run: `./mvnw test -Dtest='LegacyTranscriptParserTest' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `LegacyTranscriptParser` nem létezik.

- [ ] **Step 3: Írd meg a visszafejtőt**

`backend/src/main/java/io/mrkuhne/mezo/feature/character/service/LegacyTranscriptParser.java`:

```java
package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Derives a {@link ConferenceDeliberationEnvelope} from a conference stored BEFORE the structured
 * column existed (mezo-xlvr, spec §8) — at READ time, never written back. The verdict and ruling
 * lines are machine-written by {@link KonziliumVerdictRound}, so they parse deterministically;
 * the proposal index is rebuilt exactly the way the round assigned it, by walking the expert
 * turns in transcript order and numbering their claim lines.
 *
 * <p>Legacy threads group BY EXPERT, titled with the expert's display name: a stored transcript
 * carries no chapter membership, and inventing one would misreport the meeting. Returns
 * {@code null} when the transcript has no expert turn to number — the caller then shows the
 * original prose view.
 */
public final class LegacyTranscriptParser {

    private static final Pattern SKEPTIC_LINE =
            Pattern.compile("^P(\\d+): (KEEP|KILL) — (.+)$");
    private static final Pattern CHAIR_LINE =
            Pattern.compile("^P(\\d+): (ELFOGADVA|ELUTASÍTVA) \\(([^)]*)\\) — (.+)$");
    private static final String SKEPTIC_PERSONA = "szkeptikus";
    private static final String CHAIR_PERSONA = "mezo";
    private static final String CHAPTER_PREFIX = "Új fejezet: ";
    private static final String ACCEPTED = "ELFOGADVA";

    private LegacyTranscriptParser() {
    }

    public static ConferenceDeliberationEnvelope parse(List<ConferenceTranscriptEnvelope.Turn> turns) {
        if (turns == null || turns.isEmpty()) {
            return null;
        }

        Map<Integer, ConferenceDeliberationEnvelope.SkepticVerdict> verdicts = new LinkedHashMap<>();
        Map<Integer, ConferenceDeliberationEnvelope.ChairRuling> rulings = new LinkedHashMap<>();
        for (ConferenceTranscriptEnvelope.Turn turn : turns) {
            if (SKEPTIC_PERSONA.equals(turn.persona())) {
                collectVerdicts(turn.text(), verdicts);
            } else if (CHAIR_PERSONA.equals(turn.persona())) {
                collectRulings(turn.text(), rulings);
            }
        }

        List<ConferenceDeliberationEnvelope.Thread> threads = new ArrayList<>();
        int index = 0;
        for (ConferenceTranscriptEnvelope.Turn turn : turns) {
            if (SKEPTIC_PERSONA.equals(turn.persona()) || CHAIR_PERSONA.equals(turn.persona())) {
                continue;
            }
            List<String> claimLines = claimLines(turn.text());
            if (claimLines.isEmpty()) {
                continue;
            }
            List<ConferenceDeliberationEnvelope.Item> items = new ArrayList<>();
            for (String claimLine : claimLines) {
                items.add(new ConferenceDeliberationEnvelope.Item(
                        index, turn.persona(), claimLine, null, null, false, List.of(),
                        verdicts.get(index), rulings.get(index)));
                index++;
            }
            threads.add(new ConferenceDeliberationEnvelope.Thread(null, displayName(turn.persona()), items));
        }

        return threads.isEmpty() ? null : new ConferenceDeliberationEnvelope(List.copyOf(threads));
    }

    /** An expert turn's first line is its own header ("Drill: 2 javaslat …"); every further
     *  non-blank line is one proposal, in the order the round appended them. */
    private static List<String> claimLines(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        String[] lines = text.split("\n");
        List<String> claims = new ArrayList<>();
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].strip();
            if (!line.isEmpty()) {
                claims.add(line);
            }
        }
        return claims;
    }

    private static void collectVerdicts(String text,
                                         Map<Integer, ConferenceDeliberationEnvelope.SkepticVerdict> verdicts) {
        if (text == null) {
            return;
        }
        for (String line : text.split("\n")) {
            Matcher matcher = SKEPTIC_LINE.matcher(line.strip());
            if (matcher.matches()) {
                verdicts.put(Integer.parseInt(matcher.group(1)),
                        new ConferenceDeliberationEnvelope.SkepticVerdict(matcher.group(2), matcher.group(3)));
            }
        }
    }

    private static void collectRulings(String text,
                                        Map<Integer, ConferenceDeliberationEnvelope.ChairRuling> rulings) {
        if (text == null) {
            return;
        }
        for (String line : text.split("\n")) {
            String stripped = line.strip();
            if (stripped.startsWith(CHAPTER_PREFIX)) {
                continue;
            }
            Matcher matcher = CHAIR_LINE.matcher(stripped);
            if (matcher.matches()) {
                rulings.put(Integer.parseInt(matcher.group(1)),
                        new ConferenceDeliberationEnvelope.ChairRuling(
                                ACCEPTED.equals(matcher.group(2)),
                                confidenceOrNull(matcher.group(3)),
                                matcher.group(4)));
            }
        }
    }

    /** The chair line's confidence was rendered from a BigDecimal, but a hand-edited or older row
     *  can carry anything — an unreadable value becomes null rather than failing the whole parse. */
    private static BigDecimal confidenceOrNull(String raw) {
        try {
            return new BigDecimal(raw.strip());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** The catalog's display name, falling back to the raw persona key on catalog drift. */
    private static String displayName(String persona) {
        try {
            return CharacterExpertCatalog.byKey(persona).displayName();
        } catch (RuntimeException e) {
            return persona;
        }
    }
}
```

- [ ] **Step 4: Futtasd a tesztet**

Run: `./mvnw test -Dtest='LegacyTranscriptParserTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (4 teszt).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/service/LegacyTranscriptParser.java backend/src/test/java/io/mrkuhne/mezo/feature/character/LegacyTranscriptParserTest.java
git commit -m "feat(character): derive threads from a pre-structure transcript at read time (mezo-xlvr)"
```

---

### Task 6: Szerződés és a DTO-leképezés

**Files:**
- Modify: `api/feature/character/character.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java`
- Modify: `frontend/src/data/character/characterApi.ts`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterApiIT.java` (bővítés — itt élnek már a `/api/character/conference/{id}` tesztek)

**Interfaces:**
- Consumes: `ConferenceDeliberationEnvelope`, `LegacyTranscriptParser#parse`.
- Produces: `CharacterConferenceResponse.deliberation` (opcionális, `ConferenceThread[]`); FE típusok `ConferenceThread`, `ConferenceItem`, `ConferencePeerReaction`.

- [ ] **Step 1: Írd meg a bukó tesztet**

A `CharacterApiIT` végére (az osztály `getForBody` / `ownerAuthHeaders()` idiómájával, ahogy a
`feed_withSeededObservationAndConference_mergesNewestFirst` teszt is teszi):

```java
    private CharacterConferenceEntity seedConference(UUID owner, ConferenceTranscriptEnvelope transcript) {
        CharacterConferenceEntity conf = new CharacterConferenceEntity();
        conf.setCreatedBy(owner);
        conf.setKind("WEEKLY");
        conf.setWeekStart(LocalDate.of(2026, 8, 24));
        conf.setTranscript(transcript);
        conf.setOutcome(new ConferenceOutcomeEnvelope(List.of()));
        conf.setGeneratedAt(Instant.now());
        return conferenceRepository.save(conf);
    }

    @Test
    void conference_storedDeliberation_isServedAsThreads() {
        UUID owner = ownerId();
        CharacterConferenceEntity conf = seedConference(owner, new ConferenceTranscriptEnvelope(List.of()));
        conf.setDeliberation(new ConferenceDeliberationEnvelope(List.of(
                new ConferenceDeliberationEnvelope.Thread("recovery", "Regeneráció", List.of(
                        new ConferenceDeliberationEnvelope.Item(0, "szomnologus", "Romlik az alvás.", "NEW",
                                null, false, List.of(),
                                new ConferenceDeliberationEnvelope.SkepticVerdict("KEEP", "Rendben."),
                                new ConferenceDeliberationEnvelope.ChairRuling(
                                        true, new BigDecimal("0.60"), "Elfogadom."))))));
        conferenceRepository.save(conf);

        CharacterConferenceResponse res = getForBody("/api/character/conference/" + conf.getId(),
                ownerAuthHeaders(), HttpStatus.OK, CharacterConferenceResponse.class);

        assertThat(res.getDeliberation()).hasSize(1);
        assertThat(res.getDeliberation().get(0).getTitle()).isEqualTo("Regeneráció");
        assertThat(res.getDeliberation().get(0).getItems().get(0).getSkeptic().getVerdict())
                .isEqualTo(ConferenceSkepticVerdict.VerdictEnum.KEEP);
    }

    @Test
    void conference_legacyRow_getsThreadsDerivedFromItsProse_transcriptStaysToo() {
        UUID owner = ownerId();
        CharacterConferenceEntity conf = seedConference(owner, new ConferenceTranscriptEnvelope(List.of(
                new ConferenceTranscriptEnvelope.Turn("drill",
                        "Drill: 1 javaslat a hét 3 megfigyeléséből.\nKimarad a napló.", List.of()),
                new ConferenceTranscriptEnvelope.Turn("mezo",
                        "Mezo: 1/1 javaslat elfogadva.\nP0: ELFOGADVA (0.70) — Rendben.", List.of()))));

        CharacterConferenceResponse res = getForBody("/api/character/conference/" + conf.getId(),
                ownerAuthHeaders(), HttpStatus.OK, CharacterConferenceResponse.class);

        assertThat(res.getDeliberation()).hasSize(1);
        assertThat(res.getDeliberation().get(0).getTitle()).isEqualTo("Drill");
        assertThat(res.getDeliberation().get(0).getDimensionKey()).isNull();
        assertThat(res.getTranscript()).hasSize(2);
    }
```

Az osztály importjait egészítsd ki: `ConferenceDeliberationEnvelope`, `ConferenceSkepticVerdict`,
`CharacterConferenceResponse`, `java.math.BigDecimal`.

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run: `./mvnw test -Dtest='CharacterApiIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — a `deliberation` mező nem létezik a DTO-n.

- [ ] **Step 3: Bővítsd a szerződést**

Az `api/feature/character/character.yml` `components.schemas` blokkjában, a `ConferenceTurn` mellé:

```yaml
    ConferencePeerReaction:
      type: object
      required: [expertKey, stance, argument]
      properties:
        expertKey: { type: string }
        stance: { type: string, enum: [SUPPORT, CHALLENGE, NUANCE] }
        argument: { type: string }
    ConferenceSkepticVerdict:
      type: object
      required: [verdict, argument]
      properties:
        verdict: { type: string, enum: [KEEP, KILL] }
        argument: { type: string }
    ConferenceChairRuling:
      type: object
      required: [accepted, reason]
      properties:
        accepted: { type: boolean }
        confidence: { type: number, format: double, nullable: true }
        reason: { type: string }
    ConferenceItem:
      type: object
      required: [index, expertKey, text, sensitive, reactions]
      properties:
        index: { type: integer }
        expertKey: { type: string }
        text: { type: string }
        kind: { type: string, nullable: true }
        claimId: { type: string, nullable: true }
        sensitive: { type: boolean }
        reactions:
          type: array
          items: { $ref: '#/components/schemas/ConferencePeerReaction' }
        skeptic:
          allOf: [{ $ref: '#/components/schemas/ConferenceSkepticVerdict' }]
          nullable: true
        chair:
          allOf: [{ $ref: '#/components/schemas/ConferenceChairRuling' }]
          nullable: true
    ConferenceThread:
      type: object
      required: [title, items]
      properties:
        dimensionKey: { type: string, nullable: true }
        title: { type: string }
        items:
          type: array
          items: { $ref: '#/components/schemas/ConferenceItem' }
```

A `CharacterConferenceResponse.properties` blokkjába, a `transcript` után:

```yaml
        deliberation:
          description: >-
            The same meeting as a STRUCTURE — one thread per dossier chapter, each item carrying
            the chain that happened to it. Absent only when the row is neither stored structured
            nor derivable from its prose transcript; the client then renders `transcript`.
          type: array
          items: { $ref: '#/components/schemas/ConferenceThread' }
```

- [ ] **Step 4: Generáld újra a szerződést**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

Ellenőrizd, hogy az `api/openapi.yml` és a `frontend/src/data/_client/api.gen.ts` is frissült.

- [ ] **Step 5: Írd meg a leképezést**

A `CharacterService.conference(...)` metódusában, a `changes` után:

```java
        ConferenceDeliberationEnvelope deliberation = conf.getDeliberation() != null
                ? conf.getDeliberation()
                : LegacyTranscriptParser.parse(conf.getTranscript().turns());
        List<ConferenceThread> threads = deliberation == null ? null : deliberation.threads().stream()
                .map(CharacterService::toThreadDto)
                .toList();
```

és a builderbe `.deliberation(threads)`. A leképező segédek (privát statikus metódusok az osztály végén):

```java
    private static ConferenceThread toThreadDto(ConferenceDeliberationEnvelope.Thread thread) {
        return ConferenceThread.builder()
                .dimensionKey(thread.dimensionKey())
                .title(thread.title())
                .items(thread.items().stream().map(CharacterService::toItemDto).toList())
                .build();
    }

    private static ConferenceItem toItemDto(ConferenceDeliberationEnvelope.Item item) {
        return ConferenceItem.builder()
                .index(item.index())
                .expertKey(item.expertKey())
                .text(item.text())
                .kind(item.kind())
                .claimId(item.claimId())
                .sensitive(item.sensitive())
                .reactions(item.reactions().stream()
                        .map(reaction -> ConferencePeerReaction.builder()
                                .expertKey(reaction.expertKey())
                                .stance(ConferencePeerReaction.StanceEnum.fromValue(reaction.stance()))
                                .argument(reaction.argument())
                                .build())
                        .toList())
                .skeptic(item.skeptic() == null ? null : ConferenceSkepticVerdict.builder()
                        .verdict(ConferenceSkepticVerdict.VerdictEnum.fromValue(item.skeptic().verdict()))
                        .argument(item.skeptic().argument())
                        .build())
                .chair(item.chair() == null ? null : ConferenceChairRuling.builder()
                        .accepted(item.chair().accepted())
                        .confidence(item.chair().confidence() == null
                                ? null : item.chair().confidence().doubleValue())
                        .reason(item.chair().reason())
                        .build())
                .build();
    }
```

- [ ] **Step 6: Vedd fel az FE típus-exportokat**

A `frontend/src/data/character/characterApi.ts` típus-blokkjában, a `ConferenceTurn` után:

```typescript
export type ConferenceThread = components['schemas']['ConferenceThread']
export type ConferenceItem = components['schemas']['ConferenceItem']
export type ConferencePeerReaction = components['schemas']['ConferencePeerReaction']
```

- [ ] **Step 7: Futtasd a teszteket**

Run: `./mvnw test -Dtest='*Character*,Konzilium*,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts frontend/src/data/character/characterApi.ts backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java backend/src/test/java/io/mrkuhne/mezo/feature/character
git commit -m "feat(api): serve the konzílium deliberation, deriving it for legacy rows (mezo-xlvr)"
```

---

### Task 7: Az azonosító kikerül a megfigyelés szövegéből

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/ObservationText.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterFeedbackService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumProposalRound.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/ObservationTextTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumUserFeedbackIT.java` (bővítés)

**Interfaces:**
- Produces: `ObservationText.stripClaimIdPrefix(String text)` → előtag nélküli szöveg.

- [ ] **Step 1: Írd meg a bukó tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/character/ObservationTextTest.java`:

```java
package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.ObservationText;
import org.junit.jupiter.api.Test;

class ObservationTextTest {

    @Test
    void stripClaimIdPrefix_removesALeadingUuidPrefix() {
        String text = "[ac2179ef-e74f-4532-8d5e-587fdc6e2a14] A felhasználó megerősítette: \"Alszol eleget.\"";

        assertThat(ObservationText.stripClaimIdPrefix(text))
                .isEqualTo("A felhasználó megerősítette: \"Alszol eleget.\"");
    }

    @Test
    void stripClaimIdPrefix_leavesOrdinaryTextAlone() {
        String text = "[fontos] A hétvégi fehérjebevitel elmarad.";

        assertThat(ObservationText.stripClaimIdPrefix(text)).isEqualTo(text);
    }

    @Test
    void stripClaimIdPrefix_nullSafe() {
        assertThat(ObservationText.stripClaimIdPrefix(null)).isNull();
    }
}
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run: `./mvnw test -Dtest='ObservationTextTest' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `ObservationText` nem létezik.

- [ ] **Step 3: Írd meg a segédet**

`backend/src/main/java/io/mrkuhne/mezo/feature/character/service/ObservationText.java`:

```java
package io.mrkuhne.mezo.feature.character.service;

import java.util.regex.Pattern;

/**
 * Reading-side cleanup for observation text (mezo-xlvr). Feedback observations written before
 * this change carry a machine prefix — {@code "[<claim uuid>] "} — that {@link CharacterService}
 * used to hand straight to the feed, so the Karakter feed showed a raw uuid to the user. New rows
 * no longer carry it ({@link CharacterFeedbackService}); this strips it off the old ones at read
 * time, so nothing has to be migrated and the claim link (the observation's own signal refIds)
 * is untouched.
 */
public final class ObservationText {

    /** A leading claim-id prefix: exactly one bracketed UUID and one space. A bracketed word that
     *  is NOT a uuid is ordinary text and stays. */
    private static final Pattern CLAIM_ID_PREFIX = Pattern.compile(
            "^\\[[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}] ");

    private ObservationText() {
    }

    public static String stripClaimIdPrefix(String text) {
        if (text == null) {
            return null;
        }
        return CLAIM_ID_PREFIX.matcher(text).replaceFirst("");
    }
}
```

- [ ] **Step 4: Vedd ki az előtagot az íráskor**

A `CharacterFeedbackService.apply(...)`-ben töröld a `claimIdPrefix` változót, és mindhárom ág szövege előtag nélkül épüljön:

```java
        switch (kind) {
            case KIND_TALAL -> {
                observationText = "A felhasználó megerősítette: \"" + claim.getText() + "\""
                        + TALAL_PRICED_IN_SUFFIX;
```

```java
            case KIND_NEM_IGAZ -> {
                observationText = "A felhasználó cáfolta: \"" + claim.getText() + "\"";
```

```java
            case KIND_PONTOSITOM -> {
                observationText = "A felhasználó pontosította: \"" + claim.getText() + "\" — "
                        + flatten(text);
```

Az osztály javadocjába vedd fel, hogy a claim azonosítója a jel-hivatkozásban (`refIds`) marad, és a konzílium onnan olvassa.

- [ ] **Step 5: Tedd vissza az előtagot a bizonyíték-sorba**

A `KonziliumProposalRound.run(...)` bizonyíték-építő ciklusában:

```java
            for (CharacterObservationEntity observation : entry.getValue()) {
                String text = observation.getText();
                if (CharacterFeedbackService.USER_EXPERT_KEY.equals(observation.getExpertKey())) {
                    // The claim id is what makes the answer addressable for the expert (the prompt's
                    // "[claimId]" contract) — it lives on the observation's own signal refIds since
                    // mezo-xlvr, never in the user-facing text.
                    String claimId = claimIdOf(observation);
                    text = USER_FEEDBACK_PREFIX + (claimId == null ? "" : "[" + claimId + "] ") + text;
                }
                lines.add(observation.getDay() + " (súly " + observation.getSalience() + "): " + text);
                refIds.add(observation.getId().toString());
            }
```

És a segédmetódus az osztály végén:

```java
    /** The claim a user-feedback observation answers — its {@code user-feedback} signal's first
     *  refId. Null when the row carries no such signal (an older or hand-written row). */
    private static String claimIdOf(CharacterObservationEntity observation) {
        if (observation.getSignals() == null) {
            return null;
        }
        for (ObservationSignalsEnvelope.Signal signal : observation.getSignals().signals()) {
            if (CharacterFeedbackService.SIGNAL_KEY.equals(signal.detectorKey()) && !signal.refIds().isEmpty()) {
                return signal.refIds().get(0);
            }
        }
        return null;
    }
```

Vedd fel az importot: `import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;`.

- [ ] **Step 6: Vágd le olvasáskor a régi sorokon**

A `CharacterService.feed(...)`-ben és a futás-megfigyelés leképezésében (`CharacterRunObservation.builder()` környéke) cseréld a `.text(obs.getText())` hívásokat:

```java
                    .text(ObservationText.stripClaimIdPrefix(obs.getText()))
```

- [ ] **Step 7: Bővítsd a visszajelzés IT-t**

A `KonziliumUserFeedbackIT`-ben az az assert, ami ma a `[claimId]` előtagot várja a MENTETT szövegben, váltson erre a párra:

```java
        assertThat(observation.getText()).doesNotContain(claim.getId().toString());
        assertThat(observation.getSignals().signals()).singleElement()
                .satisfies(signal -> assertThat(signal.refIds()).containsExactly(claim.getId().toString()));
```

Ahol a teszt a konzílium bizonyíték-sorát nézi (a fake LLM visszaechózott felhasználói üzenete), ott továbbra is szerepelnie kell az azonosítónak — ezt az assertet hagyd változatlanul, ez bizonyítja, hogy a prompt nem vakult meg.

- [ ] **Step 8: Bizonyítsd, hogy a régi sorok is tisztán jönnek**

A `CharacterApiIT`-be, a feed-teszt mellé:

```java
    @Test
    void feed_legacyObservationWithAClaimIdPrefix_servesItStripped() {
        UUID owner = ownerId();
        UUID claimId = UUID.randomUUID();
        CharacterObservationEntity obs = new CharacterObservationEntity();
        obs.setCreatedBy(owner);
        obs.setExpertKey("user");
        obs.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        obs.setDay(LocalDate.now());
        obs.setText("[" + claimId + "] A felhasználó megerősítette: \"Alszol eleget.\"");
        obs.setSalience((short) 2);
        obs.setSignals(new ObservationSignalsEnvelope(List.of(
                new ObservationSignalsEnvelope.Signal("user-feedback", "megerősítés", List.of(claimId.toString())))));
        observationRepository.save(obs);

        CharacterFeedItem[] items = getForBody("/api/character/feed", ownerAuthHeaders(),
                HttpStatus.OK, CharacterFeedItem[].class);

        assertThat(items).hasSize(1);
        assertThat(items[0].getText()).doesNotContain(claimId.toString());
        assertThat(items[0].getText()).startsWith("A felhasználó megerősítette:");
    }
```

- [ ] **Step 9: Futtasd a fókuszált kaput**

Run: `./mvnw test -Dtest='*Character*,DetectorTest,Konzilium*,ClaimLifecycleIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/test/java/io/mrkuhne/mezo/feature/character
git commit -m "fix(character): the claim id leaves the feed text and lives on the signal (mezo-xlvr)"
```

---

### Task 8: A szál-nézet a felületen

**Files:**
- Create: `frontend/src/features/character/components/ConferenceThreadCard.tsx`
- Create: `frontend/src/features/character/components/ConferenceThreadCard.test.tsx`
- Modify: `frontend/src/features/character/pages/KonziliumPage.tsx`
- Modify: `frontend/src/features/character/pages/KonziliumPage.test.tsx`
- Modify: `frontend/src/features/character/character.css`
- Modify: `frontend/src/data/character/characterMock.ts`

**Interfaces:**
- Consumes: `ConferenceThread`, `ConferenceItem`, `ConferencePeerReaction` (Task 6), `expertColor(key)`, `PersonaOrb({expertKey, size})`, `confidenceWord(confidence)`.
- Produces: `ConferenceThreadCard({ thread, experts, defaultOpen })`.

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/features/character/components/ConferenceThreadCard.test.tsx`:

```tsx
// ConferenceThreadCard — one dossier chapter's thread, collapsed by default (mezo-xlvr).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { ConferenceThreadCard } from './ConferenceThreadCard'
import { MOCK_EXPERTS } from '@/data/character/characterMock'
import type { ConferenceThread } from '@/data/character/characterApi'

const THREAD: ConferenceThread = {
  dimensionKey: 'recovery',
  title: 'Regeneráció',
  items: [
    {
      index: 0,
      expertKey: 'szomnologus',
      text: 'Romlik az alvásod.',
      kind: 'NEW',
      claimId: null,
      sensitive: false,
      reactions: [{ expertKey: 'pszichologus', stance: 'CHALLENGE', argument: 'Lehet stressz is.' }],
      skeptic: { verdict: 'KILL', argument: 'Kevés adat.' },
      chair: { accepted: false, confidence: 0.4, reason: 'Nem engedem be.' },
    },
    {
      index: 1,
      expertKey: 'pszichologus',
      text: 'Feszült hét áll mögötted.',
      kind: 'NEW',
      claimId: null,
      sensitive: false,
      reactions: [],
      skeptic: { verdict: 'KEEP', argument: 'Elfogadható.' },
      chair: { accepted: true, confidence: 0.8, reason: 'Rendben.' },
    },
  ],
}

describe('ConferenceThreadCard', () => {
  test('collapsed by default: shows the chapter, the tally and every claim text, but no reasoning', () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} />)

    expect(screen.getByText('Regeneráció')).toBeInTheDocument()
    expect(screen.getByText(/2 állítás/)).toBeInTheDocument()
    expect(screen.getByText(/1 maradt meg/)).toBeInTheDocument()
    expect(screen.getByText('Romlik az alvásod.')).toBeInTheDocument()
    expect(screen.queryByText('Kevés adat.')).not.toBeInTheDocument()
  })

  test('opening the thread reveals the chain: peer stance, skeptic, chair', async () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText('Lehet stressz is.')).toBeInTheDocument()
    expect(screen.getByText('Kevés adat.')).toBeInTheDocument()
    expect(screen.getByText('Nem engedem be.')).toBeInTheDocument()
  })

  test('confidence is shown as a word, never as a number', async () => {
    render(<ConferenceThreadCard thread={THREAD} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/biztos/)).toBeInTheDocument()
    expect(screen.queryByText(/0\.8/)).not.toBeInTheDocument()
  })

  test('an item with no skeptic verdict says the round gave no answer', async () => {
    const open: ConferenceThread = {
      ...THREAD,
      items: [{ ...THREAD.items[0], skeptic: null, chair: null }],
    }
    render(<ConferenceThreadCard thread={open} experts={MOCK_EXPERTS} />)

    await userEvent.click(screen.getByRole('button', { name: /Regeneráció/ }))

    expect(screen.getByText(/nem adott választ/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run (a `frontend/` könyvtárból): `pnpm test -- ConferenceThreadCard`
Expected: FAIL — a komponens nem létezik.

- [ ] **Step 3: Írd meg a komponenst**

`frontend/src/features/character/components/ConferenceThreadCard.tsx`:

```tsx
// ============================================================
// Mezo · Karakter — ConferenceThreadCard (mezo-xlvr)
// One dossier chapter's thread from a konzílium: the faces that spoke, the chapter's own title,
// and a tally. Collapsed by default (spec §9) — the outcome is readable without opening anything;
// opening reveals the chain in the order it happened: proposal, peer stances, Szkeptikus, Mezo.
//
// Honesty rules this component enforces:
// - confidence is a WORD (confidenceWord), never the raw number;
// - a null skeptic/chair means that round produced no answer, and the card SAYS so — it never
//   renders a default verdict that nobody gave.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'
import { confidenceWord } from '@/data/character/characterApi'
import type { CharacterExpertDto, ConferenceItem, ConferenceThread } from '@/data/character/characterApi'

const STANCE_LABEL: Record<string, string> = {
  SUPPORT: 'támogatja',
  CHALLENGE: 'vitatja',
  NUANCE: 'árnyalja',
}

const NO_ANSWER = 'Ez a kör nem adott választ erre az állításra.'

export interface ConferenceThreadCardProps {
  thread: ConferenceThread
  experts: CharacterExpertDto[]
  defaultOpen?: boolean
}

function displayName(experts: CharacterExpertDto[], key: string): string {
  return experts.find((e) => e.key === key)?.displayName ?? key
}

/** Every expert that spoke in this thread, proposers first, then anyone who only reacted. */
function speakers(thread: ConferenceThread): string[] {
  const keys: string[] = []
  for (const item of thread.items) {
    if (!keys.includes(item.expertKey)) keys.push(item.expertKey)
  }
  for (const item of thread.items) {
    for (const reaction of item.reactions) {
      if (!keys.includes(reaction.expertKey)) keys.push(reaction.expertKey)
    }
  }
  return keys
}

function keptCount(thread: ConferenceThread): number {
  return thread.items.filter((item) => item.chair?.accepted === true).length
}

function ChainStep({ who, color, children }: { who: string; color: string; children: React.ReactNode }) {
  return (
    <div className="kr-thstep" style={{ '--c': color } as CSSProperties}>
      <span className="kr-thdot" aria-hidden="true" />
      <div className="kr-thwho">{who}</div>
      <div className="kr-thsaid">{children}</div>
    </div>
  )
}

function ItemChain({ item, experts }: { item: ConferenceItem; experts: CharacterExpertDto[] }) {
  return (
    <div className="kr-thitem">
      <ChainStep who={`${displayName(experts, item.expertKey)} felvetette`} color={expertColor(item.expertKey)}>
        {item.text}
      </ChainStep>
      {item.reactions.map((reaction, i) => (
        <ChainStep
          key={i}
          who={`${displayName(experts, reaction.expertKey)} ${STANCE_LABEL[reaction.stance] ?? 'hozzászólt'}`}
          color={expertColor(reaction.expertKey)}
        >
          {reaction.argument}
        </ChainStep>
      ))}
      <ChainStep who="Szkeptikus" color={expertColor('szkeptikus')}>
        {item.skeptic == null
          ? NO_ANSWER
          : `${item.skeptic.verdict === 'KILL' ? 'Kukázta' : 'Meghagyta'} — ${item.skeptic.argument}`}
      </ChainStep>
      <ChainStep who="Mezo" color={expertColor('mezo')}>
        {item.chair == null
          ? NO_ANSWER
          : `${item.chair.accepted ? 'Elfogadva' : 'Elvetve'}${
              item.chair.accepted && item.chair.confidence != null
                ? ` · ${confidenceWord(item.chair.confidence)}`
                : ''
            } — ${item.chair.reason}`}
      </ChainStep>
    </div>
  )
}

export function ConferenceThreadCard({ thread, experts, defaultOpen = false }: ConferenceThreadCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const kept = keptCount(thread)

  return (
    <div className="kr-thread">
      <button
        type="button"
        className="kr-thhead"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="kr-thfaces">
          {speakers(thread).map((key) => (
            <span key={key} className="kr-thorb" style={{ '--c': expertColor(key) } as CSSProperties}>
              <PersonaOrb expertKey={key} size={20} />
            </span>
          ))}
        </span>
        <span className="kr-thtitle">
          <span className="kr-thtt">{thread.title}</span>
          <span className="kr-thts">{`${thread.items.length} állítás · ${kept} maradt meg`}</span>
        </span>
        <span className="kr-thchev" aria-hidden="true">{open ? '⌄' : '›'}</span>
      </button>
      {open
        ? (
            <div className="kr-thbody">
              {thread.items.map((item) => <ItemChain key={item.index} item={item} experts={experts} />)}
            </div>
          )
        : (
            <div className="kr-thcollapsed">
              {thread.items.map((item) => (
                <div key={item.index} className="kr-throw">
                  <span className={`kr-thb ${item.chair?.accepted === true ? 'acc' : 'rej'}`}>
                    {item.chair == null ? 'Nincs döntés' : item.chair.accepted ? 'Bekerült' : 'Elvetve'}
                  </span>
                  <span className={`kr-thtx${item.chair?.accepted === true ? '' : ' dim'}`}>{item.text}</span>
                </div>
              ))}
            </div>
          )}
    </div>
  )
}
```

- [ ] **Step 4: Vedd fel a stílusokat**

A `frontend/src/features/character/character.css` végére, a konzílium blokk után:

```css
/* ── konzílium szál-kártya (mezo-xlvr) ── */
.kr-thread { background: var(--surface-card); border-radius: 22px; margin: 0 12px 11px; overflow: hidden; box-shadow: 0 12px 26px -20px rgba(43, 33, 24, 0.65), 0 1px 3px -2px rgba(43, 33, 24, 0.22); }
.kr-thhead { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 12px 14px 11px; border: none; background: none; font-family: inherit; text-align: left; cursor: pointer; color: inherit; }
.kr-thfaces { display: flex; flex: none; padding-top: 2px; }
.kr-thorb { width: 22px; height: 22px; border-radius: 50%; margin-left: -7px; display: grid; place-items: center; overflow: hidden; border: 1.5px solid var(--surface-card); box-shadow: 0 3px 7px -3px var(--c); }
.kr-thorb:first-child { margin-left: 0; }
.kr-thtitle { flex: 1; }
.kr-thtt { display: block; font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
.kr-thts { display: block; font-size: 9.5px; font-weight: 600; color: var(--text-secondary); margin-top: 2px; }
.kr-thchev { font-size: 14px; color: var(--text-muted); padding-left: 4px; }
.kr-thcollapsed { padding: 0 14px 12px; }
.kr-throw { display: flex; align-items: center; gap: 8px; padding: 7px 0; }
.kr-throw + .kr-throw { border-top: 0.5px solid var(--divider); }
.kr-thb { font-size: 9px; font-weight: 800; padding: 4px 10px; border-radius: 20px; flex: none; }
.kr-thb.acc { background: rgba(78, 107, 66, 0.9); color: #fff; }
.kr-thb.rej { background: rgba(43, 33, 24, 0.08); color: var(--text-secondary); }
.kr-thtx { font-size: 11px; line-height: 1.45; font-weight: 300; }
.kr-thtx.dim { color: var(--text-secondary); }
.kr-thbody { padding: 0 14px 13px; }
.kr-thitem + .kr-thitem { border-top: 0.5px solid var(--divider); margin-top: 10px; padding-top: 6px; }
.kr-thstep { position: relative; padding: 9px 0 9px 20px; }
.kr-thstep::before { content: ''; position: absolute; left: 5px; top: 15px; bottom: -9px; width: 1px; background: var(--divider); }
.kr-thitem .kr-thstep:last-child::before { display: none; }
.kr-thdot { position: absolute; left: 0; top: 12px; width: 11px; height: 11px; border-radius: 50%; background: var(--c); }
.kr-thwho { font-size: 9.5px; font-weight: 800; color: var(--c); }
.kr-thsaid { font-size: 11.5px; line-height: 1.55; font-weight: 300; margin-top: 2px; }
```

- [ ] **Step 5: Futtasd a komponens-tesztet**

Run: `pnpm test -- ConferenceThreadCard`
Expected: PASS (4 teszt).

- [ ] **Step 6: Kösd be az oldalra**

A `KonziliumPage.tsx`-ben, a `changes`-blokk után, a `buildBlocks(...)` render helyére:

```tsx
          {conference.deliberation != null && conference.deliberation.length > 0
            ? conference.deliberation.map((thread, i) => (
                <ConferenceThreadCard key={`${thread.title}-${i}`} thread={thread} experts={experts} />
              ))
            : buildBlocks(conference.transcript, experts).map((b, i) => {
                /* a meglévő ág változatlanul */
              })}
```

Vedd fel az importot: `import { ConferenceThreadCard } from '@/features/character/components/ConferenceThreadCard'`. A `buildBlocks`, `TranscriptTurn` és a fázis-címkék MARADNAK — ez a legacy fallback ág.

- [ ] **Step 7: Vedd fel a mock fixture-t**

A `characterMock.ts`-ben, a `MOCK_CONFERENCE_DETAIL` `w2` bejegyzésébe vegyél fel egy `deliberation` tömböt, ami ugyanazt a négy állítást hordozza, mint a `TRANSCRIPT_TURNS` — két szál (`physical` „Fizikai állapot", `discipline` „Fegyelem"), az elsőben egy `pszichologus` reakcióval, mindegyik tételen `skeptic` és `chair` értékkel. A `b0` bootstrap bejegyzés `deliberation` NÉLKÜL marad: ez a legacy ág élő mock-példánya.

```typescript
const DELIBERATION_W2: ConferenceThread[] = [
  {
    dimensionKey: 'physical',
    title: 'Fizikai állapot',
    items: [
      {
        index: 0,
        expertKey: 'doki',
        text: 'A testzsír-trend és a stagnáló testsúly rekompozícióra utal.',
        kind: 'NEW',
        claimId: null,
        sensitive: false,
        reactions: [
          { expertKey: 'edzo', stance: 'SUPPORT', argument: 'Az edzésterhelés is ezt támasztja alá.' },
        ],
        skeptic: { verdict: 'KEEP', argument: 'Három adatpont kevés a "biztos" szinthez.' },
        chair: { accepted: true, confidence: 0.6, reason: 'Elfogadom, a Szkeptikus érve helytálló.' },
      },
    ],
  },
  {
    dimensionKey: 'discipline',
    title: 'Fegyelem',
    items: [
      {
        index: 1,
        expertKey: 'drill',
        text: 'A heti fókuszok teljesítési aránya négy hete 80% felett.',
        kind: 'NEW',
        claimId: null,
        sensitive: false,
        reactions: [],
        skeptic: { verdict: 'KEEP', argument: 'A mintaidőszak rövid, de a jel egyértelmű.' },
        chair: { accepted: true, confidence: 0.8, reason: 'Négy egymást követő hét konzisztens jel.' },
      },
    ],
  },
]
```

Az importot vedd fel a fájl típus-importjai közé: `ConferenceThread`.

- [ ] **Step 8: Bővítsd az oldal tesztjét**

A `KonziliumPage.test.tsx`-be:

```tsx
  test('a conference with a deliberation renders threads, collapsed', async () => {
    hoisted.detail = { w2: MOCK_CONFERENCE_DETAIL.w2 }
    renderAt('/me/karakter/konzilium?id=w2')

    expect(screen.getByText('Fizikai állapot')).toBeInTheDocument()
    expect(screen.queryByText(/Három adatpont kevés/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Fizikai állapot/ }))
    expect(screen.getByText(/Három adatpont kevés/)).toBeInTheDocument()
  })

  test('a conference without a deliberation still renders the prose transcript', () => {
    hoisted.detail = { b0: MOCK_BOOTSTRAP_CONFERENCE }
    renderAt('/me/karakter/konzilium?id=b0')

    expect(screen.getByText(/A teljes eddigi történet beolvasva/)).toBeInTheDocument()
  })
```

Az importot egészítsd ki: `MOCK_BOOTSTRAP_CONFERENCE`.

- [ ] **Step 9: Futtasd az FE kaput**

Run: `pnpm test` majd `VITE_USE_MOCK=false pnpm test` majd `pnpm build`
Expected: mindhárom PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/character frontend/src/data/character
git commit -m "feat(character): thread view for the konzílium, collapsed by default (mezo-xlvr)"
```

---

### Task 9: A Feed napi csoportjainak összecsukása

**Files:**
- Modify: `frontend/src/features/character/pages/CharacterFeedPage.tsx`
- Modify: `frontend/src/features/character/pages/CharacterFeedPage.test.tsx`
- Modify: `frontend/src/features/character/character.css`

**Interfaces:**
- Consumes: `groupByDay(items)` (a fájlban már megvan), `feedDayLabel(iso)`.

- [ ] **Step 1: Írd meg a bukó tesztet**

A `CharacterFeedPage.test.tsx`-be:

```tsx
  test('only the newest day is open; older days collapse behind a header with a count', async () => {
    hoisted.items = [
      { kind: 'OBSERVATION', at: '2026-08-30T06:00:00Z', expertKey: 'drill', dimensionKeys: [], text: 'Mai megfigyelés.' },
      { kind: 'OBSERVATION', at: '2026-08-29T06:00:00Z', expertKey: 'drill', dimensionKeys: [], text: 'Tegnapi megfigyelés.' },
    ]
    render(<CharacterFeedPage />)

    expect(screen.getByText('Mai megfigyelés.')).toBeInTheDocument()
    expect(screen.queryByText('Tegnapi megfigyelés.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /1 megfigyelés/ }))
    expect(screen.getByText('Tegnapi megfigyelés.')).toBeInTheDocument()
  })
```

Igazítsd a `hoisted` / render-idiómát a fájlban már meglévőhöz.

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run: `pnpm test -- CharacterFeedPage`
Expected: FAIL — minden nap ki van renderelve.

- [ ] **Step 3: Írd meg az összecsukást**

A `CharacterFeedPage` komponensben, a `groups` kiszámítása után:

```tsx
  // Only the newest day starts open (spec §9): the page then fits one screen, and a dense day
  // never swallows the rest. Per-day open state lives here — deliberately NOT persisted: the
  // feed is a "what happened lately" surface, not a workspace with remembered state.
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})
  const isOpen = (day: string, index: number) => openDays[day] ?? index === 0
```

Vedd fel az importot: `import { useState } from 'react'`.

A nap-fejléc gombbá válik, alatta pedig csak nyitott állapotban renderelődik a tartalom:

```tsx
          const open = isOpen(grp.day, gi)
          const count = grp.items.length
          return (
            <div key={`${grp.day}-${gi}`}>
              <button
                type="button"
                className="kr-feedday"
                aria-expanded={open}
                onClick={() => setOpenDays((was) => ({ ...was, [grp.day]: !open }))}
              >
                <span className="kr-fdlbl">{grp.day}</span>
                <span className="kr-fdcount">{`${count} megfigyelés`}</span>
                <span className="kr-fdchev" aria-hidden="true">{open ? '⌄' : '›'}</span>
              </button>
              {open && (
                <>
                  {/* a meglévő observations + diffs blokk változatlanul */}
                </>
              )}
            </div>
          )
```

- [ ] **Step 4: Igazítsd a stílust**

A `character.css` `.kr-feedday` szabályát cseréld erre (a mai tipográfiát megtartva, gombbá alakítva):

```css
.kr-feedday { display: flex; align-items: center; gap: 8px; width: calc(100% - 24px); margin: 0 12px; padding: 10px 2px 6px; border: none; background: none; font-family: inherit; color: inherit; cursor: pointer; }
.kr-feedday .kr-fdlbl { font-size: 8.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
.kr-feedday .kr-fdcount { font-size: 8.5px; font-weight: 600; color: var(--text-secondary); margin-left: auto; }
.kr-feedday .kr-fdchev { font-size: 12px; color: var(--text-muted); }
```

Ha a régi `.kr-feedday` szabály más tulajdonságokat is hordoz, azokat vidd át a `.kr-fdlbl`-re, hogy a nap-címke betűképe ne változzon.

- [ ] **Step 5: Futtasd az FE kaput**

Run: `pnpm test` majd `VITE_USE_MOCK=false pnpm test` majd `pnpm build`
Expected: mindhárom PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/character
git commit -m "feat(character): the feed opens today and folds the older days (mezo-xlvr)"
```

---

### Task 10: Dokumentáció és kapuk

**Files:**
- Create: `docs/decisions/0037-konzilium-cross-talk-round.md`
- Modify: `docs/features/character.md`
- Modify: `docs/CODEMAP.md` (generált)

- [ ] **Step 1: Ellenőrizd az ADR sorszámot**

Run: `ls docs/decisions | tail -5`
Ha a `0037` már foglalt, vedd a következő szabadot, és a fájlnévben és a H1 címben is azt használd.

- [ ] **Step 2: Írd meg az ADR-t**

`docs/decisions/0037-konzilium-cross-talk-round.md`:

```markdown
# 0037. A konzílium kereszt-vita köre és a strukturált tanácskozás

- Státusz: elfogadva
- Dátum: 2026-09-06
- bd: mezo-xlvr

## Kontextus

A heti konzílium átirata próza volt: a javaslatokat, a Szkeptikus verdiktjeit és Mezo döntéseit
három külön buborék hordozta, a köztük lévő kapcsolatot csak egy `P` sorszám. A szerkezet a
futás memóriájában végig megvolt, mentés előtt dobtuk el. Ráadásul a szakértők nem is látták
egymás javaslatait, így a tanácskozás valójában nem volt tanácskozás.

## Döntés

Két lépés. Egy: a tanácskozás szerkezete külön jsonb oszlopban mentődik, fejezet-szálakra bontva,
a próza-átirat mellett. Kettő: a javaslat- és a verdikt-kör közé bekerül egy kereszt-vita kör,
ami CSAK azokra a fejezetekre hív modellt, ahol legalább két szakértő javasolt. Egy szakértő a
társa javaslatára állásfoglalást ad (támogatja, vitatja, árnyalja) egy mondat indoklással; ezek
Mezo prompt-jába kerülnek. A Szkeptikus köre változatlan, a döntés Mezóé marad.

## Következmények

- Konferenciánként legfeljebb hat plusz LLM-hívás, a legtöbb szakértőt érintő fejezetektől lefelé.
- A régi konzíliumok olvasáskor kapnak szálakat, a próza gépi soraiból visszafejtve; ott a szálak
  szakértő szerint állnak össze, mert a fejezet-hovatartozás nincs az átiratban.
- Egy nem értelmezhető kör nem termel verdiktet, és a felület ezt ki is mondja.
```

- [ ] **Step 3: Frissítsd a feature-dokumentumot**

A `docs/features/character.md`-ben:
- §3 (Architecture & data flow): a heti kör három lépésre bővül, a kereszt-vita a javaslat és a verdikt közé kerül.
- §4 (Data model & API): a `character_conference.deliberation` oszlop és a `deliberation` válaszmező.
- §9 (Decisions, gotchas & deferred): a claim-azonosító a jel-hivatkozásban él, nem a szövegben; a régi sorok olvasáskori visszafejtése; a hat hívásos korlát.
- §10 (Key files): az öt új backend osztály és az új FE komponens.
- A frontmatter `updated` mezőjét állítsd `2026-09-06`-ra.

- [ ] **Step 4: Generáld újra a codemapet és futtasd a lintereket**

```bash
node scripts/gen-codemap.mjs
node scripts/gen-codemap.mjs --check
node scripts/lint-docs.mjs --errors-only
node scripts/lint-liquibase.mjs
```
Expected: mindegyik hibátlan.

- [ ] **Step 5: Futtasd a teljes fókuszált kaput**

```bash
cd backend && ./mvnw test -Dtest='*Character*,DetectorTest,Konzilium*,ClaimLifecycleIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```
Expected: minden PASS.

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs(character): cross-talk round + structured deliberation (mezo-xlvr)"
```

---

## Amit szándékosan nem csinálunk

- Nincs adatmigráció a régi konzíliumokra; a visszafejtés olvasáskor történik, mentés nélkül.
- A Szkeptikus köre nem látja a társak reakcióit.
- A reakció nem módosít javaslatot és nem hoz létre újat.
- A Feed lapozása marad egyetlen lekérés, csak a megjelenítés csukódik össze.
- A bootstrap és a havi konzílium nem kap kereszt-vita kört.
