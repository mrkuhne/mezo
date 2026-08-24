package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * W5.1 on-write trigger (bd mezo-b3pp.18, task 6): {@code CheckInService.save} publishes {@code
 * CheckInSavedEvent} AFTER_COMMIT -> async {@code FlagEvaluationListener} -> {@code
 * FlagService.evaluateAndLog} with source {@code write}. No {@code @Transactional} on this class
 * (the {@code FlagServiceIT} precedent) — the save must genuinely commit for AFTER_COMMIT to fire;
 * Awaitility rides out the async hop, mirroring {@code CompanionMessageEventIT}.
 */
class FlagEvaluationListenerIT extends AbstractIntegrationTest {

    @Autowired private CheckInService checkInService;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private CompanionFlagLogRepository repository;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void a_check_in_save_raises_the_flag_with_source_write() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);

        SaveCheckInRequest req = SaveCheckInRequest.builder()
            .date(today).slotTime("08:00").state("done").energy(4).stress(8).build();
        checkInService.save(owner, req);

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
            assertThat(repository
                .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(owner, FlagKey.SUSTAINED_STRESS))
                .isPresent()
                .get()
                .extracting(r -> r.getSource())
                .isEqualTo(FlagKey.SOURCE_WRITE));
    }

    @Test
    void a_calm_check_in_save_raises_nothing() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();

        SaveCheckInRequest req = SaveCheckInRequest.builder()
            .date(today).slotTime("08:00").state("done").energy(4).stress(2).build();
        checkInService.save(owner, req);

        await().during(Duration.ofSeconds(1)).atMost(Duration.ofSeconds(5)).untilAsserted(() ->
            assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner))
                .noneMatch(r -> FlagKey.SUSTAINED_STRESS.equals(r.getFlagKey())));
    }
}
