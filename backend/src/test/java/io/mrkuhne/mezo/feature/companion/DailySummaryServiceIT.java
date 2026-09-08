package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.DailySummaryService;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.IntentionPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/**
 * V2.2 generation flow over the fake LLM: the deterministic digest carries real day-facts into
 * the persisted narrative (fake echoes the digest), empty days produce nothing, existing days
 * are returned without a new LLM call, and the {@code [fake-summary:…]} sentinel scripts the
 * narrative through a check-in note.
 *
 * <p>No class-level {@code @Transactional} — an emit-reachable service running under
 * {@code AppNotificationEmitter}'s {@code REQUIRES_NEW} deadlocks against an uncommitted
 * test-user row (bd mezo-gzhp.1 precedent). Isolation comes from {@code ResetDatabase} via
 * {@link AbstractIntegrationTest}.
 */
@ActiveProfiles("companion-fake")
class DailySummaryServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private DailySummaryService dailySummaryService;
    @Autowired private DailySummaryRepository dailySummaryRepository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private IntentionPopulator intentionPopulator;
    @Autowired private TrainPopulator trainPopulator;
    // mezo-b6zt: the contradiction guard below needs BOTH renderers of the same day
    @Autowired private ContextSnapshotAssembler contextSnapshotAssembler;

    @Test
    void testGenerate_shouldCarryQualityFields_whenNotesMentionAndReflectionExist() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "23:00", "06:30",
                new BigDecimal("7.0"), 4, 1, "Nyugtalan éjszaka, sok forgolódás.");
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        mentionPopulator.createMention(owner, anna.getId(),
                DAY.atTime(18, 0).atZone(ZoneId.systemDefault()).toInstant(), "positive");
        intentionPopulator.reflection(owner, DAY, "partial");

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary.getNarrative())
                .contains("Nyugtalan éjszaka")
                .contains("Említés (positive)")
                .contains("Teszt említés.")
                .contains("Napi szándék-reflexió: részben");
    }

    @Test
    void testGenerate_shouldCapQualityField_whenNoteLongerThanConfig() {
        UUID owner = userPopulator.createUser().getId();
        String longNote = "a".repeat(250);
        sleepLogPopulator.createSleepLog(owner, DAY, "23:00", "06:30",
                new BigDecimal("7.0"), 4, 0, longNote);

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary.getNarrative()).contains("a".repeat(200));
        assertThat(summary.getNarrative()).doesNotContain("a".repeat(201));
    }

    /**
     * mezo-b6zt: the day's sleep fact hardcoded a "/5" denominator against a 1..10 scale (the DB's
     * own CHECK on sleep_log.quality, and sleep.yml SleepLogRequest.quality), so an 8 was written
     * into the persisted day memory as "8/5" — a false figure that every later read inherits. 8 is
     * the pinning value precisely because it cannot exist on the old denominator.
     */
    @Test
    void testGenerate_shouldWriteSleepQualityAgainstTen_whenRatedAboveFive() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("7.2"), 8);

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary.getNarrative()).contains("minőség 8/10").doesNotContain("minőség 8/5");
    }

    /** An unrated row omits the fragment entirely — the day memory must not carry "null/10". */
    @Test
    void testGenerate_shouldOmitSleepQuality_whenRowIsUnrated() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("7.2"), null);

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary.getNarrative()).contains("Alvás: 7,2 óra").doesNotContain("minőség");
    }

    /**
     * mezo-b6zt siblings — THE defect, not a symptom of it: this digest and
     * {@code ContextSnapshotAssembler}'s [Regeneráció] block render the SAME two check-in columns,
     * and they disagreed. The narrative said "energia 8/5" while the snapshot said "energia 8/10",
     * so one model received both ceilings for one number, from two prompts, in one conversation.
     *
     * <p>Asserted as an IDENTITY between the two renderers against {@link ToolText#RATING_MAX},
     * deliberately not as two hardcoded "8/10" literals — a test that spelled the ceiling itself
     * would pass just as happily on two literals in the code, which is the state that produced the
     * bug. 8 and 7 are both impossible on the old denominator.
     */
    @Test
    void testGenerate_shouldRenderCheckInRatingsIdenticallyToTheSnapshot_whenBothRenderTheSameDay() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 8, 7, null);

        String narrative = dailySummaryService.generate(owner, DAY).getNarrative();
        String snapshot = contextSnapshotAssembler.render(owner, DAY);

        String shared = "energia 8/" + ToolText.RATING_MAX + ", stressz 7/" + ToolText.RATING_MAX;
        assertThat(narrative).contains(shared);
        assertThat(snapshot).contains(shared);
        assertThat(narrative).doesNotContain("8/5").doesNotContain("7/5");
    }

    /** Both check-in columns are nullable, so an unanswered slider must render NOTHING — never a
     *  fabricated default, and never the literal "null/10" the snapshot side used to emit. */
    @Test
    void testGenerate_shouldOmitCheckInRatings_whenSlidersUnanswered() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "08:00", null, null, "csak egy megjegyzés");

        String narrative = dailySummaryService.generate(owner, DAY).getNarrative();

        assertThat(narrative).doesNotContain("energia").doesNotContain("stressz")
                .doesNotContain("null");
    }

    /**
     * mezo-b6zt sibling: sport intensity is 1..10 (the DB's own {@code ck_sport_session_intensity}),
     * and "/5" halved its ceiling in the day's PERSISTED narrative — where later prompts read it
     * back as history, so the false figure outlived the message. The populator's default intensity
     * is 7, impossible on the old denominator.
     */
    @Test
    void testGenerate_shouldWriteSportIntensityAgainstTen_whenRatedAboveFive() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSession(owner, DAY);

        String narrative = dailySummaryService.generate(owner, DAY).getNarrative();

        assertThat(narrative).contains("intenzitás 7/" + ToolText.RATING_MAX)
                .doesNotContain("intenzitás 7/5");
    }

    /** An unrated sport session omits the fragment entirely (the column is nullable). */
    @Test
    void testGenerate_shouldOmitSportIntensity_whenUnrated() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSessionNoTime(owner, DAY, 60);

        String narrative = dailySummaryService.generate(owner, DAY).getNarrative();

        assertThat(narrative).contains("Sport: ").doesNotContain("intenzitás");
    }

    /**
     * mezo-a64t: the day memory is prose the model quotes back, so a body weight renders with a
     * Hungarian comma at one decimal — the gram-precision "83.694 kg" that shipped is both the
     * wrong separator and a precision nobody asked for, and it is PERSISTED, so every later read
     * inherits it.
     */
    @Test
    void testGenerate_shouldWriteBodyWeightWithHungarianDecimals_whenGramPrecisionLogged() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, DAY, new BigDecimal("83.694"));

        String narrative = dailySummaryService.generate(owner, DAY).getNarrative();

        assertThat(narrative).contains("Súly: 83,7 kg").doesNotContain("83.694").doesNotContain("83.7");
    }

    @Test
    void testGenerate_shouldLeaveNoTrace_whenQualityFieldsEmpty() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("7.5"), 4); // nincs notes

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary.getNarrative())
                .doesNotContain("Említés")
                .doesNotContain("Napi szándék-reflexió");
    }

    @Test
    void testGenerate_shouldPersistNarrativeWithDayFacts_whenDayHasData() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, DAY, new BigDecimal("104.5"));
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("7.2"), 4);

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary).isNotNull();
        assertThat(summary.getSummaryDate()).isEqualTo(DAY);
        // The fake echoes the digest — real day-facts must be in the persisted narrative.
        assertThat(summary.getNarrative())
                // mezo-a64t: the weight and the sleep hours are Hungarian-decimal now, and the
                // fake echoes the digest verbatim — so the narrative carries them exactly
                .contains("Súly: 104,5 kg").contains("Alvás: 7,2 óra")
                .contains("minőség 4/10").contains(DAY.toString());
        assertThat(dailySummaryRepository.findByCreatedByAndSummaryDate(owner, DAY)).isPresent();
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
                .anySatisfy(n -> {
                    assertThat(n.getKind()).isEqualTo("memory_note");
                    assertThat(n.getDeeplink()).isEqualTo("/insights/memoria");
                });
    }

    @Test
    void testGenerate_shouldReturnNull_whenDayEmpty() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(dailySummaryService.generate(owner, DAY)).isNull();
        assertThat(dailySummaryRepository.findByCreatedByAndSummaryDate(owner, DAY)).isEmpty();
    }

    @Test
    void testGenerate_shouldReturnExistingWithoutNewNarrative_whenSummaryExists() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, DAY, new BigDecimal("104.5"));
        DailySummaryEntity existing = dailySummaryPopulator.summary(owner, DAY, "korábbi narratíva");

        DailySummaryEntity result = dailySummaryService.generate(owner, DAY);

        assertThat(result.getId()).isEqualTo(existing.getId());
        assertThat(result.getNarrative()).isEqualTo("korábbi narratíva");
    }

    @Test
    void testGenerate_shouldUseScriptedNarrative_whenSentinelInCheckinNote() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 4, 2, "[fake-summary:Ez volt a nap.]");

        DailySummaryEntity summary = dailySummaryService.generate(owner, DAY);

        assertThat(summary.getNarrative()).isEqualTo("Ez volt a nap.");
    }

    @Test
    void testGenerate_shouldPropagate_whenLlmFails() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 4, 2, "[fake-fail]");

        assertThatThrownBy(() -> dailySummaryService.generate(owner, DAY))
                .isInstanceOf(IllegalStateException.class);
        assertThat(dailySummaryRepository.findByCreatedByAndSummaryDate(owner, DAY)).isEmpty();
    }
}
