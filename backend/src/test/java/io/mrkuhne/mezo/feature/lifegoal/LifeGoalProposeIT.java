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

    /** A valid pillar, so the AI branch stays "usable" (an empty pillar list falls back to the template). */
    private static final String PROTEIN =
        "{\"catalogId\":\"protein\",\"label\":\"Fehérje\",\"kind\":\"average\",\"skillKey\":\"cooking\",\"weight\":1,\"threshold\":160,\"comparator\":\"gte\"}";

    private static String script(String pillars, String obstacles, String plans) {
        return "[fake-lifegoal-propose:{\"dimension\":\"health\",\"frame\":\"intrinsic\",\"pillars\":[" + pillars
            + "],\"obstacles\":[" + obstacles + "],\"plans\":[" + plans + "]}]";
    }

    private LifeGoalProposeResponse propose(String script) {
        return postForBody("/api/life-goals/propose",
            LifeGoalProposeRequest.builder().title("Kockahas").whyText(script).build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProposeResponse.class);
    }

    // mezo-iizd.1 final review, item 6: the propose response feeds the create request VERBATIM,
    // and LifeGoalUpsertRequest caps ifThenPlans/pillars at maxItems: 5 — an over-produced plan
    // list would answer 200 here and then 400 the wizard's save, dead-ending it.
    @Test
    void testPropose_shouldClampPlansAndObstaclesToFive_whenFakeOverProduces() {
        StringBuilder plans = new StringBuilder();
        StringBuilder obstacles = new StringBuilder();
        for (int i = 0; i < 7; i++) {
            plans.append(i == 0 ? "" : ",").append("{\"ha\":\"h").append(i).append("\",\"akkor\":\"a").append(i).append("\"}");
            obstacles.append(i == 0 ? "" : ",").append("\"o").append(i).append("\"");
        }
        LifeGoalProposeResponse res = propose(script(PROTEIN, obstacles.toString(), plans.toString()));

        assertThat(res.getSource()).isEqualTo(LifeGoalProposeResponse.SourceEnum.AI);
        assertThat(res.getIfThenPlans()).hasSize(5);
        assertThat(res.getObstacles()).hasSize(5);
    }

    // Item 6: the model's strings are truncated to the schema maxima (ha/akkor 240, label 80).
    @Test
    void testPropose_shouldTruncateStringsToSchemaMaxima_whenFakeOverruns() {
        String longHa = "h".repeat(250);
        String longLabel = "L".repeat(90);
        String pillar = "{\"catalogId\":\"protein\",\"label\":\"" + longLabel
            + "\",\"kind\":\"average\",\"skillKey\":\"cooking\",\"weight\":1}";
        LifeGoalProposeResponse res = propose(script(pillar, "", "{\"ha\":\"" + longHa + "\",\"akkor\":\"b\"}"));

        assertThat(res.getPillars().get(0).getLabel()).hasSize(80);
        assertThat(res.getIfThenPlans().get(0).getHa()).hasSize(240);
    }

    // mezo-iizd.1 final review, item 7: an unvalidated triggerSource would make the UI promise
    // „Mezo figyeli (<source>)" for a trigger nothing evaluates — a fabricated capability claim.
    // The trigger is nulled; the PLAN survives so the user keeps the if–then they were shown.
    @Test
    void testPropose_shouldNullUnknownTriggerButKeepThePlan_whenFakeInventsASource() {
        LifeGoalProposeResponse res = propose(script(PROTEIN, "",
            "{\"ha\":\"x\",\"akkor\":\"y\",\"triggerSource\":\"made_up_signal\",\"delayHours\":3}"));

        assertThat(res.getIfThenPlans()).hasSize(1);
        assertThat(res.getIfThenPlans().get(0).getHa()).isEqualTo("x");
        assertThat(res.getIfThenPlans().get(0).getTrigger()).isNull();
    }

    @Test
    void testPropose_shouldKeepWhitelistedTrigger_whenFakeScriptsOne() {
        LifeGoalProposeResponse res = propose(script(PROTEIN, "",
            "{\"ha\":\"x\",\"akkor\":\"y\",\"triggerSource\":\"ritual_missed\",\"delayHours\":10}"));

        assertThat(res.getIfThenPlans().get(0).getTrigger()).isNotNull();
        assertThat(res.getIfThenPlans().get(0).getTrigger().getSource()).isEqualTo("ritual_missed");
        assertThat(res.getIfThenPlans().get(0).getTrigger().getDelayHours()).isEqualTo(10);
    }

    // Item 6b: `linked` is a legal PillarKind, but the sleep_duration catalog entry does not allow
    // it — LifeGoalPillarService.validate would 400 the save, so the pillar must never reach the
    // wizard at all.
    @Test
    void testPropose_shouldDropPillar_whenKindNotAllowedByItsCatalogEntry() {
        String badKind = "{\"catalogId\":\"sleep_duration\",\"label\":\"Alvás\",\"kind\":\"linked\",\"skillKey\":\"recovery\",\"weight\":1}";
        LifeGoalProposeResponse res = propose(script(badKind + "," + PROTEIN, "", ""));

        assertThat(res.getSource()).isEqualTo(LifeGoalProposeResponse.SourceEnum.AI);
        assertThat(res.getPillars()).hasSize(1);
        assertThat(res.getPillars().get(0).getLabel()).isEqualTo("Fehérje");
    }
}
