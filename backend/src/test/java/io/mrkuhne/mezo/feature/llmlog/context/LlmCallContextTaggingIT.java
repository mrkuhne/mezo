package io.mrkuhne.mezo.feature.llmlog.context;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.MealCoachService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.service.HeartbeatGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import reactor.core.publisher.Flux;

/**
 * Caller-side tagging (mezo-2zyu, task 6): every LLM entry point wraps its port call in
 * {@link LlmCallContextHolder#runWith}, so the ambient {@link LlmCallContext} the adapter reads at
 * call time carries the feature/operation/entity attribution instead of {@link LlmCallContext#UNKNOWN}.
 *
 * <p>The assertion is made where it belongs — at the {@link CompanionLlm} port, on the SAME thread
 * and the SAME instant the real {@code GeminiCompanionLlm} reads the holder. A {@code @Primary}
 * capturing double stands in for the adapter; an end-to-end "one llm_log_history row" assertion is
 * impossible here because {@code FakeCompanionLlm} (profile {@code companion-fake}) never reaches
 * the recorder — only the real Gemini adapter does. The record → row mapping is covered by
 * {@code LlmLogWriterIT}.
 *
 * <p>Two representative sites are proven: one WITH an entity id ({@link MealCoachService}) and one
 * feature-only ({@link HeartbeatGenerator}). Every other tagged site applies the identical
 * mechanical wrapper.
 */
@ActiveProfiles("companion-fake")
@Import(LlmCallContextTaggingIT.CapturingLlmConfiguration.class)
class LlmCallContextTaggingIT extends AbstractIntegrationTest {

    /**
     * Stands in for the terminal adapter: reads the holder DURING the call, exactly where
     * {@code GeminiCompanionLlm} does.
     */
    static class CapturingCompanionLlm implements CompanionLlm {

        private final LlmCallContextHolder contextHolder;
        private LlmCallContext captured;
        private String answer = "Rendben, marad a tempó.";

        CapturingCompanionLlm(LlmCallContextHolder contextHolder) {
            this.contextHolder = contextHolder;
        }

        LlmCallContext captured() {
            return captured;
        }

        void answerWith(String answer) {
            this.answer = answer;
        }

        void reset() {
            this.captured = null;
        }

        @Override
        public String complete(String systemPrompt, String userMessage,
            List<ToolCallback> tools, Map<String, Object> toolContext) {
            captured = contextHolder.get();
            return answer;
        }

        @Override
        public Flux<String> stream(String systemPrompt, String userMessage,
            List<ToolCallback> tools, Map<String, Object> toolContext) {
            captured = contextHolder.get();
            return Flux.just(answer);
        }

        @Override
        public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
            captured = contextHolder.get();
            return answer;
        }

        @Override
        public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
            captured = contextHolder.get();
            return answer;
        }
    }

    @TestConfiguration
    static class CapturingLlmConfiguration {

        @Bean
        @Primary
        CapturingCompanionLlm capturingCompanionLlm(LlmCallContextHolder contextHolder) {
            return new CapturingCompanionLlm(contextHolder);
        }
    }

    @Autowired private CapturingCompanionLlm capturingCompanionLlm;
    @Autowired private MealCoachService mealCoachService;
    @Autowired private HeartbeatGenerator heartbeatGenerator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;

    @BeforeEach
    void resetCapture() {
        capturingCompanionLlm.reset();
    }

    @Test
    void testGenerateForMeal_shouldTagTheCallWithTheMealCoachContext_whenTheLlmIsCalled() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        LocalDate today = LocalDate.now();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "Zabpehely", today.plusMonths(6));
        MealEntity meal = mealPopulator.createScoredMeal(owner, item, today, "Zabkása",
            today.atTime(6, 15).toInstant(ZoneOffset.UTC));
        capturingCompanionLlm.answerWith("""
            {"meals":[{"mealId":"%s","tagline":"Jó reggeli","summary":"Rendben indul a nap.",
            "improve":[]}]}""".formatted(meal.getId()));

        mealCoachService.generateForMeal(owner, meal.getId());

        LlmCallContext captured = capturingCompanionLlm.captured();
        assertThat(captured).isNotNull().isNotEqualTo(LlmCallContext.UNKNOWN);
        assertThat(captured.feature()).isEqualTo("meal_coach");
        assertThat(captured.operation()).isEqualTo("verdict");
        assertThat(captured.entityKind()).isEqualTo("meal");
        assertThat(captured.entityId()).isEqualTo(meal.getId());
    }

    @Test
    void testGenerate_shouldTagTheCallWithTheHeartbeatFeature_whenNoEntityIsTheSubject() {
        UUID user = userPopulator.createUser("llm-tagging-heartbeat@test.local").getId();
        LocalDate day = LocalDate.now();
        dailySummaryPopulator.summary(user, day.minusDays(1), "Tegnapi nap összefoglaló.");
        capturingCompanionLlm.answerWith("Szép tempó, tartsd a vizet.");

        heartbeatGenerator.generate(user, day, HeartbeatNoteEntity.WINDOW_MIDDAY);

        LlmCallContext captured = capturingCompanionLlm.captured();
        assertThat(captured).isNotNull().isNotEqualTo(LlmCallContext.UNKNOWN);
        assertThat(captured.feature()).isEqualTo("proactive_heartbeat");
        assertThat(captured.operation()).isEqualTo("generate");
        assertThat(captured.entityKind()).isNull();
        assertThat(captured.entityId()).isNull();
    }
}
