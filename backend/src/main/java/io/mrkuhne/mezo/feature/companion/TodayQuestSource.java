package io.mrkuhne.mezo.feature.companion;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Port for the context snapshot's [Napi gyakorlat] quest count: companion only needs "X/Y quests
 * closed today"; HOW quests are stored belongs to feature/quest, which implements this
 * ({@code feature/quest/service/TodayQuestAdapter}) — dependency stays quest → companion, never
 * back. quest already depends on companion (QuestFlavor uses {@link CompanionLlm}), so a direct
 * companion → quest import would form a 2-slice cycle ({@code feature_slices_are_cycle_free});
 * this port keeps it one-directional, the {@code progression.QuestLedgerSource} precedent. Bean
 * exists only when the quest switch is on; consume via {@code ObjectProvider} — an absent bean
 * renders "nincs adat", never a fabricated count.
 */
public interface TodayQuestSource {

    record Stats(int completed, int total) {}

    /** Non-rerolled quest rows for the given date: completed count + total count. */
    Stats todayStats(UUID createdBy, LocalDate date);
}
