package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.companion.tools.ToolContexts;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * V0.1 smoke IT (mezo-fnnq.1): the CompanionLlm port streams end to end through the
 * profile-gated deterministic fake — no network, no live LLM (spec §6).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.companion.enabled=true")
class CompanionLlmFakeIT extends AbstractIntegrationTest {

    @Autowired private CompanionLlm companionLlm;

    @Test
    void testWiring_shouldPickFakeAdapter_whenFakeProfileActive() {
        assertThat(companionLlm).isInstanceOf(FakeCompanionLlm.class);
    }

    @Test
    void testComplete_shouldEchoBothPromptHalves_whenCalled() {
        String result = companionLlm.complete("rendszer-prompt", "szia mezo");

        assertThat(result)
            .startsWith(FakeCompanionLlm.PREFIX)
            .contains("system=[rendszer-prompt]")
            .contains("user=[szia mezo]");
    }

    @Test
    void testStream_shouldEmitDeterministicChunksInOrder_whenCalled() {
        List<String> chunks = companionLlm.stream("rendszer-prompt", "szia mezo")
            .collectList()
            .block();

        assertThat(chunks).containsExactly(
            FakeCompanionLlm.PREFIX,
            " system=[rendszer-prompt]",
            " user=[szia mezo]");
    }

    /** Stub callback for the sentinel tests — echoes the raw args it was called with. */
    private static ToolCallback stubTool(String name) {
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
                return "ALVAS-OK args=" + toolInput;
            }
        };
    }

    @Test
    void testComplete_shouldExecuteScriptedToolAndEchoResult_whenSentinelPresent() {
        String out = companionLlm.complete("SYS", "kérdés [fake-tool:get_sleep {\"days\":3}]",
            List.of(stubTool("get_sleep")),
            Map.of(ToolContexts.USER_ID, UUID.randomUUID(), ToolContexts.AUDIT, new ToolCallAudit(6, 10)));

        assertThat(out)
            .contains("system=[SYS]")
            .contains("tool:get_sleep=[ALVAS-OK args={\"days\":3}]");
    }

    @Test
    void testStream_shouldEmitToolResultChunk_whenSentinelPresent() {
        List<String> chunks = companionLlm.stream("SYS", "[fake-tool:get_sleep]",
                List.of(stubTool("get_sleep")),
                Map.of(ToolContexts.USER_ID, UUID.randomUUID(), ToolContexts.AUDIT, new ToolCallAudit(6, 10)))
            .collectList()
            .block();

        assertThat(chunks).last().asString().isEqualTo(" tool:get_sleep=[ALVAS-OK args={}]");
    }

    @Test
    void testComplete_shouldEchoUnknown_whenSentinelNamesMissingTool() {
        String out = companionLlm.complete("SYS", "[fake-tool:get_reta_cycle]", List.of(), Map.of());

        assertThat(out).contains("tool:get_reta_cycle=[UNKNOWN]");
    }

    @Test
    void testComplete_shouldReturnMealSentinelJson_whenUserTextCarriesIt() {
        String json = "{\"slot\":\"lunch\",\"items\":[]}";
        String answer = companionLlm.complete("SYS", "ettem valamit [fake-meal:" + json + "]");
        assertThat(answer).isEqualTo(json);
    }

    @Test
    void testCompleteMultimodal_shouldReturnMealSentinelJson_whenImageBytesCarryIt() {
        String json = "{\"slot\":\"dinner\",\"items\":[]}";
        byte[] fakePhoto = ("[fake-meal:" + json + "]").getBytes(StandardCharsets.UTF_8);
        String answer = companionLlm.complete("SYS", "", fakePhoto, "image/jpeg");
        assertThat(answer).isEqualTo(json);
    }

    @Test
    void testCompleteMultimodal_shouldFallBackToEcho_whenNoSentinel() {
        String answer = companionLlm.complete("SYS", "user text", new byte[] {1, 2, 3}, "image/jpeg");
        assertThat(answer).startsWith("FAKE-LLM");
    }
}
