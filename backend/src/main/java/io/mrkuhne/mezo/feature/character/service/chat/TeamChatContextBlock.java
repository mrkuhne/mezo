package io.mrkuhne.mezo.feature.character.service.chat;

import java.util.List;

/**
 * {@link TeamChatContext#build}'s result — the background a voice call gets, never facts
 * (Csapatfal Act III Task 8, mezo-a9bo7.22, spec §5.3 "emlékszik").
 */
public record TeamChatContextBlock(
        List<String> todayLines, List<String> pastEpisodes, List<String> reactions, List<String> knowledge) {
}
