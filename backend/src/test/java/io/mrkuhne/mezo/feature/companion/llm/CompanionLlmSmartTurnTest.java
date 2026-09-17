package io.mrkuhne.mezo.feature.companion.llm;

import static io.mrkuhne.mezo.feature.companion.CompanionLlm.Role.USER;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import reactor.core.publisher.Flux;

class CompanionLlmSmartTurnTest {

    /** Records what the default implementation forwarded, so we can assert the contract. */
    private static final class RecordingLlm implements CompanionLlm {
        private final List<String> systemPrompts = new ArrayList<>();
        private final List<List<Turn>> histories = new ArrayList<>();
        private final List<Integer> toolCounts = new ArrayList<>();

        @Override
        public String complete(String systemPrompt, List<Turn> history, String userMessage,
                               List<ToolCallback> tools, Map<String, Object> toolContext) {
            systemPrompts.add(systemPrompt);
            histories.add(history);
            toolCounts.add(tools.size());
            return "ok";
        }

        @Override
        public Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                                   List<ToolCallback> tools, Map<String, Object> toolContext) {
            systemPrompts.add(systemPrompt);
            histories.add(history);
            toolCounts.add(tools.size());
            return Flux.just("ok");
        }

        @Override
        public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
            throw new UnsupportedOperationException();
        }

        @Override
        public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
            throw new UnsupportedOperationException();
        }
    }

    @Test
    void testCompleteSmart_shouldJoinHalvesAndCarryNoTools_whenTheDefaultIsInherited() {
        RecordingLlm llm = new RecordingLlm();
        List<CompanionLlm.Turn> history = List.of(new CompanionLlm.Turn(USER, "korábbi"));

        llm.completeSmart("HANG", "KONTEXTUS", history, "Szia!");

        assertThat(llm.systemPrompts).containsExactly("HANGKONTEXTUS");
        assertThat(llm.histories).containsExactly(history);
        assertThat(llm.toolCounts).containsExactly(0);
    }

    @Test
    void testStreamSmart_shouldJoinHalvesAndCarryNoTools_whenTheDefaultIsInherited() {
        RecordingLlm llm = new RecordingLlm();

        llm.streamSmart("HANG", "KONTEXTUS", List.of(), "Szia!").blockLast();

        assertThat(llm.systemPrompts).containsExactly("HANGKONTEXTUS");
        assertThat(llm.toolCounts).containsExactly(0);
    }

    @Test
    void testCompleteSmart_shouldTolerateABlankContext_whenThereIsNoVolatileHalf() {
        RecordingLlm llm = new RecordingLlm();

        llm.completeSmart("HANG", "", List.of(), "Szia!");

        assertThat(llm.systemPrompts).containsExactly("HANG");
    }
}
