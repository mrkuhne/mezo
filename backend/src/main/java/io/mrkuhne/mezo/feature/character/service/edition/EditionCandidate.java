package io.mrkuhne.mezo.feature.character.service.edition;

import io.mrkuhne.mezo.feature.character.entity.EditionRef;
import java.time.Instant;
import java.util.List;

/** Egy esti kiadás jelölt — a válogatás (EditionSelector) bemenete. {@code guests} (H4,
 *  mezo-a9bo7.15): legfeljebb 2 vendég-mag — kik szólhatnak hozzá a poszthoz. */
public record EditionCandidate(
        String sourceKind,
        String sourceId,
        TeamCharacter character,
        EditionGenre genre,
        String title,
        String recordText,
        List<String> facts,
        List<EditionRef> refs,
        boolean waiting,
        boolean claimChange,
        Instant changedAt,
        String sourceRoute,
        List<GuestSeed> guests) {

    /** Legfeljebb ennyi vendég-sor kerülhet egy posztra (spec §3.4, H4). */
    public static final int MAX_GUESTS = 2;

    public EditionCandidate {
        guests = guests == null ? List.of() : List.copyOf(guests.subList(0, Math.min(guests.size(), MAX_GUESTS)));
    }

    public String sourceKey() {
        return sourceKind + ":" + sourceId;
    }
}
