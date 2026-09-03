package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.HighlightCitationSource;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.service.FactCandidateService;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewHighlightsEnvelope.Highlight;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeeklyReviewPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Weekly review generation flow over the fake LLM (mezo-p2tr, the {@code MemoirGeneratorIT}
 * idiom): gather = the week's {@code MeWeekService} day rows + the week's confirmed pattern
 * events + the week's memoir (when present), with numbered highlight candidates; strict-JSON
 * {@code {summary, dayNotes, anchorIndexes, candidateFacts}} scripted via {@code [fake-review:{…}]} planted in
 * that MEMOIR'S TITLE — the ONLY candidate-bearing field the gather renders exactly ONCE (the
 * pattern/fact/life-event sections render their label BOTH in their own section AND again in the
 * numbered HORGONY-JELÖLTEK listing, so a sentinel planted there would appear twice and defeat
 * the GREEDY nested-JSON match; the memoir candidate's label is the week-start date, not its
 * title, so the title stays a single, safely-matchable occurrence — the memoir narrative
 * precedent, adapted for this generator's duplicated-label sections).
 *
 * <p>The WIDER gather input (mezo-d20.7.8) is asserted at the bottom against the GATHERED CONTEXT
 * via the pure-code {@code gather(...)}, not against the model's words — which also keeps that
 * matrix clear of the memoir-title sentinel's {@code varchar(200)} budget (the mezo-d20.7.6
 * precedent: the {@code generate(...)} tests stay terse and wiring-level).
 *
 * <p>No class-level {@code @Transactional} — same emit-under-{@code REQUIRES_NEW} deadlock
 * rationale as {@code MemoirGeneratorIT} (bd mezo-gzhp.1 precedent). Isolation comes from
 * {@code ResetDatabase} via {@link AbstractIntegrationTest}.
 */
