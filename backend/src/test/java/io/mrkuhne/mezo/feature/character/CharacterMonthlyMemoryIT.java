package io.mrkuhne.mezo.feature.character;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterMonthlyService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Memória mindenhol S10 part 2 (bd mezo-eq85.10, task-10-codebase-notes.md §4): the monthly
 * deep-read konzílium appends a {@code [Hosszú távú memória]} block, built from the dimension's
 * own claims text, via {@link io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock}
 * under {@code CHARACTER_EVIDENCE} — the {@code MemoirGeneratorMemoryIT} idiom applied to {@code
 * CharacterMonthlyService}. {@code run} no longer carries {@code @Transactional} itself (the same
 * HAZARD resolution as {@code CharacterBootstrapService} — see notes §4).
 */
@ActiveProfiles("companion-fake")
class CharacterMonthlyMemoryIT extends AbstractIntegrationTest {

    private static final LocalDate MONTH_START = LocalDate.of(2026, 8, 1);
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private CharacterMonthlyService monthlyService;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    private CharacterDimensionEntity seedDimension(UUID owner, String key, String kind, String expertKey) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle(key);
        entity.setKind(kind);
        entity.setExpertKey(expertKey);
        return dimensionRepository.save(entity);
    }

    private CharacterClaimEntity seedClaim(UUID owner, UUID dimensionId, String text, BigDecimal confidence,
                                            String proposedBy) {
        CharacterClaimEntity entity = new CharacterClaimEntity();
        entity.setCreatedBy(owner);
        entity.setDimensionId(dimensionId);
        entity.setText(text);
        entity.setConfidence(confidence);
        entity.setStatus("ACTIVE");
        entity.setProposedBy(proposedBy);
        entity.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        entity.setSensitive(false);
        entity.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        entity.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(
                List.of(new ClaimConfidenceHistoryEnvelope.Point(confidence, "kezdet", Instant.now()))));
        return claimRepository.save(entity);
    }

    @Test
    void testRun_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID owner = userPopulator.createUser("monthly-memory-hit@test.local").getId();
        CharacterDimensionEntity discipline = seedDimension(owner, "discipline", "CORE", "drill");
        seedClaim(owner, discipline.getId(), "Régóta nem loggol reggelente.", new BigDecimal("0.55"), "drill");
        item(owner, "Régen is nehezen loggolt reggel.");

        CharacterConferenceEntity conference = monthlyService.run(owner, MONTH_START);

        assertThat(conference).isNotNull();
        assertThat(fakeLlm.userMessages()).anySatisfy(m -> assertThat(m).contains("[Hosszú távú memória]"));
        assertThat(fakeLlm.userMessages()).anySatisfy(m -> assertThat(m).contains("source=journal_entry"));
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("CHARACTER_EVIDENCE"));
    }

    @Test
    void testRun_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID owner = userPopulator.createUser("monthly-memory-fail-embed@test.local").getId();
        CharacterDimensionEntity discipline = seedDimension(owner, "discipline", "CORE", "drill");
        seedClaim(owner, discipline.getId(),
                "Régóta nem loggol reggelente. " + FakeEmbeddingAdapter.FAIL_EMBED,
                new BigDecimal("0.55"), "drill");
        item(owner, "Régen is nehezen loggolt reggel.");

        CharacterConferenceEntity conference = monthlyService.run(owner, MONTH_START);

        assertThat(conference).isNotNull();
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
                "Napló", content, MONTH_START.minusDays(3), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }
}
