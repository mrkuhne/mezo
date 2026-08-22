package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphProposedEdge;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.LifeEventExtractionService;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** W2.3 (bd mezo-b3pp.8, spec §6.3): the nightly extractor PROPOSES life events and nothing more —
 *  candidates only, one LLM call per night at most, and a silent night costs no call at all. */
@ActiveProfiles("companion-fake")
class LifeEventExtractionServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 21);

    @Autowired private LifeEventExtractionService extractionService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private GraphEdgeRepository edgeRepository;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /** The scripted answer is planted in the narrative itself (the FakeCompanionLlm sentinel idiom):
     *  index 0 is the single existing active node the prompt lists. */
    private String scripted(String json) {
        return "Ma elkezdtem az új munkahelyemen. [fake-life-events:" + json + "]";
    }

    private JournalEntryEntity createEntry(UUID owner, LocalDate day, String text) {
        return journalPopulator.createEntry(owner, day, text, JournalEntryEntity.SOURCE_QUICKINPUT);
    }

    @Test
    void testExtractFor_shouldMakeNoLlmCallAndNoCandidates_whenTheDayHasNoNarrative() {
        UUID owner = ownerId();
        int before = fakeCompanionLlm.completeCallCount();

        assertThat(extractionService.extractFor(owner, DAY)).isZero();

        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);   // emptiness gate
        assertThat(nodeRepository.findAll()).isEmpty();
    }

    @Test
    void testExtractFor_shouldCreateCandidateWithProposedEdges_whenNarrativeExists() {
        UUID owner = ownerId();
        GraphNodeEntity existing = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Stressz rontja az alvást");
        createEntry(owner, DAY, scripted(
            "[{\"title\":\"Új munkahely első napja\",\"summary\":\"Elkezdtem az új helyen.\","
                + "\"edges\":[{\"index\":0,\"kind\":\"TRIGGERS\",\"confidence\":0.8}]}]"));

        assertThat(extractionService.extractFor(owner, DAY)).isEqualTo(1);

        List<GraphNodeEntity> nodes = nodeRepository.findAll().stream()
            .filter(n -> GraphNodeEntity.KIND_LIFE_EVENT.equals(n.getKind())).toList();
        assertThat(nodes).singleElement().satisfies(n -> {
            assertThat(n.getStatus()).isEqualTo(GraphNodeEntity.STATUS_CANDIDATE);
            assertThat(n.getTitle()).isEqualTo("Új munkahely első napja");
            assertThat(n.getSourceKind()).isEqualTo(LifeEventExtractionService.SOURCE_EXTRACTOR);
            assertThat(n.getSourceId()).isNull();
            assertThat(n.getOccurredOn()).isEqualTo(DAY);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> proposed =
                (List<Map<String, Object>>) n.getMeta().get(GraphProposedEdge.META_KEY);
            assertThat(proposed).singleElement().satisfies(p -> {
                assertThat(p).containsEntry("kind", "TRIGGERS");
                assertThat(p.get("toNodeId")).isEqualTo(existing.getId().toString());
            });
        });
        // extraction NEVER writes edges — proposals stay in meta until the user confirms
        assertThat(edgeRepository.findAll()).isEmpty();
    }

    @Test
    void testExtractFor_shouldDropProposedEdge_whenConfidenceIsBelowTheFloorOrKindIsNotAllowed() {
        UUID owner = ownerId();
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Stressz rontja az alvást");
        createEntry(owner, DAY, scripted(
            "[{\"title\":\"Csendes nap\",\"summary\":null,\"edges\":["
                + "{\"index\":0,\"kind\":\"TRIGGERS\",\"confidence\":0.05},"
                + "{\"index\":0,\"kind\":\"SUPPORTS\",\"confidence\":0.9},"
                + "{\"index\":9,\"kind\":\"TRIGGERS\",\"confidence\":0.9}]}]"));

        assertThat(extractionService.extractFor(owner, DAY)).isEqualTo(1);

        GraphNodeEntity node = nodeRepository.findAll().stream()
            .filter(n -> GraphNodeEntity.KIND_LIFE_EVENT.equals(n.getKind())).findFirst().orElseThrow();
        assertThat((List<?>) node.getMeta().get(GraphProposedEdge.META_KEY)).isEmpty();
    }

    @Test
    void testExtractFor_shouldBeIdempotentPerDay_whenRunTwice() {
        UUID owner = ownerId();
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Stressz rontja az alvást");
        createEntry(owner, DAY, scripted(
            "[{\"title\":\"Új munkahely első napja\",\"summary\":null,\"edges\":[]}]"));

        assertThat(extractionService.extractFor(owner, DAY)).isEqualTo(1);
        int afterFirst = fakeCompanionLlm.completeCallCount();

        assertThat(extractionService.extractFor(owner, DAY)).isZero();
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(afterFirst);   // no second call
        assertThat(nodeRepository.findAll()).hasSize(2);   // the seed PATTERN + the one candidate
    }

    @Test
    void testExtractFor_shouldNotResurrectRejectedCandidates_whenTheDayIsReprocessed() {
        UUID owner = ownerId();
        createEntry(owner, DAY, scripted(
            "[{\"title\":\"Új munkahely első napja\",\"summary\":null,\"edges\":[]}]"));
        assertThat(extractionService.extractFor(owner, DAY)).isEqualTo(1);
        GraphNodeEntity candidate = nodeRepository.findAll().stream()
            .filter(n -> GraphNodeEntity.KIND_LIFE_EVENT.equals(n.getKind())).findFirst().orElseThrow();
        nodeRepository.delete(candidate);   // the user rejected it

        assertThat(extractionService.extractFor(owner, DAY)).isZero();
        assertThat(nodeRepository.findAll()).isEmpty();
    }

    @Test
    void testExtractFor_shouldDegradeToNoCandidates_whenTheModelAnswerIsUnparseable() {
        UUID owner = ownerId();
        createEntry(owner, DAY,
            "Ma történt valami. " + FakeCompanionLlm.LIFE_EVENTS_BROKEN);

        assertThat(extractionService.extractFor(owner, DAY)).isZero();
        assertThat(nodeRepository.findAll()).isEmpty();
    }
}
