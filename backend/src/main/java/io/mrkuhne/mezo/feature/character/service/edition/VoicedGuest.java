package io.mrkuhne.mezo.feature.character.service.edition;

/**
 * Egy kiírandó vendég-sor (H4, mezo-a9bo7.15). {@code voiced=false}: a modell sora hiányzott vagy
 * megbukott az {@link EditionVoiceGuard#checkGuest} őrön, ezért a mag saját (konzílium-)szövege áll.
 */
public record VoicedGuest(TeamCharacter character, String body, boolean voiced) {
}
