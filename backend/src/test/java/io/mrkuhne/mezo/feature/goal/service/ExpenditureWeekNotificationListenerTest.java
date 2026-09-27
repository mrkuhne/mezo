package io.mrkuhne.mezo.feature.goal.service;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Title/body mapping for the Monday learning bell (mezo-3n2so, spec §5.2) — pure, no Spring context. */
class ExpenditureWeekNotificationListenerTest {

    private static final UUID USER = UUID.randomUUID();
    private static final UUID ESTIMATE = UUID.randomUUID();
    private static final LocalDate WEEK_START = LocalDate.of(2026, 9, 14);

    @Test
    void stepMovedGetsTheSignedKcalTitle() {
        AppNotificationEmitter emitter = mock(AppNotificationEmitter.class);
        ExpenditureWeekNotificationListener listener = new ExpenditureWeekNotificationListener(emitter);

        listener.onLearned(new ExpenditureWeekLearnedEvent(USER, ESTIMATE, WEEK_START, "UPDATED", 60, 0));

        verify(emitter).emit(eq(USER), eq(AppNotificationKind.EXPENDITURE_WEEK),
            eq("Heti tanulás: +60 kcal"), eq("Nézd meg, mit tanultam a múlt hétből."),
            eq("/fuel/tanulas"), eq(ESTIMATE), eq("expenditure_week:2026-09-14"));
    }

    @Test
    void negativeStepGetsTheSignedKcalTitleToo() {
        AppNotificationEmitter emitter = mock(AppNotificationEmitter.class);
        ExpenditureWeekNotificationListener listener = new ExpenditureWeekNotificationListener(emitter);

        listener.onLearned(new ExpenditureWeekLearnedEvent(USER, ESTIMATE, WEEK_START, "UPDATED", -40, 0));

        verify(emitter).emit(eq(USER), eq(AppNotificationKind.EXPENDITURE_WEEK),
            eq("Heti tanulás: -40 kcal"), eq("Nézd meg, mit tanultam a múlt hétből."),
            eq("/fuel/tanulas"), eq(ESTIMATE), eq("expenditure_week:2026-09-14"));
    }

    @Test
    void noStepButHoldingGetsTheLowDataTitle() {
        AppNotificationEmitter emitter = mock(AppNotificationEmitter.class);
        ExpenditureWeekNotificationListener listener = new ExpenditureWeekNotificationListener(emitter);

        listener.onLearned(new ExpenditureWeekLearnedEvent(USER, ESTIMATE, WEEK_START, "HOLDING", 0, 0));

        verify(emitter).emit(eq(USER), eq(AppNotificationKind.EXPENDITURE_WEEK),
            eq("Heti tanulás: kevés adat volt"), eq("Nézd meg, mit tanultam a múlt hétből."),
            eq("/fuel/tanulas"), eq(ESTIMATE), eq("expenditure_week:2026-09-14"));
    }

    @Test
    void noStepButExcludedDaysGetsTheExcludedCountTitle() {
        AppNotificationEmitter emitter = mock(AppNotificationEmitter.class);
        ExpenditureWeekNotificationListener listener = new ExpenditureWeekNotificationListener(emitter);

        listener.onLearned(new ExpenditureWeekLearnedEvent(USER, ESTIMATE, WEEK_START, "STABLE", 0, 2));

        verify(emitter).emit(eq(USER), eq(AppNotificationKind.EXPENDITURE_WEEK),
            eq("Heti tanulás: 2 nap kimaradt"), eq("Nézd meg, mit tanultam a múlt hétből."),
            eq("/fuel/tanulas"), eq(ESTIMATE), eq("expenditure_week:2026-09-14"));
    }
}
