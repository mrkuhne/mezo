package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-iizd.10: LIFEGOAL_SWITCH off ⇒ the {@code LifeGoalCompanionAdapter} bean (and therefore the
 * {@code LifeGoalSource} port {@code LifeGoalSnapshotBlock} reads via {@code ObjectProvider}) is
 * simply absent from the context — the companion must never fail because the lifegoal slice is
 * disabled independently of {@code COMPANION_SWITCH}, so it degrades to the honest "nincs adat"
 * line instead. Own IT class — the {@link TestPropertySource} override forks the Spring context.
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.lifegoal.enabled=false")
class ContextSnapshotAssemblerLifeGoalSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ContextSnapshotAssembler assembler;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRender_shouldShowCelokNincsAdat_whenLifegoalFeatureSwitchIsOff() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String snapshot = assembler.render(owner, today);

        assertThat(snapshot).contains("[Célok] nincs adat");
    }
}
