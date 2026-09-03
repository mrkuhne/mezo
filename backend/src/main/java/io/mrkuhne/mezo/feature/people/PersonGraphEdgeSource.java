package io.mrkuhne.mezo.feature.people;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Fogyasztó-tulajdonú port (ADR 0012, a {@code NarrativeNoteSource} idióma): a személy
 * részletek-oldala mutatja a személyhez kötött gráf-éleket, de a {@code people} feature NEM
 * függhet a {@code companion}tól (a fordított él már létezik, ez kört zárna). Ezért a people
 * deklarálja, mire van szüksége, lapos rekordokban, és a graph-oldali adapter tölti fel.
 *
 * <p>Kikapcsolt gráfnál nincs implementáció — a {@code PeopleService} {@code ObjectProvider}-en
 * át kéri, és üres térképpel dolgozik tovább.
 */
public interface PersonGraphEdgeSource {

    /**
     * Egy él a személy node-jából (vagy felé) nézve, a felhasználónak megmutatható alakban.
     *
     * @param nodeKind a MÁSIK végpont node-fajtája (GOAL, LIFE_EVENT, PATTERN, …)
     * @param title    a másik végpont címe
     * @param relationHu magyar kapcsolat-ige a személy felől nézve („támogatja", „kapcsolódik")
     * @param strength „erős" | „közepes" | „gyenge"
     */
    record Edge(String nodeKind, String title, String relationHu, String strength) {
    }

    /** Személy-id → élei, súly szerint csökkenő sorrendben, személyenként legfeljebb 3. */
    Map<UUID, List<Edge>> edgesByPerson(UUID userId);
}
