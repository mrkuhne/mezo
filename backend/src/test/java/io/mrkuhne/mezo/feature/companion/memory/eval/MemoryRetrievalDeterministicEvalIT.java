package io.mrkuhne.mezo.feature.companion.memory.eval;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.EvalQuery;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.EvalSource;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalMetrics.EvalMetrics;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalMetrics.EvalOutcome;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Network-free OLD-vs-NEW regression evaluation over fixed scripted vector geometry.
 *
 * <p>This class is intentionally not transactional: retrieval workers and their audit writes use
 * separate transactions, so fixtures must be committed before those connections can observe them.
 * Its relaxed test-only retriever deadline removes host-load timing from this ranking suite; real
 * latency remains part of the provider-backed release evaluation.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.knowledge-graph.enabled=true",
    "mezo.companion.memory-platform.execution.retriever-timeout-ms=5000"
})
class MemoryRetrievalDeterministicEvalIT extends AbstractIntegrationTest {

    private static final LocalDate AS_OF = LocalDate.of(2026, 9, 5);
    private static final String EMBEDDING_VERSION = "gemini-embedding-001-768-v1";
    private static final String FAKE_REWRITE = "FAKE-ÖNÁLLÓ-KERESŐKÉRDÉS";

    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryEmbeddingPopulator legacyPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryContextService memoryContextService;
    @Autowired private PromptMemoryAssembler legacyAssembler;
    @Autowired private EmbeddingPort embeddingPort;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void testCorpus_shouldKeepScenariosDisjointAndMeetHoldoutMinimums() {
        MemoryEvalCorpus development = SyntheticMemoryCorpusGenerator.load("development");
        MemoryEvalCorpus tuning = SyntheticMemoryCorpusGenerator.load("tuning");
        MemoryEvalCorpus holdout = SyntheticMemoryCorpusGenerator.load("holdout");

        SyntheticMemoryCorpusGenerator.validate(new SyntheticMemoryCorpusGenerator.GeneratedCorpora(
                development, tuning, holdout));

        Set<String> developmentScenarios = scenarioIds(development);
        Set<String> tuningScenarios = scenarioIds(tuning);
        Set<String> holdoutScenarios = scenarioIds(holdout);
        assertThat(developmentScenarios).doesNotContainAnyElementsOf(tuningScenarios);
        assertThat(developmentScenarios).doesNotContainAnyElementsOf(holdoutScenarios);
        assertThat(tuningScenarios).doesNotContainAnyElementsOf(holdoutScenarios);
        assertThat(holdout.queries()).hasSizeGreaterThanOrEqualTo(300);
        assertThat(holdout.queries()).filteredOn(query -> "rich".equals(query.personaId()))
                .hasSizeGreaterThanOrEqualTo(100);
        assertThat(holdout.queries()).filteredOn(query -> "sparse".equals(query.personaId()))
                .hasSizeGreaterThanOrEqualTo(100);
        assertThat(holdout.queries()).filteredOn(query -> "changing".equals(query.personaId()))
                .hasSizeGreaterThanOrEqualTo(100);
    }

    @Test
    void testOwnership_shouldHideDistractorThatRanksForItsActualOwner() {
        MemoryEvalCorpus corpus = SyntheticMemoryCorpusGenerator.load("development");
        Fixture fixture = seed(corpus);
        EvalQuery query = corpus.queries().stream()
                .filter(candidate -> "ownership".equals(candidate.family()))
                .findFirst().orElseThrow();
        EvalSource foreign = corpus.sources().stream()
                .filter(source -> query.scenarioId().equals(source.scenarioId()))
                .filter(EvalSource::foreignDistractor)
                .findFirst().orElseThrow();
        String competitiveQuery = "Saját hétvégi túrám " + fakeAxisMarker(foreign.vectorAxis());

        List<String> rightfulOwnerResults = selectedKeys(memoryContextService.retrieve(new MemoryRequest(
                fixture.owners().get(foreign.personaId()), ConsumerPolicy.CHAT_AMBIENT,
                competitiveQuery, List.of(), AS_OF, 1200, stableUuid("ownership:rightful"), false)), fixture);
        List<String> queryingOwnerResults = selectedKeys(memoryContextService.retrieve(new MemoryRequest(
                fixture.owners().get(query.personaId()), ConsumerPolicy.CHAT_AMBIENT,
                competitiveQuery, List.of(), AS_OF, 1200, stableUuid("ownership:foreign"), false)), fixture);

        assertThat(rightfulOwnerResults).contains(foreign.key());
        assertThat(queryingOwnerResults).doesNotContain(foreign.key());
    }

