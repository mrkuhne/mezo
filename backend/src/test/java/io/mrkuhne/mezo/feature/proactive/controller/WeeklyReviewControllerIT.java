package io.mrkuhne.mezo.feature.proactive.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WeeklyLessonResponse;
import io.mrkuhne.mezo.api.dto.WeeklyReviewDigestResponse;
import io.mrkuhne.mezo.api.dto.WeeklyReviewResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.WeeklyReviewPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * HTTP contract for the weekly-review read/regenerate/digest endpoints (Én/Heti, spec
 * 2026-08-27 §5, bd mezo-p2tr) — {@code GET/POST /api/proactive/weekly-review/{start}[/…]}.
 * Runs as the demodata owner (the {@code ApiIntegrationTest} auth idiom); {@code
 * WEEK_START} is a PAST, completed ISO-Monday week so regenerate's completed-week gate
 * passes, and {@code CURRENT_MONDAY} exercises the in-progress-week 409.
 */
@ActiveProfiles("companion-fake")
class WeeklyReviewControllerIT extends ApiIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(2);
    private static final LocalDate CURRENT_MONDAY = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Autowired private WeeklyReviewRepository weeklyReviewRepository;
    @Autowired private WeeklyReviewPopulator weeklyReviewPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private PatternRepository patternRepository;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private GraphNodeRepository graphNodeRepository;
    @Autowired private MemoirRepository memoirRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private WeeklyReviewResponse getReview(LocalDate start) {
        return getForBody("/api/proactive/weekly-review/" + start, ownerAuthHeaders(),
                HttpStatus.OK, WeeklyReviewResponse.class);
    }

    private void seedDay(UUID owner, LocalDate date) {
        sleepLogPopulator.createSleepLog(owner, date, new BigDecimal("7.5"), 8);
        checkInPopulator.createCheckIn(owner, date, "08:00", 8, 3, null);
    }

    private void seedConfirmedPatternEvent(UUID owner, LocalDate weekStart, String pairKey, String title) {
        PatternEntity pattern = patternPopulator.createPattern(owner, pairKey, title);
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(owner);
        event.setPatternId(pattern.getId());
        event.setKind(PatternEventEntity.KIND_CONFIRMED);
        event.setOccurredAt(weekStart.plusDays(2).atStartOfDay(ZoneOffset.UTC).toInstant());
        patternEventRepository.saveAndFlush(event);
    }

    private void seedPatternEvent(UUID owner, PatternEntity pattern, String kind, Instant at) {
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(owner);
        event.setPatternId(pattern.getId());
        event.setKind(kind);
        event.setOccurredAt(at);
        patternEventRepository.saveAndFlush(event);
    }

    private Instant dayOf(int offset, int hour) {
        return WEEK_START.plusDays(offset).atStartOfDay(ZoneOffset.UTC).plusHours(hour).toInstant();
    }

    private GraphNodeEntity seedLifeEvent(UUID owner, LocalDate weekStart, String title) {
        GraphNodeEntity node = new GraphNodeEntity();
        node.setCreatedBy(owner);
        node.setKind(GraphNodeEntity.KIND_LIFE_EVENT);
        node.setTitle(title);
        node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
        node.setOccurredOn(weekStart.plusDays(3));
        return graphNodeRepository.saveAndFlush(node);
    }

    private void seedMemoirWithSentinel(UUID owner, LocalDate weekStart, String sentinel) {
        MemoirEntity memoir = new MemoirEntity();
        memoir.setCreatedBy(owner);
        memoir.setWeekStart(weekStart);
        memoir.setTitle(sentinel);
        memoir.setBody("Teszt heti memoár.");
        memoir.setAnchors(new MemoirAnchorsEnvelope(java.util.List.of()));
        memoir.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        memoirRepository.saveAndFlush(memoir);
    }

    @Test
    void get404BeforeGeneration() {
        String body = exchangeForBody(HttpMethod.GET, "/api/proactive/weekly-review/" + WEEK_START,
                null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void get200AfterSeedAndNotStale() {
        UUID owner = ownerId();
        WeeklyReviewEntity seeded = weeklyReviewPopulator.weeklyReview(owner, WEEK_START);

        WeeklyReviewResponse response = getReview(WEEK_START);

        assertThat(response.getId()).isEqualTo(seeded.getId());
        assertThat(response.getWeekStart()).isEqualTo(WEEK_START);
        assertThat(response.getSummary()).isEqualTo(seeded.getSummary());
        assertThat(response.getDayNotes()).isEmpty();
        assertThat(response.getHighlights()).hasSize(1);
        assertThat(response.getHighlights().get(0).getKind()).isEqualTo("Memory");
        assertThat(response.getStale()).isFalse();
    }

    @Test
    void staleTrueAfterNewerWeightLogInWeek() {
        UUID owner = ownerId();
        WeeklyReviewEntity seeded = weeklyReviewPopulator.weeklyReview(owner, WEEK_START);
        weightLogPopulator.createWeightLogAt(owner, WEEK_START.plusDays(1), new BigDecimal("80.0"),
                seeded.getGeneratedAt().plusSeconds(60));

        WeeklyReviewResponse response = getReview(WEEK_START);

        assertThat(response.getStale()).isTrue();
    }

    @Test
    void nonMondayIs400() {
        LocalDate tuesday = WEEK_START.plusDays(1);
        String body = exchangeForBody(HttpMethod.GET, "/api/proactive/weekly-review/" + tuesday,
                null, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "WEEKLY_REVIEW_START_NOT_MONDAY");
    }

    @Test
    void regenerate409ForCurrentWeek() {
        String body = exchangeForBody(HttpMethod.POST,
                "/api/proactive/weekly-review/" + CURRENT_MONDAY + "/regenerate",
                null, ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "WEEKLY_REVIEW_WEEK_NOT_COMPLETE");
    }

    @Test
    void regenerate404WhenWeekEmpty() {
        String body = exchangeForBody(HttpMethod.POST,
                "/api/proactive/weekly-review/" + WEEK_START + "/regenerate",
                null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void regenerate200ReplacesRow() {
        UUID owner = ownerId();
        seedDay(owner, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(owner, WEEK_START,
                "[fake-review:{\"summary\":\"Friss elemzés.\",\"dayNotes\":[],\"anchorIndexes\":[]}]");
        WeeklyReviewEntity old = weeklyReviewPopulator.weeklyReview(owner, WEEK_START);
        // populator inserts a row with weekStart==WEEK_START; regenerate must delete it before
        // the generator re-checks findByCreatedByAndWeekStart (else it returns this row untouched).
        UUID oldId = old.getId();

        WeeklyReviewResponse response = postForBody(
                "/api/proactive/weekly-review/" + WEEK_START + "/regenerate",
                null, ownerAuthHeaders(), HttpStatus.OK, WeeklyReviewResponse.class);

        assertThat(response.getId()).isNotEqualTo(oldId);
        assertThat(response.getSummary()).isEqualTo("Friss elemzés.");
        assertThat(response.getStale()).isFalse();
        assertThat(weeklyReviewRepository.findById(oldId)).isEmpty();
        assertThat(weeklyReviewRepository.findByCreatedByAndWeekStart(owner, WEEK_START))
                .hasValueSatisfying(fresh -> assertThat(fresh.getId()).isEqualTo(response.getId()));
    }

    @Test
    void regenerateReprobesStaleInsteadOfHardcodingFalse() {
        UUID owner = ownerId();
        seedDay(owner, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(owner, WEEK_START,
                "[fake-review:{\"summary\":\"Friss elemzés.\",\"dayNotes\":[],\"anchorIndexes\":[]}]");
        weeklyReviewPopulator.weeklyReview(owner, WEEK_START);
        // createdAt is an hour in the future — guaranteed newer than whatever generatedAt the
        // regenerate call below produces, so a hardcoded stale=false would fail this assertion.
        weightLogPopulator.createWeightLogAt(owner, WEEK_START.plusDays(1), new BigDecimal("81.0"),
                Instant.now().plusSeconds(3600));

        WeeklyReviewResponse response = postForBody(
                "/api/proactive/weekly-review/" + WEEK_START + "/regenerate",
                null, ownerAuthHeaders(), HttpStatus.OK, WeeklyReviewResponse.class);

        assertThat(response.getStale()).isTrue();
        assertThat(getReview(WEEK_START).getStale()).isTrue();
    }

    @Test
    void digestListsSeededRefs() {
        UUID owner = ownerId();
        seedConfirmedPatternEvent(owner, WEEK_START, "pair-digest-1", "Alvás minta");
        knowledgeFactPopulator.factAt(owner, "Reggelente stresszesebb hétfőn.", "life",
                WEEK_START.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        seedLifeEvent(owner, WEEK_START, "Új munkahely");

        WeeklyReviewDigestResponse digest = getForBody(
                "/api/proactive/weekly-review/" + WEEK_START + "/digest",
                ownerAuthHeaders(), HttpStatus.OK, WeeklyReviewDigestResponse.class);

        assertThat(digest.getPatterns()).hasSize(1);
        assertThat(digest.getPatterns().get(0).getPairKey()).isEqualTo("pair-digest-1");
        assertThat(digest.getPatterns().get(0).getTitle()).isEqualTo("Alvás minta");
        assertThat(digest.getPatterns().get(0).getEvent()).isEqualTo(PatternEventEntity.KIND_CONFIRMED);
        assertThat(digest.getNewFacts()).hasSize(1);
        assertThat(digest.getNewFacts().get(0).getText()).isEqualTo("Reggelente stresszesebb hétfőn.");
        assertThat(digest.getLifeEvents()).hasSize(1);
        assertThat(digest.getLifeEvents().get(0).getTitle()).isEqualTo("Új munkahely");
        assertThat(digest.getLifeEvents().get(0).getOccurredOn()).isEqualTo(WEEK_START.plusDays(3));
        assertThat(digest.getMemoir()).isFalse();
        assertThat(digest.getPredictions()).isEmpty();
    }

    /** mezo-p87ok: the digest is one trace per discovery, not one row per pattern_event. A pair
     *  confirmed then promoted in the same week is ONE ref carrying the bigger news; its promotion
     *  fact is not counted again; refs are ranked promoted > reinforced > confirmed, newest first
     *  within a kind; facts newest first. */
    @Test
    void digestFoldsEventsToOneRefPerPatternAndDropsPromotionFacts() {
        UUID owner = ownerId();
        PatternEntity promotedPair = patternPopulator.createPattern(owner, "pair-fold-promoted", "Előléptetett minta");
        PatternEntity reinforcedPair = patternPopulator.createPattern(owner, "pair-fold-reinforced", "Erősödött minta");
        PatternEntity confirmedOld = patternPopulator.createPattern(owner, "pair-fold-confirmed-old", "Régebbi megerősítés");
        PatternEntity confirmedNew = patternPopulator.createPattern(owner, "pair-fold-confirmed-new", "Újabb megerősítés");

        seedPatternEvent(owner, promotedPair, PatternEventEntity.KIND_CONFIRMED, dayOf(1, 8));
        seedPatternEvent(owner, promotedPair, PatternEventEntity.KIND_PROMOTED, dayOf(2, 8));
        seedPatternEvent(owner, reinforcedPair, PatternEventEntity.KIND_REINFORCED, dayOf(3, 8));
        seedPatternEvent(owner, reinforcedPair, PatternEventEntity.KIND_CONFIRMED, dayOf(4, 8));
        seedPatternEvent(owner, confirmedOld, PatternEventEntity.KIND_CONFIRMED, dayOf(1, 9));
        seedPatternEvent(owner, confirmedNew, PatternEventEntity.KIND_CONFIRMED, dayOf(5, 9));

        var promotionFact = knowledgeFactPopulator.factAt(owner, "Az előléptetett minta ténye.", "health", dayOf(2, 8));
        promotedPair.setPromotedFactId(promotionFact.getId());
        patternRepository.saveAndFlush(promotedPair);
        knowledgeFactPopulator.factAt(owner, "Régebbi csevegés-tény.", "life", dayOf(1, 10));
        knowledgeFactPopulator.factAt(owner, "Újabb csevegés-tény.", "life", dayOf(4, 10));

        WeeklyReviewDigestResponse digest = getForBody(
                "/api/proactive/weekly-review/" + WEEK_START + "/digest",
                ownerAuthHeaders(), HttpStatus.OK, WeeklyReviewDigestResponse.class);

        assertThat(digest.getPatterns())
                .extracting(p -> p.getPairKey() + ":" + p.getEvent())
                .containsExactly(
                        "pair-fold-promoted:" + PatternEventEntity.KIND_PROMOTED,
                        "pair-fold-reinforced:" + PatternEventEntity.KIND_REINFORCED,
                        "pair-fold-confirmed-new:" + PatternEventEntity.KIND_CONFIRMED,
                        "pair-fold-confirmed-old:" + PatternEventEntity.KIND_CONFIRMED);
        assertThat(digest.getNewFacts())
                .extracting(f -> f.getText())
                .containsExactly("Újabb csevegés-tény.", "Régebbi csevegés-tény.");
    }

    @Test
    void digestNonMondayIs400() {
        LocalDate tuesday = WEEK_START.plusDays(1);
        String body = exchangeForBody(HttpMethod.GET, "/api/proactive/weekly-review/" + tuesday + "/digest",
                null, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "WEEKLY_REVIEW_START_NOT_MONDAY");
    }

    @Test
    void digestEmptyListsWhenNothingInWeek() {
        WeeklyReviewDigestResponse digest = getForBody(
                "/api/proactive/weekly-review/" + WEEK_START + "/digest",
                ownerAuthHeaders(), HttpStatus.OK, WeeklyReviewDigestResponse.class);

        assertThat(digest.getPatterns()).isEmpty();
        assertThat(digest.getNewFacts()).isEmpty();
        assertThat(digest.getLifeEvents()).isEmpty();
        assertThat(digest.getMemoir()).isFalse();
        assertThat(digest.getPredictions()).isEmpty();
    }

    // ── "A hét tanulságai" — GET …/{start}/lessons (mezo-d20.7.6) ──────────────────

    private List<WeeklyLessonResponse> getLessons(LocalDate start) {
        return java.util.Arrays.asList(getForBody("/api/proactive/weekly-review/" + start + "/lessons",
                ownerAuthHeaders(), HttpStatus.OK, WeeklyLessonResponse[].class));
    }

    @Test
    void lessonsReturnTheWeeksCandidatesWithTheirDecisions() {
        UUID owner = ownerId();
        learnedFactPopulator.weeklyCandidate(owner, WEEK_START, "Edzés után korábban fekszel.",
                "train", "3 edzésnap", null);
        LearnedFactEntity rejected = learnedFactPopulator.weeklyCandidate(owner, WEEK_START,
                "Hétvégén többet eszel.", "fuel", null, LearnedFactEntity.DECISION_REJECT);
        // a chat-extracted candidate of the same user must NOT leak into the week's list
        learnedFactPopulator.candidate(owner, "Csevegésből tanult tény.", "life", null);

        List<WeeklyLessonResponse> lessons = getLessons(WEEK_START);

        assertThat(lessons).hasSize(2);
        assertThat(lessons).anySatisfy(l -> {
            assertThat(l.getCandidateText()).isEqualTo("Edzés után korábban fekszel.");
            assertThat(l.getCategory()).isEqualTo("train");
            assertThat(l.getEvidence()).isEqualTo("3 edzésnap");
            // still open — the design's undecided state
            assertThat(l.getUserDecision()).isNull();
        });
        assertThat(lessons).anySatisfy(l -> {
            assertThat(l.getId()).isEqualTo(rejected.getId());
            // the SETTLED state, which the pending inbox (GET /api/companion/fact/candidate) hides
            assertThat(l.getUserDecision()).isEqualTo(LearnedFactEntity.DECISION_REJECT);
            assertThat(l.getEvidence()).isNull();
        });
    }

    @Test
    void lessonsAreEmptyNotNotFoundWhenTheWeekProposedNothing() {
        assertThat(getLessons(WEEK_START)).isEmpty();
    }

    @Test
    void lessonsNonMondayIs400() {
        LocalDate tuesday = WEEK_START.plusDays(1);
        String body = exchangeForBody(HttpMethod.GET,
                "/api/proactive/weekly-review/" + tuesday + "/lessons",
                null, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "WEEKLY_REVIEW_START_NOT_MONDAY");
    }

    /** Regeneration policy (handoff §6.2/4): a decided candidate survives — the user's decision
     *  must not be lost — while a still-open one is archived with the review it came with. */
    @Test
    void regenerateArchivesOpenLessonsButKeepsDecidedOnes() {
        UUID owner = ownerId();
        seedDay(owner, WEEK_START.plusDays(1));
        seedMemoirWithSentinel(owner, WEEK_START,
                "[fake-review:{\"summary\":\"Friss elemzés.\",\"dayNotes\":[],\"anchorIndexes\":[],"
                        + "\"candidateFacts\":[]}]");
        weeklyReviewPopulator.weeklyReview(owner, WEEK_START);
        LearnedFactEntity open = learnedFactPopulator.weeklyCandidate(owner, WEEK_START,
                "Nyitott tanulság.", "life", "2 nap", null);
        LearnedFactEntity decided = learnedFactPopulator.weeklyCandidate(owner, WEEK_START,
                "Eldöntött tanulság.", "life", "2 nap", LearnedFactEntity.DECISION_REJECT);

        postForBody("/api/proactive/weekly-review/" + WEEK_START + "/regenerate",
                null, ownerAuthHeaders(), HttpStatus.OK, WeeklyReviewResponse.class);

        assertThat(learnedFactRepository.findByIdAndCreatedByAndDeletedFalse(open.getId(), owner)).isEmpty();
        assertThat(learnedFactRepository.findByIdAndCreatedByAndDeletedFalse(decided.getId(), owner))
                .isPresent();
        assertThat(getLessons(WEEK_START)).singleElement()
                .satisfies(l -> assertThat(l.getId()).isEqualTo(decided.getId()));
    }
}
