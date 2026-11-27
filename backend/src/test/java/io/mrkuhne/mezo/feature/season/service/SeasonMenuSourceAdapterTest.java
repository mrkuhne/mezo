package io.mrkuhne.mezo.feature.season.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.meal.service.dayplan.DayPlanService;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import io.mrkuhne.mezo.feature.season.port.SeasonMenuSourcePort.DayFrame;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.Window;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Boop Sport S1 (mezo-r36n9.201): every sport window of the day feeds the menu, not only the first. */
class SeasonMenuSourceAdapterTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 24);
    private static final UUID OWNER = UUID.randomUUID();

    @Test
    void twoSportWindowsGiveTwoPreSessionSnacks() {
        DayPlanService plans = mock(DayPlanService.class);
        when(plans.skeleton(OWNER, DAY)).thenReturn(new DayPlanService.Skeleton(DAY, List.of(
                new DayPlanService.SkeletonWindow(SlotKey.BREAKFAST, 1, "Reggeli", budget(600), 480),
                new DayPlanService.SkeletonWindow(SlotKey.LUNCH, 1, "Ebéd", budget(800), 750),
                new DayPlanService.SkeletonWindow(SlotKey.SNACK, 1, "Uzsonna", budget(300), 960),
                new DayPlanService.SkeletonWindow(SlotKey.DINNER, 1, "Vacsora", budget(800), 1230)),
            List.of(
                new Window(LocalTime.of(7, 0), LocalTime.of(7, 40), "sport", false, "running"),
                new Window(LocalTime.of(18, 0), LocalTime.of(19, 30), "sport", false, "volleyball"))));
        SeasonMenuSourceAdapter adapter = new SeasonMenuSourceAdapter(plans, null, null, null);

        DayFrame frame = adapter.frames(OWNER, DAY, DAY).get(0);

        assertThat(frame.sport()).isTrue();
        assertThat(frame.gym()).isFalse();
        assertThat(frame.sports()).extracting(DayFrame.SportWindow::startMin).containsExactly(420, 1080);
        MenuPlanner.DayBudget day = MenuService.day(frame);
        assertThat(MenuPlanner.withPreSession(day).stream().filter(MenuPlanner.Window::preSession)).hasSize(2);
    }

    private static Macros4 budget(int kcal) {
        return new Macros4(kcal, kcal / 20, kcal / 8, kcal / 30);
    }
}
