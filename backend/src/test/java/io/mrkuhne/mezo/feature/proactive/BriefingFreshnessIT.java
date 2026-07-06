package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveBriefingService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BriefingPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * B1.2 hybrid freshness: a sleep_log row arriving AFTER generated_at makes the next GET
 * soft-delete + regenerate (regen_count+1) up to the per-day cap; without a late input the
 * row is served untouched. Trigger window: sleep date >= briefingDate - 1 (robust to the
 * night-date convention).
 */
@Transactional
@ActiveProfiles("companion-fake")
class BriefingFreshnessIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.now();

    @Autowired private ProactiveBriefingService briefingService;
    @Autowired private BriefingRepository briefingRepository;
    @Autowired private BriefingPopulator briefingPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGetBriefing_shouldRegenerate_whenSleepArrivedAfterGeneration() {
        UUID user = userPopulator.createUser("fresh-regen@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap edzés volt.");
        BriefingEntity stale = briefingPopulator.briefing(user, DAY);   // generated_at = now
        // seed a sleep row for last night CREATED AFTER generated_at (created_at defaults to now,
        // which is > the populator row's generated_at by insertion order — see Step 1 note)
        sleepLogPopulator.createSleepLog(user, DAY, new BigDecimal("7.4"), 4);

        BriefingResponse regenerated = briefingService.getBriefing(user, DAY);

        BriefingEntity live = briefingRepository.findByCreatedByAndBriefingDate(user, DAY).orElseThrow();
        assertThat(live.getId()).isNotEqualTo(stale.getId());
        assertThat(live.getRegenCount()).isEqualTo(1);
        assertThat(regenerated.getEyebrow()).isEqualTo("Fake briefing");   // freshly generated
    }

    @Test
    void testGetBriefing_shouldServeExisting_whenNoLateInput() {
        UUID user = userPopulator.createUser("fresh-keep@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenő volt.");
        BriefingEntity existing = briefingPopulator.briefing(user, DAY);

        briefingService.getBriefing(user, DAY);

        BriefingEntity live = briefingRepository.findByCreatedByAndBriefingDate(user, DAY).orElseThrow();
        assertThat(live.getId()).isEqualTo(existing.getId());
        assertThat(live.getRegenCount()).isZero();
    }

    @Test
    void testGetBriefing_shouldStopRegenerating_whenCapReached() {
        UUID user = userPopulator.createUser("fresh-cap@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap futás volt.");
        BriefingEntity capped = briefingPopulator.briefing(user, DAY);
        capped.setRegenCount(2);   // == regen-cap-per-day
        briefingRepository.saveAndFlush(capped);
        sleepLogPopulator.createSleepLog(user, DAY, new BigDecimal("7.4"), 4);   // late input exists, but the cap holds

        briefingService.getBriefing(user, DAY);

        BriefingEntity live = briefingRepository.findByCreatedByAndBriefingDate(user, DAY).orElseThrow();
        assertThat(live.getId()).isEqualTo(capped.getId());
        assertThat(live.getRegenCount()).isEqualTo(2);
    }

    @Test
    void testGetBriefing_shouldServe404AndPreserveOldRow_whenRegenerationFails() {
        UUID user = userPopulator.createUser("fresh-fail@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap séta volt.");
        BriefingEntity stale = briefingPopulator.briefing(user, DAY);
        sleepLogPopulator.createSleepLog(user, DAY, new java.math.BigDecimal("7.4"), 4);
        // script an UNPARSEABLE briefing answer via a check-in note sentinel -> generate() returns null
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2, "[fake-briefing:{\"eyebrow\":}]");

        assertThatThrownBy(() -> briefingService.getBriefing(user, DAY))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
