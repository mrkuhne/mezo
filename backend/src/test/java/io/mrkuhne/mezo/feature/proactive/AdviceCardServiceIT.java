package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCandidate;
import io.mrkuhne.mezo.feature.proactive.service.AdviceCardService;
import io.mrkuhne.mezo.feature.proactive.service.SetupCheckService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S4 (bd mezo-d58h.4, spec §4 severity order + §5): ONE advice card per day across ALL tiers, and
 * a strictly higher-severity candidate arriving later in the day SUPERSEDES the incumbent instead
 * of being dropped (the S3 shape — two independent first-wins gates — is what this replaces).
 */
@ActiveProfiles("companion-fake")
class AdviceCardServiceIT extends AbstractIntegrationTest {

    @Autowired private AdviceCardService adviceCardService;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private UserPopulator userPopulator;

    private AdviceCandidate flag(String flagKey) {
        return AdviceCandidate.fromFlag(flagKey, flagKey + "_entry", "Mezo · észrevétel",
            List.of("tény"), List.of("javaslat"), "Sablon-szöveg.");
    }

    private AdviceCandidate setup(String checkKey) {
        return AdviceCandidate.fromSetupCheck(checkKey, "Mezo · beállítás",
            List.of("Állítsd be az alvás-célt."), "Állítsd be az alvás-célt.");
    }

    @Test
    void testDeliver_shouldWriteAnAdviceCard() {
        UUID owner = userPopulator.createUser().getId();

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_ADVICE);
        assertThat(card.orElseThrow().getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
        assertThat(card.orElseThrow().getContent().interventionKey()).isEqualTo("sleep_debt_entry");
        assertThat(card.orElseThrow().getContent().facts()).containsExactly("tény");
        assertThat(card.orElseThrow().getContent().suggestions()).containsExactly("javaslat");
    }

    @Test
    void testDeliver_shouldRejectALowerSeverityCandidate_whenTheDayAlreadyHasACard() {
        UUID owner = userPopulator.createUser().getId();
        adviceCardService.deliver(owner, flag(FlagKey.MISSED_WORKOUTS));

        assertThat(adviceCardService.deliver(owner, flag(FlagKey.LOGGING_GAP))).isEmpty();

        assertThat(todaysCard(owner).getContent().adviceKey()).isEqualTo(FlagKey.MISSED_WORKOUTS);
    }

    /** Equal rank never churns the card — a re-raise of the same flag must leave the row (and its
     *  „Segített?" votes) exactly where they are. */
    @Test
    void testDeliver_shouldRejectAnEqualSeverityCandidate() {
        UUID owner = userPopulator.createUser().getId();
        UUID firstId = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT)).orElseThrow().getId();

        assertThat(adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT))).isEmpty();

        assertThat(todaysCard(owner).getId()).isEqualTo(firstId);
    }

    @Test
    void testDeliver_shouldSupersedeTheDaysCard_whenTheCandidateIsMoreSevere() {
        UUID owner = userPopulator.createUser().getId();
        UUID lowId = adviceCardService.deliver(owner, flag(FlagKey.LOGGING_GAP)).orElseThrow().getId();

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.MISSED_WORKOUTS));

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getId()).isNotEqualTo(lowId);
        // The partial unique index is per (user, day, kind) on LIVE rows — the loser is soft-deleted.
        assertThat(todaysCard(owner).getContent().adviceKey()).isEqualTo(FlagKey.MISSED_WORKOUTS);
        assertThat(companionMessageRepository.findById(lowId)).isEmpty();
    }

    /** The whole point of S4 item 1: a setup card and a flag card can no longer both land today. */
    @Test
    void testDeliver_shouldSubsumeSetupCards_inTheSameGate() {
        UUID owner = userPopulator.createUser().getId();
        adviceCardService.deliver(owner, setup(SetupCheckService.CHECK_MISSING_SLEEP_GOAL));

        Optional<CompanionMessageEntity> card = adviceCardService.deliver(owner, flag(FlagKey.SLEEP_DEBT));

        assertThat(card).isPresent();
        assertThat(companionMessageRepository
            .findByCreatedByAndMessageDateOrderByGeneratedAtAsc(owner, LocalDate.now()))
            .hasSize(1);
        assertThat(todaysCard(owner).getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
    }

    private CompanionMessageEntity todaysCard(UUID owner) {
        return companionMessageRepository.findByCreatedByAndMessageDateAndKind(
            owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE).orElseThrow();
    }
}
