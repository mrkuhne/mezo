package io.mrkuhne.mezo.feature.companion.feedback.service;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * Csapatfal Act III (mezo-a9bo7.21): resolves a {@code team_chat_line} feedback artifact to the
 * library entry ({@code advice_key}) its ügy was opened with, so a 👍/👎 on a team chat line
 * feeds the same {@code intervention:<key>} effectiveness rollup as a verdict on the retired
 * advice card. The team chat lives in {@code feature.character}, which already imports
 * {@code feature.companion} — companion may never import it back, so this port inverts the
 * dependency ({@link FeedMessageKindSource} precedent). The implementation
 * ({@code TeamChatInterventionKeyAdapter}) exists only while the team chat is switched on;
 * {@link FeedbackLearningService} takes it through an {@code ObjectProvider}.
 */
public interface TeamChatInterventionKeySource {

    /** {@code (team_chat_line.id → its thread's advice_key)} for every id that is a live line
     *  owned by {@code userId} whose ügy carries a non-null advice key; every other id (dangling,
     *  foreign, or a USER line on a key-less ügy) is simply absent. */
    Map<UUID, String> interventionKeysByIds(UUID userId, Collection<UUID> lineIds);
}
