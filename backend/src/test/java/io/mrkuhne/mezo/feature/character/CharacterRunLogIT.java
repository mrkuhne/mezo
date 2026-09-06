package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterRunEntity;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.entity.RunDetectorKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.RunExpertKeysEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterBootstrapService;
import io.mrkuhne.mezo.feature.character.service.CharacterConferenceService;
import io.mrkuhne.mezo.feature.character.service.CharacterObservationService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the Karakter S9 Gépterem honesty spine (mezo-1gim.14): {@code character_run} rows
 * written by all four pipelines, including the quiet-night zero row, idempotency per
 * {@code (created_by, kind, day)}, the DB unique-index backstop, and the run-log's own
 * never-throws-into-the-host-pipeline contract.
 */
@ActiveProfiles("companion-fake")
class CharacterRunLogIT extends ApiIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 26);
    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24); // ISO Monday
    private static final int WINDOW_DAYS = 14;

    @Autowired private CharacterObservationService observationService;
    @Autowired private CharacterConferenceService conferenceService;
    @Autowired private CharacterBootstrapService bootstrapService;
    @Autowired private CharacterRunRepository runRepository;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterObservationRepository observationRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /** Keeps every nightly detector quiet on {@link #DAY} (mirrors CharacterObservationServiceIT). */
    private void seedQuietWindow(UUID owner) {
        PantryItemEntity pantryItem = pantryItemPopulator.createFood(owner, "Csirkemell", null);
        for (int i = 0; i < WINDOW_DAYS; i++) {
            mealPopulator.createPantryMeal(owner, pantryItem, DAY.minusDays(i));
        }
        checkInPopulator.createCheckIn(owner, DAY, "07:30", 3, 3, "rendben");
        journalPopulator.createEntry(owner, DAY.minusDays(3), "Csendes nap volt.", "quickinput");
    }

    @Test
    void nightly_quietDay_writesZeroRow() {
        UUID owner = owner();
        seedQuietWindow(owner);

        int written = observationService.generateForDay(owner, DAY);
        assertThat(written).isZero();

        CharacterRunEntity row = runRepository.findByCreatedByAndKindAndDay(owner, "NIGHTLY", DAY).orElseThrow();
        assertThat(row.getDay()).isEqualTo(DAY);
        assertThat(row.getObservationCount()).isZero();
        assertThat(row.getCallCount()).isZero();
        assertThat(row.getDetectorKeys().keys()).isEmpty();
        assertThat(row.getExpertKeys().keys()).isEmpty();
        assertThat(row.getConferenceId()).isNull();
        assertThat(row.getGeneratedAt()).isNotNull();
    }

    @Test
    void nightly_signalDay_writesCountsAndKeys() {
        UUID owner = owner();
        // nothing seeded for DAY or the prior window -> logging-gap + journal-silence (both
        // "drill") fire, mirroring CharacterObservationServiceIT's signal-day setup
        int written = observationService.generateForDay(owner, DAY);
        assertThat(written).isEqualTo(1);

        CharacterRunEntity row = runRepository.findByCreatedByAndKindAndDay(owner, "NIGHTLY", DAY).orElseThrow();
        assertThat(row.getObservationCount()).isEqualTo(1);
        assertThat(row.getCallCount()).isEqualTo(1); // one expert ("drill") called
        assertThat(row.getDetectorKeys().keys()).containsExactlyInAnyOrder("logging-gap", "journal-silence");
        assertThat(row.getExpertKeys().keys()).containsExactly("drill");
        assertThat(row.getConferenceId()).isNull();
    }

    @Test
    void nightly_rerunSameDay_stillExactlyOneRow() {
        UUID owner = owner();
        observationService.generateForDay(owner, DAY);
        assertThat(runRepository.findByCreatedByAndDayBetweenOrderByDayDescGeneratedAtDesc(owner, DAY, DAY))
                .hasSize(1);

        observationService.generateForDay(owner, DAY); // idempotent catch-up re-run

        assertThat(runRepository.findByCreatedByAndDayBetweenOrderByDayDescGeneratedAtDesc(owner, DAY, DAY))
                .hasSize(1);
    }

    @Test
    void weekly_conference_writesRowWithConferenceId() {
        UUID owner = owner();
        // seeding mirrors CharacterConferenceServiceIT's happy path: a dimension + one observation
        // inside the target week is enough for the fake LLM's canned proposal/verdict rounds
        CharacterDimensionEntity dimension = new CharacterDimensionEntity();
        dimension.setCreatedBy(owner);
        dimension.setKey("discipline");
        dimension.setTitle("discipline");
        dimension.setKind("CORE");
        dimension.setExpertKey("drill");
        dimensionRepository.save(dimension);

        CharacterObservationEntity observation = new CharacterObservationEntity();
        observation.setCreatedBy(owner);
        observation.setExpertKey("drill");
        observation.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        observation.setDay(WEEK_START.plusDays(1));
        observation.setText("3 napja nincs kaja-log.");
        observation.setSalience((short) 4);
        observation.setSignals(new ObservationSignalsEnvelope(
                List.of(new ObservationSignalsEnvelope.Signal("logging-gap", "3 nap", List.of()))));
        observationRepository.save(observation);

        CharacterConferenceEntity conference = conferenceService.runWeekly(owner, WEEK_START);
        assertThat(conference).isNotNull();

        CharacterRunEntity row = runRepository.findByCreatedByAndKindAndDay(owner, "WEEKLY", WEEK_START).orElseThrow();
        assertThat(row.getConferenceId()).isEqualTo(conference.getId());
        assertThat(row.getObservationCount()).isEqualTo(1);
        assertThat(row.getExpertKeys().keys()).containsExactly("drill");
        assertThat(row.getDetectorKeys().keys()).containsExactly("logging-gap");
    }

    @Test
    void bootstrap_writesRow() {
        UUID owner = owner();
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 7, 1), "Jó hónap volt, sokat fejlődtem.");

        // the run row's day is stamped by the SERVER's clock: capture the day AROUND the call, query
        // the whole {before, after} span and accept either side — a midnight between the two reads
        // would otherwise search (and assert) a day the row was never written on
        LocalDate dayBefore = LocalDate.now();
        CharacterConferenceEntity conference = bootstrapService.run(owner);
        LocalDate dayAfter = LocalDate.now();
        assertThat(conference).isNotNull();

        List<CharacterRunEntity> rows = runRepository.findByCreatedByAndDayBetweenOrderByDayDescGeneratedAtDesc(
                owner, dayBefore, dayAfter);
        assertThat(rows).filteredOn(r -> "BOOTSTRAP".equals(r.getKind())).singleElement().satisfies(row -> {
            assertThat(row.getConferenceId()).isEqualTo(conference.getId());
            assertThat(row.getDay()).isIn(dayBefore, dayAfter);
        });
    }

    @Test
    void uniqueIndex_backstop_duplicateTripleRejected() {
        UUID owner = owner();
        CharacterRunEntity first = newRunEntity(owner, "NIGHTLY", DAY);
        runRepository.saveAndFlush(first);

        CharacterRunEntity duplicate = newRunEntity(owner, "NIGHTLY", DAY);
        assertThatThrownBy(() -> runRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void runLogFailure_doesNotBreak_generateForDay() {
        UUID owner = owner();
        // pre-insert a live NIGHTLY row for DAY so the run-log's own idempotency check treats this
        // as an already-logged day — asserting the observation pipeline completes normally
        // regardless of what the run-log decided to do with this day
        runRepository.saveAndFlush(newRunEntity(owner, "NIGHTLY", DAY));

        int written = observationService.generateForDay(owner, DAY);

        assertThat(written).isEqualTo(1); // the observation pipeline ran to completion, unaffected
        assertThat(runRepository.findByCreatedByAndDayBetweenOrderByDayDescGeneratedAtDesc(owner, DAY, DAY))
                .hasSize(1); // still exactly the pre-inserted row — no duplicate, no crash
    }

    private CharacterRunEntity newRunEntity(UUID owner, String kind, LocalDate day) {
        CharacterRunEntity entity = new CharacterRunEntity();
        entity.setCreatedBy(owner);
        entity.setKind(kind);
        entity.setDay(day);
        entity.setObservationCount(0);
        entity.setCallCount(0);
        entity.setDetectorKeys(new RunDetectorKeysEnvelope(List.of()));
        entity.setExpertKeys(new RunExpertKeysEnvelope(List.of()));
        entity.setGeneratedAt(Instant.now());
        return entity;
    }
}
