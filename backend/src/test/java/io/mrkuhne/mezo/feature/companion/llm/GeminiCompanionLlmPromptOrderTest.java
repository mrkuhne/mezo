package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm.Role;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Advisors;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.AmbientRecall;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Chat;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Consolidation;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Embedding;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Extraction;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Facts;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Graph;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.HabitSuggest;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Hypotheses;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Llm;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Patterns;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.PatternPair;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Recall;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Snapshot;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Summary;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Tools;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Transcription;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.feature.llmlog.service.NoOpLlmCallRecorder;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.prompt.Prompt;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A Spring AI prompt-SORRENDJE nem fedhető le integrációs teszttel: az ITs a companion-fake
 * profilon futnak, ahol ez a bean nem is létezik, a fake echója pedig a HÍVÓ összeállítását
 * bizonyítja, nem a ChatClient üzenetlistáját. Egy Promptot rögzítő ChatModel stub az egyetlen
 * mód, hogy hálózat nélkül lássuk, mit küld ki az adapter (mezo-q71s).
 *
 * <p>{@code CompanionProperties} egy validált record (nincs no-arg konstruktora és nincs kész
 * teszt-fixture rá) — a minimal() helper közvetlenül példányosítja az összes beágyazott rekordot,
 * egyetlen {@link PatternPair} bejegyzéssel (a {@code pairs} lista {@code @NotEmpty}). A
 * {@link NoOpLlmCallRecorder} a repo meglévő no-op audit-recordere (nincs {@code LlmCallRecorder.NO_OP}
 * konstans).
 */
class GeminiCompanionLlmPromptOrderTest {

    /** Rögzíti a kimenő Promptot, és egy fix választ ad vissza. */
    private static final class CapturingChatModel implements ChatModel {
        private final AtomicReference<Prompt> captured = new AtomicReference<>();

        @Override
        public ChatResponse call(Prompt prompt) {
            captured.set(prompt);
            return new ChatResponse(List.of(new Generation(new AssistantMessage("ok"))));
        }
    }

    @Test
    void testComplete_shouldOrderSystemThenHistoryThenUser_whenHistoryIsGiven() {
        CapturingChatModel chatModel = new CapturingChatModel();
        LlmCallContextHolder contextHolder = new LlmCallContextHolder();
        GeminiCompanionLlm adapter = new GeminiCompanionLlm(
                chatModel,
                new LlmModelRouter(minimalCompanionProperties(), contextHolder),
                new NoOpLlmCallRecorder(),
                contextHolder,
                new GoogleGenAiUsageExtractor());

        adapter.complete("RENDSZER", List.of(
                new Turn(Role.USER, "korábbi kérdés"),
                new Turn(Role.ASSISTANT, "korábbi válasz")), "mostani kérdés", List.of(), Map.of());

        List<Message> sent = chatModel.captured.get().getInstructions();
        assertThat(sent).extracting(Message::getMessageType).containsExactly(
                MessageType.SYSTEM, MessageType.USER, MessageType.ASSISTANT, MessageType.USER);
        assertThat(sent.get(0).getText()).isEqualTo("RENDSZER");
        assertThat(sent.get(1).getText()).isEqualTo("korábbi kérdés");
        assertThat(sent.get(2).getText()).isEqualTo("korábbi válasz");
        assertThat(sent.get(3).getText()).isEqualTo("mostani kérdés");
    }

    /**
     * mezo-ozri.5: the volatile half of the instructions must land AFTER the history and
     * immediately before the user's turn — behind the provider's cacheable prefix (stable system
     * message + tool definitions + closed history), never inside it.
     */
    @Test
    void testComplete_shouldPlaceTurnContextAfterHistoryAndBeforeUser_whenTurnContextIsGiven() {
        CapturingChatModel chatModel = new CapturingChatModel();
        LlmCallContextHolder contextHolder = new LlmCallContextHolder();
        GeminiCompanionLlm adapter = adapter(chatModel, contextHolder, new NoOpLlmCallRecorder());

        adapter.complete("RENDSZER", "[Ma] friss adat", List.of(
                new Turn(Role.USER, "korábbi kérdés"),
                new Turn(Role.ASSISTANT, "korábbi válasz")), "mostani kérdés", List.of(), Map.of());

        List<Message> sent = chatModel.captured.get().getInstructions();
        assertThat(sent).extracting(Message::getMessageType).containsExactly(
                MessageType.SYSTEM, MessageType.USER, MessageType.ASSISTANT,
                MessageType.SYSTEM, MessageType.USER);
        assertThat(sent.get(0).getText()).isEqualTo("RENDSZER");
        assertThat(sent.get(3).getText()).isEqualTo("[Ma] friss adat");
        assertThat(sent.get(4).getText()).isEqualTo("mostani kérdés");
    }

