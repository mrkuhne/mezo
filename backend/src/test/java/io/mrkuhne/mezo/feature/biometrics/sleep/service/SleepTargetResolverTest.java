package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepGoalProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Verifies {@link SleepTargetPort#targetHours(UUID)} on {@link SleepAnchorResolver} (mezo-3g5w). */
class SleepTargetResolverTest {

    private final SleepGoalRepository repository = mock(SleepGoalRepository.class);
    private final SleepGoalProperties properties =
        new SleepGoalProperties(480, "WAKE", "06:30", "22:30", 15);
    private final SleepAnchorResolver resolver = new SleepAnchorResolver(repository, properties);

    @Test
    void testTargetHours_shouldDeriveFromGoalRow_whenGoalExists() {
        UUID user = UUID.randomUUID();
        SleepGoalEntity g = new SleepGoalEntity();
        g.setTargetMinutes(450); // 7.5 h
        g.setAnchor("WAKE");
        g.setAnchorTime("06:30");
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.of(g));

        assertThat(resolver.targetHours(user)).isEqualByComparingTo(new BigDecimal("7.5"));
    }

    @Test
    void testTargetHours_shouldGhostFromConfig_whenNoGoalRow() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.empty());

        assertThat(resolver.targetHours(user)).isEqualByComparingTo(new BigDecimal("8.0")); // 480 min
    }
}
