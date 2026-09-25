package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.KnowledgeRecheckService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * S2 (mezo-d6ivw.2) Task 5: the quarterly knowledge re-check — a confirmed, plan-less fact is
 * re-asked against the fresh 28-day context and, ONLY on a "drift" verdict, gets a hedged
 * observation row of its own. The confirmed row and its fact are never touched: code decides who
 * may write {@code status}, the LLM only phrases prose.
 *
 * <p>{@code quiet-from == quiet-to} disables {@code ObservationBudget}'s quiet-hours check
 * entirely ({@code from.equals(to)} short-circuits it) — set here so these tests never go flaky
 * depending on the wall-clock hour they happen to run at; the dedicated budget IT below covers
 * the veto itself via {@code max-per-day=0} instead (the {@code QuickNoticeBudgetOffIT} idiom).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.reflection.notice.quiet-from=00:00",
        "mezo.companion.reflection.notice.quiet-to=00:00"})
class KnowledgeRecheckServiceIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeRecheckService recheckService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    private static final String DEFAULT_CLAIM = "Reggelente fél liter vizet iszol.";

    private static TestPlanEnvelope plan() {
        return new TestPlanEnvelope("people:anna", "sleep-duration-h", 1,
                TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 30);
    }

    /** A confirmed, plan-less, reflection-owned row promoted into a fact — the row shape Task 5
     *  reads (S2 fixture idiom: populator row + fact created directly + {@code promotedFactId}). */
    private PatternEntity confirmedPlanlessPromoted(UUID owner) {
        return confirmedPlanlessPromoted(owner, DEFAULT_CLAIM);
    }

    private PatternEntity confirmedPlanlessPromoted(UUID owner, String claimText) {
        return confirmedPlanlessPromoted(owner, claimText, true);
    }

    private PatternEntity confirmedPlanlessPromoted(UUID owner, String claimText, boolean includeInPrompt) {
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        row.setMechanism(claimText);
        row = patternPopulator.save(row);
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(owner);
        fact.setFactText(claimText);
        fact.setCategory("life");
        fact.setSource(KnowledgeFactEntity.SOURCE_PATTERN);
        fact.setIncludeInPrompt(includeInPrompt);
        fact.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        fact = knowledgeFactRepository.saveAndFlush(fact);
        row.setPromotedFactId(fact.getId());
        return patternPopulator.save(row);
    }

    private List<PatternEventEntity> events(UUID owner, UUID patternId) {
        return patternEventRepository.findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(
                owner, patternId);
    }

    @Test
    void testRunFor_shouldCreateHedgedDriftRow_whenLlmReportsDrift() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity confirmed = confirmedPlanlessPromoted(owner);

        int created = recheckService.runFor(owner);

        assertThat(created).isEqualTo(1);
        PatternEntity drift = patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                owner, PatternEntity.KIND_REFLECTION, "drift-" + confirmed.getId()).orElseThrow();
        assertThat(drift.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(drift.getTestPlan()).isNull();
        assertThat(drift.getHypothesisKey()).isNull();
        assertThat(drift.getOrigin()).isEqualTo(PatternEntity.ORIGIN_NIGHTLY_REFLECTION);
        assertThat(drift.getCategory()).isEqualTo(confirmed.getCategory());
        List<PatternEventEntity> events = events(owner, drift.getId());
        assertThat(events).extracting(PatternEventEntity::getKind)
                .contains(PatternEventEntity.KIND_OBSERVATION);
        // the confirmed row and its fact are untouched
        PatternEntity reread = patternRepository.findById(confirmed.getId()).orElseThrow();
        assertThat(reread.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
        assertThat(reread.getPromotedFactId()).isEqualTo(confirmed.getPromotedFactId());
    }

    @Test
    void testRunFor_shouldCreateNothing_whenLlmSaysHolds() {
        UUID owner = userPopulator.createUser().getId();
        confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"holds\",\"text\":\"\"}]]" + DEFAULT_CLAIM);

        assertThat(recheckService.runFor(owner)).isEqualTo(0);
    }

    @Test
    void testRunFor_shouldCreateNothing_whenLlmSaysUnknown() {
        UUID owner = userPopulator.createUser().getId();
        confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"unknown\",\"text\":\"\"}]]" + DEFAULT_CLAIM);

        assertThat(recheckService.runFor(owner)).isEqualTo(0);
    }

    /** Code decides on the VERDICT, but a blank {@code text} is refused too — an LLM answering
     *  {@code drift} with nothing to say must never mint an empty-prose row. */
    @Test
    void testRunFor_shouldCreateNothing_whenLlmSaysDriftWithBlankText() {
        UUID owner = userPopulator.createUser().getId();
        confirmedPlanlessPromoted(owner,
                "[[RECHECK:{\"verdict\":\"drift\",\"text\":\"   \"}]]" + DEFAULT_CLAIM);

        assertThat(recheckService.runFor(owner)).isEqualTo(0);
    }

    @Test
    void testRunFor_shouldSkip_whenDriftRowAlreadyExistsForTheSameSource() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity confirmed = confirmedPlanlessPromoted(owner);
        PatternEntity rejectedDrift = new PatternEntity();
        rejectedDrift.setCreatedBy(owner);
        rejectedDrift.setKind(PatternEntity.KIND_REFLECTION);
        rejectedDrift.setPairKey("drift-" + confirmed.getId());
        rejectedDrift.setCategory("trigger");
        rejectedDrift.setCategoryLabel("Trigger");
        rejectedDrift.setTitle("Elutasított sodródás");
        rejectedDrift.setMechanism("Elutasított sodródás.");
        rejectedDrift.setEvidence(confirmed.getEvidence());
        rejectedDrift.setOrigin(PatternEntity.ORIGIN_NIGHTLY_REFLECTION);
        rejectedDrift.setStatus(PatternEntity.STATUS_REJECTED);
        patternRepository.saveAndFlush(rejectedDrift);

        int created = recheckService.runFor(owner);

        assertThat(created).isEqualTo(0);
    }

    @Test
    void testRunFor_shouldSkip_whenFactIsMutedFromPrompt() {
        UUID owner = userPopulator.createUser().getId();
        confirmedPlanlessPromoted(owner, DEFAULT_CLAIM, false);
        int callsBefore = fakeCompanionLlm.completeCallCount();

        int created = recheckService.runFor(owner);

        assertThat(created).isEqualTo(0);
        // A muted fact is the user's own "leave it alone" — never even ASKED about.
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(callsBefore);
    }

    @Test
    void testRunFor_shouldSkipPlannedRows() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, plan(), PatternEntity.STATUS_CONFIRMED);
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(owner);
        fact.setFactText(DEFAULT_CLAIM);
        fact.setCategory("life");
        fact.setSource(KnowledgeFactEntity.SOURCE_PATTERN);
        fact.setIncludeInPrompt(true);
        fact.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        fact = knowledgeFactRepository.saveAndFlush(fact);
        row.setPromotedFactId(fact.getId());
        patternPopulator.save(row);

        int created = recheckService.runFor(owner);

        assertThat(created).isEqualTo(0);
    }
}
