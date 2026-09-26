package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * Task 4 (bd mezo-a9bo7.21): {@link AdviceApplyService#applyPort} — the port-dispatch seam
 * extracted out of {@code apply}, so the csapatfal team-chat action buttons (Act III) can reuse
 * the same lookup without a {@code companion_message} card. Plain unit test, no Spring context —
 * {@code apply}'s own card/lock/idempotence behaviour stays pinned by {@code AdviceApplyServiceIT}.
 */
class AdviceApplyServiceTest {

    private final CompanionMessageRepository companionMessageRepository = mock(CompanionMessageRepository.class);

    @Test
    void testApplyPort_shouldRunTheRegisteredPortsEffect() {
        AdviceMutationPort port = mock(AdviceMutationPort.class);
        when(port.actionKey()).thenReturn("shift_sleep_anchor");
        AdviceApplyService service = new AdviceApplyService(companionMessageRepository, List.of(port));
        UUID userId = UUID.randomUUID();
        Map<String, Object> params = Map.of("minutes", -30);

        service.applyPort(userId, "shift_sleep_anchor", params);

        verify(port, times(1)).apply(userId, params);
    }

    @Test
    void testApplyPort_shouldThrowPortMissing_whenNoPortIsRegisteredForTheKey() {
        AdviceApplyService service = new AdviceApplyService(companionMessageRepository, List.of());
        UUID userId = UUID.randomUUID();

        assertThatThrownBy(() -> service.applyPort(userId, "unknown_action", Map.of()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> {
                SystemRuntimeErrorException e = (SystemRuntimeErrorException) ex;
                assertThat(e.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                assertThat(e.getMessage()).isEqualTo("PROACTIVE_ADVICE_ACTION_PORT_MISSING");
            });
    }

    @Test
    void testApplyPort_shouldDispatchToTheMatchingPortOnly_whenSeveralAreRegistered() {
        AdviceMutationPort matching = mock(AdviceMutationPort.class);
        when(matching.actionKey()).thenReturn("lighten_tomorrow");
        AdviceMutationPort other = mock(AdviceMutationPort.class);
        when(other.actionKey()).thenReturn("shift_sleep_anchor");
        AdviceApplyService service = new AdviceApplyService(companionMessageRepository, List.of(other, matching));
        UUID userId = UUID.randomUUID();

        service.applyPort(userId, "lighten_tomorrow", Map.of("delta", -1));

        verify(matching, times(1)).apply(userId, Map.of("delta", -1));
        verify(other, times(0)).apply(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyMap());
    }
}
