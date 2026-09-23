package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.eval.EvalApiKeyCondition;
import io.mrkuhne.mezo.feature.companion.eval.EvalTarget;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.data.domain.PageRequest;
import tools.jackson.databind.ObjectMapper;

/** Synthetic-only, opt-in prose comparison. Neither arm writes a message or dispatches a push. */
@Tag("eval")
@EnabledIfSystemProperty(named = "mezo.eval.contextual-feed", matches = "true")
@ExtendWith(EvalApiKeyCondition.class)
@TestPropertySource(properties = "mezo.feature.contextual-feed.enabled=true")
@Timeout(value = 20, unit = java.util.concurrent.TimeUnit.MINUTES)
class ContextualFeedProviderEvalIT extends AbstractIntegrationTest {
    private static final EvalTarget TARGET = EvalTarget.fromSystemProperties();
    @DynamicPropertySource
    static void model(DynamicPropertyRegistry registry) {
        registry.add("mezo.companion.llm.provider", TARGET::providerKey);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".chat-model", TARGET::model);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".smart-model", TARGET::model);
    }
    @Autowired private ObjectMapper json;
    @Autowired private UserPopulator users;
    @Autowired private CompanionMessagePopulator messages;
    @Autowired private WeightLogPopulator weights;
    @Autowired private CheckInPopulator checkins;
    @Autowired private io.mrkuhne.mezo.support.populator.GoalPopulator goals;
    @Autowired private io.mrkuhne.mezo.support.populator.SleepLogPopulator sleeps;
    @Autowired private io.mrkuhne.mezo.support.populator.SleepGoalPopulator sleepGoals;
    @Autowired private io.mrkuhne.mezo.support.populator.TrainPopulator training;
    @Autowired private io.mrkuhne.mezo.support.populator.WaterLogPopulator water;
    @Autowired private CompanionMessageRepository repository;
    @Autowired private FeedGenerationService generator;
    @Autowired private FeedContextAssembler context;
    @Autowired private FeedEvidenceAssembler evidence;
    @Autowired private CompanionLlm llm;
    @Autowired private PromptPersona persona;
    @Autowired private LlmCallContextHolder calls;
    @Autowired private LlmLogRepository logs;
    record Result(String id, String kind, String arm, String model, String answer, Object trace,
                  long millis, BigDecimal costUsd, String error) { }

    @Test
    void testProvider_shouldCaptureComparableOutputs_whenExplicitlyEnabled() throws Exception {
        String selection = System.getProperty("mezo.eval.contextual-feed.cases", "");
        var selectedIds = java.util.Set.of(selection.split(","));
        var cases = List.of(json.readValue(getClass().getResourceAsStream("/eval/contextual-feed/cases.json"),
                ContextualFeedEvaluationIT.Case[].class)).stream()
                .filter(c -> selection.isBlank() || selectedIds.contains(c.id())).toList();
        assertThat(cases).isNotEmpty();
        if (!selection.isBlank()) assertThat(cases).hasSize(selectedIds.size());
        var output = Path.of("target/eval/contextual-feed-" + TARGET.model() + (selection.isBlank() ? "" : "-selected") + ".json");
        Files.createDirectories(output.getParent());
        var results = new ArrayList<Result>();
        for (var c : cases) {
            var user = users.createUser().getId();
            var date = LocalDate.parse(c.date());
            if (!c.prior().isBlank()) messages.createMessage(user, date.minusDays(1), c.kind(), "Tegnap",
                    List.of(c.prior()), Instant.parse(c.date() + "T00:00:00Z").minusSeconds(86400));
            if (c.id().equals("rising-weight")) {
                weights.createWeightLog(user, date.minusDays(60), new BigDecimal("95.0"));
                weights.createWeightLog(user, date.minusDays(30), new BigDecimal("88.0"));
            }
            for (int i = 0; i < c.weights().size(); i++) weights.createWeightLog(user,
                    date.minusDays(c.weights().size() - i - 1), new BigDecimal(c.weights().get(i)));
            checkins.createCheckIn(user, date, "06:30", 4, 2, c.context());
            if (c.id().equals("goal-switch")) goals.createGoal(user, "active");
            if (c.kind().equals("sleep")) {
                sleeps.createSleepLog(user, date.minusDays(2), new BigDecimal("5.8"), 5);
                sleeps.createSleepLog(user, date.minusDays(1), new BigDecimal("5.5"), 5);
                sleeps.createSleepLog(user, date, new BigDecimal("5.4"), 4);
            }
            if (c.kind().equals("hydration")) {
                sleepGoals.goal(user);
                training.createGymSlot(user, date.getDayOfWeek().getValue() - 1, "18:00");
                water.createWaterLog(user, date, 400);
            }
            long before = repository.count();
            // Deliberately generous control: old instructions receive the SAME rich evidence/history.
            // This isolates the editorial change; it does not pretend to replay production latency.
            String payload = context.assemble(user, date, Instant.now(), c.kind(),
                    evidence.render(user, date, c.kind()) + "\n" + c.context()).text();
            for (String arm : List.of("legacy-prompt-control", "contextual")) {
                Instant start = Instant.now();
                String answer = "";
                Object trace = null;
                String error = null;
                try {
                    if (arm.equals("contextual")) {
                        var result = LlmActorContext.runAsCaptured(user, () -> generator.generate(user, date, c.kind(), c.context()));
                        if (result == null) error = "unusable_response";
                        else { answer = json.writeValueAsString(result.envelope()); trace = result.trace(); }
                    } else {
                        answer = LlmActorContext.runAsCaptured(user, () -> calls.runWith(
                                new LlmCallContext("proactive_feed", c.kind() + "_baseline", null, null),
                                () -> llm.complete(persona.render(user, baseline(c.kind())), payload)));
                    }
                } catch (RuntimeException e) { error = e.getClass().getSimpleName(); }
                if (error == null) org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10))
                        .until(() -> !logs.findByCreatedByAndFeatureAndOperationAndCreatedAtAfterOrderByCreatedAtDesc(user,
                                "proactive_feed", c.kind() + (arm.equals("contextual") ? "" : "_baseline"),
                                start, PageRequest.of(0, 30)).isEmpty());
                var entries = logs.findByCreatedByAndFeatureAndOperationAndCreatedAtAfterOrderByCreatedAtDesc(user,
                        "proactive_feed", c.kind() + (arm.equals("contextual") ? "" : "_baseline"), start, PageRequest.of(0, 30));
                var costs = entries.stream().map(e -> e.getCostUsd()).filter(java.util.Objects::nonNull).toList();
                BigDecimal cost = costs.isEmpty() ? null : costs.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
                results.add(new Result(c.id(), c.kind(), arm, TARGET.model(), answer, trace,
                        java.time.Duration.between(start, Instant.now()).toMillis(), cost, error));
                Files.writeString(output, json.writerWithDefaultPrettyPrinter().writeValueAsString(results));
            }
            assertThat(repository.count()).isEqualTo(before);
        }
        assertThat(results).hasSize(cases.size() * 2).allSatisfy(r -> {
            assertThat(r.error()).as(r.id() + "/" + r.arm()).isNull();
            assertThat(r.answer()).isNotBlank();
        });
    }
    private String baseline(String kind) {
        return switch (kind) {
            case "weight" -> CompanionMessageGenerator.WEIGHT_PROMPT;
            case "sleep" -> CompanionMessageGenerator.SLEEP_PROMPT;
            case "morning" -> CompanionMessageGenerator.MORNING_PROMPT;
            case "people" -> CompanionMessageGenerator.PEOPLE_PROMPT;
            case "advice" -> AdviceProseGenerator.ADVICE_PROMPT;
            case "hydration" -> "Írd le egy rövid magyar bekezdésben a naplózott vízmennyiséget, az időarányos és napi célt.";
            default -> CompanionMessageGenerator.WINDOW_PROMPT;
        };
    }
}
