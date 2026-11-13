package io.mrkuhne.mezo.feature.meal.controller;

import io.mrkuhne.mezo.api.controller.FuelPlanApi;
import io.mrkuhne.mezo.api.dto.FuelPlanResponse;
import io.mrkuhne.mezo.api.dto.UsualMealsResponse;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.meal.service.dayplan.DayPlanService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** /api/fuel/plan surface (Boop B4, mezo-r36n9.14) — mappings come from the generated {@link FuelPlanApi}. */
@RestController
@RequiredArgsConstructor
public class FuelPlanController implements FuelPlanApi {

    private final DayPlanService dayPlanService;
    private final CurrentUserId currentUserId;

    @Override
    public FuelPlanResponse getFuelPlan(LocalDate date) {
        return dayPlanService.response(currentUserId.get(), date);
    }

    @Override
    public UsualMealsResponse getUsualMeals(String slot) {
        return dayPlanService.usuals(currentUserId.get(), SlotKey.fromWire(slot));
    }
}
