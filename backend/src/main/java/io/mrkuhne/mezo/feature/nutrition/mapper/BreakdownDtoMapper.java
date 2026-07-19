package io.mrkuhne.mezo.feature.nutrition.mapper;

import io.mrkuhne.mezo.api.dto.MealBreakdown;
import io.mrkuhne.mezo.api.dto.MealContextRow;
import io.mrkuhne.mezo.api.dto.MealImproveRow;
import io.mrkuhne.mezo.api.dto.MealMacroDetail;
import io.mrkuhne.mezo.api.dto.MealMicroRow;
import io.mrkuhne.mezo.api.dto.MealNovaDetail;
import io.mrkuhne.mezo.api.dto.MealNovaItemRow;
import io.mrkuhne.mezo.api.dto.MealNovaStackRow;
import io.mrkuhne.mezo.api.dto.MealScoreDimension;
import io.mrkuhne.mezo.api.dto.MealToolRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import java.util.List;

/**
 * The jsonb envelope → contract-DTO projection, 1:1 (the FE injects presentation-only colors).
 * Nutrition-owned since mezo-bw3y so BOTH consumers of the envelope (meal's score, recipe's
 * template breakdown) share it without a recipe→meal package edge (the frozen slice cycle,
 * mezo-ah18.16). Pure static functions — no state, no Spring wiring (relocated verbatim from
 * MealMapper's default methods).
 */
public final class BreakdownDtoMapper {

    private BreakdownDtoMapper() {
    }

    public static MealBreakdown toDto(MealBreakdownJson b) {
        return MealBreakdown.builder()
            .value(b.value())
            .confidence(b.confidence())
            .summary(b.summary())
            .dimensions(b.dimensions() == null ? List.of()
                : b.dimensions().stream().map(BreakdownDtoMapper::toDimension).toList())
            .improve(b.improve() == null ? List.of()
                : b.improve().stream()
                    .map(i -> MealImproveRow.builder().text(i.text()).impact(i.impact()).build())
                    .toList())
            .tools(b.tools() == null ? List.of()
                : b.tools().stream()
                    .map(t -> MealToolRow.builder().type(t.type()).name(t.name()).build())
                    .toList())
            .build();
    }

    private static MealScoreDimension toDimension(MealBreakdownJson.Dimension d) {
        return MealScoreDimension.builder()
            .id(d.id())
            .label(d.label())
            .weight(d.weight())
            .score(d.score())
            .detail(d.detail())
            .macro(d.macro() == null ? null : MealMacroDetail.builder()
                .ratioP(d.macro().ratioP()).ratioC(d.macro().ratioC()).ratioF(d.macro().ratioF())
                .targetP(d.macro().targetP()).targetC(d.macro().targetC()).targetF(d.macro().targetF())
                .kcalShareOfDay(d.macro().kcalShareOfDay())
                .notes(d.macro().notes())
                .build())
            .micros(d.micros() == null ? null : d.micros().stream()
                .map(m -> MealMicroRow.builder()
                    .name(m.name()).value(m.value()).pct(m.pct()).status(m.status()).build())
                .toList())
            .nova(d.nova() == null ? null : MealNovaDetail.builder()
                .dominant(d.nova().dominant())
                .stack(d.nova().stack().stream()
                    .map(s -> MealNovaStackRow.builder()
                        .nova(s.nova()).pct(s.pct()).label(s.label()).build())
                    .toList())
                .items(d.nova().items().stream()
                    .map(i -> MealNovaItemRow.builder()
                        .name(i.name()).nova(i.nova()).warning(i.warning()).build())
                    .toList())
                .build())
            .context(d.context() == null ? null : d.context().stream()
                .map(c -> MealContextRow.builder().label(c.label()).value(c.value()).build())
                .toList())
            .build();
    }
}