    @Test
    void testSeed_shouldUseStableMemoryItemIds() {
        MemoryEvalCorpus corpus = SyntheticMemoryCorpusGenerator.load("development");
        Fixture fixture = seed(corpus);
        EvalSource source = corpus.sources().getFirst();

        assertThat(fixture.itemIdBySourceKey().get(source.key()))
                .isEqualTo(stableUuid(source.key() + ":memory-item"));
    }

    @Test
    void testCompare_shouldMeetSmokeFloor_onDevelopmentSplit() {
        Comparison comparison = compare(SyntheticMemoryCorpusGenerator.load("development"));

        assertSmokeFloor(comparison);
    }

    @Test
    void testCompare_shouldMatchHumanApprovedHoldoutAndMeetSmokeFloor() {
        MemoryEvalCorpus holdout = SyntheticMemoryCorpusGenerator.load("holdout");
        SyntheticMemoryCorpusGenerator.loadApprovedReview(holdout);

        assertSmokeFloor(compare(holdout));
    }

    private Comparison compare(MemoryEvalCorpus corpus) {
        Fixture fixture = seed(corpus);
        List<EvalOutcome> legacy = new ArrayList<>();
        List<EvalOutcome> candidate = new ArrayList<>();
        for (EvalQuery query : corpus.queries()) {
            UUID owner = fixture.owners().get(query.personaId());
            String deterministicQuery = deterministicQuery(query, fixture);
            legacy.add(runLegacy(query, owner, deterministicQuery, fixture));
            candidate.add(runCandidate(query, owner, deterministicQuery, fixture));
        }
        return new Comparison(
                MemoryEvalMetrics.evaluate(corpus.queries(), legacy),
                MemoryEvalMetrics.evaluate(corpus.queries(), candidate));
    }

    private Fixture seed(MemoryEvalCorpus corpus) {
        Map<String, UUID> owners = new LinkedHashMap<>();
        SyntheticMemoryCorpusGenerator.PERSONAS.forEach(persona -> owners.put(
                persona.id(), databasePopulator.populateUser("memory-eval-" + persona.id() + "@test.local")));
        Map<String, EvalSource> sourcesByKey = new HashMap<>();
        Map<UUID, String> sourceKeyById = new HashMap<>();
        Map<String, UUID> itemIdBySourceKey = new HashMap<>();
        for (EvalSource source : corpus.sources()) {
            UUID owner = owners.get(source.personaId());
            UUID sourceId = stableUuid(source.key());
            float[] vector = sourceVector(source);
            legacyPopulator.embedding(
                    owner, source.sourceKind(), sourceId, source.content(), source.occurredOn(), vector);
            MemoryItemEntity item = memoryPopulator.item(
                    owner, source.sourceKind(), sourceId, source.content(), source.occurredOn());
            replaceGeneratedId(item, stableUuid(source.key() + ":memory-item"));
            item.setSalience(BigDecimal.valueOf(source.salience()));
            item.setState(source.state());
            itemRepository.saveAndFlush(item);
            memoryPopulator.vector(item, EMBEDDING_VERSION, vector);
            sourcesByKey.put(source.key(), source);
            sourceKeyById.put(sourceId, source.key());
            itemIdBySourceKey.put(source.key(), item.getId());
        }
        return new Fixture(owners, sourcesByKey, sourceKeyById, itemIdBySourceKey);
    }

    private void replaceGeneratedId(MemoryItemEntity item, UUID stableId) {
        int updated = jdbcTemplate.update(
                "update memory_item set id = ? where id = ?", stableId, item.getId());
        assertThat(updated).isOne();
        item.setId(stableId);
    }

