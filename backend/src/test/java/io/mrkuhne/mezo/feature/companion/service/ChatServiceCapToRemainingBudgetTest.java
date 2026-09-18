package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CharacterPromptSource;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.advisor.CompanionAdvisorChain;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.memory.service.ChatMemoryContextAdapter;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfilePromptAssembler;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionPromptBlock;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionReplyRecorder;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import tools.jackson.databind.ObjectMapper;

/**
 * Unit coverage for {@link ChatService#capToRemainingBudget} — the only behaviour under test, so
 * every other collaborator is a bare Mockito mock the method never touches (mirrors
 * {@code CompanionPropertiesFixtures}' "fail loudly instead of reading a default" stance).
 */
class ChatServiceCapToRemainingBudgetTest {

    private final ChatService chatService = new ChatService(
        mock(AiConversationRepository.class),
        mock(AiMessageRepository.class),
        mock(ConversationService.class),
        mock(ContextSnapshotAssembler.class),
        mock(KnowledgeFactService.class),
        mock(ChatMemoryContextAdapter.class),
        mock(ObjectProvider.class),
        mock(ObjectProvider.class),
        mock(WeekContextRenderer.class),
        mock(ObjectProvider.class),
        mock(ObjectProvider.class),
        mock(CompanionLlm.class),
        mock(ObjectProvider.class),
        mock(CompanionToolRegistry.class),
        CompanionPropertiesFixtures.withMaxCallsPerTurn(2),
        mock(CompanionMapper.class),
        mock(ApplicationEventPublisher.class),
        mock(LlmCallContextHolder.class),
        mock(PromptPersona.class),
        mock(TurnGearRouter.class),
        mock(TurnPlanner.class),
        mock(PlanExecutor.class),
        mock(TurnAnswerer.class),
        mock(ConversationTurnService.class),
        mock(io.mrkuhne.mezo.feature.companion.config.ConversationProperties.class),
        mock(ConversationHistory.class),
        mock(PersonalBaselineContext.class),
        new ObjectMapper());

    private static TurnPlan.PlanStep step(String tool, String why) {
        return new TurnPlan.PlanStep(tool, Map.of(), why);
    }

    @Test
    void testCapToRemainingBudget_shouldCarryTheStepsWhy_onASyntheticDroppedOutcome() {
        ValidatedPlan plan = new ValidatedPlan(
            List.of(step("get_goal", "cél"), step("get_recovery", "hogy lássam a mai étkezést")),
            List.of());
        ToolCallAudit audit = new ToolCallAudit(15, 10);
        audit.recordCall("already_called", "{}"); // 1 of maxCallsPerTurn=2 already spent -> remaining=1

        ChatService.CappedPlan capped = chatService.capToRemainingBudget(plan, audit);

        assertThat(capped.plan().steps()).extracting(TurnPlan.PlanStep::tool).containsExactly("get_goal");
        assertThat(capped.dropped()).hasSize(1);
        ToolCallAudit.ToolOutcome dropped = capped.dropped().getFirst();
        assertThat(dropped.name()).isEqualTo("get_recovery");
        assertThat(dropped.result()).isEqualTo(RecordingToolCallback.BUDGET_EXHAUSTED);
        assertThat(dropped.why()).isEqualTo("hogy lássam a mai étkezést");
    }
}
