package io.mrkuhne.mezo.feature.companion.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope.ToolCall;
import io.mrkuhne.mezo.feature.companion.entity.ToolOutcomesEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolOutcomesEnvelope.Outcome;
import java.util.List;
import org.junit.jupiter.api.Test;

/** S9.7 (mezo-rj214.7): the ask ({@link ToolCallsEnvelope}) and result
 *  ({@link ToolOutcomesEnvelope}) envelopes are zipped BY INDEX onto the wire — see
 *  {@code CompanionMapper#toTools}. */
class CompanionMapperTest {

    private final CompanionMapper mapper = new CompanionMapperImpl();

    @Test
    void toTools_shouldCarryWhyOutcomeAndFailed_whenBothEnvelopesPresent() {
        var calls = new ToolCallsEnvelope(List.of(
                new ToolCall("read", "get_weight_trend", "weeks=2", "Súly trend ellenőrzése")));
        var outcomes = new ToolOutcomesEnvelope(List.of(
                new Outcome("get_weight_trend", "-0.4 kg / hét", false)));

        var tools = mapper.toTools(calls, outcomes);

        assertThat(tools).hasSize(1);
        assertThat(tools.get(0).getType()).isEqualTo("read");
        assertThat(tools.get(0).getName()).isEqualTo("get_weight_trend(weeks=2)");
        assertThat(tools.get(0).getWhy()).isEqualTo("Súly trend ellenőrzése");
        assertThat(tools.get(0).getOutcome()).isEqualTo("-0.4 kg / hét");
        assertThat(tools.get(0).getFailed()).isFalse();
    }

    @Test
    void toTools_shouldMarkFailedTrue_whenOutcomeFailed() {
        var calls = new ToolCallsEnvelope(List.of(new ToolCall("read", "get_recovery", "days=3", "Regeneráció")));
        var outcomes = new ToolOutcomesEnvelope(List.of(new Outcome("get_recovery", "időtúllépés", true)));

        var tools = mapper.toTools(calls, outcomes);

        assertThat(tools.get(0).getFailed()).isTrue();
        assertThat(tools.get(0).getOutcome()).isEqualTo("időtúllépés");
    }

    @Test
    void toTools_shouldOmitOutcomeAndFailFalse_whenResultEnvelopeIsNull_askOnlyRetentionScrubbed() {
        var calls = new ToolCallsEnvelope(List.of(
                new ToolCall("read", "get_weight_trend", "weeks=2", "Súly trend ellenőrzése")));

        var tools = mapper.toTools(calls, null);

        assertThat(tools).hasSize(1);
        assertThat(tools.get(0).getWhy()).isEqualTo("Súly trend ellenőrzése");
        assertThat(tools.get(0).getOutcome()).isNull();
        assertThat(tools.get(0).getFailed()).isFalse();
    }

    @Test
    void toTools_shouldOmitWhy_whenPreS97RowHasNoWhy() {
        var calls = new ToolCallsEnvelope(List.of(new ToolCall("read", "get_weight_trend", "weeks=2")));

        var tools = mapper.toTools(calls, null);

        assertThat(tools.get(0).getWhy()).isNull();
        assertThat(tools.get(0).getOutcome()).isNull();
        assertThat(tools.get(0).getFailed()).isFalse();
    }

    @Test
    void toTools_shouldToleratePositionally_whenOutcomesEnvelopeShorterThanCalls() {
        var calls = new ToolCallsEnvelope(List.of(
                new ToolCall("read", "get_weight_trend", "weeks=2", "Súly trend"),
                new ToolCall("read", "get_recovery", "days=3", "Regeneráció")));
        var outcomes = new ToolOutcomesEnvelope(List.of(new Outcome("get_weight_trend", "-0.4 kg", false)));

        var tools = mapper.toTools(calls, outcomes);

        assertThat(tools).hasSize(2);
        assertThat(tools.get(0).getOutcome()).isEqualTo("-0.4 kg");
        assertThat(tools.get(1).getWhy()).isEqualTo("Regeneráció");
        assertThat(tools.get(1).getOutcome()).isNull();
        assertThat(tools.get(1).getFailed()).isFalse();
    }

    @Test
    void toTools_shouldToleratePositionally_whenOutcomesEnvelopeLongerThanCalls() {
        var calls = new ToolCallsEnvelope(List.of(
                new ToolCall("read", "get_weight_trend", "weeks=2", "Súly trend")));
        var outcomes = new ToolOutcomesEnvelope(List.of(
                new Outcome("get_weight_trend", "-0.4 kg", false),
                new Outcome("get_recovery", "időtúllépés", true)));

        var tools = mapper.toTools(calls, outcomes);

        assertThat(tools).hasSize(1);
        assertThat(tools.get(0).getOutcome()).isEqualTo("-0.4 kg");
    }

    @Test
    void toTools_shouldReturnEmptyList_whenCallsEnvelopeIsNull() {
        assertThat(mapper.toTools(null, null)).isEmpty();
        assertThat(mapper.toTools(null, new ToolOutcomesEnvelope(List.of(new Outcome("x", "y", false)))))
                .isEmpty();
    }

    @Test
    void toMessageResponse_shouldPassBothEnvelopesToToTools() {
        var entity = new AiMessageEntity();
        entity.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCall("read", "get_recovery", "days=3", "Regeneráció ellenőrzése"))));
        entity.setToolOutcomes(new ToolOutcomesEnvelope(List.of(new Outcome("get_recovery", "jó", false))));

        var response = mapper.toMessageResponse(entity);

        assertThat(response.getTools()).hasSize(1);
        assertThat(response.getTools().get(0).getWhy()).isEqualTo("Regeneráció ellenőrzése");
        assertThat(response.getTools().get(0).getOutcome()).isEqualTo("jó");
    }
}
