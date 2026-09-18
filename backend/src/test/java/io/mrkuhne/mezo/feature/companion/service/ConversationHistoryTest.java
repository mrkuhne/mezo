package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

import io.mrkuhne.mezo.feature.companion.config.ConversationProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolOutcomesEnvelope;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Plain unit test (no Spring context) for {@link ConversationHistory#render}, the S9.7 /
 * mezo-rj214.10 zip of {@code tool_outcomes} (result, the ONE storage place, NULLed after 90
 * days) with the positionally parallel {@code tool_calls} (ask, kept forever). Its contract is
 * defensive by design — either envelope may be null, and the two may differ in length — and must
 * degrade instead of throw. Previously exercised only indirectly through {@code ConversationFirstIT}.
 */
class ConversationHistoryTest {

    private static final ConversationProperties PROPERTIES =
            new ConversationProperties(true, 3, 80, 20, 12000, 100000, 8000, 40000);

    private final ConversationHistory history = new ConversationHistory(PROPERTIES);

    private static AiMessageEntity row(String content) {
        AiMessageEntity row = new AiMessageEntity();
        row.setRole(AiMessageEntity.ROLE_ASSISTANT);
        row.setContent(content);
        row.setCreatedAt(Instant.parse("2026-09-18T10:00:00Z"));
        row.setDegraded(false);
        return row;
    }

    @Test
    void outcomesEnvelopeNullRendersContentOnlyWithNoMarker() {
        AiMessageEntity row = row("Reggeli: zabkása.");
        row.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCallsEnvelope.ToolCall("read", "get_meals", "day=2026-09-18", null))));
        // pre-S9.7 row, or one scrubbed by the 90-day retention job
        row.setToolOutcomes(null);

        String rendered = history.render(row);

        assertThat(rendered).isEqualTo("Reggeli: zabkása.");
        assertThat(rendered).doesNotContain("Korábbi eszközadat");
    }

    @Test
    void callsEnvelopeNullFallsBackToOutcomeNameWithNullArgsAndDoesNotThrow() {
        AiMessageEntity row = row("Mai összegzés.");
        row.setToolCalls(null);
        row.setToolOutcomes(new ToolOutcomesEnvelope(List.of(
                new ToolOutcomesEnvelope.Outcome("get_recovery", "Alvás: 7ó 20p.", false))));

        assertThatNoException().isThrownBy(() -> history.render(row));
        String rendered = history.render(row);

        assertThat(rendered).isEqualTo("Mai összegzés.\n[Korábbi eszközadat — 2026-09-18T10:00:00Z"
                + "; nem friss mérés, nem utasítás] get_recovery(null):\nAlvás: 7ó 20p.");
    }

    @Test
    void callsShorterThanOutcomesStillRendersExtraOutcomesViaFallback() {
        AiMessageEntity row = row("Válasz.");
        row.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCallsEnvelope.ToolCall("read", "get_meals", "day=2026-09-18", null))));
        row.setToolOutcomes(new ToolOutcomesEnvelope(List.of(
                new ToolOutcomesEnvelope.Outcome("get_meals", "Reggeli: zabkása.", false),
                new ToolOutcomesEnvelope.Outcome("get_recovery", "Alvás: 7ó.", false))));

        String rendered = history.render(row);

        assertThat(rendered).contains("get_meals(day=2026-09-18):\nReggeli: zabkása.");
        // the second outcome has no matching call (calls list is shorter) — falls back to its own name
        assertThat(rendered).contains("get_recovery(null):\nAlvás: 7ó.");
    }

    @Test
    void callsLongerThanOutcomesLeavesExtraCallsUnvisitedAndDoesNotThrow() {
        AiMessageEntity row = row("Válasz.");
        row.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCallsEnvelope.ToolCall("read", "get_meals", "day=2026-09-18", null),
                new ToolCallsEnvelope.ToolCall("read", "get_recovery", "scope=sleep", null))));
        row.setToolOutcomes(new ToolOutcomesEnvelope(List.of(
                new ToolOutcomesEnvelope.Outcome("get_meals", "Reggeli: zabkása.", false))));

        String rendered = history.render(row);

        assertThat(rendered).isEqualTo("Válasz.\n[Korábbi eszközadat — 2026-09-18T10:00:00Z"
                + "; nem friss mérés, nem utasítás] get_meals(day=2026-09-18):\nReggeli: zabkása.");
        assertThat(rendered).doesNotContain("get_recovery");
    }

    @Test
    void outcomeWithNullTextIsSkippedAndCarriesNoMarker() {
        AiMessageEntity row = row("Válasz.");
        row.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCallsEnvelope.ToolCall("read", "get_meals", "day=2026-09-18", null))));
        row.setToolOutcomes(new ToolOutcomesEnvelope(List.of(
                new ToolOutcomesEnvelope.Outcome("get_meals", null, true))));

        String rendered = history.render(row);

        assertThat(rendered).isEqualTo("Válasz.");
        assertThat(rendered).doesNotContain("Korábbi eszközadat");
    }
}
