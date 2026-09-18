package io.mrkuhne.mezo.feature.proactive;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.proactive.service.ChallengeGenerator;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Memória mindenhol S9 (bd mezo-eq85.9): the challenge generator's own gather appends a {@code
 * [Hosszú távú memória]} block via {@link
 * io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock} — the {@code
 * PredictionGeneratorMemoryIT} idiom, applied to {@code ChallengeGenerator}. Query is the
 * CONFIRMED-pattern candidates' own titles joined (this generator's ONE pattern-typed list); the
 * task-9 codebase notes forbid a memory entry in ANY of this generator's three index-contracted
 * lists ({@code exercises}, {@code patterns}, {@code refCandidates}), so these tests assert the
 * block's presence and the audited run only.
 *
 * <p>No class-level {@code @Transactional} — same {@code ChallengeGeneratorIT} rationale
 * (emit-under-{@code REQUIRES_NEW} deadlock risk, bd mezo-gzhp.1).
 */
@ActiveProfiles("companion-fake")
class ChallengeGeneratorMemoryIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private ChallengeGenerator generator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    /** Template session + one exercise with logged-set history — the grounding gate. */
    private WorkoutSessionEntity seedTemplateWithHistory(UUID user) {
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Meso", "active");
        WorkoutSessionEntity session =
                trainPopulator.createWorkoutSession(user, meso.getId(), "Pull", "pull", 0, "planned");
        ExerciseEntity ex = trainPopulator.createExercise(user, session.getId(), "Chest Supported Row", 0);
        trainPopulator.createExerciseSet(user, ex.getId(), 0);
        trainPopulator.createExerciseSet(user, ex.getId(), 1);
        return session;
    }

    @Test
    void testGenerate_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID user = userPopulator.createUser("challenge-memory-hit@test.local").getId();
        WorkoutSessionEntity session = seedTemplateWithHistory(user);
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        item(user, "Régen is hasonló mintát figyeltél meg.");

        generator.generate(user, session.getId(), LocalDate.now());

        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(runRepository.findAll()).filteredOn(run -> user.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("PREDICTION_EVIDENCE"));
    }

    @Test
    void testGenerate_shouldStillRun_whenMemoryEmbeddingFails() {
        UUID user = userPopulator.createUser("challenge-memory-fail-embed@test.local").getId();
        WorkoutSessionEntity session = seedTemplateWithHistory(user);
        // The challenge memory query is the CONFIRMED-pattern candidates' own titles joined — the
        // ONLY text it is built from. patternPopulator.statistical always titles the row
        // "Alvásminőség ↔ másnapi edzés-RPE"; the marker rides a second, custom-titled pattern.
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        PatternEntity marker = patternPopulator.createPattern(user, "sleep~mood",
                "Hangulat mintázat " + FakeEmbeddingAdapter.FAIL_EMBED);
        marker.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(marker);
        item(user, "Régen is hasonló mintát figyeltél meg.");

        generator.generate(user, session.getId(), LocalDate.now());

        assertDenseRetrieverFailed(user);
    }

    private void item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", content, LocalDate.now().minusDays(3), new String[0], new String[0],
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
