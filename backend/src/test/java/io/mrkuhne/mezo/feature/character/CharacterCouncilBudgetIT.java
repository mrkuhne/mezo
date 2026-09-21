package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.character.service.CharacterCouncilBudget;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@TestPropertySource(properties = {"mezo.character.council-budget.cycle-calls=3",
        "mezo.character.council-budget.cycle-smart-calls=1",
        "mezo.character.council-budget.autonomous-daily-calls=2",
        "mezo.character.council-budget.total-daily-calls=3"})
class CharacterCouncilBudgetIT extends AbstractIntegrationTest {
    @Autowired private CharacterCouncilBudget budget;
    @Autowired private DatabasePopulator users;
    @Autowired private LlmCallContextHolder calls;
    @Autowired private PlatformTransactionManager transactions;

    private void call(UUID owner, boolean reply) {
        budget.run(owner, reply, () -> calls.runWith(new LlmCallContext("character", "quota-test", null, null), () -> "ok"));
    }

    @Test
    void testBudget_shouldReserveReplyAllocation_whenAutonomousAllowanceSpent() {
        var owner = users.populateUser("quota-allocation@test.local");
        call(owner, false); call(owner, false);
        assertThatThrownBy(() -> call(owner, false)).isInstanceOf(RuntimeException.class);
        call(owner, true);
        assertThatThrownBy(() -> call(owner, true)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void testBudget_shouldRetainCharge_whenDomainTransactionRollsBack() {
        var owner = users.populateUser("quota-rollback@test.local");
        var tx = new TransactionTemplate(transactions);
        tx.executeWithoutResult(status -> { call(owner, false); status.setRollbackOnly(); });
        call(owner, false);
        assertThatThrownBy(() -> call(owner, false)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void testBudget_shouldRejectCycleEvenWhenCallerSwallowsSmartRefusal() {
        var owner = users.populateUser("quota-smart@test.local");
        assertThatThrownBy(() -> budget.run(owner, true, () -> {
            calls.runWith(new LlmCallContext("character", "smart-one", null, null), true, () -> "ok");
            try { calls.runWith(new LlmCallContext("character", "smart-two", null, null), true, () -> "not-called"); }
            catch (RuntimeException ignored) { /* real pipelines isolate an individual expert */ }
            return "must not report success";
        })).isInstanceOf(RuntimeException.class);
        assertThat(io.mrkuhne.mezo.feature.llmlog.context.LlmCallQuota.capture()).isNull();
    }
}
