package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolOutcomesEnvelope;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Plain unit test (no Spring context) for {@link TurnProvenance#build}, the pure converter that
 * turns ONE {@code ToolCallAudit.ToolOutcome} list into the two persisted envelopes (S9.7,
 * mezo-rj214.7). Cases from task-3-brief.md, in order.
 */
class TurnProvenanceTest {

    /** Generous defaults; only cases 5/6 shrink these to force truncation/over-budget. */
    private static final CompanionProperties.Turn.Provenance DEFAULT_LIMITS =
            new CompanionProperties.Turn.Provenance(90, "0 50 3 * * *", 4000, 20000);

    @Test
    void emptyListYieldsBothEnvelopesNull() {
        TurnProvenance.Built built = TurnProvenance.build(List.of(), DEFAULT_LIMITS);

        assertThat(built.ask()).isNull();
        assertThat(built.result()).isNull();
    }

    @Test
    void nullListYieldsBothEnvelopesNull() {
        TurnProvenance.Built built = TurnProvenance.build(null, DEFAULT_LIMITS);

        assertThat(built.ask()).isNull();
        assertThat(built.result()).isNull();
    }

    @Test
    void planTruthOutcomeCompactsArgsAndKeepsWhy() {
        ToolCallAudit.ToolOutcome outcome = new ToolCallAudit.ToolOutcome(
                "get_meals", "{\"day\":\"2026-09-18\"}", "Reggeli: …", "hogy lássam a mai étkezést");

        TurnProvenance.Built built = TurnProvenance.build(List.of(outcome), DEFAULT_LIMITS);

        assertThat(built.ask().calls()).hasSize(1);
        ToolCallsEnvelope.ToolCall ask = built.ask().calls().get(0);
        assertThat(ask.type()).isEqualTo("read");
        assertThat(ask.name()).isEqualTo("get_meals");
        assertThat(ask.args()).isEqualTo("day=2026-09-18");
        assertThat(ask.why()).isEqualTo("hogy lássam a mai étkezést");

        assertThat(built.result().outcomes()).hasSize(1);
        ToolOutcomesEnvelope.Outcome result = built.result().outcomes().get(0);
        assertThat(result.text()).isEqualTo("Reggeli: …");
        assertThat(result.failed()).isFalse();
    }

    @Test
    void stepTimeoutMarksFailedAndKeepsMarkerText() {
        ToolCallAudit.ToolOutcome outcome = new ToolCallAudit.ToolOutcome(
                "get_meals", "{}", PlanExecutor.STEP_TIMEOUT, "miert");

        TurnProvenance.Built built = TurnProvenance.build(List.of(outcome), DEFAULT_LIMITS);

        ToolOutcomesEnvelope.Outcome result = built.result().outcomes().get(0);
        assertThat(result.failed()).isTrue();
        assertThat(result.text()).isEqualTo(PlanExecutor.STEP_TIMEOUT);
    }

    @Test
    void stepFailedAndBudgetExhaustedMarkersMarkFailed() {
        ToolCallAudit.ToolOutcome stepFailed = new ToolCallAudit.ToolOutcome(
                "get_meals", "{}", PlanExecutor.STEP_FAILED, "miert");
        ToolCallAudit.ToolOutcome budgetExhausted = new ToolCallAudit.ToolOutcome(
                "get_meals", "{}", RecordingToolCallback.BUDGET_EXHAUSTED, "miert");

        TurnProvenance.Built built = TurnProvenance.build(List.of(stepFailed, budgetExhausted), DEFAULT_LIMITS);

        assertThat(built.result().outcomes().get(0).failed()).isTrue();
        assertThat(built.result().outcomes().get(0).text()).isEqualTo(PlanExecutor.STEP_FAILED);
        assertThat(built.result().outcomes().get(1).failed()).isTrue();
        assertThat(built.result().outcomes().get(1).text()).isEqualTo(RecordingToolCallback.BUDGET_EXHAUSTED);
    }

    @Test
    void resultLongerThanPerOutcomeCapIsTruncatedWithSuffixKeepingPrefix() {
        CompanionProperties.Turn.Provenance tightPerOutcome =
                new CompanionProperties.Turn.Provenance(90, "0 50 3 * * *", 200, 20000);
        String longResult = "a".repeat(300);
        ToolCallAudit.ToolOutcome outcome = new ToolCallAudit.ToolOutcome("get_meals", "{}", longResult, "miert");

        TurnProvenance.Built built = TurnProvenance.build(List.of(outcome), tightPerOutcome);

        String text = built.result().outcomes().get(0).text();
        assertThat(text).startsWith("a".repeat(200));
        assertThat(text).endsWith(" …(rövidítve)");
        assertThat(text).isEqualTo("a".repeat(200) + " …(rövidítve)");
    }

    @Test
    void onceRunningTotalPassesBudgetFurtherOutcomesGetOverBudgetTextButAreNeverDropped() {
        CompanionProperties.Turn.Provenance tightTotal =
                new CompanionProperties.Turn.Provenance(90, "0 50 3 * * *", 4000, 1000);
        ToolCallAudit.ToolOutcome first = new ToolCallAudit.ToolOutcome("a", "{}", "x".repeat(1000), "w1");
        ToolCallAudit.ToolOutcome second = new ToolCallAudit.ToolOutcome("b", "{}", "some more text", "w2");
        ToolCallAudit.ToolOutcome third = new ToolCallAudit.ToolOutcome(
                "c", "{}", PlanExecutor.STEP_TIMEOUT, "w3");

        TurnProvenance.Built built = TurnProvenance.build(List.of(first, second, third), tightTotal);

        List<ToolOutcomesEnvelope.Outcome> outcomes = built.result().outcomes();
        assertThat(outcomes).hasSize(3);
        assertThat(outcomes.get(1).text()).isEqualTo("…(a többi részlet nem fér ide)");
        assertThat(outcomes.get(1).failed()).isFalse();
        // failed must stay driven by the ORIGINAL result, not by the over-budget replacement text
        assertThat(outcomes.get(2).text()).isEqualTo("…(a többi részlet nem fér ide)");
        assertThat(outcomes.get(2).failed()).isTrue();
    }

    @Test
    void ranTruthOutcomePassesCompactArgsThroughAndHasNoWhy() {
        ToolCallAudit.ToolOutcome outcome = new ToolCallAudit.ToolOutcome("get_weight_trend", "days=7", "trend text");

        TurnProvenance.Built built = TurnProvenance.build(List.of(outcome), DEFAULT_LIMITS);

        ToolCallsEnvelope.ToolCall ask = built.ask().calls().get(0);
        assertThat(ask.args()).isEqualTo("days=7");
        assertThat(ask.why()).isNull();
    }

    @Test
    void nullResultYieldsFailedTrueAndNonNullPlaceholderText() {
        ToolCallAudit.ToolOutcome outcome = new ToolCallAudit.ToolOutcome("get_meals", "{}", null, "miert");

        TurnProvenance.Built built = TurnProvenance.build(List.of(outcome), DEFAULT_LIMITS);

        ToolOutcomesEnvelope.Outcome result = built.result().outcomes().get(0);
        assertThat(result.failed()).isTrue();
        assertThat(result.text()).isNotNull();
    }
}
