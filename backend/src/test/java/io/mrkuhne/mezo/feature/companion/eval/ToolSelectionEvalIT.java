package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.CaseOutcome;
import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.EvalReport;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Tool-SELECTION measurement harness (mezo-xixu; re-baselined for the OpenAI migration in
 * mezo-ozri.3, spec §S3) — a REPORT, not a pass/fail gate. {@code FakeCompanionLlm} only replays
 * scripted {@code [fake-tool:X]} sentinels, so it cannot measure selection; this IT runs the REAL
 * provider adapter over a representative Hungarian case set and reports selection accuracy, the
 * critical-wrong-tool count, JSON validity, latency and USD per successful action.
 *
 * <p><b>One property picks the model, and everything else follows it</b> ({@link EvalTarget}):
 * {@code -Dmezo.eval.model=gpt-5.6-luna} switches the provider, that provider's cheap tier AND the
 * API key the gate demands. Without it the incumbent {@code gemini-2.5-flash} is measured. The
 * money numbers are read back out of {@code llm_log_history}, which makes this run a live check of
 * the provider's own cost bookkeeping as well — a null {@code cost_usd} there is exactly the S2
 * streaming trap (spec §8.6).
 *
 * <p>Opt-in twice over: {@code @Tag("eval")} is excluded from the default {@code ./mvnw test} run
 * (the surefire {@code excludedGroups} in {@code pom.xml}, bound to the overridable
 * {@code mezo.excludedTestGroups} property so a literal POM value can't block the CLI override),
 * and {@link EvalApiKeyCondition} skips a keyless incumbent run while FAILING a keyless requested
 * one. Run explicitly:
 * {@code ./mvnw test -Dtest=ToolSelectionEvalIT -Dmezo.excludedTestGroups= [-Dmezo.eval.model=…]}.
 *
 * <p><b>Only the GENERATION rows count.</b> A chat turn also emits a Gemini embedding row (the
 * SHADOW memory mode embeds every turn, spec §4) whose model and price are identical whichever
 * chat model is under test; folding it into the numbers would add the same constant to every
 * candidate and would break the served-model check outright. It is logged separately instead.
 *
 * <p><b>Deliberately not {@code @Transactional}</b> (mezo-ozri.3): the audit write runs
 * {@code @Async} in a {@code REQUIRES_NEW} transaction, so an uncommitted test fixture is invisible
 * to it — and its rows would be invisible to us. {@code MemoryRetrievalDeterministicEvalIT} is
 * non-transactional for the same reason.
 *
 * <p>The advisor chain (V1.3 clinical guard + LLM verdict) is switched off here — it would add an
 * unrelated cheap-tier call (and possible retries) to every case, which is cost and noise for a
 * harness measuring tool selection specifically, not answer quality. The companion-fake profile is
 * deliberately NOT active: a real adapter must be the live {@code CompanionLlm} bean for the
 * measurement to mean anything.
 */
@Slf4j
@Tag("eval")
@ExtendWith(EvalApiKeyCondition.class)
@Timeout(value = 30, unit = TimeUnit.MINUTES)
@TestPropertySource(properties = {
        "mezo.feature.companion.enabled=true",
        "mezo.companion.advisors.enabled=false"
})
class ToolSelectionEvalIT extends AbstractIntegrationTest {

    private static final String CASES_RESOURCE = "companion/tool-selection-cases.json";
    private static final EvalTarget TARGET = EvalTarget.fromSystemProperties();
    private static final Path ARTIFACT_DIR = Path.of("target", "eval");

    /** The kinds a chat turn can bill on the model under test; embeddings and audio are not ours. */
    private static final EnumSet<CallKind> GENERATION_KINDS =
        EnumSet.of(CallKind.CHAT, CallKind.CHAT_STREAM, CallKind.SMART, CallKind.TOOL, CallKind.VISION);

    /**
     * The model under test drives the provider switch AND that provider's cheap tier, from one
     * property. Audio and vision stay on Gemini either way (spec §A1) — this suite sends neither.
     */
    @DynamicPropertySource
    static void evalModel(DynamicPropertyRegistry registry) {
        registry.add("mezo.companion.llm.provider", TARGET::providerKey);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".chat-model", TARGET::model);
    }

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private ObjectMapper objectMapper;

    /** One eval case: a HU question and the tool name(s) that legitimately answer it. */
    record Case(String id, String question, List<String> expectedTools, String note) {}

    /** One case's raw result before metrics: the tools it picked and the answer it wrote. */
    private record CaseRun(List<String> tools, String answer, boolean errored) {}

    @Test
    void testToolSelection_shouldMeasureTheCaseSetOnTheTargetModel_whenARealProviderAnswers() throws Exception {
        List<Case> cases = loadCases();
        assertThat(cases).isNotEmpty();
        UUID userId = databasePopulator.populateUser("tool-selection-eval@test.local");

        List<CaseOutcome> outcomes = new ArrayList<>();
        Map<String, String> answers = new LinkedHashMap<>();
        BigDecimal sideCostUsd = BigDecimal.ZERO;
        for (Case testCase : cases) {
            llmLogRepository.deleteAll();
            CaseRun run = runCase(userId, testCase);
            List<LlmLogEntity> rows = awaitLogRows();
            List<LlmLogEntity> generationRows = rows.stream()
                    .filter(row -> GENERATION_KINDS.contains(row.getCallKind())).toList();
            sideCostUsd = sideCostUsd.add(totalCostUsd(rows).subtract(totalCostUsd(generationRows)));
            outcomes.add(new CaseOutcome(testCase.id(), testCase.question(), testCase.expectedTools(),
                    run.tools(), totalLatencyMs(generationRows), totalCostUsd(generationRows),
                    !run.errored(), run.errored()));
            answers.put(testCase.id(), run.answer());
            assertServedModel(generationRows);
        }
        log.info("Provider-independent side calls (embedding, audio) cost ${} across the run", sideCostUsd);

        EvalReport report = ToolSelectionEvalMetrics.evaluate(TARGET.model(), outcomes);
        String markdown = EvalReportWriter.toMarkdown(report);
        log.info("\n{}", markdown);
        writeArtifacts(markdown, answers);

        // A REPORT, not a gate: the go/no-go decision is a human reading these numbers against the
        // incumbent's (spec §M2). What IS asserted is that the harness measured what it claims to.
        assertThat(outcomes).hasSameSizeAs(cases);
        assertThat(report.totalCostUsd()).isGreaterThan(BigDecimal.ZERO);
        assertThat(report.latencyP50()).isPositive();
    }

    /**
     * Every logged row of this run must come from the model under test — the trap the pre-S3 gate
     * hid: a provider switch that silently keeps answering from the incumbent still produces a
     * plausible-looking accuracy number, for the wrong model. Embedding and audio rows are already
     * filtered out by the caller — those legitimately stay on Gemini (spec §A1, §E1).
     */
    private void assertServedModel(List<LlmLogEntity> rows) {
        assertThat(rows).isNotEmpty();
        assertThat(rows).allSatisfy(row ->
            assertThat(row.getServedModel()).contains(TARGET.model()));
    }

    private List<LlmLogEntity> awaitLogRows() {
        Awaitility.await().atMost(Duration.ofSeconds(30))
            .until(() -> !llmLogRepository.findAll().isEmpty());
        return llmLogRepository.findAll();
    }

    private static long totalLatencyMs(List<LlmLogEntity> rows) {
        return rows.stream().mapToLong(LlmLogEntity::getLatencyMs).sum();
    }

    private static BigDecimal totalCostUsd(List<LlmLogEntity> rows) {
        return rows.stream()
            .map(row -> row.getCostUsd() == null ? BigDecimal.ZERO : row.getCostUsd())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void writeArtifacts(String markdown, Map<String, String> answers) throws Exception {
        Files.createDirectories(ARTIFACT_DIR);
        Files.writeString(ARTIFACT_DIR.resolve("tool-selection-" + TARGET.model() + ".md"), markdown);
        Files.writeString(ARTIFACT_DIR.resolve("answers-" + TARGET.model() + ".json"),
            objectMapper.writeValueAsString(Map.of("model", TARGET.model(), "answers", answers)));
        log.info("Eval artifacts written to {}", ARTIFACT_DIR.toAbsolutePath());
    }

    /** Fresh conversation per case (no shared history) — isolates each question's tool selection. */
    private CaseRun runCase(UUID userId, Case testCase) {
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        try {
            MessageResponse response = chatService.sendMessage(userId, conversation.getId(),
                    SendMessageRequest.builder().content(testCase.question()).build());
            AiMessageEntity assistant = messageRepository.findById(response.getId()).orElseThrow();
            List<String> tools = assistant.getToolCalls() == null
                    ? List.of()
                    : assistant.getToolCalls().calls().stream()
                        .map(ToolCallsEnvelope.ToolCall::name).distinct().toList();
            return new CaseRun(tools, assistant.getContent(), false);
        } catch (Exception e) {
            log.warn("Tool-selection eval case {} failed — counted as a miss AND an error", testCase.id(), e);
            return new CaseRun(List.of(), "", true);
        }
    }

    private List<Case> loadCases() throws Exception {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(CASES_RESOURCE)) {
            assertThat(in).as("classpath resource %s", CASES_RESOURCE).isNotNull();
            return objectMapper.readValue(in, new TypeReference<List<Case>>() {});
        }
    }
}
