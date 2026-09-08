package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;

import java.util.ArrayList;
import java.util.List;

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

    /** mezo-b3pp.33 — the trap: {@code Ref} gained a {@code label} component, so a naive
     *  {@code LinkedHashSet<Ref>} would stop deduping once the same (kind,id) arrives with and
     *  without a label. Dedup must stay on (kind, id) only, and the FIRST ref wins. */
    @Test
    void testAddRef_shouldStillDedupe_whenTheSameKindAndIdArriveWithDifferentLabels() {
        ToolCallAudit audit = new ToolCallAudit(6, 10);
        audit.addRef("Memory", "2026-05-21", null);
        audit.addRef("Memory", "2026-05-21", "valami");

        RefsEnvelope refs = audit.toRefsEnvelope();
        assertThat(refs.refs()).containsExactly(new RefsEnvelope.Ref("Memory", "2026-05-21", null));
    }

    @Test
    void testRecordCall_shouldNotifyListenerWithTheRecordedCall_whenListenerRegistered() {
        ToolCallAudit audit = new ToolCallAudit(5, 5);
        List<ToolCallsEnvelope.ToolCall> seen = new ArrayList<>();
        audit.onCall(seen::add);

        audit.recordCall("get_recovery", "scope=sleep, days=3");

        assertThat(seen).singleElement().satisfies(call -> {
            assertThat(call.name()).isEqualTo("get_recovery");
            assertThat(call.args()).isEqualTo("scope=sleep, days=3");
            assertThat(call.type()).isEqualTo(ToolCallAudit.TYPE_READ);
        });
    }

    @Test
    void testRecordCall_shouldStillRecord_whenListenerThrows() {
        ToolCallAudit audit = new ToolCallAudit(5, 5);
        audit.onCall(call -> {
            throw new IllegalStateException("listener blew up");
        });

        audit.recordCall("get_recipes", "filter=smoothie");

        // a broken progress listener must never fail the turn — the audit is the source of truth
        assertThat(audit.callCount()).isEqualTo(1);
        assertThat(audit.toToolCallsEnvelope().calls()).singleElement()
                .extracting(ToolCallsEnvelope.ToolCall::name).isEqualTo("get_recipes");
    }

    @Test
    void testToolOutcomes_shouldCarryResultText_whenResultRecordedForACall() {
        // mezo-indo: the verdict judge needs WHAT a tool returned, not just that it ran. The
        // result arrives after the call is recorded (recordCall fires the live SSE listener
        // BEFORE the delegate runs), so it must be attachable to the call by its index.
        ToolCallAudit audit = new ToolCallAudit(6, 10);
        int first = audit.recordCall("get_weight_trend", "weeks=4");
        int second = audit.recordCall("get_sleep", "days=7");
        audit.recordResult(second, "Alvás (7 nap): 7,1 óra átlag");
        audit.recordResult(first, "Súlytrend (4 hét): trendsúly 85,5 kg");

        assertThat(audit.toolOutcomes())
                .extracting(ToolCallAudit.ToolOutcome::name, ToolCallAudit.ToolOutcome::args,
                        ToolCallAudit.ToolOutcome::result)
                .containsExactly(
                        tuple("get_weight_trend", "weeks=4", "Súlytrend (4 hét): trendsúly 85,5 kg"),
                        tuple("get_sleep", "days=7", "Alvás (7 nap): 7,1 óra átlag"));
    }

    @Test
    void testToolOutcomes_shouldLeaveResultNull_whenNoResultWasRecorded() {
        // A call whose result never arrives (a thrown listener path, a future caller that forgets)
        // must still surface as an outcome — the judge is told the output is unknown, not that the
        // call never happened.
        ToolCallAudit audit = new ToolCallAudit(6, 10);
        audit.recordCall("get_sleep", "days=7");

        assertThat(audit.toolOutcomes()).singleElement()
                .extracting(ToolCallAudit.ToolOutcome::result).isNull();
    }
}
