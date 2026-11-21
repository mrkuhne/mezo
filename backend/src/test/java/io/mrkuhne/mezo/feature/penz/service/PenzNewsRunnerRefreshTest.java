package io.mrkuhne.mezo.feature.penz.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.penz.config.PenzNewsProperties;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;

/**
 * Finding #13 of the L6 security review (mezo-r36n9.104): the refresh cooldown is stamped only once the run was
 * accepted; a full executor answers 429 and leaves the next refresh free.
 */
class PenzNewsRunnerRefreshTest {

    private static final PenzNewsProperties PROPS =
        new PenzNewsProperties(false, "0 30 6,13 * * *", "Europe/Budapest", "", 2_097_152, 2_097_152, 2, 40, 30, 15, 4);

    private static PenzNewsRunner runner(Executor executor) {
        return new PenzNewsRunner(null, null, null, null, null, null, PROPS, executor,
            new DefaultListableBeanFactory().getBeanProvider(Clock.class));
    }

    @Test
    void testRequestRefresh_shouldNotStampTheCooldown_whenTheExecutorRejects() {
        UUID owner = UUID.randomUUID();
        AtomicInteger accepted = new AtomicInteger();
        boolean[] full = {true};
        PenzNewsRunner runner = runner(task -> {
            if (full[0]) {
                throw new RejectedExecutionException("full");
            }
            accepted.incrementAndGet();
        });

        assertThatThrownBy(() -> runner.requestRefresh(owner)).isInstanceOf(SystemRuntimeErrorException.class);
        full[0] = false;
        runner.requestRefresh(owner);

        assertThat(accepted).hasValue(1);
        assertThatThrownBy(() -> runner.requestRefresh(owner)).isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(accepted).hasValue(1);
    }
}
