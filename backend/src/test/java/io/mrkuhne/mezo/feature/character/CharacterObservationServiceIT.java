package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterObservationService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the nightly observation pass (mezo-1gim.3): the quiet-day honesty contract (no signals ->
 * zero rows, no LLM call), the canned-fake happy path over a real multi-detector signal day
 * (idempotency included), and the sentinel-scripted expert answer exercising validation/clamping.
 */
@ActiveProfiles("companion-fake")
class CharacterObservationServiceIT extends ApiIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 26);
    private static final int WINDOW_DAYS = 14;

    @Autowired private CharacterObservationService observationService;
    @Autowired private CharacterObservationRepository observationRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void marker_mirroredInFakeLlm_staysInSync() {
        assertThat(FakeCompanionLlm.OBSERVATION_MARKER_MIRROR)
                .isEqualTo(CharacterObservationService.OBSERVATION_MARKER);
    }

    @Test
    void quietDay_noSignals_zeroRowsAndNoLlmCall() {
        UUID owner = owner();
        PantryItemEntity pantryItem = pantryItemPopulator.createFood(owner, "Csirkemell", null);
        // a meal on every window day (incl. DAY) keeps logging-gap and under-logging quiet
        for (int i = 0; i < WINDOW_DAYS; i++) {
            mealPopulator.createPantryMeal(owner, pantryItem, DAY.minusDays(i));
        }
        // check-ins today keep checkin-gap quiet
        checkInPopulator.createCheckIn(owner, DAY, "07:30", 3, 3, "rendben");
        // a recent journal entry (not ON DAY) keeps journal-silence quiet without firing journal-note
        journalPopulator.createEntry(owner, DAY.minusDays(3), "Csendes nap volt.", "quickinput");

        int callsBefore = fakeCompanionLlm.completeCallCount();

        int written = observationService.generateForDay(owner, DAY);

        assertThat(written).isZero();
        assertThat(observationRepository.findByCreatedByOrderByDayDescCreatedAtDesc(
                owner, org.springframework.data.domain.Pageable.unpaged())).isEmpty();
        // mezo-1gim.4 item 5: the zero-cost claim must be pinned on the LLM call count, not just
        // inferred from the zero rows written.
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(callsBefore);
    }

    @Test
    void signalDay_cannedFakeAnswer_writesObservationWithSignalsEnvelope() {
        UUID owner = owner();
        // nothing seeded for DAY or the 13 prior days -> logging-gap + journal-silence (both "drill") fire
        int written = observationService.generateForDay(owner, DAY);

        assertThat(written).isEqualTo(1); // the fake's canned single-observation array

        List<CharacterObservationEntity> rows = observationRepository
                .findByCreatedByOrderByDayDescCreatedAtDesc(owner, org.springframework.data.domain.Pageable.unpaged());
        assertThat(rows).hasSize(1);
        CharacterObservationEntity row = rows.get(0);
        assertThat(row.getExpertKey()).isEqualTo("drill");
        assertThat(row.getDay()).isEqualTo(DAY);
        assertThat(row.getText()).isEqualTo("Fake megfigyelés.");
        assertThat(row.getSalience()).isEqualTo((short) 3);
        assertThat(row.getDimensionKeys().keys()).containsExactly("discipline");
        assertThat(row.getSignals().signals())
                .extracting(ObservationSignalsEnvelope.Signal::detectorKey)
                .containsExactlyInAnyOrder("logging-gap", "journal-silence");
        assertThat(row.getConsumedByConferenceId()).isNull();

        // idempotency: a second run for the same owner/day/expert writes nothing new
        assertThat(observationService.generateForDay(owner, DAY)).isZero();
        assertThat(observationRepository.findByCreatedByOrderByDayDescCreatedAtDesc(
                owner, org.springframework.data.domain.Pageable.unpaged())).hasSize(1);
    }

    @Test
    void journalSentinel_scriptsTheExpertAnswer_invalidDimensionKeysFallBackAndBlankDraftDropped() {
        UUID owner = owner();
        // a meal on every window day keeps logging-gap/under-logging quiet, isolating journal-note
        // (pszichologus) as the only fired signal
        PantryItemEntity pantryItem = pantryItemPopulator.createFood(owner, "Csirkemell", null);
        for (int i = 0; i < WINDOW_DAYS; i++) {
            mealPopulator.createPantryMeal(owner, pantryItem, DAY.minusDays(i));
        }
        // a journal entry ON DAY fires journal-note (pszichologus) and carries the sentinel into
        // the user message the fake receives
        String sentinel = "[fake-char-obs:[{\"text\":\"A napló feszültséget mutat.\",\"salience\":9,"
                + "\"dimensionKeys\":[\"mental\",\"nonsense\"]},"
                + "{\"text\":\"\",\"salience\":2,\"dimensionKeys\":[\"mental\"]}]]";
        journalPopulator.createEntry(owner, DAY, sentinel, "quickinput");

        int written = observationService.generateForDay(owner, DAY);

        assertThat(written).isEqualTo(1); // the blank-text second draft is dropped

        Optional<CharacterObservationEntity> row = observationRepository
                .findByCreatedByOrderByDayDescCreatedAtDesc(owner, org.springframework.data.domain.Pageable.unpaged())
                .stream()
                .filter(o -> o.getExpertKey().equals("pszichologus"))
                .findFirst();
        assertThat(row).isPresent();
        CharacterObservationEntity r = row.get();
        assertThat(r.getText()).isEqualTo("A napló feszültséget mutat.");
        assertThat(r.getSalience()).isEqualTo((short) 5); // clamped 9 -> 5
        assertThat(r.getDimensionKeys().keys()).containsExactly("mental"); // "nonsense" filtered out
    }

    @Test
    void selfAuditDimensionKey_isKnown_andSurvivesValidation() {
        UUID owner = owner();
        PantryItemEntity pantryItem = pantryItemPopulator.createFood(owner, "Csirkemell", null);
        for (int i = 0; i < WINDOW_DAYS; i++) {
            mealPopulator.createPantryMeal(owner, pantryItem, DAY.minusDays(i));
        }
        String sentinel = "[fake-char-obs:[{\"text\":\"Önvizsgálati jel.\",\"salience\":3,"
                + "\"dimensionKeys\":[\"self-audit\"]}]]";
        journalPopulator.createEntry(owner, DAY, sentinel, "quickinput");

        observationService.generateForDay(owner, DAY);

        CharacterObservationEntity row = observationRepository
                .findByCreatedByOrderByDayDescCreatedAtDesc(owner, org.springframework.data.domain.Pageable.unpaged())
                .stream().filter(o -> o.getText().equals("Önvizsgálati jel.")).findFirst().orElseThrow();
        assertThat(row.getDimensionKeys().keys()).containsExactly("self-audit");
    }
}
