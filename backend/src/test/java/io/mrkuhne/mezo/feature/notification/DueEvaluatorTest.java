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
 * <p>Sign convention (mirrors {@code weekly-planner}'s {@code dueBlocks} table exactly):
 * {@code delta = fireMinute - nowMinuteOfDay}. A scenario with a larger {@code now} (closer to, or
 * past, the fire minute) is what the brief calls "later" in the catch-up window; {@code now}
 * further before the fire minute is "future" and never due.
 */
class DueEvaluatorTest {

    private static final int CATCH_UP_MINUTES = 2;
    private static final int TEN_AM = 10 * 60; // fireMinute for the plain (lead 0) scenarios below

    private final DueEvaluator evaluator = new DueEvaluator();

    /** anchor 10:00 (600), lead 0 -> fireMinute = 600. delta = 600 - now. */
    private static Stream<Arguments> windowScenarios() {
        return Stream.of(
            Arguments.of("exact minute fires", TEN_AM, true),           // delta = 600-600 = 0
            Arguments.of("one minute late still fires (catch-up 2)", TEN_AM - 1, true),  // delta = 1
            Arguments.of("two minutes late does not fire", TEN_AM - 2, false),           // delta = 2, not < 2
            Arguments.of("a future minute does not fire", TEN_AM - 100, false)           // delta = 100
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
        // never fires, because a negative fireMinute can never land in [0, catchUp) for any valid
        // nowMinuteOfDay in [0, 1439].
        AnchorSet anchors = anchorSet(event(NotificationCategory.MEDICATION, 10, "00:10"));
        List<CategoryPref> prefs = List.of(pref(NotificationCategory.MEDICATION, true, 30));

        List<DueItem> dueAtTwentyThreeForty = evaluator.due(23 * 60 + 40, prefs, anchors, CATCH_UP_MINUTES);
        List<DueItem> dueAtMidnight = evaluator.due(0, prefs, anchors, CATCH_UP_MINUTES);

        assertThat(dueAtTwentyThreeForty).as("must not wrap around to 23:40 the previous evening").isEmpty();
        assertThat(dueAtMidnight).as("negative fireMinute never lands in [0, catchUp)").isEmpty();
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
