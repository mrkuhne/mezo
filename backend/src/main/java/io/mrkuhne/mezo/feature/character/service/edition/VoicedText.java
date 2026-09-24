package io.mrkuhne.mezo.feature.character.service.edition;

/**
 * Egy kiadás-poszt kiírandó szövege — a {@link EditionVoiceWriter} kimenete és a
 * {@link TeamEditionService#publish} bemenete.
 *
 * <p>{@code voiced=false} a becsületes visszaesés (ADR 0049): a karakterhang nem született meg vagy
 * megbukott a {@link EditionVoiceGuard}-on, ezért a poszt a forrásrekord SAJÁT szövegével megy ki.
 * A fal ettől még teljes: inkább száraz, mint kitalált.
 */
public record VoicedText(String title, String body, boolean voiced) {
}
