package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LifeGoalDimension;
import io.mrkuhne.mezo.api.dto.LifeGoalFrame;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Runs against the companion-fake LLM profile (the test context's default).
 *
 * <p>Sentinel channel note (task-5 correction over the brief): the fake LLM's
 * {@code [fake-lifegoal-propose:…]} sentinel is planted in {@code whyText}, not {@code title} — the
 * contract caps {@code title} at 120 chars ({@code LifeGoalProposeRequest}), too tight for a
 * scripted JSON payload, while {@code whyText} allows 600. The adapter's user-message context
 * carries both fields ({@code [Cél]\n<title>\n[Miért]\n<whyText>\n…}), so {@code FakeCompanionLlm}
 * still matches the sentinel regardless of which field it rides in. {@code title} stays
 * {@code "Kockahas"} in every test — a health keyword for {@code LifeGoalTemplateProposer}'s
 * keyword match — while checking that none of the scripted {@code whyText} payloads below happen
 * to also contain a dimension keyword that would collide with the assertion under test.
 */
@ActiveProfiles("companion-fake")
class LifeGoalProposeIT extends ApiIntegrationTest {

    @Test
    void testPropose_shouldReturnAiProposal_whenFakeAnswersDefault() {
        LifeGoalProposeResponse res = postForBody("/api/life-goals/propose",
            LifeGoalProposeRequest.builder().title("Kockahas").whyText("hogy jól nézzek ki").build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProposeResponse.class);
        assertThat(res.getSource()).isEqualTo(LifeGoalProposeResponse.SourceEnum.AI);
        assertThat(res.getDimension()).isEqualTo(LifeGoalDimension.HEALTH);
        assertThat(res.getFrame()).isEqualTo(LifeGoalFrame.EXTRINSIC);
        assertThat(res.getPillars()).hasSize(1);
        assertThat(res.getPillars().get(0).getSource().getKey()).isEqualTo("SLEEP_DURATION_H");
        assertThat(res.getPillars().get(0).getRule().getWindowDays()).isEqualTo(7);
        assertThat(res.getIfThenPlans()).hasSize(1);
        assertThat(res.getIfThenPlans().get(0).getTrigger().getSource()).isEqualTo("sport_session_logged");
    }

    @Test
    void testPropose_shouldFallBackToTemplate_whenFakeAnswerBroken() {
        LifeGoalProposeResponse res = postForBody("/api/life-goals/propose",
            LifeGoalProposeRequest.builder().title("Kockahas").whyText("[fake-lifegoal-propose:not-json]").build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProposeResponse.class);
        assertThat(res.getSource()).isEqualTo(LifeGoalProposeResponse.SourceEnum.TEMPLATE);
        assertThat(res.getDimension()).isEqualTo(LifeGoalDimension.HEALTH);
        assertThat(res.getPillars()).hasSize(4);
    }

    @Test
    void testPropose_shouldDropUnknownCatalogId_whenFakeScriptsOne() {
        String script = "[fake-lifegoal-propose:{\"dimension\":\"health\",\"frame\":\"intrinsic\",\"pillars\":["
            + "{\"catalogId\":\"nope\",\"label\":\"X\",\"kind\":\"average\",\"skillKey\":\"recovery\",\"weight\":1},"
            + "{\"catalogId\":\"protein\",\"label\":\"Fehérje\",\"kind\":\"average\",\"skillKey\":\"cooking\",\"weight\":1,\"threshold\":160,\"comparator\":\"gte\"}],"
            + "\"obstacles\":[],\"plans\":[]}]";
        LifeGoalProposeResponse res = postForBody("/api/life-goals/propose",
            LifeGoalProposeRequest.builder().title("Kockahas").whyText(script).build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProposeResponse.class);
        assertThat(res.getSource()).isEqualTo(LifeGoalProposeResponse.SourceEnum.AI);
        assertThat(res.getPillars()).hasSize(1);
        assertThat(res.getPillars().get(0).getLabel()).isEqualTo("Fehérje");
    }
}
