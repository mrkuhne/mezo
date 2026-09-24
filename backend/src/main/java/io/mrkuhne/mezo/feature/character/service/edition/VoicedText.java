package io.mrkuhne.mezo.feature.character.service.edition;

import java.util.List;

/**
 * Egy kiadás-poszt kiírandó szövege — a {@link EditionVoiceWriter} kimenete és a
 * {@link TeamEditionService#publish} bemenete.
 *
 * <p>{@code voiced=false} a becsületes visszaesés (ADR 0049): a karakterhang nem született meg vagy
 * megbukott a {@link EditionVoiceGuard}-on, ezért a poszt a forrásrekord SAJÁT szövegével megy ki.
 * A fal ettől még teljes: inkább száraz, mint kitalált.
 *
 * <p>{@code guests} (H4, mezo-a9bo7.15): legfeljebb 2 vendég-sor, a jelölt magjainak sorrendjében;
 * mindegyiknek saját {@code voiced} jelzője van — egy megbukott vendég-sor a posztot nem érinti.
 */
public record VoicedText(String title, String body, boolean voiced, List<VoicedGuest> guests) {

    public VoicedText {
        guests = guests == null ? List.of() : List.copyOf(guests);
    }

    public VoicedText(String title, String body, boolean voiced) {
        this(title, body, voiced, List.of());
    }
}
