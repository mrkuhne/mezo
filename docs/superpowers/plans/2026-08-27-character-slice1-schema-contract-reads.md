# Karakter Slice 1 — Schema + Contract + Read Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Karakter dossier's persistence spine (5 tables), the `character.yml`
contract with 4 read endpoints, lazy core-dimension seeding, and honest-empty reads — bd
`mezo-1gim.1`, spec `docs/superpowers/specs/2026-08-27-user-character-dossier-design.md` §4/§9.

**Architecture:** New backend feature package `feature/character` mirroring `feature/proactive`'s
layout (entity/repository/service/controller/config). No LLM anywhere in this slice — reads
return the honest empty dossier until later slices populate it. One deliberate deviation from
the spec is locked here: the 7 core dimensions are **lazily seeded on first read** (the
habit-day precedent), NOT by migration — `character_dimension` rows carry `created_by`, and a
migration cannot know the owner's user id.

**Tech Stack:** Spring Boot 3 + JPA/Hibernate (`OwnedEntity` base, soft delete), Liquibase SQL
changesets, openapi-merge-cli + openapi-generator (`CharacterApi`/DTOs), JUnit ITs on
`ApiIntegrationTest` (Testcontainers).

## Global Constraints

- House idioms: UUID PK `gen_random_uuid()`, `created_by` ownership, `is_deleted` soft delete
  (`@SQLDelete`/`@SQLRestriction`), typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)`, Liquibase
  script `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql` + changeset in `1.0.0_master.yml`.
- Feature switch: new `CHARACTER_SWITCH = "mezo.feature.character.enabled"` in
  `FeaturesConfiguration`; every character bean conditions on it (the PROACTIVE_SWITCH
  precedent notes it ALSO needs COMPANION_SWITCH — that dependency starts mattering in Slice 2
  when LLM calls appear; Slice 1 beans condition on CHARACTER_SWITCH only).
- Honest states: absence is `[]` on list endpoints / explicit nulls, never fabricated content.
  Unknown maturity renders 0, portraits start empty-string.
- Core dimension catalog (spec §2, keys verbatim): `physical`, `athletic`, `nutrition`,
  `recovery`, `mental`, `discipline`, `life` — with expert keys `doki`, `edzo`, `taplalkozo`,
  `szomnologus`, `pszichologus`, `drill`, `antropologus` and HU titles `Fizikai`, `Sportolói`,
  `Táplálkozási`, `Alvás & regeneráció`, `Mentális & érzelmi`, `Motiváció & fegyelem`,
  `Élet & kapcsolatok`.
- Local testing: focused ITs only, Testcontainers mode:
  `cd backend && ./mvnw test -Dtest=<Pattern> -Dmezo.test.use-testcontainers=true`.
  Full suite runs in CI via the self-PR (never locally).
- Conventional commits carrying the bd id, e.g. `feat(character): ... (mezo-1gim.1)`.
- After the slice: regenerate `docs/CODEMAP.md` in the same change (ArchUnit + codemap are
  enforced; focused ITs don't cover them — CI does).

---

### Task 1: Migration + entities + repositories

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608272000_mezo-1gim.1_create_character_tables.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/CharacterDimensionEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/CharacterClaimEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/CharacterObservationEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/CharacterConferenceEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/CharacterPortraitRevisionEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ClaimEvidenceEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ClaimFeedbackEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ClaimConfidenceHistoryEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ObservationSignalsEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ConferenceTranscriptEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ConferenceOutcomeEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterDimensionRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterClaimRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterObservationRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterConferenceRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterPortraitRevisionRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterPersistenceIT.java`

