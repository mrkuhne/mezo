package io.mrkuhne.mezo.feature.companion;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Port for {@code PracticeTools#get_daily_practice}'s activity-log lines (mezo-xixu): companion
 * only needs "what was logged that day" (text + awarded XP); HOW activities are stored belongs to
 * {@code feature/activity}, which implements this ({@code activity/service/DailyActivityAdapter}).
 * The dependency stays activity → companion, never back — {@code feature.activity} already depends
 * on {@code feature.companion} (both directly, {@code ActivityClassifier} calling
 * {@link CompanionLlm}, and transitively via {@code feature.quest}, which also depends on
 * companion), so a direct {@code companion.tools → activity.service.ActivityService} import would
 * close a NEW 2-/3-slice cycle ({@code ArchitectureTest#feature_slices_are_cycle_free} is a
 * FreezingArchRule — only pre-existing frozen cycles are tolerated); this port keeps it
 * one-directional, the {@link TodayQuestSource} precedent. Bean exists only when the activity
 * switch is on; consume via {@code ObjectProvider} — an absent bean renders "nincs adat", never a
 * fabricated list.
 */
public interface TodayActivitySource {

    record ActivityLine(String text, Integer xpAwarded) {}

    /** This date's logged activities (newest first) — text + awarded XP only, never the raw entity. */
    List<ActivityLine> activitiesForDay(UUID createdBy, LocalDate date);
}
