package io.mrkuhne.mezo.feature.nutrition.dayplan;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.dayplan.PlannedWindow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.TemplateRow;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.TrainingBlock;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.WindowKind;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.WindowPlacer;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.WindowRule;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Window placement ported from {@code frontend/src/features/fuel/logic/buildDayPlan.ts}
 * ({@code placeWindows} :189) and {@code compileTemplate.ts} :67 — the expected clock times are
 * the web planner's own pinned values, so the phone and the web app place the same day.
 */
class WindowPlacerTest {

    private static List<String> times(List<PlannedWindow> windows) {
        return windows.stream().map(w -> WindowPlacer.hhmm(w.timeMin())).toList();
    }

    /** Owner decision 21: the default rhythm is 3 meals + 2 snacks, placed around wake and bed. */
    @Test
    void placesDefaultRhythmAroundWakeAndBed() {
        List<PlannedWindow> windows = WindowPlacer.place("06:00", "23:00", 5, List.of());

        // eatingStart = wake+45 = 06:45, kitchenClose = bed-90 = 21:30; mains at span 0/0.5/1,
        // snacks halfway between them.
        assertThat(times(windows)).containsExactly("06:45", "10:26", "14:08", "17:49", "21:30");
        assertThat(windows).extracting(PlannedWindow::slotKey).containsExactly(
            SlotKey.BREAKFAST, SlotKey.SNACK, SlotKey.LUNCH, SlotKey.SNACK, SlotKey.DINNER);
        assertThat(windows).extracting(PlannedWindow::kind).containsExactly(
            WindowKind.MEAL, WindowKind.SNACK, WindowKind.MEAL, WindowKind.SNACK, WindowKind.MEAL);
        assertThat(windows).extracting(PlannedWindow::label).containsExactly(
            "Reggeli", "Tízórai", "Ebéd", "Uzsonna", "Vacsora");
        // Every window opens a real range around its time, inside the eating span.
        assertThat(windows).allSatisfy(w -> {
            assertThat(w.fromMin()).isGreaterThanOrEqualTo(6 * 60 + 45);
            assertThat(w.toMin()).isLessThanOrEqualTo(21 * 60 + 30);
            assertThat(w.toMin() - w.fromMin()).isGreaterThanOrEqualTo(30);
        });
    }

    /**
     * One evening session: the nearest window before it is pulled out to start−75 as pre-fuel, and
     * the main nearest the session end snaps to end+45 (clamped to kitchen close) as post-workout.
     */
    @Test
    void insertsPreAndPostWorkoutWindowsAroundASession() {
        TrainingBlock sport = new TrainingBlock(18 * 60 + 15, 90, "Röpi");

        List<PlannedWindow> windows = WindowPlacer.place("06:00", "21:45", 4, List.of(sport));

        PlannedWindow snack = windows.stream().filter(w -> w.slotKey() == SlotKey.SNACK).findFirst().orElseThrow();
        PlannedWindow dinner = windows.stream().filter(w -> w.slotKey() == SlotKey.DINNER).findFirst().orElseThrow();
        assertThat(WindowPlacer.hhmm(snack.timeMin())).isEqualTo("17:00"); // 18:15 − 75
        assertThat(snack.rule()).isEqualTo(WindowRule.PRE_TRAINING_SNACK);
        assertThat(WindowPlacer.hhmm(dinner.timeMin())).isEqualTo("20:15"); // 19:45 + 45, clamped to 20:15
        assertThat(dinner.rule()).isEqualTo(WindowRule.POST_TRAINING);
        assertThat(dinner.weight()).isEqualTo(2.5); // the post-workout main is weighted up
        // No meal window may overlap the session itself.
        assertThat(windows).allSatisfy(w ->
            assertThat(w.fromMin() < sport.endMin() && w.toMin() > sport.startMin()).isFalse());
    }

    /**
     * {@code meal_slot_template} has no rows in production, so the default rhythm is the normal
     * path — but when the owner saves one its anchors and its fixed budget shares replace it.
     */
    @Test
    void respectsASlotTemplateWhenOneExists() {
        List<TemplateRow> rows = List.of(
            new TemplateRow("Ébredés után", SlotKey.BREAKFAST, "standard", "wake", null, 60, 30),
            new TemplateRow("Edzés előtt", SlotKey.SNACK, "pre_workout", "training_start", null, -60, 20),
            new TemplateRow("Edzés után", SlotKey.DINNER, "post_workout", "training_end", null, 30, 50));
        TrainingBlock gym = new TrainingBlock(17 * 60, 60, "Pull");

        List<PlannedWindow> windows = WindowPlacer.fromTemplate(rows, "06:00", "23:00", List.of(gym));

        assertThat(times(windows)).containsExactly("07:00", "16:00", "18:30");
        assertThat(windows).extracting(PlannedWindow::budgetPct).containsExactly(30, 20, 50);
        assertThat(windows).extracting(PlannedWindow::rule).containsExactly(
            WindowRule.TEMPLATE_WAKE, WindowRule.TEMPLATE_TRAINING_START, WindowRule.TEMPLATE_TRAINING_END);
        assertThat(windows).extracting(PlannedWindow::label)
            .containsExactly("Ébredés után", "Edzés előtt", "Edzés után");
    }

    /** A training-relative row has nothing to resolve against on a rest day — it is dropped, not faked. */
    @Test
    void dropsTrainingRelativeTemplateRowsOnADayWithNoSession() {
        List<TemplateRow> rows = List.of(
            new TemplateRow("Ébredés után", SlotKey.BREAKFAST, "standard", "wake", null, 60, 50),
            new TemplateRow("Edzés után", SlotKey.DINNER, "post_workout", "training_end", null, 30, 50));

        List<PlannedWindow> windows = WindowPlacer.fromTemplate(rows, "06:00", "23:00", List.of());

        assertThat(times(windows)).containsExactly("07:00");
    }
}
