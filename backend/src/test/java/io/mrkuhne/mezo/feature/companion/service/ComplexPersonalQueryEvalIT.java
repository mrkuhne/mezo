package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.eval.EvalApiKeyCondition;
import io.mrkuhne.mezo.feature.companion.eval.EvalTarget;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.ObjectMapper;

/** Real-provider replay of the natural production question on isolated synthetic fixtures. */
@Tag("eval")
@ExtendWith(EvalApiKeyCondition.class)
@Timeout(value = 10, unit = TimeUnit.MINUTES)
@TestPropertySource(properties = {
        "mezo.companion.conversation.enabled=true",
        "mezo.companion.advisors.enabled=false"
})
class ComplexPersonalQueryEvalIT extends AbstractIntegrationTest {
    private static final EvalTarget TARGET = EvalTarget.fromSystemProperties();
    private static final String QUESTION = "A tegnapi kajám meg a legutóbbi edzésem alapján jó úton vagyok a súlycélom felé? Min változtassak ma?";
    @DynamicPropertySource
    static void model(DynamicPropertyRegistry registry) {
        registry.add("mezo.companion.llm.provider", TARGET::providerKey);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".smart-model", TARGET::model);
        registry.add("mezo.companion.llm." + TARGET.providerKey() + ".chat-model", TARGET::model);
    }
    @Autowired private ChatService chat;
    @Autowired private DatabasePopulator users;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private GoalPopulator goals;
    @Autowired private GoalRepository goalRepository;
    @Autowired private WeightLogPopulator weights;
    @Autowired private TrainPopulator train;
    @Autowired private MealPopulator meals;
    @Autowired private ObjectMapper json;
    @Autowired private io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository logs;

    record AuditCall(String operation, java.util.UUID owner, int millis, BigDecimal costUsd) {}

    @Test
    void testConversation_shouldReadLatestMeaningfulWorkoutAndDatedWeights_whenNaturalQuestionIsAsked() throws Exception {
        var user = users.populateUser("complex-eval@test.local");
        var today = LocalDate.now();
        var goal = goals.createGoal(user, "maintain", "active");
        goal.setTitle("Rekompozíció");
        goal.setStartDate(today.minusDays(12));
        goal.setTargetDate(today.plusDays(44));
        goal.setStartWeightKg(new BigDecimal("83"));
        goal.setRateTargetPctPerWeek(BigDecimal.ZERO);
        goalRepository.saveAndFlush(goal);
        weights.createWeightLog(user, today.minusDays(25), new BigDecimal("85"));
        weights.createWeightLog(user, today.minusDays(14), new BigDecimal("82.8"));
        weights.createWeightLog(user, today.minusDays(7), new BigDecimal("83.3"));
        weights.createWeightLog(user, today.minusDays(4), new BigDecimal("84.3"));
        weights.createWeightLog(user, today.minusDays(3), new BigDecimal("85.1"));
        weights.createWeightLog(user, today.minusDays(2), new BigDecimal("85.1"));
        weights.createWeightLog(user, today.minusDays(1), new BigDecimal("85.2"));
        weights.createWeightLog(user, today, new BigDecimal("85.6"));
        var meso = train.createMesocycle(user, "Erő és izom", "active");
        var template = train.createWorkoutSession(user, meso.getId(), "Hát-bicepsz", "pull", 0, "planned");
        for (int ago : List.of(20, 16, 12, 8, 1)) {
            var session = train.createWorkoutInstance(user, template, today.minusDays(ago), "completed");
            var ex = train.createExercise(user, session.getId(), "Lehúzás csigán", 0);
            for (int set = 0; set < 5; set++) train.createLoggedSet(user, ex.getId(), session.getId(), set, "50", 10, 0, Instant.now());
        }
        train.createWorkoutInstance(user, template, today, "completed");
        for (String slot : List.of("breakfast", "lunch", "dinner")) {
            meals.createMealWithItems(user, today.minusDays(1), slot, today.minusDays(1).atTime(12, 0)
                    .atZone(java.time.ZoneId.systemDefault()).toInstant(), List.of(
                    new MealPopulator.Line("Teszt főétel", "900", "50", "80", "40", (short) 1),
                    new MealPopulator.Line("Teszt kiegészítő", "330", "18", "44", "13", (short) 1)));
        }
        var conversation = conversations.conversation(user);
        long started = System.currentTimeMillis();
        var answer = LlmActorContext.runAsCaptured(user, () -> chat.sendMessage(user, conversation.getId(),
                SendMessageRequest.builder().content(QUESTION).build()));
        Path output = Path.of("target/complex-personal-query-eval.json");
        Files.writeString(output, json.writeValueAsString(Map.of("question", QUESTION, "model", TARGET.model(),
                "millis", System.currentTimeMillis() - started, "answer", answer,
                "llmCalls", logs.findAll().stream().filter(row -> conversation.getId().equals(row.getEntityId()))
                        .map(row -> new AuditCall(row.getOperation(), row.getCreatedBy(), row.getLatencyMs(), row.getCostUsd())).toList())));
        assertThat(answer.getDegraded()).isFalse();
        assertThat(answer.getTools().stream().map(tool -> tool.getName().split("\\(")[0]).toList())
                .contains("get_goal", "get_fuel_log", "get_training_log");
        assertThat(answer.getContent()).isNotBlank();
        // Numerical/causal interpretation is assessed against the saved answer and evidence,
        // not by keyword matching a free-form model response.
    }
}