**Interfaces:**
- Consumes: `io.mrkuhne.mezo.techcore.persistence.OwnedEntity` (id-less base: `createdBy`,
  `isDeleted`, `createdAt` — mirror `MemoirEntity`'s use exactly).
- Produces (Task 3 relies on these): the five entities + repositories with the finder
  signatures listed in Step 3, and the envelope record types by exact name above.

- [ ] **Step 1: Write the migration SQL**

`202608272000_mezo-1gim.1_create_character_tables.sql` (mirrors
`202608271200_mezo-p2tr_create_weekly_review.sql`'s conventions):

```sql
-- Karakter dossier spine (bd mezo-1gim.1, spec 2026-08-27-user-character-dossier-design §4):
-- 5 tables. character_dimension = 7 lazily-seeded CORE rows + AI-opened CHAPTER rows;
-- claims carry confidence + typed jsonb evidence/feedback/history; observations are the
-- nightly experts' output consumed by conferences; conferences persist the real multi-turn
-- konzílium transcript; portrait revisions back the future "Történet" view.

create table character_dimension (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    key         varchar(40) not null,
    title       varchar(80) not null,
    kind        varchar(10) not null,
    expert_key  varchar(40),
    portrait    text        not null default '',
    maturity    smallint    not null default 0,
    version     int         not null default 0,
    updated_at  timestamptz not null default now(),
    constraint pk_character_dimension_id primary key (id),
    constraint fk_character_dimension_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_character_dimension_kind check (kind in ('CORE', 'CHAPTER')),
    constraint ck_character_dimension_maturity check (maturity between 0 and 100)
);

create unique index uq_character_dimension_created_by_key
    on character_dimension (created_by, key) where is_deleted = false;

create table character_claim (
    id                    uuid          not null default gen_random_uuid(),
    created_by            uuid          not null,
    is_deleted            boolean       not null default false,
    created_at            timestamptz   not null default now(),
    dimension_id          uuid          not null,
    text                  text          not null,
    confidence            numeric(3, 2) not null,
    status                varchar(10)   not null,
    origin_conference_id  uuid,
    proposed_by           varchar(40)   not null,
    evidence              jsonb         not null,
    sensitive             boolean       not null default false,
    user_feedback         jsonb         not null,
    confidence_history    jsonb         not null,
    updated_at            timestamptz   not null default now(),
    constraint pk_character_claim_id primary key (id),
    constraint fk_character_claim_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_character_claim_dimension_id foreign key (dimension_id) references character_dimension (id),
    constraint ck_character_claim_status check (status in ('ACTIVE', 'RETIRED')),
    constraint ck_character_claim_confidence check (confidence between 0 and 1)
);

create index ix_character_claim_dimension_id on character_claim (dimension_id);

create table character_observation (
    id                        uuid        not null default gen_random_uuid(),
    created_by                uuid        not null,
    is_deleted                boolean     not null default false,
    created_at                timestamptz not null default now(),
    expert_key                varchar(40) not null,
    dimension_keys            jsonb       not null,
    day                       date        not null,
    text                      text        not null,
    salience                  smallint    not null,
    signals                   jsonb       not null,
    consumed_by_conference_id uuid,
    constraint pk_character_observation_id primary key (id),
    constraint fk_character_observation_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_character_observation_salience check (salience between 1 and 5)
);

create index ix_character_observation_created_by_day on character_observation (created_by, day);

create table character_conference (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    kind         varchar(10) not null,
    week_start   date,
    transcript   jsonb       not null,
    outcome      jsonb       not null,
    generated_at timestamptz not null,
    constraint pk_character_conference_id primary key (id),
    constraint fk_character_conference_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_character_conference_kind check (kind in ('BOOTSTRAP', 'WEEKLY', 'MONTHLY'))
);

create unique index uq_character_conference_weekly
    on character_conference (created_by, week_start) where is_deleted = false and kind = 'WEEKLY';

create table character_portrait_revision (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    dimension_id  uuid        not null,
    version       int         not null,
    portrait      text        not null,
    conference_id uuid        not null,
    constraint pk_character_portrait_revision_id primary key (id),
    constraint fk_character_portrait_revision_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_character_portrait_revision_dimension_id foreign key (dimension_id) references character_dimension (id)
);

create index ix_character_portrait_revision_dimension_id on character_portrait_revision (dimension_id);
```

Note: `character_conference.transcript`/`outcome` are written by later slices; Slice 1 only
reads them. The claim FKs to `character_conference` are intentionally NOT declared
(`origin_conference_id`, `consumed_by_conference_id` are soft refs — the conference row may be
soft-deleted/regenerated independently; the weekly-review regenerate precedent).

- [ ] **Step 2: Register the changeset**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202608272000_mezo-1gim.1_create_character_tables"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608272000_mezo-1gim.1_create_character_tables.sql
```

- [ ] **Step 3: Write the entities, envelopes, repositories**

All entities mirror `MemoirEntity` exactly (extends `OwnedEntity`, `@SQLDelete`/
`@SQLRestriction`, `@Getter @Setter`). Shown in full for the two least-obvious; the other
three repeat the same idiom with the columns from Step 1.

`CharacterDimensionEntity.java`:

```java
package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One dossier dimension (Karakter spec §2/§4): the 7 lazily-seeded CORE rows + AI-opened
 * CHAPTER rows. Portrait prose is rewritten only by conferences (Slice 3+); maturity is the
 * computed 0–100 coverage roll-up.
 */
@Getter
@Setter
@Entity
@Table(name = "character_dimension")
@SQLDelete(sql = "update character_dimension set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterDimensionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false, length = 40)
    private String key;

    @NotNull
    @Column(nullable = false, length = 80)
    private String title;

    /** CORE | CHAPTER. */
    @NotNull
    @Column(nullable = false, length = 10)
    private String kind;

    /** Owning expert persona key; null for CHAPTER rows (the Integrátor owns those). */
    @Column(name = "expert_key", length = 40)
    private String expertKey;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String portrait = "";

    @NotNull
    @Column(nullable = false)
    private Short maturity = 0;

    @NotNull
    @Column(nullable = false)
    private Integer version = 0;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
```

`CharacterClaimEntity.java` (same skeleton; fields):

```java
    @NotNull @Column(name = "dimension_id", nullable = false, columnDefinition = "uuid")
    private UUID dimensionId;

    @NotNull @Column(nullable = false, columnDefinition = "text")
    private String text;

    /** 0.00–1.00 — surfaced to the FE only as human words (Minták precedent). */
    @NotNull @Column(nullable = false, precision = 3, scale = 2)
    private java.math.BigDecimal confidence;

    /** ACTIVE | RETIRED — a Mezo-rejected proposal never becomes a row (spec §4). */
    @NotNull @Column(nullable = false, length = 10)
    private String status;

    @Column(name = "origin_conference_id", columnDefinition = "uuid")
    private UUID originConferenceId;

    /** Expert persona key that proposed it (or "user" for feedback-born claims later). */
    @NotNull @Column(name = "proposed_by", nullable = false, length = 40)
    private String proposedBy;

    @NotNull @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb")
    private ClaimEvidenceEnvelope evidence;

    /** The §3 mirror-tone class (self-calibration, rejection-pattern, med-cycle). */
    @NotNull @Column(nullable = false)
    private Boolean sensitive = false;

    @NotNull @JdbcTypeCode(SqlTypes.JSON) @Column(name = "user_feedback", nullable = false, columnDefinition = "jsonb")
    private ClaimFeedbackEnvelope userFeedback;

    @NotNull @JdbcTypeCode(SqlTypes.JSON) @Column(name = "confidence_history", nullable = false, columnDefinition = "jsonb")
    private ClaimConfidenceHistoryEnvelope confidenceHistory;

    @NotNull @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
```

`CharacterObservationEntity.java` fields: `expertKey` (varchar 40), `dimensionKeys`
(`List<String>` via `@JdbcTypeCode(SqlTypes.JSON)`, column `dimension_keys jsonb`), `day`
(`LocalDate`), `text`, `salience` (`Short`), `signals` (`ObservationSignalsEnvelope` jsonb),
`consumedByConferenceId` (nullable UUID, column `consumed_by_conference_id`).

`CharacterConferenceEntity.java` fields: `kind` (varchar 10), `weekStart` (nullable
`LocalDate`, column `week_start`), `transcript` (`ConferenceTranscriptEnvelope` jsonb),
`outcome` (`ConferenceOutcomeEnvelope` jsonb), `generatedAt` (`Instant`, column
`generated_at`).

`CharacterPortraitRevisionEntity.java` fields: `dimensionId` (UUID), `version` (Integer),
`portrait` (text), `conferenceId` (UUID, column `conference_id`).

Envelopes (the `MemoirAnchorsEnvelope` record precedent — typed, minimal):

```java
/** Evidence refs behind a claim — code-collected ids, never invented (spec §4). */
public record ClaimEvidenceEnvelope(List<Ref> refs) {
    public record Ref(String kind, String id, String label) {}
}

/** Append-only user feedback history on a claim (spec §7). */
public record ClaimFeedbackEnvelope(List<Event> events) {
    public record Event(String kind, String text, java.time.Instant at) {}
}

/** Compact confidence movement history for the claim detail UI (spec §4). */
public record ClaimConfidenceHistoryEnvelope(List<Point> points) {
    public record Point(java.math.BigDecimal value, String cause, java.time.Instant at) {}
}

/** Detector events + raw data refs an observation is grounded in (spec §5). */
public record ObservationSignalsEnvelope(List<Signal> signals) {
    public record Signal(String detectorKey, String summary, List<String> refIds) {}
}

/** The persisted konzílium exchange, turn by turn, as it actually ran (spec §3/§4). */
public record ConferenceTranscriptEnvelope(List<Turn> turns) {
    public record Turn(String persona, String text, List<String> refIds) {}
}

/** Structured change list — the feed's diff source (spec §4/§6). */
public record ConferenceOutcomeEnvelope(List<Change> changes) {
    public record Change(String kind, String dimensionKey, String claimId, String summary) {}
}
```

Repositories (Spring Data, mirror `MemoirRepository`):

```java
public interface CharacterDimensionRepository extends JpaRepository<CharacterDimensionEntity, UUID> {
    List<CharacterDimensionEntity> findByCreatedBy(UUID createdBy);
    Optional<CharacterDimensionEntity> findByCreatedByAndKey(UUID createdBy, String key);
}
// NOTE: display order is NOT alphabetical — the service sorts CORE rows by
// CharacterCoreCatalog index, then CHAPTER rows by createdAt (the UI's order).

public interface CharacterClaimRepository extends JpaRepository<CharacterClaimEntity, UUID> {
    List<CharacterClaimEntity> findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(
            UUID createdBy, UUID dimensionId, String status);
}

public interface CharacterObservationRepository extends JpaRepository<CharacterObservationEntity, UUID> {
    List<CharacterObservationEntity> findByCreatedByOrderByDayDescCreatedAtDesc(UUID createdBy, Pageable pageable);
}

public interface CharacterConferenceRepository extends JpaRepository<CharacterConferenceEntity, UUID> {
    List<CharacterConferenceRepository.Summary> findByCreatedByOrderByGeneratedAtDesc(UUID createdBy);
    Optional<CharacterConferenceEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
    Optional<CharacterConferenceEntity> findFirstByCreatedByOrderByGeneratedAtDesc(UUID createdBy);
    /** Projection so the list endpoint never loads full transcripts. */
    interface Summary {
        UUID getId();
        String getKind();
        java.time.LocalDate getWeekStart();
        java.time.Instant getGeneratedAt();
    }
}

public interface CharacterPortraitRevisionRepository extends JpaRepository<CharacterPortraitRevisionEntity, UUID> {
    List<CharacterPortraitRevisionEntity> findByCreatedByAndDimensionIdOrderByVersionDesc(UUID createdBy, UUID dimensionId);
}
```

- [ ] **Step 4: Write the failing persistence IT**

`CharacterPersistenceIT.java` — round-trips every table + envelope through JPA and asserts
soft delete + the partial unique indexes (mirror `PredictionPersistenceIT`'s shape,
`extends AbstractIntegrationTest`):

```java
package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// imports: the five entities/envelopes/repositories, AppUserRepository, OwnerProperties,
// AbstractIntegrationTest, BigDecimal, LocalDate, Instant, List, UUID

class CharacterPersistenceIT extends AbstractIntegrationTest {

    // @Autowired: all five repositories + AppUserRepository + OwnerProperties

    @Test
    void dimensionClaimObservationConferenceRevision_roundTripWithEnvelopes() {
        UUID owner = ownerId();

        CharacterDimensionEntity dim = new CharacterDimensionEntity();
        dim.setCreatedBy(owner);
        dim.setKey("discipline");
        dim.setTitle("Motiváció & fegyelem");
        dim.setKind("CORE");
        dim.setExpertKey("drill");
        dim = dimensionRepository.save(dim);
        assertThat(dim.getPortrait()).isEmpty();
        assertThat(dim.getMaturity()).isZero();

        CharacterConferenceEntity conf = new CharacterConferenceEntity();
        conf.setCreatedBy(owner);
        conf.setKind("WEEKLY");
        conf.setWeekStart(LocalDate.of(2026, 8, 24));
        conf.setTranscript(new ConferenceTranscriptEnvelope(List.of(
                new ConferenceTranscriptEnvelope.Turn("drill", "A héten 3 nap üres kajanapló.", List.of()))));
        conf.setOutcome(new ConferenceOutcomeEnvelope(List.of(
                new ConferenceOutcomeEnvelope.Change("CLAIM_ACCEPTED", "discipline", null, "Új claim."))));
        conf.setGeneratedAt(Instant.now());
        conf = conferenceRepository.save(conf);

        CharacterClaimEntity claim = new CharacterClaimEntity();
        claim.setCreatedBy(owner);
        claim.setDimensionId(dim.getId());
        claim.setText("Stresszes hetekben elmarad a kajalogolás.");
        claim.setConfidence(new BigDecimal("0.60"));
        claim.setStatus("ACTIVE");
        claim.setOriginConferenceId(conf.getId());
        claim.setProposedBy("drill");
        claim.setEvidence(new ClaimEvidenceEnvelope(List.of(
                new ClaimEvidenceEnvelope.Ref("observation", "x", "3 nap kihagyás"))));
        claim.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        claim.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of(
                new ClaimConfidenceHistoryEnvelope.Point(new BigDecimal("0.60"), "konzílium", Instant.now()))));
        claimRepository.save(claim);

        CharacterObservationEntity obs = new CharacterObservationEntity();
        obs.setCreatedBy(owner);
        obs.setExpertKey("drill");
        obs.setDimensionKeys(List.of("discipline", "nutrition"));
        obs.setDay(LocalDate.of(2026, 8, 26));
        obs.setText("Ma sem került be étkezés, 4. napja.");
        obs.setSalience((short) 4);
        obs.setSignals(new ObservationSignalsEnvelope(List.of(
                new ObservationSignalsEnvelope.Signal("logging-gap", "4 nap", List.of()))));
        observationRepository.save(obs);

        CharacterPortraitRevisionEntity rev = new CharacterPortraitRevisionEntity();
        rev.setCreatedBy(owner);
        rev.setDimensionId(dim.getId());
        rev.setVersion(1);
        rev.setPortrait("Első portré.");
        rev.setConferenceId(conf.getId());
        revisionRepository.save(rev);

        // reload + envelope round-trip assertions on each
        CharacterClaimEntity reloaded = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(reloaded.getEvidence().refs()).hasSize(1);
        assertThat(reloaded.getEvidence().refs().getFirst().kind()).isEqualTo("observation");
    }

    @Test
    void dimensionKey_uniquePerLiveOwnerRow_softDeleteFreesIt() {
        // save a CORE "mental" dimension; saving a second live "mental" for the same owner
        // throws DataIntegrityViolationException; delete the first (soft), flush, and the
        // second save succeeds — mirror the memoir partial-unique test idiom.
    }
}
```

(The second test's body follows the described assertions exactly — write it out in full in
implementation; `assertThatThrownBy(...).isInstanceOf(DataIntegrityViolationException.class)`
after `repository.saveAndFlush`.)

- [ ] **Step 5: Run the IT — expect FAIL (tables/entities missing), then implement Steps 1–3 files, re-run — expect PASS**

Run: `cd backend && ./mvnw test -Dtest=CharacterPersistenceIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/test/java/io/mrkuhne/mezo/feature/character
git commit -m "feat(character): dossier persistence spine — 5 tables + entities (mezo-1gim.1)"
```

---

### Task 2: Contract fragment + switch + generated API

**Files:**
- Create: `api/feature/character/character.yml`
- Modify: `api/generate/merge.yml` (append input line)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (add constant)
- Generated (committed): `api/openapi.yml`, frontend `api.gen.ts`

**Interfaces:**
- Produces: generated `CharacterApi` interface + DTOs (`CharacterOverviewResponse`,
  `CharacterDimensionResponse`, `CharacterClaimDto`, `CharacterFeedItem`,
  `CharacterConferenceSummary`, `CharacterConferenceResponse`, `ConferenceTurn`) that Task 3
  implements; `FeaturesConfiguration.CHARACTER_SWITCH`.

- [ ] **Step 1: Add the switch constant**

In `FeaturesConfiguration` (next to `PROACTIVE_SWITCH`):

```java
    /** Karakter dossier (mezo-1gim) — dimensions/claims/observations/conferences + reads.
     *  LLM-calling character beans (Slice 2+) additionally require {@link #COMPANION_SWITCH}. */
    public static final String CHARACTER_SWITCH = "mezo.feature.character.enabled";
```

Also add `mezo.feature.character.enabled: true` wherever the sibling feature switches get
their default (follow `mezo.feature.proactive.enabled`'s occurrences in
`backend/src/main/resources/application*.yml` and the test profile configs — same values in
the same files).

- [ ] **Step 2: Write `api/feature/character/character.yml`**

```yaml
openapi: 3.0.3
info: { title: '', version: '' }
tags:
  - name: Character
    description: >-
      Karakter dossier (mezo-1gim) — the synthesized user profile: 7 CORE dimensions +
      AI-opened chapters, confidence-carrying claims, expert observations, and persisted
      konzílium transcripts. Slice 1 ships reads over an honestly empty dossier.
paths:
  /api/character:
    get:
      tags: [Character]
      operationId: getCharacterOverview
      summary: The dossier overview — all dimensions with maturity, portrait and top claims (lazily seeds the 7 CORE dimensions on first read)
      responses:
        '200':
          description: The dossier (CORE dimensions always present; portraits may be empty — the honest pre-bootstrap state)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CharacterOverviewResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/character/dimension/{key}:
    get:
      tags: [Character]
      operationId: getCharacterDimension
      summary: One dimension in full — portrait, ACTIVE claims with evidence refs, recent revisions
      parameters:
        - name: key
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: The dimension
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CharacterDimensionResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: No such dimension key for this user
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/character/feed:
    get:
      tags: [Character]
      operationId: getCharacterFeed
      summary: Recent expert observations + the latest conference outcome diff, merged chronologically (empty array = honest empty state)
      parameters:
        - name: limit
          in: query
          required: false
          schema: { type: integer, default: 30, maximum: 100 }
      responses:
        '200':
          description: Feed items, newest first (possibly empty — never a 404; list-endpoint precedent)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/CharacterFeedItem' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/character/conference:
    get:
      tags: [Character]
      operationId: listCharacterConferences
      summary: Konzílium list (summaries only — transcripts load per id)
      responses:
        '200':
          description: Conference summaries, newest first (possibly empty)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/CharacterConferenceSummary' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/character/conference/{conferenceId}:
    get:
      tags: [Character]
      operationId: getCharacterConference
      summary: One konzílium with its full persisted transcript — the exchange as it actually ran, never re-dramatized
      parameters:
        - name: conferenceId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: The conference
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CharacterConferenceResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: No such conference for this user
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    CharacterClaimDto:
      type: object
      required: [id, text, confidence, sensitive, evidence]
      properties:
        id: { type: string, format: uuid }
        text: { type: string }
        confidence: { type: number, description: 0–1; the FE renders human words, never the raw number (Minták precedent) }
        sensitive: { type: boolean }
        proposedBy: { type: string, description: expert persona key }
        evidence:
          type: array
          items:
            type: object
            required: [kind, label]
            properties:
              kind: { type: string }
              id: { type: string, nullable: true }
              label: { type: string }
    CharacterDimensionSummary:
      type: object
      required: [key, title, kind, maturity, portrait, topClaims]
      properties:
        key: { type: string }
        title: { type: string }
        kind: { type: string, enum: [CORE, CHAPTER] }
        expertKey: { type: string, nullable: true }
        maturity: { type: integer, description: 0–100; 0 = "tanulom" }
        portrait: { type: string, description: empty string until the first conference writes it }
        topClaims:
          type: array
          items: { $ref: '#/components/schemas/CharacterClaimDto' }
    CharacterOverviewResponse:
      type: object
      required: [dimensions]
      properties:
        dimensions:
          type: array
          items: { $ref: '#/components/schemas/CharacterDimensionSummary' }
    CharacterPortraitRevisionDto:
      type: object
      required: [version, portrait, createdAt]
      properties:
        version: { type: integer }
        portrait: { type: string }
        createdAt: { type: string, format: date-time }
    CharacterDimensionResponse:
      type: object
      required: [key, title, kind, maturity, portrait, claims, revisions]
      properties:
        key: { type: string }
        title: { type: string }
        kind: { type: string, enum: [CORE, CHAPTER] }
        expertKey: { type: string, nullable: true }
        maturity: { type: integer }
        portrait: { type: string }
        claims:
          type: array
          items: { $ref: '#/components/schemas/CharacterClaimDto' }
        revisions:
          type: array
          items: { $ref: '#/components/schemas/CharacterPortraitRevisionDto' }
    CharacterFeedItem:
      type: object
      required: [kind, at, text]
      properties:
        kind: { type: string, enum: [OBSERVATION, CONFERENCE_CHANGE] }
        at: { type: string, format: date-time }
        expertKey: { type: string, nullable: true, description: null for CONFERENCE_CHANGE items }
        dimensionKeys:
          type: array
          items: { type: string }
        text: { type: string }
    CharacterConferenceSummary:
      type: object
      required: [id, kind, generatedAt]
      properties:
        id: { type: string, format: uuid }
        kind: { type: string, enum: [BOOTSTRAP, WEEKLY, MONTHLY] }
        weekStart: { type: string, format: date, nullable: true }
        generatedAt: { type: string, format: date-time }
    ConferenceTurn:
      type: object
      required: [persona, text]
      properties:
        persona: { type: string }
        text: { type: string }
        refIds:
          type: array
          items: { type: string }
    CharacterConferenceResponse:
      type: object
      required: [id, kind, generatedAt, transcript, changes]
      properties:
        id: { type: string, format: uuid }
        kind: { type: string, enum: [BOOTSTRAP, WEEKLY, MONTHLY] }
        weekStart: { type: string, format: date, nullable: true }
        generatedAt: { type: string, format: date-time }
        transcript:
          type: array
          items: { $ref: '#/components/schemas/ConferenceTurn' }
        changes:
          type: array
          items:
            type: object
            required: [kind, summary]
            properties:
              kind: { type: string }
              dimensionKey: { type: string, nullable: true }
              summary: { type: string }
```

- [ ] **Step 3: Register the fragment + regenerate**

Append to `api/generate/merge.yml` inputs (last line, after me-week):

```yaml
  - inputFile: ../feature/character/character.yml
```

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` + FE `api.gen.ts` regenerate cleanly (commit both — the CI
contract-drift gate compares them).

- [ ] **Step 4: Verify backend codegen compiles**

Run: `cd backend && ./mvnw compile -q`
Expected: BUILD SUCCESS with generated `CharacterApi` + DTOs available under
`io.mrkuhne.mezo.api`.

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/data/_client backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/main/resources
git commit -m "feat(character): contract fragment + CHARACTER_SWITCH (mezo-1gim.1)"
```

(If `pnpm generate:api` writes elsewhere, `git status` first and add the actual generated
paths.)

---

### Task 3: Service + controller + read ITs

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterCoreCatalog.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/controller/CharacterController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterApiSwitchOffIT.java`

**Interfaces:**
- Consumes: Task 1 repositories/entities; Task 2 generated `CharacterApi` + DTOs +
  `CHARACTER_SWITCH`; `CurrentUserId`, `SystemMessage`/`SystemRuntimeErrorException`
  (the MeWeekController idiom).
- Produces: `CharacterService.overview(UUID)`, `.dimension(UUID, String)`,
  `.feed(UUID, int)`, `.conferences(UUID)`, `.conference(UUID, UUID)` — Slice 2+ reuse the
  seeding via `CharacterService.ensureCoreDimensions(UUID)`.

- [ ] **Step 1: Write the failing API IT**

`CharacterApiIT.java` (`extends ApiIntegrationTest`; no LLM profile needed — nothing calls
the port):

```java
class CharacterApiIT extends ApiIntegrationTest {

    @Test
    void overview_firstRead_lazilySeedsTheSevenCoreDimensions_emptyPortraits() {
        CharacterOverviewResponse res = getForBody("/api/character", ownerAuthHeaders(),
                HttpStatus.OK, CharacterOverviewResponse.class);
        assertThat(res.getDimensions()).hasSize(7);
        assertThat(res.getDimensions()).extracting(CharacterDimensionSummary::getKey)
                .containsExactly("physical", "athletic", "nutrition", "recovery",
                        "mental", "discipline", "life");
        assertThat(res.getDimensions()).allSatisfy(d -> {
            assertThat(d.getKind()).isEqualTo(CharacterDimensionSummary.KindEnum.CORE);
            assertThat(d.getMaturity()).isZero();
            assertThat(d.getPortrait()).isEmpty();
            assertThat(d.getTopClaims()).isEmpty();
        });
        // second read: still exactly 7 (idempotent seeding)
        CharacterOverviewResponse again = getForBody("/api/character", ownerAuthHeaders(),
                HttpStatus.OK, CharacterOverviewResponse.class);
        assertThat(again.getDimensions()).hasSize(7);
    }

    @Test
    void dimension_knownKey_returnsIt_unknownKeyIs404() {
        getForBody("/api/character", ownerAuthHeaders(), HttpStatus.OK, CharacterOverviewResponse.class);
        CharacterDimensionResponse d = getForBody("/api/character/dimension/discipline",
                ownerAuthHeaders(), HttpStatus.OK, CharacterDimensionResponse.class);
        assertThat(d.getTitle()).isEqualTo("Motiváció & fegyelem");
        assertThat(d.getExpertKey()).isEqualTo("drill");
        assertThat(d.getClaims()).isEmpty();
        assertThat(d.getRevisions()).isEmpty();
        getForBody("/api/character/dimension/nonsense", ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, SystemMessageList.class);
    }

    @Test
    void feedAndConferences_emptyDossier_honestEmptyArrays() {
        assertThat(getForBody("/api/character/feed", ownerAuthHeaders(),
                HttpStatus.OK, CharacterFeedItem[].class)).isEmpty();
        assertThat(getForBody("/api/character/conference", ownerAuthHeaders(),
                HttpStatus.OK, CharacterConferenceSummary[].class)).isEmpty();
        getForBody("/api/character/conference/" + UUID.randomUUID(), ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, SystemMessageList.class);
    }

    @Test
    void feed_withSeededObservationAndConference_mergesNewestFirst() {
        // seed via repositories (the persistence-IT recipes): one observation (day = today-1)
        // and one WEEKLY conference (generatedAt = now) whose outcome has one change;
        // GET /api/character/feed → 2 items, CONFERENCE_CHANGE first (newer), then
        // OBSERVATION with expertKey "drill" and the observation text.
    }
}
```

(Write the fourth test out fully in implementation using `CharacterObservationRepository` /
`CharacterConferenceRepository` autowired into the IT — entity setters exactly as in
`CharacterPersistenceIT`.)

`CharacterApiSwitchOffIT.java` — mirror `ProactiveApiSwitchOffIT`: run with
`mezo.feature.character.enabled=false` (`@TestPropertySource` or the sibling's exact
mechanism — copy it) and assert all 4 GETs return `HttpStatus.NOT_FOUND` (no controller
bean).

- [ ] **Step 2: Run ITs — expect FAIL (no controller)**

Run: `cd backend && ./mvnw test -Dtest='CharacterApi*IT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL (404s where 200 expected — no `CharacterController` bean yet).

- [ ] **Step 3: Implement catalog + service + controller**

`CharacterCoreCatalog.java` — the fixed CORE list (spec §2, Global Constraints values):

```java
package io.mrkuhne.mezo.feature.character.service;

import java.util.List;

/** The 7 CORE dimensions (Karakter spec §2) — seeded lazily, never deleted. */
public final class CharacterCoreCatalog {

    public record CoreDimension(String key, String title, String expertKey) {}

    public static final List<CoreDimension> CORE = List.of(
            new CoreDimension("physical", "Fizikai", "doki"),
            new CoreDimension("athletic", "Sportolói", "edzo"),
            new CoreDimension("nutrition", "Táplálkozási", "taplalkozo"),
            new CoreDimension("recovery", "Alvás & regeneráció", "szomnologus"),
            new CoreDimension("mental", "Mentális & érzelmi", "pszichologus"),
            new CoreDimension("discipline", "Motiváció & fegyelem", "drill"),
            new CoreDimension("life", "Élet & kapcsolatok", "antropologus"));

    private CharacterCoreCatalog() {}
}
```

`CharacterService.java` — `@Service`, `@RequiredArgsConstructor`,
`@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")`:

- `ensureCoreDimensions(UUID owner)` — `@Transactional`; for each catalog entry missing from
  `findByCreatedBy`, insert a row (kind `CORE`, empty portrait, maturity 0). Idempotent;
  called by `overview` and `dimension`.
- `overview(UUID owner)` — ensure, load dimensions, sort CORE by `CharacterCoreCatalog.CORE`
  index then CHAPTER by `createdAt`, per dimension load top ACTIVE claims
  (`findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc`, cap 3) → map to
  `CharacterOverviewResponse`. Mapping is inline in the service (5 small mappers don't
  warrant a MapStruct class yet; the proactive mapper precedent applies from Slice 3).
- `dimension(UUID owner, String key)` — ensure, `findByCreatedByAndKey` orElseThrow
  `SystemRuntimeErrorException(SystemMessage.error("CHARACTER_DIMENSION_NOT_FOUND").build(),
  HttpStatus.NOT_FOUND)`; ACTIVE claims (uncapped) + revisions (cap 10).
- `feed(UUID owner, int limit)` — observations page (`PageRequest.of(0, limit)`) mapped to
  `OBSERVATION` items (at = `day` at start-of-day UTC… no: use the row's `createdAt` — the
  honest event time) + the latest conference's outcome changes mapped to `CONFERENCE_CHANGE`
  items (at = `generatedAt`, text = change summary, dimensionKeys = [dimensionKey] when
  present); merge, sort by `at` desc, cap at `limit`.
- `conferences(UUID owner)` / `conference(UUID owner, UUID id)` — straight maps; unknown id →
  the same 404 idiom with `"CHARACTER_CONFERENCE_NOT_FOUND"`.

`CharacterController.java` — mirror `MeWeekController` exactly:

```java
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterController implements CharacterApi {

    private final CharacterService characterService;
    private final CurrentUserId currentUserId;

    @Override public CharacterOverviewResponse getCharacterOverview() {
        return characterService.overview(currentUserId.get());
    }
    @Override public CharacterDimensionResponse getCharacterDimension(String key) {
        return characterService.dimension(currentUserId.get(), key);
    }
    @Override public List<CharacterFeedItem> getCharacterFeed(Integer limit) {
        return characterService.feed(currentUserId.get(), limit == null ? 30 : Math.min(limit, 100));
    }
    @Override public List<CharacterConferenceSummary> listCharacterConferences() {
        return characterService.conferences(currentUserId.get());
    }
    @Override public CharacterConferenceResponse getCharacterConference(UUID conferenceId) {
        return characterService.conference(currentUserId.get(), conferenceId);
    }
}
```

(Exact generated method names/signatures come from `CharacterApi` — adjust to what Task 2
generated, not the other way around.)

- [ ] **Step 4: Run ITs — expect PASS**

Run: `cd backend && ./mvnw test -Dtest='Character*IT' -Dmezo.test.use-testcontainers=true`
Expected: all Character ITs PASS.

- [ ] **Step 5: Regenerate CODEMAP + commit**

Run the repo's codemap regeneration (see `docs/CODEMAP.md` header for the command used by
recent `chore(codemap)` commits; run exactly that).

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/test/java/io/mrkuhne/mezo/feature/character docs/CODEMAP.md
git commit -m "feat(character): reads over the empty dossier + lazy core seeding (mezo-1gim.1)"
```

---

### Task 4: Ship the slice

- [ ] **Step 1: Focused gates** — re-run every Character IT one final time (command above);
  `./mvnw compile -q` clean.
- [ ] **Step 2: bd bookkeeping** — `bd update mezo-1gim.1 --claim` at start of execution;
  `bd close mezo-1gim.1` when CI is green.
- [ ] **Step 3: Branch + self-PR flow** (house rules): push the branch, open the self-PR, wait
  for CI green (full backend IT suite + contract-drift), then merge locally `--no-ff` after
  `git pull --rebase` on main, push, delete branch, `bd dolt push`.

---

## Out of scope for Slice 1 (later slices per spec §12)

- S2: detector catalog + nightly expert pass (first LLM use; `CHARACTER_SWITCH` +
  `COMPANION_SWITCH` conditions + cron switch + `CharacterProperties` config class).
- S3: weekly konzílium orchestration + claim lifecycle + portrait rewrite + transcript writes.
- S4: bootstrap endpoint (`POST /api/character/bootstrap`, 409 semantics) + monthly deep read.
- S5: `[Karakter]` prompt block + generator wiring. S6: claim feedback endpoint + user
  observations. S7: FE (after the design 2.0 Karakter prototype round).
