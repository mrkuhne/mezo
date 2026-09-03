package io.mrkuhne.mezo.feature.people;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Fogyasztó-tulajdonú port (a {@link PersonGraphEdgeSource} és a
 * {@code feature/companion/NarrativeNoteSource} idiómája): az Emberek hub Mezo-sávja a mai
 * {@code people} companion-üzenetet mutatja, de a {@code people} feature NEM függhet a
 * {@code proactive}tól — a fordított él (a generátor olvassa a személyeket) ebben a szeletben
 * született meg, tehát ez kört zárna.
 *
 * <p>Üres {@link Optional}: ma még nincs ilyen üzenet (a hajnali futás kimaradt, a proaktív
 * kapcsoló ki van kapcsolva, vagy az adat-kapu nem engedte). A hívó ilyenkor a saját
 * determinisztikus tartalék-mondatát mutatja — a sáv sosem üres.
 */
public interface PeopleMezoNoteSource {

    Optional<String> todaysNote(UUID userId, LocalDate today);
}
