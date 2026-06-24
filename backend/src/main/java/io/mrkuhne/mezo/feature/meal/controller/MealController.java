package io.mrkuhne.mezo.feature.meal.controller;

import io.mrkuhne.mezo.api.controller.MealApi;
import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/**
 * Implements the generated {@link MealApi}; HTTP mappings, status codes and {@code @Valid}
 * come from the interface. Day reads go through {@link FuelDayService} (targets + consumed +
 * meals aggregation); meal CRUD goes through {@link MealService}.
 */
@RestController
@RequiredArgsConstructor
public class MealController implements MealApi {

    private final FuelDayService fuelDayService;
    private final MealService mealService;
    private final CurrentUserId currentUserId;

    @Override
    public FuelDayResponse getFuelDay(LocalDate date) {
        return fuelDayService.getDay(currentUserId.get(), date);
    }

    @Override
    public MealResponse createMeal(MealRequest mealRequest) {
        return mealService.create(currentUserId.get(), mealRequest);
    }

    @Override
    public void updateMeal(UUID id, MealRequest mealRequest) {
        mealService.update(currentUserId.get(), id, mealRequest);
    }

    @Override
    public void deleteMeal(UUID id) {
        mealService.delete(currentUserId.get(), id);
    }
}
