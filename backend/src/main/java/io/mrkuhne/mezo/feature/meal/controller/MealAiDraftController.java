package io.mrkuhne.mezo.feature.meal.controller;

import io.mrkuhne.mezo.api.controller.MealAiLogApi;
import io.mrkuhne.mezo.api.dto.MealAiDraftResponse;
import io.mrkuhne.mezo.feature.meal.service.MealAiDraftService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * AI meal-draft endpoint (mezo-78rn) — implements the generated {@link MealAiLogApi}; HTTP mapping,
 * {@code multipart/form-data} binding, {@code @Valid}/{@code @Size} constraints and status codes all
 * come from the interface. A thin delegate: it only resolves the owner from the security principal
 * and hands the parsed multipart parts to {@link MealAiDraftService}.
 *
 * <p>Switch off -> {@code @ConditionalOnProperty} drops the bean -> the whole {@code /api/meal/ai-draft}
 * path 404s (same gating story as {@code PantryScrapeController}). Companion off is a different axis:
 * the bean still exists, but the service degrades to a 503 via its {@code ObjectProvider} port.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MEAL_AI_LOG_SWITCH, havingValue = "true")
public class MealAiDraftController implements MealAiLogApi {

    private final MealAiDraftService service;
    private final CurrentUserId currentUserId;

    @Override
    public MealAiDraftResponse draftMealFromAi(LocalDate date, String text, MultipartFile photo) {
        return service.draft(currentUserId.get(), date, text, photo);
    }
}
