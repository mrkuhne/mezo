package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import org.junit.jupiter.api.Test;

class ToolCallAuditTest {

    @Test
    void testToEnvelopes_shouldReturnNull_whenNothingRecorded() {
        ToolCallAudit audit = new ToolCallAudit(6, 10);
        assertThat(audit.toToolCallsEnvelope()).isNull();
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testRecordCall_shouldTypeReadAndExhaustBudget_whenCapReached() {
        ToolCallAudit audit = new ToolCallAudit(2, 10);
        audit.recordCall("get_sleep", "days=7");
        assertThat(audit.budgetExhausted()).isFalse();
        audit.recordCall("get_weight_trend", "weeks=2");
        assertThat(audit.budgetExhausted()).isTrue();
        ToolCallsEnvelope envelope = audit.toToolCallsEnvelope();
        assertThat(envelope.calls()).extracting(ToolCallsEnvelope.ToolCall::type)
                .containsOnly(ToolCallAudit.TYPE_READ);
        assertThat(envelope.calls()).extracting(ToolCallsEnvelope.ToolCall::name)
                .containsExactly("get_sleep", "get_weight_trend");
        assertThat(envelope.calls().getFirst().args()).isEqualTo("days=7");
    }

    @Test
    void testAddRef_shouldDedupeAndCap_whenOverfed() {
        ToolCallAudit audit = new ToolCallAudit(6, 2);
        audit.addRef("Sleep", "2026-07-01");
        audit.addRef("Sleep", "2026-07-01");
        audit.addRef("Sleep", "2026-07-02");
        audit.addRef("Sleep", "2026-07-03");
        RefsEnvelope refs = audit.toRefsEnvelope();
        assertThat(refs.refs()).containsExactly(
                new RefsEnvelope.Ref("Sleep", "2026-07-01"),
                new RefsEnvelope.Ref("Sleep", "2026-07-02"));
    }
}
