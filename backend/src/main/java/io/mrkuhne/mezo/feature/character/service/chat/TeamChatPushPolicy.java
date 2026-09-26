package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.proactive.service.AdvicePriority;
import java.util.List;

/**
 * The team chat push budget (Csapatfal Act III Task 10, mezo-a9bo7.23, spec 2026-09-26 §5.5): at
 * most {@code maxPerDay} phone pushes per user per local day from the team chat — the SECOND (and
 * any later push, once the budget is spent) only when its ügy's flag key is strictly more severe
 * ({@link AdvicePriority#outranks}, keyed by flag key) than EVERY ügy already pushed that day.
 *
 * <p>Pure static lookup, deliberately not a Spring bean — {@link TeamChatService#open} supplies
 * the day's already-pushed flag keys (from {@code TeamChatThreadRepository}, scoped to the user's
 * local day via {@code TeamChatProperties.zone()}) and the budget ({@code maxPushesPerDay}), and
 * decides what to do with the verdict (flip {@code thread.pushed}, call
 * {@code AppNotificationEmitter}). A resolution never calls this class — {@code TeamChatService.
 * resolve} has no push step at all (spec §5.5: resolutions never push).
 */
public final class TeamChatPushPolicy {

    private TeamChatPushPolicy() {
    }

    /**
     * Whether {@code candidateFlagKey}'s open should push, given the flag keys of every ügy
     * already pushed today (oldest push order does not matter — every one of them must be
     * outranked) and the day's push budget.
     */
    public static boolean shouldPush(String candidateFlagKey, List<String> pushedTodayFlagKeys, int maxPerDay) {
        if (pushedTodayFlagKeys.isEmpty()) {
            return true;
        }
        if (pushedTodayFlagKeys.size() >= maxPerDay) {
            return false;
        }
        return pushedTodayFlagKeys.stream().allMatch(pushed -> AdvicePriority.outranks(candidateFlagKey, pushed));
    }
}
