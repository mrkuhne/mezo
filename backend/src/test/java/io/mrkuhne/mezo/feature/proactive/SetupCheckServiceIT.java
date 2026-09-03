package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.SetupCheckService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S3 (bd mezo-d58h.3, spec 2026-09-03 §4 setup table): the missing-sleep-goal setup check —
 * {@link SetupCheckService#runFor} emits a {@code setup} card when no {@code sleep_goal} row
 * exists for the user, stays silent once one does, and re-emits the SAME check at most weekly
 * (the one-per-day card gate and the per-check re-emit window are two separate gates, pinned
 * separately below).
 */
class SetupCheckServiceIT extends AbstractIntegrationTest {

    @Autowired private SetupCheckService setupCheckService;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRunFor_shouldEmitTheMissingSleepGoalCard_whenNoGoalRowExists() {
        UUID owner = userPopulator.createUser().getId();

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_SETUP);
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_MISSING_SLEEP_GOAL);
    }

    @Test
    void testRunFor_shouldStaySilent_whenTheGoalRowExists() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);

        assertThat(setupCheckService.runFor(owner)).isEmpty();
    }

    @Test
    void testRunFor_shouldNotRepeatTheSameCheck_insideTheReEmitWindow() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(setupCheckService.runFor(owner)).isPresent();
        assertThat(setupCheckService.runFor(owner)).isEmpty(); // same day AND inside 168h
    }

    /** {@link #testRunFor_shouldNotRepeatTheSameCheck_insideTheReEmitWindow} pins BOTH the
     *  one-card-per-day gate AND the weekly re-emit window at once — a service that only enforced
     *  the daily gate (and ignored {@code reEmitHours} entirely) would still pass it, since the
     *  second call there is same-day regardless. This test isolates the weekly window: a setup
     *  card from a PAST day, generated further back than {@code reEmitHours} (168h), must NOT
     *  block today's card — proving the re-emit check actually reads generatedAt, not just
     *  message_date. */
    @Test
    void testRunFor_shouldEmitANewCard_whenThePriorCardIsOutsideTheReEmitWindow() {
        UUID owner = userPopulator.createUser().getId();
        companionMessagePopulator.createSetup(owner, LocalDate.now().minusDays(10),
            SetupCheckService.CHECK_MISSING_SLEEP_GOAL, SetupCheckService.EYEBROW,
            List.of("…"), Instant.now().minus(200, ChronoUnit.HOURS)); // 200h > 168h window

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_MISSING_SLEEP_GOAL);
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
            owner, LocalDate.now(), CompanionMessageEntity.KIND_SETUP)).isPresent();
    }
}
