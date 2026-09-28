package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

/** S8 (mezo-d6ivw.12): title-only facts become sentences — dry-run lists, apply rewrites, mute stays. */
@ActiveProfiles("companion-fake")
@RecordApplicationEvents
class FactTextBackfillServiceIT extends AbstractIntegrationTest {

    @Autowired private FactTextBackfillService backfill;
    @Autowired private FactTextBackfillRunner runner;
    @Autowired private PatternService patternService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private KnowledgeFactRepository factRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ApplicationEvents applicationEvents;

    /** A confirmed reflection row whose fact is reset to the pre-S8 title-only text. */
    private KnowledgeFactEntity legacyFact(UUID owner, String mechanism) {
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_MONITORING);
        row.setMechanism(mechanism);
        patternPopulator.save(row);
        patternService.applyUserConfirm(owner, row);
        patternRepository.saveAndFlush(row);
        KnowledgeFactEntity fact = factRepository.findById(row.getPromotedFactId()).orElseThrow();
        fact.setFactText(row.getTitle());
        return factRepository.saveAndFlush(fact);
    }

    @Test
    void testPlanThenApply_shouldRewriteTitleOnlyFacts_keepMute_andBeIdempotent() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity live = legacyFact(owner, "Esti képernyő után később alszol el. Második mondat.");
        KnowledgeFactEntity muted = legacyFact(owner, "Kávé délután rontja az alvást.");
        muted.mute(KnowledgeFactEntity.MUTED_USER, Instant.now());
        factRepository.saveAndFlush(muted);
        PatternEntity stat = patternPopulator.createPattern(owner, "pair-stat-" + UUID.randomUUID(), "Stat cím");
        patternService.applyUserConfirm(owner, stat);
        patternRepository.saveAndFlush(stat);
        // A forgotten (soft-deleted) legacy fact — apply must never touch it, and it costs no
        // event (findByCreatedByAndDeletedFalse... already excludes it via @SQLRestriction).
        KnowledgeFactEntity forgotten = legacyFact(owner, "Reggeli fehérje segít a jóllakottságban.");
        factRepository.delete(forgotten);

        List<FactTextBackfillService.Change> plan = backfill.plan(owner);

        assertThat(plan).extracting(FactTextBackfillService.Change::after).containsExactlyInAnyOrder(
                "Esti képernyő után később alszol el. Második mondat.", "Kávé délután rontja az alvást.");
        assertThat(factRepository.findById(live.getId()).orElseThrow().getFactText())
                .isEqualTo("Teszt: terv nélküli észrevétel"); // dry-run writes nothing
        assertThat(applicationEvents.stream(KnowledgeFactChangedEvent.class)).isEmpty(); // dry-run publishes nothing

        backfill.apply(owner);

        assertThat(factRepository.findById(live.getId()).orElseThrow().getFactText())
                .isEqualTo("Esti képernyő után később alszol el. Második mondat.");
        KnowledgeFactEntity mutedAfter = factRepository.findById(muted.getId()).orElseThrow();
        assertThat(mutedAfter.getFactText()).isEqualTo("Kávé délután rontja az alvást.");
        assertThat(mutedAfter.isIncludeInPrompt()).isFalse();
        assertThat(mutedAfter.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_USER);
        assertThat(backfill.plan(owner)).isEmpty();
        assertThat(factRepository.findById(forgotten.getId())).isEmpty(); // stays forgotten, untouched

        // Exactly one KnowledgeFactChangedEvent per rewritten row (live + muted) — none for the
        // deleted fact and none for the plan/dry-run calls above.
        assertThat(applicationEvents.stream(KnowledgeFactChangedEvent.class))
                .extracting(KnowledgeFactChangedEvent::factId)
                .containsExactlyInAnyOrder(live.getId(), muted.getId());
    }

    @Test
    void testRunner_shouldDoNothing_whenModeIsOff() {
        assertThat(runner.execute("off")).isZero();
    }
}
