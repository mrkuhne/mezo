package io.mrkuhne.mezo.feature.fuel.controller;

import io.mrkuhne.mezo.api.controller.FuelSlotPlanApi;
import io.mrkuhne.mezo.api.dto.SlotPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.SlotPlanEvaluateResponse;
import io.mrkuhne.mezo.feature.fuel.service.SlotPlanEvaluationService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * Gated {@code POST /api/fuel/slot-templates/evaluate} surface (mezo-7102) — own generated
 * {@link FuelSlotPlanApi} interface (own tag) so this controller can be
 * {@code @ConditionalOnProperty}-gated independently of the unconditional {@code FuelController}.
 * Stateless: {@link CurrentUserId} is used ONLY as the auth gate — nothing is persisted or read
 * per-user.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLOT_TEMPLATE_AI_SWITCH, havingValue = "true")
public class SlotPlanEvaluateController implements FuelSlotPlanApi {

    private final SlotPlanEvaluationService slotPlanEvaluationService;
    private final CurrentUserId currentUserId;

    @Override
    public SlotPlanEvaluateResponse evaluateSlotPlan(SlotPlanEvaluateRequest slotPlanEvaluateRequest) {
        currentUserId.get(); // auth gate only — nothing persisted
        return slotPlanEvaluationService.evaluate(slotPlanEvaluateRequest);
    }
}
