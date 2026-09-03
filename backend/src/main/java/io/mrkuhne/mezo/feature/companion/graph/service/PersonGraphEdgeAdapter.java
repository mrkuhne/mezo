package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.people.PersonGraphEdgeSource;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A {@link PersonGraphEdgeSource} graph-oldali megvalósítása (Emberek S5, mezo-06o0.4): a
 * személy PERSON node-jának legerősebb éleit adja vissza a részletek-oldalnak, ugyanazzal a
 * magyar szótárral, amit a {@code [Összefüggések]} prompt-blokk és a {@code
 * GraphNodeResponse.topEdges} használ ({@link GraphEdgeLineRenderer}) — ezért él ebben a
 * package-ben: a renderer package-private.
 *
 * <p>Egy él csak akkor számít, ha a MÁSIK végpontja is aktív node — egy archivált csomópontot
 * megnevező csempe zavarna, nem tájékoztatna (a {@code listActiveWithTopEdges} ugyanezt a
 * szabályt követi).
 *
 * <p>{@code @ConditionalOnProperty}: kikapcsolt gráfnál ez a bean nem létezik, és a
 * {@code PeopleService} üres térképpel dolgozik tovább.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class PersonGraphEdgeAdapter implements PersonGraphEdgeSource {

    /** Ugyanaz a megjelenítési sapka, mint a Tudásgráf csomópont-kártyáin. */
    private static final int MAX_EDGES_PER_PERSON = 3;

    private final GraphService graphService;

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<Edge>> edgesByPerson(UUID userId) {
        List<GraphNodeEntity> active = graphService.listActive(userId);
        Map<UUID, GraphNodeEntity> activeById = new HashMap<>();
        for (GraphNodeEntity node : active) {
            activeById.put(node.getId(), node);
        }
        Map<UUID, List<Edge>> byPerson = new HashMap<>();
        for (GraphNodeEntity node : active) {
            if (!GraphPromotionService.SOURCE_PERSON.equals(node.getSourceKind()) || node.getSourceId() == null) {
                continue;
            }
            List<GraphEdgeEntity> touching = new ArrayList<>(graphService.edgesFrom(userId, node.getId()));
            touching.addAll(graphService.edgesTo(userId, node.getId()));
            // A rendezés a NYERS élsúlyon történik, MIELŐTT Edge-re mappelnénk: az Edge már csak
            // a durva „erős/közepes/gyenge" szót hordozza, azon rendezni elveszítené a sorrendet.
            List<Edge> edges = touching.stream()
                .sorted(Comparator.comparing(GraphEdgeEntity::getWeight,
                    Comparator.nullsLast(Comparator.reverseOrder())))
                .map(e -> toEdge(node, e, activeById))
                .filter(java.util.Objects::nonNull)
                .limit(MAX_EDGES_PER_PERSON)
                .toList();
            if (!edges.isEmpty()) {
                byPerson.put(node.getSourceId(), edges);
            }
        }
        return byPerson;
    }

    /** null, ha a másik végpont nem aktív node (archivált/jelölt/törölt). */
    private Edge toEdge(GraphNodeEntity personNode, GraphEdgeEntity edge, Map<UUID, GraphNodeEntity> activeById) {
        UUID otherId = personNode.getId().equals(edge.getFromNodeId()) ? edge.getToNodeId() : edge.getFromNodeId();
        GraphNodeEntity other = activeById.get(otherId);
        if (other == null) {
            return null;
        }
        return new Edge(other.getKind(), other.getTitle(),
            GraphEdgeLineRenderer.KIND_VERBS.getOrDefault(edge.getKind(), edge.getKind()),
            GraphEdgeLineRenderer.strength(edge.getWeight()));
    }
}
