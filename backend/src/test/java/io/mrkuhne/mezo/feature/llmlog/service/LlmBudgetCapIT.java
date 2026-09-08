package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.companion.llm.LlmModelRouter;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * The per-user rolling USD cap end to end (mezo-ozri.6, spec §C1): the three graded steps fire in
 * order as ONE account's logged spend climbs, and every threshold comes from properties rather than
 * from code — the bd acceptance criteria, in one file.
 *
 * <p>The ceiling is pinned to $1.00 here purely so the arithmetic reads as cents instead of a table
 * of fractions; the shipped ceiling is $5.00. That the numbers can be pinned AT ALL, from properties
 * and without a recompile, is itself half of what this test asserts.
 */
@TestPropertySource(properties = {
    "mezo.feature.llm-log.enabled=true",
    "mezo.llm-log.budget.enabled=true",
    "mezo.llm-log.budget.hard-cap-usd=1.00",
    "mezo.llm-log.budget.cycle-days=30",
    "mezo.llm-log.budget.degrade-at-percent=70",
    "mezo.llm-log.budget.throttle-cron-at-percent=90",
    "mezo.llm-log.budget.stop-at-percent=100",
    "mezo.llm-log.budget.throttled-features[0]=proactive_memoir",
    "mezo.companion.llm.openai.chat-model=gpt-5.6-luna",
    "mezo.companion.llm.openai.smart-model=gpt-5.6-terra"
})
class LlmBudgetCapIT extends AbstractIntegrationTest {

    private static final LlmCallContext CHAT = new LlmCallContext("companion_chat", "turn", null, null);
    private static final LlmCallContext MEMOIR = new LlmCallContext("proactive_memoir", "generate", null, null);

    @Autowired private LlmBudgetService llmBudgetService;
    @Autowired private LlmCallContextHolder llmCallContextHolder;
    @Autowired private LlmModelRouter llmModelRouter;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private void spend(UUID user, String usd) {
        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-terra", 1000, 100,
            null, new BigDecimal(usd));
    }

    private String modelOfASmartCall() {
        return llmCallContextHolder.runWith(CHAT,
            () -> llmModelRouter.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART));
    }

    /**
     * The whole ladder on ONE account and ONE fixture, in order: full service, then the cheap-tier
     * fallback, then the suspended generator, then the pause. Split into four tests this would still
     * pass with a threshold comparison that reads the wrong way round, because each test would only
     * ever see its own state. Each step lands EXACTLY on its threshold, so the ladder also pins the
     * inclusivity: "70% spent" is already the degraded state, not the last comfortable one.
     */
    @Test
    void testCap_shouldActivateTheThreeStepsInOrder_whenOneUserSpendsThroughTheCeiling() {
        UUID user = userPopulator.createUser("llm-budget-cap@test.hu").getId();

        LlmActorContext.runAs(user, () -> {
            // --- below every threshold: full service, and a smart call still gets the smart model
            spend(user, "0.50");
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.OK);
            assertThat(modelOfASmartCall()).isEqualTo("gpt-5.6-terra");

            // --- 70%: the call still goes out, on the cheap tier
            spend(user, "0.20"); // $0.70 = EXACTLY 70%: the thresholds are inclusive
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.DEGRADED);
            assertThat(modelOfASmartCall()).isEqualTo("gpt-5.6-luna");

            // --- 90%: the expensive generator is suspended; the user's own turn is not
            spend(user, "0.20"); // $0.90 = EXACTLY 90%
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.THROTTLED);
            assertThatThrownBy(() -> llmCallContextHolder.runWith(MEMOIR, () -> "generated"))
                .isInstanceOf(SystemRuntimeErrorException.class);
            assertThat(llmCallContextHolder.runWith(CHAT, () -> "answered")).isEqualTo("answered");

            // --- 100%: everything the cap can see is refused until the window rolls
            spend(user, "0.10"); // $1.00 = EXACTLY the ceiling — spent, not "nearly spent"
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.STOPPED);
            assertThatThrownBy(() -> llmCallContextHolder.runWith(CHAT, () -> "answered"))
                .isInstanceOf(SystemRuntimeErrorException.class);
        });
    }

    /**
     * The ceiling is PER ACCOUNT. If a second user's exhausted budget cost the first one anything,
     * "per-user cap" would be a global cap wearing the wrong name.
     */
    @Test
    void testCap_shouldNotLeakAcrossAccounts_whenAnotherUserIsExhausted() {
        UUID spender = userPopulator.createUser("llm-budget-spender@test.hu").getId();
        UUID quiet = userPopulator.createUser("llm-budget-quiet@test.hu").getId();
        spend(spender, "5.00");

        assertThat(levelAs(quiet)).isEqualTo(LlmBudgetLevel.OK);
        assertThat(levelAs(spender)).isEqualTo(LlmBudgetLevel.STOPPED);
    }

    /**
     * Background traffic nobody can be billed for is never capped: there is no account to measure it
     * against, and failing it would break the work for a reason no user could be told.
     */
    @Test
    void testCap_shouldStayOpen_whenTheCallHasNoActor() {
        assertThat(llmCallContextHolder.runWith(CHAT, () -> "answered")).isEqualTo("answered");
    }

    /** The exempt list wins over an exhausted ceiling — the owner's replay must stay usable. */
    @Test
    void testCap_shouldStayOpenForExemptFeatures_whenTheCeilingIsSpent() {
        UUID user = userPopulator.createUser("llm-budget-exempt@test.hu").getId();
        spend(user, "5.00");

        LlmActorContext.runAs(user, () -> assertThat(llmCallContextHolder.runWith(
            new LlmCallContext(LlmCallContext.FEATURE_ADMIN_REPLAY, "replay", null, null),
            () -> "replayed")).isEqualTo("replayed"));
    }

    private LlmBudgetLevel levelAs(UUID user) {
        AtomicReference<LlmBudgetLevel> seen = new AtomicReference<>();
        LlmActorContext.runAs(user, () -> seen.set(llmBudgetService.levelFor("companion_chat")));
        return seen.get();
    }
}
