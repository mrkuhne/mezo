package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagService;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.InterventionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Intervention switch OFF (bd mezo-b3pp.19): no {@code InterventionService} bean, and a flag
 *  raise still writes its {@code companion_flag_log} row but delivers no intervention card —
 *  W5.1 flag logging is unaffected by W5.2's switch. */
@TestPropertySource(properties = "mezo.feature.intervention.enabled=false")
class InterventionSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private FlagService flagService;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void testContext_shouldHaveNoInterventionServiceBean_whenSwitchOff() {
        assertThat(context.getBeanProvider(InterventionService.class).getIfAvailable()).isNull();
    }

    @Test
    void testEvaluateAndLog_shouldWriteFlagButNoCard_whenSwitchOff() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);

        assertThat(flagService.evaluateAndLog(owner, FlagKey.SOURCE_WRITE))
            .contains(FlagKey.SUSTAINED_STRESS);

        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
            owner, today, CompanionMessageEntity.KIND_INTERVENTION)).isEmpty();
    }
}
