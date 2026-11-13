package io.mrkuhne.mezo.feature.nutrition.dayplan;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.dayplan.BudgetSplitter;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.PlannedWindow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.WindowKind;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.WindowRule;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Budget split ported from {@code buildDayPlan.ts} ({@code splitBudget} :267,
 * {@code splitBudgetPct} :290) — the pinned numbers are the web planner's own.
 */
class BudgetSplitterTest {

    private static PlannedWindow window(SlotKey slot, WindowKind kind, int timeMin, double weight) {
        return new PlannedWindow(slot, kind, slot.wire(), timeMin, weight, null, null,
            kind == WindowKind.SNACK ? WindowRule.SNACK : WindowRule.MAIN, timeMin - 30, timeMin + 30);
    }

    private static final List<PlannedWindow> FOUR = List.of(
        window(SlotKey.BREAKFAST, WindowKind.MEAL, 7 * 60, 2),
        window(SlotKey.LUNCH, WindowKind.MEAL, 13 * 60, 2),
        window(SlotKey.SNACK, WindowKind.SNACK, 16 * 60, 1),
        window(SlotKey.DINNER, WindowKind.MEAL, 20 * 60, 2));

    /** Every macro is split by weight and the rounding drift lands on dinner, so Σ === the budget. */
    @Test
    void splitsRemainingBudgetOverOpenWindows() {
        Macros4 daily = new Macros4(2150, 163, 226, 66); // Σ weights = 7

        List<Macros4> out = BudgetSplitter.split(daily, FOUR, true);

        assertThat(out).containsExactly(
            new Macros4(614, 47, 65, 19),
            new Macros4(614, 47, 65, 19),
            new Macros4(307, 23, 32, 9),
            new Macros4(615, 46, 64, 19)); // dinner absorbs the drift
        assertThat(out.stream().mapToInt(Macros4::kcal).sum()).isEqualTo(daily.kcal());
        assertThat(out.stream().mapToInt(Macros4::p).sum()).isEqualTo(daily.p());
        assertThat(out.stream().mapToInt(Macros4::c).sum()).isEqualTo(daily.c());
        assertThat(out.stream().mapToInt(Macros4::f).sum()).isEqualTo(daily.f());
    }

    /**
     * Kihagyás S3: the budget is split over ALL windows, skipped ones included — a skipped meal's
     * share is never redistributed, so nobody else is asked to eat more.
     */
    @Test
    void skippedWindowKcalLeaveTheBudget() {
        Macros4 daily = new Macros4(2150, 163, 226, 66);

        List<Macros4> out = BudgetSplitter.split(daily, FOUR, true);

        int skippedShare = out.get(2).kcal(); // the snack window is the one that got skipped
        int stillOpen = out.get(0).kcal() + out.get(1).kcal() + out.get(3).kcal();
        assertThat(skippedShare).isEqualTo(307);
        assertThat(stillOpen).isEqualTo(daily.kcal() - skippedShare);
    }

    /** Kímélő mód (GUIDANCE): the day is not judged on kcal, so no window carries a budget at all. */
    @Test
    void guidanceModeHasNoBudget() {
        List<Macros4> out = BudgetSplitter.split(new Macros4(2150, 163, 226, 66), FOUR, false);

        assertThat(out).hasSize(FOUR.size()).containsOnlyNulls();
    }

    /** A template's rows split by their fixed percentage; the largest row absorbs the drift. */
    @Test
    void splitsByTemplatePercentageWhenRowsCarryOne() {
        List<PlannedWindow> rows = List.of(
            new PlannedWindow(SlotKey.BREAKFAST, WindowKind.MEAL, "R", 7 * 60, 30, 30, null,
                WindowRule.TEMPLATE_WAKE, 7 * 60 - 45, 7 * 60 + 45),
            new PlannedWindow(SlotKey.LUNCH, WindowKind.MEAL, "E", 13 * 60, 20, 20, null,
                WindowRule.TEMPLATE_FIXED, 13 * 60 - 45, 13 * 60 + 45),
            new PlannedWindow(SlotKey.DINNER, WindowKind.MEAL, "V", 20 * 60, 50, 50, null,
                WindowRule.TEMPLATE_FIXED, 20 * 60 - 45, 20 * 60 + 45));

        List<Macros4> out = BudgetSplitter.split(new Macros4(2000, 150, 200, 60), rows, true);

        assertThat(out.stream().mapToInt(Macros4::kcal).toArray()).containsExactly(600, 400, 1000);
        assertThat(out.stream().mapToInt(Macros4::p).sum()).isEqualTo(150);
        assertThat(out.stream().mapToInt(Macros4::c).sum()).isEqualTo(200);
        assertThat(out.stream().mapToInt(Macros4::f).sum()).isEqualTo(60);
    }
}
