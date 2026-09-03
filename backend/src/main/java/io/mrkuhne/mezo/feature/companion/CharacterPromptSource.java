package io.mrkuhne.mezo.feature.companion;

import java.util.UUID;

/**
 * Port for the [Karakter] dossier block (Karakter spec §8, mezo-1gim.8): the companion needs the
 * rendered prompt text, while the dossier itself belongs to {@code feature/character}, which
 * implements this ({@code character/service/CharacterPromptAssembler}). The dependency stays
 * character → companion, never back — {@code feature/character} already depends on companion (the
 * {@code CompanionLlm} port), so a direct {@code companion.service → character.repository} import
 * would close a NEW slice cycle ({@code ArchitectureTest#feature_slices_are_cycle_free}); this port
 * keeps it one-directional, the {@code WeekReviewSource}/{@code TodayQuestSource} precedent. The
 * bean exists only when both the character and companion switches are on; consume via
 * {@code ObjectProvider} — an absent bean means the block is OMITTED, never fabricated.
 */
public interface CharacterPromptSource {

    /** The deterministic [Karakter] block, or "" when the dossier has nothing worth injecting. */
    String render(UUID userId);
}
