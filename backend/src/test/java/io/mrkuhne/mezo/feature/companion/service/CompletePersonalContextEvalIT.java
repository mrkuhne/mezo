package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.eval.EvalApiKeyCondition;
import io.mrkuhne.mezo.feature.companion.eval.EvalTarget;
import io.mrkuhne.mezo.feature.companion.llm.GeminiEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContextItem;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.PreparedMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.companion.memory.service.MemorySourceRepairService;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.ObjectMapper;

/** Real chat + real Gemini hybrid retrieval on synthetic records; no production accounts or text. */
@Tag("eval")
@ExtendWith(EvalApiKeyCondition.class)
@Timeout(value = 20, unit = TimeUnit.MINUTES)
@TestPropertySource(properties = {
        "mezo.companion.conversation.enabled=true",
        "mezo.companion.advisors.enabled=false",
        "mezo.companion.memory-platform.serving-mode=NEW"
})
class CompletePersonalContextEvalIT extends AbstractIntegrationTest {
    private static final EvalTarget TARGET = EvalTarget.fromSystemProperties();
    private static final String TOPIC = "borókakerti séta";
    private static final String LAST_SENTENCE = "A sárga iránytűt végül a hetedik diófa tövében hagytam.";

    @DynamicPropertySource
    static void model(DynamicPropertyRegistry registry) {
        registry.add("mezo.companion.llm.provider", TARGET::providerKey);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".smart-model", TARGET::model);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".chat-model", TARGET::model);
    }

    @Autowired private ChatService chat;
    @Autowired private EmbeddingPort embedding;
    @Autowired private CompanionProperties companionProperties;
    @Autowired private MemoryPlatformProperties memoryProperties;
    @Autowired private MemorySourceRepairService repair;
    @Autowired private MemoryContextService memory;
    @Autowired private MemoryItemRepository items;
    @Autowired private MemoryRetrievalRunRepository runs;
    @Autowired private DatabasePopulator users;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private BiometricProfilePopulator profiles;
    @Autowired private WeightLogPopulator weights;
    @Autowired private GoalPopulator goals;
    @Autowired private JournalPopulator journals;
    @Autowired private ObjectMapper json;

    record Run(UUID id, String queryMode, String query, String rewrittenQuery, long millis,
               String error, Map<String, Object> retrieverTrace) {}
    record Probe(String question, PreparedMemoryQuery preparedQuery, List<MemoryContextItem> selected,
                 UUID retrievalRunId, Map<String, Object> retrieverTrace, long millis, String error) {}
    record Turn(int index, String question, String answer, List<String> tools, Boolean degraded,
                Object recalledProvenance, List<Run> retrievalRuns, long millis, String error) {}

    @Test
    void testConversation_shouldRecallWholeHistoricalSourceAndPersonalBaseline_whenRealProvidersRequested()
            throws Exception {
        assertThat(System.getenv("GEMINI_API_KEY")).as("Real embedding eval requires GEMINI_API_KEY").isNotBlank();
        assertThat(embedding).isInstanceOf(GeminiEmbeddingAdapter.class);
        LocalDate today = LocalDate.now();
        UUID user = users.populateUser("synthetic-complete-personal-context@test.local");
        var profile = profiles.create(user);
        int age = Period.between(profile.getBirthDate(), today).getYears();
        weights.createWeightLog(user, today.minusDays(1), new BigDecimal("83.26"));
        goals.createGoalFull(user, today.minusDays(7), today.plusDays(60), null, null, null, null);
        LocalDate journalDate = today.minusDays(75);
        String padding = "A kertben figyeltem a felhőket, a madarakat és a fák lassú mozgását. ".repeat(100);
        String source = padding.substring(0, 4200) + "\nA " + TOPIC
                + " alatt megnyugtatott, hogy húsz percre kikapcsoltam a telefonomat. " + LAST_SENTENCE;
        var journal = journals.createEntry(user, journalDate, source, JournalEntryEntity.SOURCE_QUICKINPUT);
        var conversation = conversations.conversation(user);
        Path output = Path.of("target/eval/complete-personal-context-"
                + TARGET.model().replaceAll("[^A-Za-z0-9._-]", "_") + ".json");
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("model", TARGET.model());
        report.put("embeddingModel", companionProperties.embedding().model());
        report.put("retrievalExecution", memoryProperties.execution());
        report.put("sourceChunkCharacters", companionProperties.embedding().embedMaxChars());
        report.put("syntheticUserId", user);
        report.put("sourceId", journal.getId());
        report.put("sourceDate", journalDate);
        report.put("sourceCharacters", source.length());
        report.put("expectedLastSentence", LAST_SENTENCE);
        List<Probe> probes = new ArrayList<>();
        List<Turn> turns = new ArrayList<>();
        report.put("retrievalProbes", probes);
        report.put("turns", turns);
        save(output, report);

        long repairStarted = System.currentTimeMillis();
        int repaired = LlmActorContext.runAsCaptured(user, () -> repair.repair(user, today, 20));
        int chunks = items.findByCreatedByAndSourceKindAndSourceIdOrderByChunkIndex(
                user, "journal_entry", journal.getId()).size();
        report.put("repairedSources", repaired);
        report.put("canonicalChunks", chunks);
        report.put("repairMillis", System.currentTimeMillis() - repairStarted);
        save(output, report);

        String recallQuestion = "Mi segített megnyugodni a borókakerti séta során a régi naplómban?";
        probes.add(probe(user, conversation.getId(), recallQuestion, List.of()));
        save(output, report);
        probes.add(probe(user, conversation.getId(), "És akkor mi segített?", List.of(
                new CompanionLlm.Turn(CompanionLlm.Role.USER, recallQuestion),
                new CompanionLlm.Turn(CompanionLlm.Role.ASSISTANT,
                        "A régi naplódban említett borókakerti sétáról beszélünk."))));
        save(output, report);

        List<String> questions = List.of(
                "A profilom szerint hány éves vagyok, milyen magas, milyen nemű, és mi a testsúlycélom?",
                recallQuestion,
                "Kérlek, olvasd vissza az eredeti naplóbejegyzést, és idézd szó szerint az utolsó mondatát.",
                "Most váltsunk témát: írj hárommondatos mesét egy könyvtáros polipról.");
        for (int index = 0; index < questions.size(); index++) {
            String question = questions.get(index);
            var before = auditRuns(user).stream().map(Run::id).toList();
            long started = System.currentTimeMillis();
            String answer = "";
            List<String> used = List.of();
            Boolean degraded = null;
            Object recalled = List.of();
            String error = "";
            try {
                // gear-audited: continuity, long-source hydration and a deliberate general-topic switch.
                var reply = LlmActorContext.runAsCaptured(user, () -> chat.sendMessage(user, conversation.getId(),
                        SendMessageRequest.builder().content(question).build()));
                answer = reply.getContent();
                used = reply.getTools().stream().map(tool -> tool.getName()).toList();
                degraded = reply.getDegraded();
                recalled = reply.getRecalled();
            } catch (RuntimeException failure) {
                error = failure.getClass().getSimpleName();
            }
            turns.add(new Turn(index, question, answer, used, degraded, recalled,
                    auditRuns(user).stream().filter(run -> !before.contains(run.id())).toList(),
                    System.currentTimeMillis() - started, error));
            save(output, report);
        }

        // Keep the report even when quality or provider reliability fails the eval.
        assertThat(repaired).isPositive();
        assertThat(chunks).isGreaterThanOrEqualTo(3);
        assertThat(probes).allSatisfy(probe -> {
            assertThat(probe.error()).as(probe.question()).isNullOrEmpty();
            assertThat(probe.retrievalRunId()).isNotNull();
            assertThat(probe.selected()).anySatisfy(item -> {
                assertThat(item.sourceId()).isEqualTo(journal.getId());
                assertThat(item.content()).contains(TOPIC);
            });
        });
        assertThat(turns).allSatisfy(turn -> {
            assertThat(turn.error()).as(turn.question()).isEmpty();
            assertThat(turn.answer()).isNotBlank();
            assertThat(turn.degraded()).as(turn.question()).isFalse();
        });
        assertThat(turns.getFirst().answer().toLowerCase()).contains("180", String.valueOf(age), "férfi", "80", "fogy");
        assertThat(turns.get(2).answer()).contains(LAST_SENTENCE);
    }

    private Probe probe(UUID user, UUID conversation, String question, List<CompanionLlm.Turn> history) {
        long started = System.currentTimeMillis();
        try {
            var result = LlmActorContext.runAsCaptured(user, () -> memory.retrieveDetailed(
                    new MemoryRequest(user, ConsumerPolicy.CHAT_AMBIENT, question, history,
                            LocalDate.now(), 1200, conversation, false),
                    MemoryContextService.RetrieveOptions.audited(RetrievalServingMode.NEW)));
            return new Probe(question, result.query(), result.context().items(), result.runId(),
                    result.retrieverTrace(), System.currentTimeMillis() - started, result.errorCode());
        } catch (RuntimeException failure) {
            return new Probe(question, null, List.of(), null, Map.of(),
                    System.currentTimeMillis() - started, failure.getClass().getSimpleName());
        }
    }

    private List<Run> auditRuns(UUID user) {
        return runs.findByCreatedByOrderByCreatedAtDesc(user, PageRequest.of(0, 100)).stream()
                .map(run -> new Run(run.getId(), run.getQueryMode(), run.getRawQuery(), run.getRewrittenQuery(),
                        run.getDurationMs(), run.getErrorCode(), run.getRetrieverTrace())).toList();
    }

    private void save(Path output, Map<String, Object> report) throws Exception {
        Files.createDirectories(output.getParent());
        Files.writeString(output, json.writerWithDefaultPrettyPrinter().writeValueAsString(report));
    }
}
