package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;

import java.util.Map;

class RecordingToolCallbackTest {

    private static ToolCallback stub(String name, String result, boolean throwing) {
        return new ToolCallback() {
            @Override
            public ToolDefinition getToolDefinition() {
                return ToolDefinition.builder().name(name).description("stub").inputSchema("{}").build();
            }

            @Override
            public String call(String toolInput) {
                return call(toolInput, null);
            }

            @Override
            public String call(String toolInput, ToolContext toolContext) {
                if (throwing) {
                    // simulates an arbitrary downstream failure inside a tool read
                    throw new IllegalStateException("boom");
                }
                return result;
            }
        };
    }

    @Test
    void testCall_shouldRecordCompactArgsAndDelegate_whenWithinBudget() {
        ToolCallAudit audit = new ToolCallAudit(2, 10);
        RecordingToolCallback cb = new RecordingToolCallback(stub("get_sleep", "OK", false), audit);
        String out = cb.call("{\"days\":7}", new ToolContext(Map.of()));
        assertThat(out).isEqualTo("OK");
        assertThat(audit.toToolCallsEnvelope().calls().getFirst().args()).isEqualTo("days=7");
    }

    @Test
    void testCall_shouldSoftFailWithoutRecording_whenBudgetExhausted() {
        ToolCallAudit audit = new ToolCallAudit(1, 10);
        RecordingToolCallback cb = new RecordingToolCallback(stub("get_sleep", "OK", false), audit);
        cb.call("{}", new ToolContext(Map.of()));
        String out = cb.call("{}", new ToolContext(Map.of()));
        assertThat(out).isEqualTo(RecordingToolCallback.BUDGET_EXHAUSTED);
        assertThat(audit.callCount()).isEqualTo(1);
    }

    @Test
    void testCall_shouldReturnHonestErrorText_whenDelegateThrows() {
        ToolCallAudit audit = new ToolCallAudit(6, 10);
        RecordingToolCallback cb = new RecordingToolCallback(stub("get_sleep", null, true), audit);
        String out = cb.call("{}", new ToolContext(Map.of()));
        assertThat(out).isEqualTo(RecordingToolCallback.TOOL_FAILED);
        assertThat(audit.callCount()).isEqualTo(1); // the attempt IS audited
    }

    @Test
    void testCompactArgs_shouldFlattenScalars_andHandleBlank() {
        assertThat(RecordingToolCallback.compactArgs("{\"days\":7}")).isEqualTo("days=7");
        assertThat(RecordingToolCallback.compactArgs("{\"weeks\":2,\"x\":\"a\"}")).isEqualTo("weeks=2, x=a");
        assertThat(RecordingToolCallback.compactArgs("")).isEmpty();
        assertThat(RecordingToolCallback.compactArgs(null)).isEmpty();
        assertThat(RecordingToolCallback.compactArgs("{}")).isEmpty();
    }
}