    private EvalOutcome runLegacy(
            EvalQuery query, UUID owner, String deterministicQuery, Fixture fixture) {
        PromptMemoryAssembler.AmbientRecall result = legacyAssembler.recall(
                owner, stableUuid(query.id() + ":old"), deterministicQuery, AS_OF);
        List<String> selected = result.items().stream()
                .map(item -> fixture.sourceKeyById().get(item.refId()))
                .filter(java.util.Objects::nonNull)
                .toList();
        return outcome(query, selected, selected, fixture);
    }

    private EvalOutcome runCandidate(
            EvalQuery query, UUID owner, String deterministicQuery, Fixture fixture) {
        MemoryContext result = memoryContextService.retrieve(new MemoryRequest(
                owner, ConsumerPolicy.CHAT_AMBIENT, deterministicQuery, query.history(), AS_OF,
                1200, stableUuid(query.id() + ":new"), false));
        List<String> selected = result.items().stream()
                .map(item -> fixture.sourceKeyById().get(item.sourceId()))
                .filter(java.util.Objects::nonNull)
                .toList();
        return outcome(query, selected, selected, fixture);
    }

    private static List<String> selectedKeys(MemoryContext context, Fixture fixture) {
        return context.items().stream()
                .map(item -> fixture.sourceKeyById().get(item.sourceId()))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private EvalOutcome outcome(
            EvalQuery query, List<String> ranked, List<String> selected, Fixture fixture) {
        int ownershipLeaks = (int) ranked.stream()
                .map(fixture.sourcesByKey()::get)
                .filter(source -> source != null && !query.personaId().equals(source.personaId()))
                .count();
        return new EvalOutcome(query.id(), ranked, selected, ownershipLeaks);
    }

    private String deterministicQuery(EvalQuery query, Fixture fixture) {
        if (query.expectsEmpty()) {
            return query.query();
        }
        EvalSource required = query.relevanceBySourceKey().entrySet().stream()
                .filter(entry -> entry.getValue() == 2)
                .findFirst()
                .map(Map.Entry::getKey)
                .map(fixture.sourcesByKey()::get)
                .orElseThrow();
        if ("follow_up".equals(query.family())) {
            return query.query();
        }
        return query.query() + ' ' + fakeAxisMarker(required.vectorAxis());
    }

    private float[] sourceVector(EvalSource source) {
        if (source.scenarioId().contains(":follow_up:") && source.key().endsWith(":01")) {
            return embeddingPort.embedQuery(FAKE_REWRITE);
        }
        return axisVector(source.vectorAxis());
    }

    private static String fakeAxisMarker(int axis) {
        StringBuilder marker = new StringBuilder("[fake-embed:");
        for (int index = 0; index <= axis; index++) {
            if (index > 0) {
                marker.append(' ');
            }
            marker.append(index == axis ? '1' : '0');
        }
        return marker.append(']').toString();
    }

    private static void assertSmokeFloor(Comparison comparison) {
        System.out.println("Deterministic memory eval: " + comparison);
        assertThat(comparison.legacy().ownershipLeaks()).isZero();
        assertThat(comparison.candidate().ownershipLeaks()).isZero();
        assertThat(comparison.candidate().recallAt5()).isGreaterThanOrEqualTo(0.40);
        assertThat(comparison.candidate().ndcgAt5()).isGreaterThanOrEqualTo(0.40);
        assertThat(comparison.candidate().mrr()).isGreaterThanOrEqualTo(0.40);
        assertThat(comparison.candidate().contextPrecision()).isGreaterThanOrEqualTo(0.05);
        assertThat(comparison.candidate().emptyFalsePositiveRate()).isZero();
    }

    private static Set<String> scenarioIds(MemoryEvalCorpus corpus) {
        Set<String> result = new HashSet<>();
        corpus.queries().forEach(query -> result.add(query.scenarioId()));
        return result;
    }

    private static UUID stableUuid(String value) {
        return UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8));
    }

    private record Fixture(
            Map<String, UUID> owners,
            Map<String, EvalSource> sourcesByKey,
            Map<UUID, String> sourceKeyById,
            Map<String, UUID> itemIdBySourceKey) {
    }

    private record Comparison(EvalMetrics legacy, EvalMetrics candidate) {
    }
}
