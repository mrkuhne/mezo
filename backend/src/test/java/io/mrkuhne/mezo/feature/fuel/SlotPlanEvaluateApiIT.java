package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ResolvedSlotTime;
import io.mrkuhne.mezo.api.dto.SlotPlanBlock;
import io.mrkuhne.mezo.api.dto.SlotPlanBudget;
import io.mrkuhne.mezo.api.dto.SlotPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.SlotPlanEvaluateResponse;
import io.mrkuhne.mezo.api.dto.SlotTemplateSlot;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * HTTP-level ITs for POST /api/fuel/slot-templates/evaluate (mezo-7102) — the gated, stateless
 * "judge my split" LLM call over a (draft) meal-slot template. The LLM is {@code FakeCompanionLlm}
 * (companion-fake); scripted verdicts are planted via {@code [fake-slot-plan:{json}]} sentinels.
 * The sentinel must land in the built USER MESSAGE ({@code SlotPlanEvaluationService.buildUserMessage});
 * {@code SlotTemplateSlot.label} caps at 40 chars (shared with the CRUD template contract), too
 * short for a JSON sentinel, so the scripted case plants it in a {@code ResolvedSlotTime.label}
 * entry instead (that schema is owned by this endpoint alone and allows up to 200 chars) — the
 * service prints every resolved time verbatim in a dedicated "Feloldott idők" section regardless
 * of whether it matches a real slot label.
 */
@ActiveProfiles("companion-fake")
class SlotPlanEvaluateApiIT extends ApiIntegrationTest {

    @Test
    void testEvaluate_shouldReturnVerdictAndSummary_whenRequestValid() {
        SlotPlanEvaluateResponse resp = evaluate(baseRequest().build(), HttpStatus.OK);

        assertThat(resp.getVerdict()).isIn(
            SlotPlanEvaluateResponse.VerdictEnum.OK, SlotPlanEvaluateResponse.VerdictEnum.ADJUST);
        assertThat(resp.getSummary()).isNotBlank();
    }

    @Test
    void testEvaluate_shouldReturnScriptedVerdict_whenSentinelPlantedInResolvedTimeLabel() {
        SlotPlanEvaluateRequest req = baseRequest()
            .resolvedTimes(List.of(
                ResolvedSlotTime.builder().label("Reggeli").time("07:30").build(),
                ResolvedSlotTime.builder().label("Vacsora").time("19:00").build(),
                ResolvedSlotTime.builder()
                    .label("[fake-slot-plan:{\"verdict\":\"adjust\",\"summary\":\"Igazitsd at.\","
                        + "\"suggestions\":[]}]")
                    .time("00:00")
                    .build()))
            .build();

        SlotPlanEvaluateResponse resp = evaluate(req, HttpStatus.OK);

        assertThat(resp.getVerdict()).isEqualTo(SlotPlanEvaluateResponse.VerdictEnum.ADJUST);
        assertThat(resp.getSummary()).isEqualTo("Igazitsd at.");
    }

    private SlotPlanEvaluateResponse evaluate(SlotPlanEvaluateRequest req, HttpStatus expected) {
        return postForBody("/api/fuel/slot-templates/evaluate", req, ownerAuthHeaders(), expected,
            SlotPlanEvaluateResponse.class);
    }

    private static SlotPlanEvaluateRequest.SlotPlanEvaluateRequestBuilder baseRequest() {
        SlotTemplateSlot breakfast = SlotTemplateSlot.builder()
            .label("Reggeli").slotKind("breakfast").role("standard").anchorType("wake").budgetPct(40).build();
        SlotTemplateSlot dinner = SlotTemplateSlot.builder()
            .label("Vacsora").slotKind("dinner").role("standard").anchorType("fixed").time("19:00").budgetPct(60).build();

        return SlotPlanEvaluateRequest.builder()
            .dayType("training_am")
            .slots(List.of(breakfast, dinner))
            .resolvedTimes(List.of(
                ResolvedSlotTime.builder().label("Reggeli").time("07:30").build(),
                ResolvedSlotTime.builder().label("Vacsora").time("19:00").build()))
            .budget(SlotPlanBudget.builder().kcal(2400).p(180).c(260).f(70).build())
            .balanceKcal(300)
            .blocks(List.of(SlotPlanBlock.builder().kind("training").time("07:00").durationMin(60).build()));
    }
}
