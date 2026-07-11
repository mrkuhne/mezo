package io.mrkuhne.mezo.feature.progression;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Port for the quest half of the discipline trait: progression only needs the closed-quest
 * counts; HOW they are stored belongs to feature/quest, which implements this
 * ({@code feature/quest/service/QuestLedgerAdapter}) — dependency stays quest → progression,
 * never back (feature_slices_are_cycle_free). Bean exists only when the quest switch is on;
 * consume via ObjectProvider.
 */
public interface QuestLedgerSource {

    record Stats(int completed, int expired) {}

    /** Terminal (completed/expired) quests in [from, to] — rerolled/offered rows excluded. */
    Stats closedQuestStats(UUID createdBy, LocalDate from, LocalDate to);
}
