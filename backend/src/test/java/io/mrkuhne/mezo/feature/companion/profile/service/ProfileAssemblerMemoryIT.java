package io.mrkuhne.mezo.feature.companion.profile.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Memória mindenhol S10 part 2 (bd mezo-eq85.10, task-10-codebase-notes.md §4): the weekly/
 * quarterly profile rebuild appends a {@code [Hosszú távú memória]} block, built from the
 * rollup digest, via {@link io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock}
 * under {@code CHARACTER_EVIDENCE} — the {@code MemoirGeneratorMemoryIT} idiom applied to
 * {@code ProfileAssembler}. {@code rebuild} carries no {@code @Transactional} (see
 * {@code ProfileAssembler.self}'s javadoc — the memory retrieval runs OUTSIDE any transaction on
 * purpose, resolving the HAZARD notes §4 describes).
 */
@ActiveProfiles("companion-fake")
class ProfileAssemblerMemoryIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private ProfileAssembler assembler;
    @Autowired private FeedbackPopulator feedbackPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FeedbackLearningService feedbackLearningService;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;

    private static LocalDate currentQuarter() {
        return Quarters.startOf(LocalDate.now());
    }

    private UUID seedSignal() {
        UUID owner = userPopulator.createUser("profile-memory@test.local").getId();
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "down", "too_much");
        journalPopulator.createReviewedDecision(
                owner, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált.");
        feedbackLearningService.computeRollups(owner);
        return owner;
    }

    @Test
    void testRebuild_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID owner = seedSignal();
        item(owner, "Régen is jól reagált a rövid üzenetekre.");

        Optional<UUID> nodeId = assembler.rebuild(owner, currentQuarter());

        assertThat(nodeId).isPresent();
        assertThat(fakeCompanionLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(fakeCompanionLlm.lastUserMessage()).contains("source=journal_entry");
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("CHARACTER_EVIDENCE"));
    }

    @Test
    void testRebuild_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID owner = userPopulator.createUser("profile-memory-fail-embed@test.local").getId();
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "down", "too_much");
        journalPopulator.createReviewedDecision(
                owner, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált.");
        feedbackLearningService.computeRollups(owner);
        // The rollup lines themselves are pure arithmetic (no room for a text marker) — the
        // memory query also carries the habit-node titles (production code, renderPayload), which
        // IS free text, so the marker is planted there.
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN,
                "Rövid üzenetek. " + FakeEmbeddingAdapter.FAIL_EMBED);
        item(owner, "Régen is jól reagált a rövid üzenetekre.");

        Optional<UUID> nodeId = assembler.rebuild(owner, currentQuarter());

        assertThat(nodeId).isPresent();
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> {
                    assertThat(run.getConsumerPolicy()).isEqualTo("CHARACTER_EVIDENCE");
                    Object denseTraceRaw = run.getRetrieverTrace().get("dense");
                    assertThat(denseTraceRaw).isNotNull();
                    Map<?, ?> denseTrace = (Map<?, ?>) denseTraceRaw;
                    assertThat(denseTrace.get("error")).isNotNull();
                });
    }

    private void item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", content, LocalDate.now().minusDays(3), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }
}
