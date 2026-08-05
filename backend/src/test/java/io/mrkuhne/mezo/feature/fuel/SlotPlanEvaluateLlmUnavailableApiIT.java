package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SlotPlanBudget;
import io.mrkuhne.mezo.api.dto.SlotPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.SlotTemplateSlot;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

/** Slot-plan-ai on, companion off -> no adapter bean -> clean 503, never a 500 (mezo-7102). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class SlotPlanEvaluateLlmUnavailableApiIT extends ApiIntegrationTest {

    @Test
    void testEvaluate_should503_whenCompanionSwitchOff() {
        SlotTemplateSlot breakfast = SlotTemplateSlot.builder()
            .label("Reggeli").slotKind("breakfast").role("standard").anchorType("wake").budgetPct(40).build();
        SlotTemplateSlot dinner = SlotTemplateSlot.builder()
            .label("Vacsora").slotKind("dinner").role("standard").anchorType("fixed").time("19:00").budgetPct(60).build();
        SlotPlanEvaluateRequest req = SlotPlanEvaluateRequest.builder()
            .dayType("rest")
            .slots(List.of(breakfast, dinner))
            .budget(SlotPlanBudget.builder().kcal(2200).p(160).c(230).f(65).build())
            .balanceKcal(0)
            .build();

        ResponseEntity<String> resp = exchangeForResponse(
            HttpMethod.POST, "/api/fuel/slot-templates/evaluate", req, ownerAuthHeaders());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertHasRequestError(resp.getBody(), "FUEL_SLOT_TEMPLATE_LLM_UNAVAILABLE");
    }
}
