package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * Spec §L1's documented consequence, made explicit and testable (bd mezo-ozri.6): with the audit log
 * off nothing is recorded, so the cap has nothing to read and is INERT — an account far past the
 * ceiling still gets full service.
 *
 * <p>Fail-closed was considered in the brainstorm and rejected: a ceiling that blocks everything the
 * moment its own measurement is switched off turns one config mistake into a total outage. Turning
 * the audit log off IS turning the cap off, and {@link LlmBudgetService} says so once at WARN rather
 * than letting it be a silent surprise.
 */
@TestPropertySource(properties = {
    "mezo.feature.llm-log.enabled=false",
    "mezo.llm-log.budget.enabled=true",
    "mezo.llm-log.budget.hard-cap-usd=1.00"
})
class LlmBudgetLogDisabledIT extends AbstractIntegrationTest {

    @Autowired private LlmBudgetService llmBudgetService;
    @Autowired private LlmCallContextHolder llmCallContextHolder;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testCap_shouldStayInert_whenTheAuditLogIsDisabled() {
        UUID user = userPopulator.createUser("llm-budget-blind@test.hu").getId();
        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-terra", 1000, 100,
            null, new BigDecimal("99.00"));

        LlmActorContext.runAs(user, () -> {
            assertThat(llmBudgetService.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.OK);
            assertThat(llmCallContextHolder.runWith(
                new LlmCallContext("companion_chat", "turn", null, null), () -> "answered"))
                .isEqualTo("answered");
        });
    }
}
