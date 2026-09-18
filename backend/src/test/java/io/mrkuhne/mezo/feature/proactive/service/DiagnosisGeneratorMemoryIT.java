package io.mrkuhne.mezo.feature.proactive.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Memória mindenhol S9 (bd mezo-eq85.9): the fatigue diagnosis's PURE-CODE gather ({@link
 * FatigueEvidenceCollector}) appends a {@code [Hosszú távú memória]} block via {@link
 * io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock} — the {@code
 * PredictionGeneratorMemoryIT} idiom, applied to the diagnosis path. {@code deep = true} (unlike
 * the other three Part-B surfaces of this task) — diagnosis is an offline SMART-tier pass, nobody
 * is waiting on it (see {@code DiagnosisGenerator#CONTEXT}'s javadoc). Query is the evidence
 * candidates' own label/detail lines joined — the task-9 brief's "fatigue evidence summary line",
 * built purely from what {@code FatigueGather} already collects.
 *
 * <p>Per the task-9 codebase notes' Deviation 1, no memory entry is added to {@code
 * FatigueGather.candidates()} — that list is BOTH the model's {@code evidenceIndexes} contract AND
 * is persisted verbatim into {@code DiagnosisEvidenceEnvelope}; a new {@code EvidenceItem} kind
 * would be a contract change out of scope. Deviation 2: the raw {@code knowledgeFactRepository}
 * read in {@code FatigueEvidenceCollector.gather} is left untouched — replacing it with {@code
 * renderPromptBlock} would delete indexed candidates and silently shift every index after them.
 *
 * <p>No class-level {@code @Transactional} — the house rule these generator ITs already follow
 * ({@code DiagnosisGeneratorIT}, {@code FatigueEvidenceCollectorIT}), which also happens to be
 * what a real memory retrieval needs (committed fixtures, no shared test connection to starve).
 */
@ActiveProfiles("companion-fake")
class DiagnosisGeneratorMemoryIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private DiagnosisGenerator generator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    /** The {@code DiagnosisGeneratorIT} precedent: enough domain coverage to clear the
     *  {@code minDomains} gate so {@code gather} — and therefore the memory retrieval it now
     *  wraps — actually runs. */
    private void seedTwoDomains(UUID user) {
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("6.0"), 6);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 4, 7, null);
        }
        for (int i = 14; i < 42; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("7.5"), 8);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 8, 3, null);
        }
    }

    @Test
    void testGenerate_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID user = userPopulator.createUser("diagnosis-memory-hit@test.local").getId();
        seedTwoDomains(user);
        item(user, "Régen is hasonló fáradtságot éltél át.");

        generator.generate(user, TODAY);

        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(runRepository.findAll()).filteredOn(run -> user.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("PREDICTION_EVIDENCE"));
    }

    @Test
    void testGenerate_shouldStillRun_whenMemoryEmbeddingFails() {
        UUID user = userPopulator.createUser("diagnosis-memory-fail-embed@test.local").getId();
        seedTwoDomains(user);
        // The diagnosis memory query is the evidence candidates' own label/detail lines joined —
        // a CONFIRMED pattern becomes a "pattern"-kind candidate whose label is its title, so the
        // marker riding the pattern title reaches the query with no new read.
        PatternEntity marker = patternPopulator.createPattern(user,
                "pair-" + UUID.randomUUID().toString().substring(0, 8),
                "Fáradtság mintázat " + FakeEmbeddingAdapter.FAIL_EMBED);
        marker.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(marker);
        item(user, "Régen is hasonló fáradtságot éltél át.");

        generator.generate(user, TODAY);

        assertDenseRetrieverFailed(user);
    }

    private void item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", content, TODAY.minusDays(3), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }

    /** The Task-7/8 {@code assertDenseRetrieverFailed} precedent, adapted for
     *  {@code PREDICTION_EVIDENCE}. */
    private void assertDenseRetrieverFailed(UUID user) {
        assertThat(runRepository.findAll()).filteredOn(run -> user.equals(run.getCreatedBy()))
                .anySatisfy(run -> {
                    assertThat(run.getConsumerPolicy()).isEqualTo("PREDICTION_EVIDENCE");
                    Object denseTraceRaw = run.getRetrieverTrace().get("dense");
                    assertThat(denseTraceRaw).isNotNull();
                    Map<?, ?> denseTrace = (Map<?, ?>) denseTraceRaw;
                    assertThat(denseTrace.get("error")).isNotNull();
                });
    }
}
