package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Proves the {@code LifeGoalProposeLlmAdapter} system prompt is rendered through {@link
 * PromptPersona} before it reaches the LLM (mezo-qw37.6, a Table A row the S6 plan's
 * {@code grep -rn "Daniel"} inventory missed — the lifegoal slice landed on main after Table A was
 * written). The {@link FakeCompanionLlm#LIFEGOAL_PROPOSE_SYSTEM_ECHO} sentinel planted in
 * {@code whyText} (the adapter's user-message context carries it verbatim) makes the fake answer
 * with the VALID default proposal whose {@code frameNote} is the prompt's persona line — the one
 * field the adapter passes through untouched — so the assertion bites on a dropped
 * {@code promptPersona.render(...)} call.
 */
@ActiveProfiles("companion-fake")
class LifeGoalProposeNameIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalProposePort proposePort;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testPropose_shouldNameTheUser_whenSystemPromptIsRendered() {
        AppUserEntity user = userPopulator.createUser("lifegoal-name@test.local");
        user.setName("Anna");
        userPopulator.save(user);

        Optional<LifeGoalProposePort.Proposal> proposal = proposePort.propose(user.getId(), "Kockahas",
                "hogy jól nézzek ki " + FakeCompanionLlm.LIFEGOAL_PROPOSE_SYSTEM_ECHO,
                "sleep_duration · Alvás (average)", Set.of("recovery"));

        assertThat(proposal).isPresent();
        assertThat(proposal.get().frameNote())
                .contains("Anna életcél-tervezője vagy")
                .doesNotContain(PromptPersona.NAME_TOKEN)
                .doesNotContain("Daniel");
    }
}
