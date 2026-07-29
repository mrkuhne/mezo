package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet.AnchoredEvent;
import io.mrkuhne.mezo.feature.notification.domain.CategoryPref;
import io.mrkuhne.mezo.feature.notification.domain.DueItem;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.DueEvaluator;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Table test for {@link DueEvaluator#due} (bd mezo-h4wp.6.2). Pure function, so it is
 * exhaustively testable without Spring, a database, or a clock — construct with {@code new}.
 *
 * <p>Sign convention — the window looks <b>BACKWARD</b>:
 * {@code elapsed = nowMinuteOfDay - fireMinute}, due when {@code elapsed ∈ [0, catchUpMinutes)}.
 * So "late" means {@code now} is PAST the fire minute (a missed tick being recovered) and "early"
 * means {@code now} is still before it (never due). The previous version of this table had those
 * two labels inverted, which is exactly how the forward-window bug survived review.
 */
class DueEvaluatorTest {

    private static final int CATCH_UP_MINUTES = 2;
    private static final int TEN_AM = 10 * 60; // fireMinute for the plain (lead 0) scenarios below

    private final DueEvaluator evaluator = new DueEvaluator();

    /** anchor 10:00 (600), lead 0 -> fireMinute = 600. elapsed = now - 600. */
    private static Stream<Arguments> windowScenarios() {
        return Stream.of(
            Arguments.of("exact minute fires", TEN_AM, true),                              // elapsed = 0
            Arguments.of("one minute LATE still fires — the missed-tick catch-up (width 2)",
                    TEN_AM + 1, true),                                                     // elapsed = 1
            Arguments.of("the far edge, now == fireMinute + catchUpMinutes, does not fire",
                    TEN_AM + 2, false),                                                    // elapsed = 2, not < 2
            Arguments.of("well past the window does not fire", TEN_AM + 100, false),       // elapsed = 100
            Arguments.of("one minute EARLY does not fire — the window never looks forward",
                    TEN_AM - 1, false),                                                    // elapsed = -1
            Arguments.of("a future minute does not fire", TEN_AM - 100, false)             // elapsed = -100
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("windowScenarios")
    void testDue_shouldRespectTheCatchUpWindow_whenNowVariesAroundTheFireMinute(
            String scenario, int nowMinuteOfDay, boolean expectDue) {
        AnchorSet anchors = anchorSet(event(NotificationCategory.MEDICATION, TEN_AM, "10:00"));
        List<CategoryPref> prefs = List.of(pref(NotificationCategory.MEDICATION, true, 0));

        List<DueItem> due = evaluator.due(nowMinuteOfDay, prefs, anchors, CATCH_UP_MINUTES);

        assertThat(due).as(scenario).hasSize(expectDue ? 1 : 0);
    }

    /**
     * The reason the catch-up window exists at all, as its own named test rather than a table row:
     * this job shares a size-1 scheduler thread with 18 other crons, so a slow LLM job straddling
     * two ticks genuinely loses a minute. The forward window this replaced returned nothing here
     * (delta = -1), dropping the anchor for the whole day.
     */
    @Test
    void testDue_shouldStillFire_whenTheTickWasMissedAndNowIsOneMinutePastTheFireMinute() {
        AnchorSet anchors = anchorSet(event(NotificationCategory.MEDICATION, TEN_AM, "10:00"));
        List<CategoryPref> prefs = List.of(pref(NotificationCategory.MEDICATION, true, 0));

        List<DueItem> due = evaluator.due(TEN_AM + 1, prefs, anchors, CATCH_UP_MINUTES);

        assertThat(due).as("a missed 10:00 tick must still deliver at 10:01").hasSize(1);
    }

    /**
     * The other half of the same bug: firing at {@code fireMinute - 1} sent every notification a
     * minute early, and the {@code push_log} dedup then suppressed the on-time minute — so the
     * early send was the ONLY send. The window must never look forward.
     */
    @Test
    void testDue_shouldNotFire_whenNowIsOneMinuteBeforeTheFireMinute() {
        AnchorSet anchors = anchorSet(event(NotificationCategory.MEDICATION, TEN_AM, "10:00"));
        List<CategoryPref> prefs = List.of(pref(NotificationCategory.MEDICATION, true, 0));

        List<DueItem> due = evaluator.due(TEN_AM - 1, prefs, anchors, CATCH_UP_MINUTES);

        assertThat(due).as("09:59 is not a 10:00 notification").isEmpty();
    }

    @Test
    void testDue_shouldNeverFire_whenCategoryIsDisabledEvenThoughItIsDue() {
        AnchorSet anchors = anchorSet(event(NotificationCategory.MEDICATION, TEN_AM, "10:00"));
        List<CategoryPref> prefs = List.of(pref(NotificationCategory.MEDICATION, false, 0));

        List<DueItem> due = evaluator.due(TEN_AM, prefs, anchors, CATCH_UP_MINUTES);

        assertThat(due).isEmpty();
    }

    @Test
    void testDue_shouldShiftTheFireMinuteByTheLead_whenGymSlotIsSeventeenThirtyWithThirtyMinuteLead() {
        int gymSlot = 17 * 60 + 30; // 17:30
        AnchorSet anchors = anchorSet(event(NotificationCategory.GYM, gymSlot, "17:30"));
        List<CategoryPref> prefs = List.of(pref(NotificationCategory.GYM, true, 30));

        List<DueItem> dueAtSeventeenHundred = evaluator.due(17 * 60, prefs, anchors, CATCH_UP_MINUTES);
        List<DueItem> dueAtTheSlotItself = evaluator.due(gymSlot, prefs, anchors, CATCH_UP_MINUTES);

        assertThat(dueAtSeventeenHundred).as("fires at 17:00, i.e. the slot minus the 30-min lead").hasSize(1);
        assertThat(dueAtTheSlotItself).as("does not fire again at the slot's own start time").isEmpty();
    }

    @Test
    void testDue_shouldYieldNothing_whenTheAnchorIsUnavailable() {
        AnchorSet anchors = new AnchorSet(List.of(), List.of(), List.of());
        List<CategoryPref> prefs = List.of(pref(NotificationCategory.MEDICATION, true, 0));

        List<DueItem> due = evaluator.due(TEN_AM, prefs, anchors, CATCH_UP_MINUTES);

        assertThat(due).isEmpty();
    }

    @Test
    void testDue_shouldYieldNothing_whenThePrefListIsEmpty() {
        AnchorSet anchors = anchorSet(event(NotificationCategory.MEDICATION, TEN_AM, "10:00"));

        List<DueItem> due = evaluator.due(TEN_AM, List.of(), anchors, CATCH_UP_MINUTES);

        assertThat(due).isEmpty();
    }

    @Test
    void testDue_shouldBuildDedupKeyFromCategoryAndAnchorTime_whenCalledTwiceInTheSameMinute() {
        int gymSlot = 17 * 60 + 30;
        AnchorSet anchors = anchorSet(event(NotificationCategory.GYM, gymSlot, "17:30"));
        List<CategoryPref> prefs = List.of(pref(NotificationCategory.GYM, true, 30));

        List<DueItem> first = evaluator.due(17 * 60, prefs, anchors, CATCH_UP_MINUTES);
        List<DueItem> second = evaluator.due(17 * 60, prefs, anchors, CATCH_UP_MINUTES);

        assertThat(first).extracting(DueItem::dedupKey).containsExactly("gym:17:30");
        assertThat(second).extracting(DueItem::dedupKey).containsExactly("gym:17:30");
        assertThat(first).as("stable across two calls in the same minute").isEqualTo(second);
    }

    @Test
    void testDue_shouldNotFireThePreviousEvening_whenAnAnchorNearMidnightWithLeadGoesNegative() {
        // Anchor 00:10 (minute 10), lead 30 -> raw fireMinute = -20. A wraparound "fix" would
        // reinterpret this as 23:40 the previous evening and fire then. The honest answer: it
        // never fires, because no nowMinuteOfDay in [0, 1439] is within catchUpMinutes AFTER a
        // negative fire minute.
        AnchorSet anchors = anchorSet(event(NotificationCategory.MEDICATION, 10, "00:10"));
        List<CategoryPref> prefs = List.of(pref(NotificationCategory.MEDICATION, true, 30));

        List<DueItem> dueAtTwentyThreeForty = evaluator.due(23 * 60 + 40, prefs, anchors, CATCH_UP_MINUTES);
        List<DueItem> dueAtMidnight = evaluator.due(0, prefs, anchors, CATCH_UP_MINUTES);

        assertThat(dueAtTwentyThreeForty).as("must not wrap around to 23:40 the previous evening").isEmpty();
        assertThat(dueAtMidnight).as("no minute of the day is within catchUp AFTER a negative fire minute")
                .isEmpty();
    }

    private static AnchorSet anchorSet(AnchoredEvent event) {
        return new AnchorSet(List.of(event), List.of(), List.of());
    }

    private static AnchoredEvent event(NotificationCategory category, int minuteOfDay, String dedupSuffix) {
        return new AnchoredEvent(category, minuteOfDay, dedupSuffix, "title", "body", "/url");
    }

    private static CategoryPref pref(NotificationCategory category, boolean enabled, int leadMinutes) {
        return new CategoryPref(category, enabled, leadMinutes);
    }
}
