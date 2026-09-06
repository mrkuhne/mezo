package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalExtractor;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalExtractor.ExtractedSignal;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import reactor.core.publisher.Flux;
import tools.jackson.databind.ObjectMapper;

/**
 * Reflexió S1 (mezo-eq85.1): the extractor's defensive-parsing contract. Plain JUnit — the LLM is
 * a hand-written stub returning a canned answer, so the whole "Gemini phrases, code decides" rule
 * (unsure ⇒ no numbers, unknown topic dropped, out-of-range clamped, broken answer ⇒ no signal)
 * is pinned without a Spring context.
 */
class TextSignalExtractorTest {

    private static TextSignalExtractor extractorReturning(String answer) {
        CompanionLlm llm = new CompanionLlm() {
            @Override
            public String complete(String systemPrompt, List<Turn> history, String userMessage,
                                   List<ToolCallback> tools, Map<String, Object> toolContext) {
                return answer;
            }

            @Override
            public Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                                       List<ToolCallback> tools, Map<String, Object> toolContext) {
                return Flux.just(answer);
            }

            @Override
            public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
                return answer;
            }

            @Override
            public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
                return answer;
            }
        };
        return new TextSignalExtractor(llm, new ObjectMapper(), new LlmCallContextHolder());
    }

    private static TextSignalExtractor throwingExtractor() {
        CompanionLlm llm = new CompanionLlm() {
            @Override
            public String complete(String systemPrompt, List<Turn> history, String userMessage,
                                   List<ToolCallback> tools, Map<String, Object> toolContext) {
                throw new IllegalStateException("provider down");
            }

            @Override
            public Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                                       List<ToolCallback> tools, Map<String, Object> toolContext) {
                return Flux.error(new IllegalStateException("provider down"));
            }

            @Override
            public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
                throw new IllegalStateException("provider down");
            }

            @Override
            public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
                throw new IllegalStateException("provider down");
            }
        };
        return new TextSignalExtractor(llm, new ObjectMapper(), new LlmCallContextHolder());
    }

    @Test
    void testExtract_shouldParseNumbersPeopleTopics_whenAnswerIsValidJson() {
        TextSignalExtractor extractor = extractorReturning(
                "{\"mood\":4,\"energy\":3,\"stress\":2,\"confidence\":\"sure\",\"people\":[\"Anna\"],"
                        + "\"topics\":[\"kapcsolatok\",\"ismeretlen\"],\"keywords\":[\"séta\"]}");
        ExtractedSignal signal = extractor
                .extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "Annával sétáltunk")
                .orElseThrow();
        assertThat(signal.mood()).isEqualTo(4);
        assertThat(signal.energy()).isEqualTo(3);
        assertThat(signal.stress()).isEqualTo(2);
        assertThat(signal.confidence()).isEqualTo("sure");
        assertThat(signal.people()).containsExactly("Anna");
        assertThat(signal.topics()).containsExactly("kapcsolatok"); // unknown topic dropped
        assertThat(signal.keywords()).containsExactly("séta");
    }

    @Test
    void testExtract_shouldDropNumbers_whenUnsure() {
        ExtractedSignal signal = extractorReturning(
                "{\"mood\":4,\"energy\":2,\"stress\":1,\"confidence\":\"unsure\",\"people\":[],"
                        + "\"topics\":[],\"keywords\":[]}")
                .extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "ok")
                .orElseThrow();
        assertThat(signal.mood()).isNull();
        assertThat(signal.energy()).isNull();
        assertThat(signal.stress()).isNull();
        assertThat(signal.confidence()).isEqualTo("unsure");
    }

    @Test
    void testExtract_shouldBeEmpty_whenAnswerIsNotJson() {
        assertThat(extractorReturning("nem tudom")
                .extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "x")).isEmpty();
    }

    @Test
    void testExtract_shouldClampOutOfRange_whenModelOvershoots() {
        ExtractedSignal signal = extractorReturning(
                "{\"mood\":9,\"energy\":0,\"confidence\":\"sure\",\"people\":[],\"topics\":[],\"keywords\":[]}")
                .extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "x")
                .orElseThrow();
        assertThat(signal.mood()).isEqualTo(5);
        assertThat(signal.energy()).isEqualTo(1);
    }

    @Test
    void testExtract_shouldBeEmpty_whenTextIsBlank() {
        assertThat(extractorReturning("{\"mood\":4,\"confidence\":\"sure\"}")
                .extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "   ")).isEmpty();
    }

    @Test
    void testExtract_shouldBeEmpty_whenTheCallThrows() {
        assertThat(throwingExtractor()
                .extract(UUID.randomUUID(), "journal_entry", UUID.randomUUID(), "x")).isEmpty();
    }
}