@ActiveProfiles("companion-fake")
class WeeklyReviewGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);

    @Autowired private WeeklyReviewGenerator generator;
    @Autowired private WeeklyReviewRepository repository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private WeeklyReviewPopulator weeklyReviewPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private MemoirRepository memoirRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private FactCandidateService factCandidateService;
    @Autowired private HighlightCitationSource citationSource;
    @Autowired private WeeklyReviewService weeklyReviewService;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private ExperimentPopulator experimentPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;

    /** A day with SOME logged data — just enough to clear the empty-week gate. */
    private void seedDay(UUID owner, LocalDate date) {
        sleepLogPopulator.createSleepLog(owner, date, new BigDecimal("7.5"), 8);
        checkInPopulator.createCheckIn(owner, date, "08:00", 8, 3, null);
    }

    /** A confirmed pattern_event in-week, grounded on a plainly-titled pattern — the Pattern
     *  highlight candidate the highlight-resolution tests target by index. */
    private void seedConfirmedPatternEvent(UUID owner, LocalDate weekStart) {
        PatternEntity pattern = patternPopulator.createPattern(
                owner, "pair-" + UUID.randomUUID().toString().substring(0, 8), "Alvás minta");
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(owner);
        event.setPatternId(pattern.getId());
        event.setKind(PatternEventEntity.KIND_CONFIRMED);
        event.setOccurredAt(weekStart.plusDays(2).atStartOfDay(ZoneOffset.UTC).toInstant());
        patternEventRepository.saveAndFlush(event);
    }

    /** A memoir row whose TITLE carries the {@code [fake-review:{…}]} sentinel — see the class
     *  javadoc for why this is the safe planting channel. */
    private void seedMemoirWithSentinel(UUID owner, LocalDate weekStart, String sentinel) {
        MemoirEntity memoir = new MemoirEntity();
        memoir.setCreatedBy(owner);
        memoir.setWeekStart(weekStart);
        memoir.setTitle(sentinel);
        memoir.setBody("Teszt heti memoár.");
        memoir.setAnchors(new MemoirAnchorsEnvelope(List.of()));
        memoir.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        memoirRepository.saveAndFlush(memoir);
    }

    @Test
    void generatesRowFromWeekData() {
        UUID user = userPopulator.createUser("wr-gen@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedConfirmedPatternEvent(user, WEEK_START);
        seedMemoirWithSentinel(user, WEEK_START,
                "[fake-review:{\"summary\":\"Jó hét volt.\",\"dayNotes\":[{\"date\":\""
                        + WEEK_START + "\",\"note\":\"Nyugodt hétfő.\"}],\"anchorIndexes\":[0]}]");

        WeeklyReviewEntity review = generator.generate(user, WEEK_START);

        assertThat(review).isNotNull();
        assertThat(review.getWeekStart()).isEqualTo(WEEK_START);
        assertThat(review.getSummary()).isEqualTo("Jó hét volt.");
        assertThat(review.getDayNotes().notes()).hasSize(1);
        assertThat(review.getDayNotes().notes().get(0).date()).isEqualTo(WEEK_START);
        assertThat(review.getDayNotes().notes().get(0).note()).isEqualTo("Nyugodt hétfő.");
        // anchorIndexes:[0] resolves to candidate #0 — the Pattern highlight (added before the
        // Memory candidate the memoir itself contributes).
        assertThat(review.getHighlights().highlights()).hasSize(1);
        assertThat(review.getHighlights().highlights().get(0).kind()).isEqualTo("Pattern");
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(user))
                .anySatisfy(n -> {
                    assertThat(n.getKind()).isEqualTo("weekly_review_ready");
                    assertThat(n.getDeeplink()).isEqualTo("/me/week?start=" + WEEK_START);
                });
    }

    @Test
    void emptyWeekProducesNoRow() {
        UUID user = userPopulator.createUser("wr-empty@test.local").getId();

        assertThat(generator.generate(user, WEEK_START)).isNull();
        assertThat(repository.count()).isZero();
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(user)).isEmpty();
    }

    @Test
    void unusableAnswerProducesNoRow() {
        UUID user = userPopulator.createUser("wr-broken@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(user, WEEK_START, "[fake-review:{\"summary\":}]");

        assertThat(generator.generate(user, WEEK_START)).isNull();
        assertThat(repository.count()).isZero();
    }

    @Test
    void existingRowReturnedUntouched() {
        UUID user = userPopulator.createUser("wr-idem@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        WeeklyReviewEntity existing = weeklyReviewPopulator.weeklyReview(user, WEEK_START);

        assertThat(generator.generate(user, WEEK_START).getId()).isEqualTo(existing.getId());
        assertThat(repository.count()).isEqualTo(1);
    }

    /**
     * B4 (mezo-8tp8): {@code resolveHighlights} was only ever exercised with valid index 0 (above)
     * and invalid 99 (below) — an off-by-one that always returned {@code candidates.get(0)}
     * regardless of the requested index would still pass both. This seeds TWO candidates (a
     * Pattern at index 0, then the memoir's own Memory candidate at index 1 — see the class
     * javadoc for why the memoir is the only safe sentinel-planting channel) and resolves the
     * NON-ZERO index 1, asserting the resolved highlight is the candidate AT THAT POSITION
     * (kind + label), not the one at index 0.
     */
    @Test
    void resolvesANonZeroValidHighlightIndexToTheCandidateAtThatPosition() {
        UUID user = userPopulator.createUser("wr-nonzero-idx@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedConfirmedPatternEvent(user, WEEK_START);
        seedMemoirWithSentinel(user, WEEK_START,
                "[fake-review:{\"summary\":\"Vegyes hét.\",\"dayNotes\":[],\"anchorIndexes\":[1]}]");

        WeeklyReviewEntity review = generator.generate(user, WEEK_START);

        assertThat(review).isNotNull();
        assertThat(review.getHighlights().highlights()).hasSize(1);
        assertThat(review.getHighlights().highlights().get(0).kind()).isEqualTo("Memory");
        assertThat(review.getHighlights().highlights().get(0).label()).isEqualTo(WEEK_START.toString());
    }

    @Test
    void invalidHighlightIndexesAreDropped() {
        UUID user = userPopulator.createUser("wr-invalid-idx@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedConfirmedPatternEvent(user, WEEK_START);
        seedMemoirWithSentinel(user, WEEK_START,
                "[fake-review:{\"summary\":\"Vegyes hét.\",\"dayNotes\":[],\"anchorIndexes\":[0,99]}]");

        WeeklyReviewEntity review = generator.generate(user, WEEK_START);

        assertThat(review).isNotNull();
        assertThat(review.getHighlights().highlights()).hasSize(1);
        assertThat(review.getHighlights().highlights().get(0).kind()).isEqualTo("Pattern");
    }

    // ── "A hét tanulságai" — the round's knowledge candidates (mezo-d20.7.6, handoff §6.2) ──

    /** The sentinel channel is the same memoir title; {@code candidateFacts} rides along inside
     *  it. {@code memoir.title} is {@code varchar(200)}, so the scripted payloads here stay
     *  DELIBERATELY terse — the bounds-check/dedupe/cap matrix, which needs long and many inputs,
     *  is exercised directly against the service in {@code WeeklyLessonServiceIT}. */
    private static String reviewWith(String candidateFactsJson) {
        return "[fake-review:{\"summary\":\"Jó hét.\",\"candidateFacts\":" + candidateFactsJson + "}]";
    }

    @Test
    void proposesWeeklyKnowledgeCandidatesOnTheExistingCandidatePath() {
        UUID user = userPopulator.createUser("wr-lesson@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(user, WEEK_START, reviewWith(
                "[{\"text\":\"Edzés után többet alszol.\",\"category\":\"train\","
                        + "\"evidence\":\"5 nap\"},"
                        + "{\"text\":\"Jobb energia.\",\"category\":\"fuel\","
                        + "\"evidence\":null}]"));

        assertThat(generator.generate(user, WEEK_START)).isNotNull();

        List<LearnedFactEntity> candidates = learnedFactRepository.findByCreatedByAndDeletedFalse(user);
        assertThat(candidates).hasSize(2);
        assertThat(candidates).allSatisfy(c -> {
            assertThat(c.getSource()).isEqualTo(LearnedFactEntity.SOURCE_WEEKLY_REVIEW);
            assertThat(c.getWeekStart()).isEqualTo(WEEK_START);
            // a weekly candidate has NO chat message behind it — the week is the provenance
            assertThat(c.getDerivedFromMessageId()).isNull();
            assertThat(c.getUserDecision()).isNull();
        });
        assertThat(candidates).anySatisfy(c -> {
            assertThat(c.getCandidateText()).isEqualTo("Edzés után többet alszol.");
            assertThat(c.getCategory()).isEqualTo("train");
            assertThat(c.getEvidence()).isEqualTo("5 nap");
        });
        // an unknown evidence stays NULL — never a fabricated evidence line
        assertThat(candidates).anySatisfy(c -> {
            assertThat(c.getCategory()).isEqualTo("fuel");
            assertThat(c.getEvidence()).isNull();
        });
        // the weekly round emits NO per-candidate FACT_CANDIDATE — WEEKLY_REVIEW_READY already spoke
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(user))
                .isNotEmpty()
                .allSatisfy(n -> assertThat(n.getKind()).isEqualTo("weekly_review_ready"));
    }

    @Test
    void noCandidateFactsWritesNoCandidateRow() {
        UUID user = userPopulator.createUser("wr-lesson-none@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(user, WEEK_START, reviewWith("[]"));

        assertThat(generator.generate(user, WEEK_START)).isNotNull();

        assertThat(learnedFactRepository.findByCreatedByAndDeletedFalse(user)).isEmpty();
    }

    /** A pre-{@code candidateFacts} answer (the field simply absent) must not break the round. */
    @Test
    void answerWithoutCandidateFactsStillProducesTheReview() {
        UUID user = userPopulator.createUser("wr-lesson-absent@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(user, WEEK_START,
                "[fake-review:{\"summary\":\"Csendes hét.\",\"dayNotes\":[],\"anchorIndexes\":[]}]");

        assertThat(generator.generate(user, WEEK_START)).isNotNull();
        assertThat(learnedFactRepository.findByCreatedByAndDeletedFalse(user)).isEmpty();
    }

    @Test
    void aRejectedLessonIsNotReOfferedByALaterWeek() {
        UUID user = userPopulator.createUser("wr-lesson-rejected@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(user, WEEK_START, reviewWith(
                "[{\"text\":\"Röplabda után későn fekszel.\",\"category\":\"health\","
                        + "\"evidence\":\"4 este\"}]"));
        assertThat(generator.generate(user, WEEK_START)).isNotNull();
        LearnedFactEntity offered = learnedFactRepository.findByCreatedByAndDeletedFalse(user).get(0);
        factCandidateService.decide(user, offered.getId(),
                FactDecisionRequest.builder().decision(LearnedFactEntity.DECISION_REJECT).build());

        // the NEXT week proposes the very same lesson — "amit elvetsz, nem kérdezi újra"
        LocalDate nextWeek = WEEK_START.plusWeeks(1);
        seedDay(user, nextWeek.plusDays(1));
        seedMemoirWithSentinel(user, nextWeek, reviewWith(
                "[{\"text\":\"Röplabda után későn fekszel.\",\"category\":\"health\","
                        + "\"evidence\":\"5 este\"}]"));

        assertThat(generator.generate(user, nextWeek)).isNotNull();

        assertThat(learnedFactRepository.findByCreatedByAndWeekStartAndDeletedFalseOrderByCreatedAtDesc(
                user, nextWeek)).isEmpty();
    }

    // ── highlight feedback — the write side (mezo-d20.7.7, handoff §6.4/B) ──────────────────

    /**
     * A persisted highlight is a REF, not just a chip label: the candidate carries the id of the
     * entity it was collected from, which is what lets a citation be counted against the thing
     * itself. The Pattern candidate carries the PATTERN's id (not the event's) — a citation is
     * about the pattern.
     */
    @Test
    void generatedHighlightsCarryTheCitedEntitysId() {
        UUID user = userPopulator.createUser("wr-refids@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedConfirmedPatternEvent(user, WEEK_START);
        seedMemoirWithSentinel(user, WEEK_START,
                "[fake-review:{\"summary\":\"Vegyes hét.\",\"dayNotes\":[],\"anchorIndexes\":[0,1]}]");

        WeeklyReviewEntity review = generator.generate(user, WEEK_START);

        assertThat(review).isNotNull();
        UUID patternId = patternEventRepository.findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(
                user, PatternEventEntity.KIND_CONFIRMED, Instant.EPOCH).get(0).getPatternId();
        UUID memoirId = memoirRepository.findByCreatedByAndWeekStart(user, WEEK_START).orElseThrow().getId();
        assertThat(review.getHighlights().highlights()).satisfiesExactly(
                pattern -> {
                    assertThat(pattern.kind()).isEqualTo(Highlight.KIND_PATTERN);
                    assertThat(pattern.refId()).isEqualTo(patternId);
                },
                memory -> {
                    assertThat(memory.kind()).isEqualTo(Highlight.KIND_MEMORY);
                    assertThat(memory.refId()).isEqualTo(memoirId);
                });
        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN))
                .containsEntry(patternId, 1);
    }

    /**
     * Idempotence over regeneration: {@code regenerate} soft-deletes the week's row and writes a
     * fresh one, so the week must still count ONCE. It does so structurally — the signal is
     * derived from the LIVE rows, and there is only ever one live row per week (partial unique).
     * The mezo-d20.7.6 stance on the same problem, one layer down: nothing to reconcile.
     */
    @Test
    void regeneratingTheSameWeekDoesNotDoubleCountItsCitations() {
        UUID user = userPopulator.createUser("wr-recite@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedConfirmedPatternEvent(user, WEEK_START);
        seedMemoirWithSentinel(user, WEEK_START,
                "[fake-review:{\"summary\":\"Vegyes hét.\",\"dayNotes\":[],\"anchorIndexes\":[0]}]");
        assertThat(generator.generate(user, WEEK_START)).isNotNull();
        UUID patternId = patternEventRepository.findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(
                user, PatternEventEntity.KIND_CONFIRMED, Instant.EPOCH).get(0).getPatternId();
        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN))
                .containsEntry(patternId, 1);

        weeklyReviewService.regenerate(user, WEEK_START);

        assertThat(repository.count()).isEqualTo(1);
        assertThat(citationSource.citedWeeks(user, HighlightCitationSource.KIND_PATTERN))
                .containsEntry(patternId, 1);
    }

    /** The promotion path: accepting a weekly candidate mints a knowledge fact whose source says
     *  {@code weekly_review}, not {@code chat} — and it goes through {@code FactCandidateService},
     *  the only writer that publishes {@code KnowledgeFactPromotedEvent} (graph node for free). */
    @Test
    void acceptingAWeeklyCandidatePromotesItWithTheWeeklySource() {
        UUID user = userPopulator.createUser("wr-lesson-accept@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(user, WEEK_START, reviewWith(
                "[{\"text\":\"Edzés után korán fekszel.\",\"category\":\"train\","
                        + "\"evidence\":\"3 edzésnap\"}]"));
        assertThat(generator.generate(user, WEEK_START)).isNotNull();
        LearnedFactEntity candidate = learnedFactRepository.findByCreatedByAndDeletedFalse(user).get(0);

        factCandidateService.decide(user, candidate.getId(),
                FactDecisionRequest.builder().decision(LearnedFactEntity.DECISION_ACCEPT).build());

        UUID promotedId = learnedFactRepository.findById(candidate.getId()).orElseThrow().getPromotedFactId();
        assertThat(promotedId).isNotNull();
        assertThat(knowledgeFactRepository.findById(promotedId)).hasValueSatisfying(fact -> {
            assertThat(fact.getSource()).isEqualTo(KnowledgeFactEntity.SOURCE_WEEKLY_REVIEW);
            assertThat(fact.getFactText()).isEqualTo("Edzés után korán fekszel.");
            assertThat(fact.getCategory()).isEqualTo("train");
            assertThat(fact.isIncludeInPrompt()).isTrue();
        });
    }

    // ── The WIDER gather input (mezo-d20.7.8, handoff §6.4 item D) ──────────────────────────
    //
    // These assert on the GATHERED CONTEXT, never on the model's words: gather() is pure code, so
    // it is called directly and the fake LLM never runs. That also keeps them clear of the
    // memoir-title sentinel's varchar(200) budget (the mezo-d20.7.6 precedent) — the generate()
    // tests above stay terse and wiring-level, the matrix lives here against the payload.

    /** All six new sources present at once — each one must be legible in the rendered payload. */
    @Test
    void theWiderContextSourcesReachTheRenderedContext() {
        UUID user = userPopulator.createUser("wr-wider@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));

        journalPopulator.createEntry(user, WEEK_START.plusDays(2), "Nehéz nap a melóban, de bírtam.",
                JournalEntryEntity.SOURCE_QUICKINPUT);
        journalPopulator.createDecision(user, WEEK_START.plusDays(1), "Váltok reggeli edzésre.",
                WEEK_START.plusDays(30), "snapshot");
        journalPopulator.createReviewedDecision(user, WEEK_START.minusWeeks(4), "Elhagyom a késői kávét.",
                4, "Bevált.", WEEK_START.plusDays(3).atStartOfDay(ZoneOffset.UTC).toInstant());
        experimentPopulator.active(user, "sleep_avg", "up", WEEK_START.minusDays(2), 14);
        UUID person = personPopulator.createPerson(user, "Anna").getId();
        mentionPopulator.createMention(user, person, WEEK_START.plusDays(1).atStartOfDay(ZoneOffset.UTC)
                .toInstant(), "positive");
        mentionPopulator.createMention(user, person, WEEK_START.plusDays(4).atStartOfDay(ZoneOffset.UTC)
                .toInstant(), "positive");
        UUID medication = medicationPopulator.createMedication(user).getId();
        medicationDosePopulator.createDose(user, medication, WEEK_START, new BigDecimal("6"));
        periodSummaryPopulator.periodSummary(user, PeriodSummaryEntity.GRANULARITY_WEEK, WEEK_START,
                "A hét konszolidált szövege.");

        String context = generator.gather(user, WEEK_START).payload();

        assertThat(context).contains("\nNAPLÓBEJEGYZÉSEK:\n- " + WEEK_START.plusDays(2)
                + ": Nehéz nap a melóban, de bírtam.\n");
        assertThat(context).contains("- meghozva " + WEEK_START.plusDays(1) + ": Váltok reggeli edzésre.");
        assertThat(context).contains("- értékelve " + WEEK_START.minusWeeks(4)
                + " (4/5): Elhagyom a késői kávét.");
        assertThat(context).contains("\nKÍSÉRLETEK A HÉTEN:\n- Teszt kísérlet [active, 9/14. nap]\n");
        assertThat(context).contains("\nEMBER-EMLÍTÉSEK A HÉTEN:\n- Anna: 2 említés\n");
        // dose on the Monday -> cycle day 1 (peak) at the week's start, day 7 (trough) at its end
        assertThat(context).contains("\nGYÓGYSZER-CIKLUS: Teszt gyógyszer — hét eleje: 1. nap (Csúcs)"
                + " → hét vége: 7. nap (Mélypont)\n");
        assertThat(context).contains("\nA HÉT KONSZOLIDÁLT NARRATÍVÁJA:\nA hét konszolidált szövege.\n");
        // data only — the wider sources mint NO anchor candidates (the kind vocabulary is frozen)
        assertThat(generator.gather(user, WEEK_START).candidates()).isEmpty();
    }

    /** A week with none of them present: still a valid context, and NOT one empty header. */
    @Test
    void aWeekWithoutTheWiderSourcesRendersNoEmptyScaffolding() {
        UUID user = userPopulator.createUser("wr-wider-none@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));

        String context = generator.gather(user, WEEK_START).payload();

        assertThat(context).contains("A HÉT NAPJAI (" + WEEK_START + " – " + WEEK_START.plusDays(6) + "):");
        assertThat(context).contains("HORGONY-JELÖLTEK");
        assertThat(context).doesNotContain("NAPLÓBEJEGYZÉSEK", "DÖNTÉSEK", "KÍSÉRLETEK A HÉTEN",
                "EMBER-EMLÍTÉSEK", "GYÓGYSZER-CIKLUS", "A HÉT KONSZOLIDÁLT NARRATÍVÁJA");
    }

    /** The budget in force: the journal cap holds and an over-long entry is clipped with a visible
     *  {@code …} rather than silently truncated into a half-claim. */
    @Test
    void journalEntriesAreCappedAndOverLongProseIsVisiblyClipped() {
        UUID user = userPopulator.createUser("wr-wider-journal@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        for (int i = 0; i < 7; i++) {
            journalPopulator.createEntry(user, WEEK_START.plusDays(i % 7), "Bejegyzés " + i + ".",
                    JournalEntryEntity.SOURCE_QUICKINPUT);
        }
        journalPopulator.createEntry(user, WEEK_START, "x".repeat(400), JournalEntryEntity.SOURCE_RITUAL);

        String context = generator.gather(user, WEEK_START).payload();

        String block = context.substring(context.indexOf("NAPLÓBEJEGYZÉSEK:"));
        block = block.substring(0, block.indexOf("\nHORGONY-JELÖLTEK"));
        assertThat(block.lines().filter(l -> l.startsWith("- ")).count()).isEqualTo(7);
        assertThat(context).contains("x".repeat(180) + "…");
        assertThat(context).doesNotContain("x".repeat(181));
    }

    /** Honest medication rendering: no logged dose at all ⇒ the section is absent entirely (never a
     *  fabricated cycle day); a first dose landing mid-week ⇒ the unknown week-start is a dash. */
    @Test
    void theMedicationCycleIsOmittedWithoutADoseAndDashesAnUnknownWeekStart() {
        UUID noDose = userPopulator.createUser("wr-wider-med-none@test.local").getId();
        seedDay(noDose, WEEK_START.plusDays(1));
        medicationPopulator.createMedication(noDose);

        assertThat(generator.gather(noDose, WEEK_START).payload()).doesNotContain("GYÓGYSZER-CIKLUS");

        UUID midWeek = userPopulator.createUser("wr-wider-med-mid@test.local").getId();
        seedDay(midWeek, WEEK_START.plusDays(1));
        UUID medication = medicationPopulator.createMedication(midWeek).getId();
        medicationDosePopulator.createDose(midWeek, medication, WEEK_START.plusDays(4), new BigDecimal("6"));

        assertThat(generator.gather(midWeek, WEEK_START).payload())
                .contains("GYÓGYSZER-CIKLUS: Teszt gyógyszer — hét eleje: – → hét vége: 3. nap (Stabil)");
    }

    /** Only experiments whose window actually intersects the week are context; a proposal that never
     *  started, and a window that closed before the week, are not. */
    @Test
    void onlyExperimentsWhoseWindowOverlapsTheWeekAreRendered() {
        UUID user = userPopulator.createUser("wr-wider-exp@test.local").getId();
        seedDay(user, WEEK_START.plusDays(1));
        experimentPopulator.experiment(user, ExperimentEntity.STATUS_PROPOSED, "sleep_avg", "up");
        experimentPopulator.active(user, "weight_trend", "down", WEEK_START.minusDays(30), 7);

        assertThat(generator.gather(user, WEEK_START).payload()).doesNotContain("KÍSÉRLETEK A HÉTEN");
    }
}
