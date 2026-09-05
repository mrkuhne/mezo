package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContextItem;
import io.mrkuhne.mezo.feature.companion.memory.dto.ScoreBreakdown;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextRenderer;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextSelector;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MemoryContextSelectorTest {

    private final MemoryContextRenderer renderer = new MemoryContextRenderer(
            MemoryCandidateFusionTest.properties());
    private final MemoryContextSelector selector = new MemoryContextSelector(renderer);

    @Test
    void testSelect_shouldCollapseNearDuplicatesAndCapChatTurns_whenCandidatesOverlap() {
        UUID conversation = UUID.randomUUID();
        List<FusedCandidate> ranked = List.of(
                fused("Első beszélgetés-emlék a futásról.", "chat_turn", UUID.randomUUID(),
                        conversation, false, null, 10),
                fused("Masodik beszelgetes emlek a futasrol", "chat_turn", UUID.randomUUID(),
                        conversation, false, null, 9),
                fused("Harmadik teljesen más beszélgetés-emlék.", "chat_turn", UUID.randomUUID(),
                        conversation, false, null, 8),
                fused("Negyedik teljesen más beszélgetés-emlék.", "chat_turn", UUID.randomUUID(),
                        conversation, false, null, 7));

        List<FusedCandidate> selected = selector.select(ranked, 500);

        assertThat(selected).hasSize(2);
    }

    @Test
    void testSelect_shouldKeepConflictPair_whenConflictingContentsAreSimilar() {
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        List<FusedCandidate> ranked = List.of(
                fused(firstId, "A reggeli kávé javítja az alvást.", "knowledge_fact", firstId,
                        null, true, secondId, 10),
                fused(secondId, "A reggeli kávé nem javítja az alvást.", "knowledge_fact", secondId,
                        null, true, firstId, 9));

        assertThat(selector.select(ranked, 500)).hasSize(2);
    }

    @Test
    void testSelect_shouldKeepExactConflictPair_whenTwoPairsAreInterleaved() {
        UUID firstId = UUID.randomUUID();
        UUID firstPeerId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        UUID secondPeerId = UUID.randomUUID();
        List<FusedCandidate> ranked = List.of(
                fused(firstId, "Első állítás.", "knowledge_fact", firstId, null, true, firstPeerId, 10),
                fused(secondId, "Második állítás.", "knowledge_fact", secondId, null, true, secondPeerId, 9),
                fused(secondPeerId, "Második ellenállítás.", "knowledge_fact", secondPeerId,
                        null, true, secondId, 8),
                fused(firstPeerId, "Első ellenállítás.", "knowledge_fact", firstPeerId,
                        null, true, firstId, 7));

        assertThat(selector.select(ranked, 500))
                .extracting(item -> item.candidate().stableId())
                .containsExactly(firstId, firstPeerId, secondId, secondPeerId);
    }

    @Test
    void testSelect_shouldKeepStandaloneGraphConflict_whenEdgeAlreadyContainsBothSides() {
        FusedCandidate ordinary = fused("Alvás --CONFLICTS--> késői kávé", "journal_entry",
                UUID.randomUUID(), false, 11);
        FusedCandidate edge = fused("Alvás --CONFLICTS--> késői kávé", "knowledge_edge",
                UUID.randomUUID(), null, true, null, 10);

        assertThat(selector.select(List.of(ordinary, edge), 500)).containsExactly(ordinary, edge);
    }

    @Test
    void testRender_shouldStayWithinTokenBudgetAndNeverCutSelectedContent() {
        String content = "Ez egy teljes, rövid emlék.";
        FusedCandidate first = fused(content, "journal_entry", UUID.randomUUID(), false, 10);
        FusedCandidate second = fused("Ez a második elem már nem férhet bele a keretbe.",
                "journal_entry", UUID.randomUUID(), false, 9);
        List<FusedCandidate> selected = selector.select(List.of(first, second), 25);
        List<MemoryContextItem> items = selected.stream().map(this::contextItem).toList();

        String block = renderer.render(items, 25);

        assertThat(block.length()).isLessThanOrEqualTo(25 * 3);
        assertThat(block).contains(content);
        assertThat(block).doesNotContain("már nem férhet");
    }

    @Test
    void testSelect_shouldIncludeRenderedIndicatorLength_whenCheckingExactBudget() {
        LocalDate asOf = LocalDate.of(2026, 9, 5);
        FusedCandidate old = withOccurredOn(fused("Pont a keret szélén lévő emlék.",
                "journal_entry", UUID.randomUUID(), false, 10), asOf.minusDays(400));
        MemoryContextItem oldItem = contextItem(old, asOf.minusDays(400), asOf);
        MemoryContextItem recentItem = contextItem(old, asOf.minusDays(1), asOf);
        int budgetThatFitsOnlyWithoutIndicator = (renderer.render(List.of(recentItem), 500).length() + 3) / 3;

        assertThat(selector.select(List.of(old), budgetThatFitsOnlyWithoutIndicator, asOf)).isEmpty();
        assertThat(renderer.render(List.of(oldItem), budgetThatFitsOnlyWithoutIndicator)).isEmpty();
    }

    private FusedCandidate fused(
            String content, String sourceKind, UUID sourceId, boolean conflicting, double finalScore) {
        return fused(content, sourceKind, sourceId, null, conflicting, null, finalScore);
    }

    private FusedCandidate fused(
            String content, String sourceKind, UUID sourceId, UUID diversityGroupId,
            boolean conflicting, UUID conflictingWithId, double finalScore) {
        UUID stableId = UUID.randomUUID();
        return fused(stableId, content, sourceKind, sourceId, diversityGroupId,
                conflicting, conflictingWithId, finalScore);
    }

    private FusedCandidate fused(
            UUID stableId, String content, String sourceKind, UUID sourceId, UUID diversityGroupId,
            boolean conflicting, UUID conflictingWithId, double finalScore) {
        MemoryCandidate candidate = new MemoryCandidate("dense", "memory_item", stableId, stableId,
                sourceId, sourceKind, "Címke", content, LocalDate.of(2026, 9, 1), 1.0,
                false, conflicting, 0.5, diversityGroupId, conflictingWithId);
        ScoreBreakdown score = new ScoreBreakdown(0.01, 0, 0, 0, 0, 0, finalScore);
        return new FusedCandidate(candidate, score, Map.of("dense", 1));
    }

    private MemoryContextItem contextItem(FusedCandidate item) {
        MemoryCandidate candidate = item.candidate();
        return new MemoryContextItem(null, candidate.memoryItemId(), candidate.sourceId(),
                candidate.sourceKind(), candidate.label(), candidate.content(), candidate.occurredOn(),
                renderer.indicator(candidate, LocalDate.of(2026, 9, 5)), item.score());
    }

    private MemoryContextItem contextItem(FusedCandidate item, LocalDate occurredOn, LocalDate asOf) {
        MemoryCandidate original = item.candidate();
        MemoryCandidate dated = new MemoryCandidate(original.retriever(), original.candidateKind(),
                original.stableId(), original.memoryItemId(), original.sourceId(), original.sourceKind(),
                original.label(), original.content(), occurredOn, original.localScore(), original.pinned(),
                original.conflicting(), original.salience(), original.diversityGroupId(), original.conflictingWithId());
        return new MemoryContextItem(null, dated.memoryItemId(), dated.sourceId(), dated.sourceKind(),
                dated.label(), dated.content(), dated.occurredOn(), renderer.indicator(dated, asOf), item.score());
    }

    private FusedCandidate withOccurredOn(FusedCandidate item, LocalDate occurredOn) {
        MemoryCandidate original = item.candidate();
        MemoryCandidate dated = new MemoryCandidate(original.retriever(), original.candidateKind(),
                original.stableId(), original.memoryItemId(), original.sourceId(), original.sourceKind(),
                original.label(), original.content(), occurredOn, original.localScore(), original.pinned(),
                original.conflicting(), original.salience(), original.diversityGroupId(), original.conflictingWithId());
        return new FusedCandidate(dated, item.score(), item.retrieverRanks());
    }
}
