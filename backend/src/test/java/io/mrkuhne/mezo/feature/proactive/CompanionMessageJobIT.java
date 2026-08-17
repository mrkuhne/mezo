package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.CompanionMessageJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Companion-feed crons (spec §3): three window methods (morning/midday/evening), one switch.
 * run*() invoked directly; NOT @Transactional so the job's own
 * transactions commit and ResetDatabase cleans up. runMorning additionally fires the sleep
 * reaction right after the morning message — its own freshness gate makes it a safe no-op when
 * sleep isn't logged yet, and a real generation when a fresh sleep log already exists (the
 * "cron előtt logolt alvás" case, spec §3).
 */
@ActiveProfiles("companion-fake")
class CompanionMessageJobIT extends AbstractIntegrationTest {

    @Autowired private CompanionMessageJob companionMessageJob;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRunMorning_shouldGenerateTodaysMorningMessage_whenUserHasNarrativeMemory() {
        UUID user = userPopulator.createUser("feedjob-gen@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1), "Tegnap edzés volt.");

        companionMessageJob.runMorning();

        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                user, LocalDate.now(), CompanionMessageEntity.KIND_MORNING))
                .hasValueSatisfying(m -> assertThat(m.getContent().eyebrow()).isEqualTo("Fake reggeli"));
    }

    @Test
    void testRunMorning_shouldBeIdempotent_whenMessageAlreadyExists() {
        UUID user = userPopulator.createUser("feedjob-idem@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1), "Tegnap úszás volt.");

        companionMessageJob.runMorning();
        CompanionMessageEntity first = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(user, LocalDate.now(), CompanionMessageEntity.KIND_MORNING)
                .orElseThrow();
        companionMessageJob.runMorning();

        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                user, LocalDate.now(), CompanionMessageEntity.KIND_MORNING))
                .hasValueSatisfying(m -> assertThat(m.getId()).isEqualTo(first.getId()));
    }

    @Test
    void testRunMorning_shouldSkipUserWithoutMemory_andStillServeOthers() {
        UUID bare = userPopulator.createUser("feedjob-bare@test.local").getId();
        UUID rich = userPopulator.createUser("feedjob-rich@test.local").getId();
        dailySummaryPopulator.summary(rich, LocalDate.now().minusDays(1), "Tegnap futás volt.");

        companionMessageJob.runMorning();

        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                bare, LocalDate.now(), CompanionMessageEntity.KIND_MORNING)).isEmpty();
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                rich, LocalDate.now(), CompanionMessageEntity.KIND_MORNING)).isPresent();
    }

    @Test
    void testRunMorning_shouldAlsoGenerateSleepReaction_whenFreshSleepLogAlreadyExists() {
        UUID user = userPopulator.createUser("feedjob-sleep@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1), "Tegnap pihenőnap volt.");
        sleepLogPopulator.createSleepLog(user, LocalDate.now(), new BigDecimal("7.5"), 4);

        companionMessageJob.runMorning();

        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                user, LocalDate.now(), CompanionMessageEntity.KIND_MORNING))
                .hasValueSatisfying(m -> assertThat(m.getContent().eyebrow()).isEqualTo("Fake reggeli"));
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                user, LocalDate.now(), CompanionMessageEntity.KIND_SLEEP))
                .hasValueSatisfying(m -> assertThat(m.getContent().eyebrow()).isEqualTo("Fake alvás"));
    }

    @Test
    void testRunMidday_shouldGenerateTodaysMiddayMessage_whenUserHasNarrativeMemory() {
        UUID user = userPopulator.createUser("feedjob-midday@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1), "Tegnap pihenőnap volt.");

        companionMessageJob.runMidday();

        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                user, LocalDate.now(), CompanionMessageEntity.KIND_MIDDAY)).isPresent();
    }

    @Test
    void testRunEvening_shouldGenerateTodaysEveningMessage_whenUserHasNarrativeMemory() {
        UUID user = userPopulator.createUser("feedjob-evening@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1), "Tegnap pihenőnap volt.");

        companionMessageJob.runEvening();

        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                user, LocalDate.now(), CompanionMessageEntity.KIND_EVENING)).isPresent();
    }
}
