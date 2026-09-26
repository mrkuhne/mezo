package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaisedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * The advice-card retirement switch (Csapatfal Act III, mezo-a9bo7.24): with
 * {@code mezo.proactive.advice-card.enabled=false} the flag-raise listener does not exist, so a
 * raise never reaches {@link InterventionService} — the team chat owns the teendő from then on.
 */
class InterventionEventListenerTest {

    private final InterventionService interventionService = mock(InterventionService.class);

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(InterventionService.class, () -> interventionService)
            .withUserConfiguration(InterventionEventListener.class)
            .withPropertyValues(
                    FeaturesConfiguration.COMPANION_SWITCH + "=true",
                    FeaturesConfiguration.PROACTIVE_SWITCH + "=true",
                    FeaturesConfiguration.INTERVENTION_SWITCH + "=true");

    @Test
    void adviceCardOff_noListener_soInterventionServiceIsNeverCalled() {
        runner.withPropertyValues(FeaturesConfiguration.ADVICE_CARD_SWITCH + "=false")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(InterventionEventListener.class));
    }

    @Test
    void adviceCardMissing_noListener_theSwitchIsDeclaredExplicitly() {
        runner.run(ctx -> assertThat(ctx).doesNotHaveBean(InterventionEventListener.class));
    }

    @Test
    void adviceCardOn_listenerDeliversTheRaise() {
        runner.withPropertyValues(FeaturesConfiguration.ADVICE_CARD_SWITCH + "=true")
                .run(ctx -> {
                    assertThat(ctx).hasSingleBean(InterventionEventListener.class);
                    UUID user = UUID.randomUUID();
                    ctx.getBean(InterventionEventListener.class)
                            .onFlagRaised(new FlagRaisedEvent(user, "sleep_debt", "test"));
                    verify(interventionService).deliverForFlag(user, "sleep_debt");
                });
    }
}
