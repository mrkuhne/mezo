package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.service.DailySummaryService;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * V2.2 generation flow over the fake LLM: the deterministic digest carries real day-facts into
 * the persisted narrative (fake echoes the digest), empty days produce nothing, existing days
 * are returned without a new LLM call, and the {@code [fake-summary:…]} sentinel scripts the
 * narrative through a check-in note.
 */
@Transactional
@ActiveProfiles("companion-fake")
class DailySummaryServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private DailySummaryService dailySummaryService;
    @Autowired private DailySummaryRepository dailySummaryRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

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
                .contains("104.5").contains("7.2").contains("minőség 4/5").contains(DAY.toString());
        assertThat(dailySummaryRepository.findByCreatedByAndSummaryDate(owner, DAY)).isPresent();
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
