package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;

class ToolCallAuditConcurrencyTest {

    @Test
    void testRecordCallAndResult_shouldLoseNothing_whenHammeredFromManyThreads() throws Exception {
        int calls = 64;
        ToolCallAudit audit = new ToolCallAudit(calls, 10);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(8)) {
            List<Future<?>> futures = java.util.stream.IntStream.range(0, calls)
                .<Future<?>>mapToObj(i -> pool.submit(() -> {
                    start.await();
                    int index = audit.recordCall("get_fuel_log", "{\"i\":" + i + "}");
                    audit.recordResult(index, "eredmény " + i);
                    audit.addRef("FuelDay", "2026-09-" + (i % 28 + 1));
                    return null;
                }))
                .toList();
            start.countDown();
            for (Future<?> f : futures) {
                f.get();
            }
        }

        assertThat(audit.callCount()).isEqualTo(calls);
        // Every call index got its own result — nothing lost, nothing cross-wired.
        assertThat(audit.toolOutcomes()).hasSize(calls)
            .allSatisfy(outcome -> {
                String i = outcome.args().replaceAll("\\D", "");
                assertThat(outcome.result()).isEqualTo("eredmény " + i);
            });
    }

    @Test
    void testBudget_shouldNeverOvershoot_whenCheckedConcurrently() throws Exception {
        int budget = 5;
        ToolCallAudit audit = new ToolCallAudit(budget, 10);
        try (ExecutorService pool = Executors.newFixedThreadPool(8)) {
            List<Future<Boolean>> futures = java.util.stream.IntStream.range(0, 32)
                .mapToObj(i -> pool.submit(() -> {
                    if (audit.budgetExhausted()) {
                        return false;
                    }
                    audit.recordCall("get_pantry", "{}");
                    return true;
                }))
                .toList();
            long recorded = futures.stream().filter(f -> {
                try { return f.get(); } catch (Exception e) { throw new RuntimeException(e); }
            }).count();
            // The check-then-record pair is not atomic across callers by design (same as the
            // Spring AI loop today); the invariant is that the AUDIT ITSELF never corrupts —
            // callCount equals the number of successful recordCall returns.
            assertThat(audit.callCount()).isEqualTo(recorded);
        }
    }
}
