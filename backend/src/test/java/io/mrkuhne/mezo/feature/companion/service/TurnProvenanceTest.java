package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.ConversationProperties;
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

    /**
     * The production storage budget, which since the mezo-rj214.10 unification is the ONE budget
     * in {@code mezo.companion.conversation} (result-max-chars / results-max-chars) rather than a
     * second provenance-specific pair. Only cases 5/6 shrink it to force truncation/over-budget,
     * and they stay inside the property's own validation range (500 / 2000 minimums).
     */
    private static final ConversationProperties DEFAULT_LIMITS = limits(8000, 40000);

    private static ConversationProperties limits(int resultMaxChars, int resultsMaxChars) {
        return new ConversationProperties(true, 3, 80, 20, 12000, 100000, resultMaxChars, resultsMaxChars);
    }

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
        ConversationProperties tightPerOutcome = limits(500, 40000);
        String longResult = "a".repeat(700);
        ToolCallAudit.ToolOutcome outcome = new ToolCallAudit.ToolOutcome("get_meals", "{}", longResult, "miert");

        TurnProvenance.Built built = TurnProvenance.build(List.of(outcome), tightPerOutcome);

        String text = built.result().outcomes().get(0).text();
        assertThat(text).startsWith("a".repeat(500));
        assertThat(text).endsWith(" …(rövidítve)");
        assertThat(text).isEqualTo("a".repeat(500) + " …(rövidítve)");
    }

    @Test
    void onceRunningTotalPassesBudgetFurtherOutcomesGetOverBudgetTextButAreNeverDropped() {
        ConversationProperties tightTotal = limits(8000, 2000);
        ToolCallAudit.ToolOutcome first = new ToolCallAudit.ToolOutcome("a", "{}", "x".repeat(2000), "w1");
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

    /**
     * Today's tools only ever emit flat scalar args, but the plan's args are model-controlled and
     * {@code PlanValidator} only checks key names — an array-valued arg must render as its own
     * compact JSON rather than throw {@code JsonNodeException} (Jackson 3's {@code asString()}
     * rejects container nodes) and fall into the outer "return unchanged" guard.
     */
    @Test
    void arrayValuedArgRendersAsCompactJsonInsteadOfThrowing() {
        ToolCallAudit.ToolOutcome outcome = new ToolCallAudit.ToolOutcome(
                "get_meals", "{\"scope\":[\"a\",\"b\"]}", "ok", "miert");

        TurnProvenance.Built built = TurnProvenance.build(List.of(outcome), DEFAULT_LIMITS);

        ToolCallsEnvelope.ToolCall ask = built.ask().calls().get(0);
        assertThat(ask.args()).isEqualTo("scope=[\"a\",\"b\"]");
    }

    /** A null-valued arg must render as an honest placeholder, never a bare {@code key=}. */
    @Test
    void nullValuedArgRendersAsHonestPlaceholderNotBareKey() {
        ToolCallAudit.ToolOutcome outcome = new ToolCallAudit.ToolOutcome(
                "get_meals", "{\"day\":null}", "ok", "miert");

        TurnProvenance.Built built = TurnProvenance.build(List.of(outcome), DEFAULT_LIMITS);

        ToolCallsEnvelope.ToolCall ask = built.ask().calls().get(0);
        assertThat(ask.args()).isEqualTo("day=(üres)");
    }

    @Test
    void jsonEncodedToolTextIsDecodedSoTheCardShowsRealNewlines() {
        // Spring AI serialises a String-returning tool, so the raw result arrives quoted with
        // escaped newlines — exactly what reached a production provenance card (mezo-rj214.7).
        String wireShape = "\"Napi étkezés-összesítők (utolsó 1 nap):\\n2026-09-19: 0/3221 kcal\"";

        TurnProvenance.Built built = TurnProvenance.build(
                List.of(new ToolCallAudit.ToolOutcome("get_fuel_log", "range=day", wireShape, "mai étkezés")),
                DEFAULT_LIMITS);

        String text = built.result().outcomes().getFirst().text();
        assertThat(text).isEqualTo("Napi étkezés-összesítők (utolsó 1 nap):\n2026-09-19: 0/3221 kcal");
        assertThat(text).doesNotContain("\\n").doesNotStartWith("\"");
    }

    @Test
    void plainTextIsLeftExactlyAsItIs() {
        TurnProvenance.Built built = TurnProvenance.build(
                List.of(new ToolCallAudit.ToolOutcome("get_sleep", "days=3", "Kedd óta 7,2 óra átlag.", null)),
                DEFAULT_LIMITS);

        assertThat(built.result().outcomes().getFirst().text()).isEqualTo("Kedd óta 7,2 óra átlag.");
    }

    @Test
    void aQuotedButUnparseableResultIsLeftAlone() {
        String notJson = "\"nyitó idézőjel, de nincs lezárva rendesen \\q\"";

        TurnProvenance.Built built = TurnProvenance.build(
                List.of(new ToolCallAudit.ToolOutcome("get_x", "", notJson, null)), DEFAULT_LIMITS);

        assertThat(built.result().outcomes().getFirst().text()).isEqualTo(notJson);
    }
}
