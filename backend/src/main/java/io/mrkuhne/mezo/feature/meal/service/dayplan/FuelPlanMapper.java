package io.mrkuhne.mezo.feature.meal.service.dayplan;

import io.mrkuhne.mezo.api.dto.FuelPlanResponse;
import io.mrkuhne.mezo.api.dto.FuelPlanSuggestion;
import io.mrkuhne.mezo.api.dto.FuelPlanTip;
import io.mrkuhne.mezo.api.dto.FuelPlanWindow;
import io.mrkuhne.mezo.api.dto.Macros;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlan;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.DayPlanWindow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Suggestion;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Tip;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** The day plan on the wire. Null stays null — "no budget" and "no tip" are states, not zeros. */
final class FuelPlanMapper {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT);

    private FuelPlanMapper() {
    }

    static FuelPlanResponse toResponse(DayPlan plan) {
        return FuelPlanResponse.builder()
            .date(plan.date())
            .windows(plan.windows().stream().map(FuelPlanMapper::window).toList())
            .remaining(macros(plan.remaining()))
            .tip(tip(plan.tip()))
            .build();
    }

    private static FuelPlanWindow window(DayPlanWindow w) {
        return FuelPlanWindow.builder()
            .slot(FuelPlanWindow.SlotEnum.fromValue(w.slot().wire()))
            .kind(FuelPlanWindow.KindEnum.fromValue(w.kind().name().toLowerCase(Locale.ROOT)))
            .label(w.label())
            .from(w.from().format(HH_MM))
            .to(w.to().format(HH_MM))
            .budget(macros(w.budget()))
            .state(FuelPlanWindow.StateEnum.fromValue(w.state().name().toLowerCase(Locale.ROOT)))
            .loggedMealIds(w.loggedMealIds())
            .suggestion(suggestion(w.suggestion()))
            .build();
    }

    private static FuelPlanSuggestion suggestion(Suggestion s) {
        return s == null ? null : FuelPlanSuggestion.builder()
            .kind(FuelPlanSuggestion.KindEnum.fromValue(s.kind().name().toLowerCase(Locale.ROOT)))
            .recipeId(s.recipeId())
            .text(s.text())
            .reason(s.reason())
            .build();
    }

    private static FuelPlanTip tip(Tip t) {
        return t == null ? null : FuelPlanTip.builder().text(t.text()).reason(t.reason()).build();
    }

    private static Macros macros(Macros4 m) {
        return m == null ? null : Macros.builder()
            .kcal(BigDecimal.valueOf(m.kcal()))
            .p(BigDecimal.valueOf(m.p()))
            .c(BigDecimal.valueOf(m.c()))
            .f(BigDecimal.valueOf(m.f()))
            .build();
    }
}