    /** A blank volatile half reproduces the pre-split shape exactly — one system message. */
    @Test
    void testComplete_shouldSendOneSystemMessage_whenTurnContextIsBlank() {
        CapturingChatModel chatModel = new CapturingChatModel();
        LlmCallContextHolder contextHolder = new LlmCallContextHolder();
        GeminiCompanionLlm adapter = adapter(chatModel, contextHolder, new NoOpLlmCallRecorder());

        adapter.complete("RENDSZER", "  ", List.of(), "mostani kérdés", List.of(), Map.of());

        assertThat(chatModel.captured.get().getInstructions())
                .extracting(Message::getMessageType)
                .containsExactly(MessageType.SYSTEM, MessageType.USER);
    }

    /**
     * The audit row keeps showing every instruction the model got, in the order it got them — the
     * split is a transport detail, not a change to what the log can prove (mezo-ozri.5).
     */
    @Test
    void testComplete_shouldRecordStablePromptAndTurnContextJoined_whenTurnContextIsGiven() {
        CapturingChatModel chatModel = new CapturingChatModel();
        LlmCallContextHolder contextHolder = new LlmCallContextHolder();
        List<LlmCallRecord> recorded = new ArrayList<>();
        GeminiCompanionLlm adapter = adapter(chatModel, contextHolder, recorded::add);

        adapter.complete("RENDSZER", "[Ma] friss adat", List.of(), "kérdés", List.of(), Map.of());

        assertThat(recorded).hasSize(1);
        assertThat(recorded.get(0).systemPrompt()).isEqualTo("RENDSZER[Ma] friss adat");
    }

    private static GeminiCompanionLlm adapter(CapturingChatModel chatModel,
                                              LlmCallContextHolder contextHolder,
                                              LlmCallRecorder recorder) {
        return new GeminiCompanionLlm(
                chatModel,
                new LlmModelRouter(minimalCompanionProperties(), contextHolder),
                recorder,
                contextHolder,
                new GoogleGenAiUsageExtractor());
    }

    /** Egy szolgáltató tiere, model-override nélkül (mezo-ozri.4). */
    private static Llm.Tier tier(String chatModel, String smartModel) {
        return new Llm.Tier(chatModel, smartModel, Map.of(), Map.of(),
                new Llm.Tier.ReasoningEffort(null, null));
    }

    /** A legkisebb valid {@link CompanionProperties} — minden constraint kielégítve. */
    private static CompanionProperties minimalCompanionProperties() {
        return new CompanionProperties(
                new Llm(LlmProvider.GEMINI, tier("gemini-2.5-flash", "gemini-2.5-pro"),
                        tier("gpt-5.6-luna", "gpt-5.6-terra"), Map.of()),
                new Chat(20, 80),
                new Snapshot(7, 200, 180, 12, 3),
                new Tools(15, 30, 26, 10),
                new Facts(10, 3),
                new Extraction(true, 3),
                new Advisors(true, 1, List.of("teszt-anyag")),
                new Embedding("gemini-embedding-001", true, 2000, true, 80, 200),
                new Summary("0 20 2 * * *", 7, 200),
                new Consolidation("0 30 3 * * MON", "0 50 3 1 * *", 8, 3),
                new Recall(90, 5, 0.25, 20, 300),
                new Patterns("0 40 2 * * *", 60, 8, 3, 7, 100, List.of(minimalPatternPair())),
                new Hypotheses(0.75, 0.50),
                new HabitSuggest(5),
                new CompanionProperties.LifegoalPropose(5),
                new Transcription(5_242_880, List.of("audio/wav")),
                new AmbientRecall(true, 30, 1200, true,
                        new AmbientRecall.Group(2, 0.55, 90),
                        new AmbientRecall.Group(2, 0.55, 180),
                        new AmbientRecall.Group(2, 0.60, 90),
                        new AmbientRecall.Group(1, 0.55, 90),
                        new AmbientRecall.Group(1, 0.55, 90)),
                new Graph(2, 8, 0.99, 0.05, 800, 6, 0.4, "0 20 3 * * *", 30, 0.05, 8),
                List.of());
    }

    private static PatternPair minimalPatternPair() {
        return new PatternPair(
                "sleep-quality~next-day-training-rpe",
                "physiology",
                "Alvás -> edzés-RPE",
                "Jobb alvás, könnyebb edzés",
                "Teszt mechanizmus.",
                "Jobban alszol, ha...?",
                "positive",
                "Teszt pozitív magyarázat.",
                "Teszt negatív magyarázat.",
                MetricKey.SLEEP_QUALITY,
                MetricKey.TRAINING_RPE,
                1);
    }
}
