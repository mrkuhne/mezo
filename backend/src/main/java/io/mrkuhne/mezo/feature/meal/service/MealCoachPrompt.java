package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.Window;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Pure prompt assembly for {@link MealCoachService} (mezo-mr4n) — no Spring, no DB, so the
 * prompt's CONTENT (which is the real contract with the model) is unit-testable.
 *
 * <p>The honesty rule of the whole coach layer lives here: every meal block carries the day state
 * as of THAT meal's log time, never "now". That is what makes a verdict cacheable — the same meal
 * always produces the same prompt, so a breakfast read back in the evening is still judged against
 * the morning's numbers (spec §4).
 */
final class MealCoachPrompt {

    private MealCoachPrompt() {
    }

    /**
     * One meal to narrate. {@code kcalBefore}/{@code pBefore}/{@code cBefore}/{@code fBefore} are
     * the day's totals BEFORE this meal; {@code indexInDay} is 1-based.
     */
    record MealBlock(UUID mealId, String name, String slot, LocalTime loggedAt, int indexInDay,
                     MealBreakdownJson breakdown, MealRole role,
                     BigDecimal kcalBefore, BigDecimal pBefore, BigDecimal cBefore,
                     BigDecimal fBefore) {
    }

    static String userMessage(LocalDate date, NutritionTargetsProperties targets,
                              List<Window> workouts, List<MealBlock> meals) {
        StringBuilder sb = new StringBuilder();
        sb.append("NAP: ").append(date).append('\n');
        sb.append("NAPI CÉLOK: ").append(targets.kcal()).append(" kcal · P ").append(targets.p())
          .append("g · C ").append(targets.c()).append("g · F ").append(targets.f()).append("g\n");

        sb.append("MAI EDZÉSEK: ");
        if (workouts.isEmpty()) {
            sb.append("nincs\n");
        } else {
            sb.append('\n');
            for (Window w : workouts) {
                sb.append("- ").append(w.start()).append('-').append(w.end())
                  .append(" · ").append(w.kind());
                if (w.label() != null && !w.label().isBlank()) {
                    sb.append(" · ").append(w.label());
                }
                sb.append(w.done() ? " · megvolt" : " · tervezett").append('\n');
            }
        }

        for (MealBlock m : meals) {
            appendMeal(sb, targets, m);
        }
        return sb.toString();
    }

    private static void appendMeal(StringBuilder sb, NutritionTargetsProperties targets, MealBlock m) {
        sb.append("\n=== ÉTKEZÉS mealId=").append(m.mealId()).append(" ===\n");
        sb.append("Név: ").append(m.name() == null ? "-" : m.name())
          .append(" | slot: ").append(m.slot() == null ? "-" : m.slot())
          .append(" | idő: ").append(m.loggedAt())
          .append(" | a nap ").append(m.indexInDay()).append(". étkezése\n");
        sb.append("Szerep: ").append(roleLabel(m.role())).append('\n');
        sb.append("A NAP ÁLLAPOTA EDDIG A PONTIG: ").append(plain(m.kcalBefore())).append(" kcal · P ")
          .append(plain(m.pBefore())).append("g · C ").append(plain(m.cBefore())).append("g · F ")
          .append(plain(m.fBefore())).append("g (marad: ")
          .append(remaining(targets.kcal(), m.kcalBefore())).append(" kcal · P ")
          .append(remaining(targets.p(), m.pBefore())).append("g)\n");

        MealBreakdownJson b = m.breakdown();
        sb.append("DETERMINISZTIKUS BONTÁS (0-1, súlyozott) — érték ").append(b.value())
          .append(", megbízhatóság ").append(b.confidence()).append(":\n");
        for (Dimension d : b.dimensions()) {
            sb.append("- ").append(d.id()).append(" (").append(d.label()).append("): score ")
              .append(d.score()).append(", súly ").append(d.weight())
              .append(" — ").append(d.detail()).append('\n');
        }
    }

    /** The role as the prompt names it — the same tokens the scoring rubric uses. */
    private static String roleLabel(MealRole role) {
        return switch (role) {
            case PRE_WORKOUT -> "pre_workout (edzés előtti üzemanyag-ablak)";
            case POST_WORKOUT -> "post_workout (regenerációs ablak, az edzés megvolt)";
            case STANDARD -> "standard (nincs edzés-kontextus)";
        };
    }

    private static String plain(BigDecimal v) {
        return v == null ? "0" : v.stripTrailingZeros().toPlainString();
    }

    private static String remaining(int target, BigDecimal consumed) {
        BigDecimal left = BigDecimal.valueOf(target)
            .subtract(consumed == null ? BigDecimal.ZERO : consumed);
        return left.stripTrailingZeros().toPlainString();
    }
}
