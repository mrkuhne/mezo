package io.mrkuhne.mezo.feature.capacity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CapacityPattern;
import io.mrkuhne.mezo.api.dto.CapacitySeasonHints;
import io.mrkuhne.mezo.api.dto.CapacityWeek;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityPatternEntity;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CalendarEventScoreRepository;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityPatternRepository;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentDraft;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload;
import io.mrkuhne.mezo.feature.capacity.service.CapacityLearningService;
import io.mrkuhne.mezo.feature.capacity.service.ProposalService;
import io.mrkuhne.mezo.feature.capacity.service.SundayPreviewJob;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Boop B7 K4 Tasks 22–23 (mezo-r36n9.17): the move log's evening-after ({@link CapacityLearningService#fillOutcomes}),
 * the learned patterns' storage and reads, the earlier weeks on the week read, the new-season hints and the Sunday
 * preview. Real clock, dates relative to today in the owner zone. All names and figures invented.
 */
class CapacityLearningIT extends ApiIntegrationTest {

    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    @Autowired private TrainPopulator train;
    @Autowired private CalendarEventPopulator calendar;
    @Autowired private CalendarEventRepository events;
    @Autowired private CapacityProposalRepository proposals;
    @Autowired private CapacityPatternRepository patterns;
    @Autowired private CalendarEventScoreRepository scores;
    @Autowired private CapacityLearningService learning;
    @Autowired private ProposalService proposalService;

    private final LocalDate today = LocalDate.now(BUD);
    private final LocalDate thisMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    private WorkoutSessionEntity sessionOn(UUID owner, UUID mesoId, LocalDate day, String label) {
        int dow = day.getDayOfWeek().getValue() - 1;
        WorkoutSessionEntity s = train.createWorkoutSession(owner, mesoId, WorkoutService.HU_DAY_LABELS.get(dow), label,
            dow, "active");
        train.createExercise(owner, s.getId(), "Evezés", 0);
        train.createGymSlot(owner, dow, "17:30");
        return s;
    }

    private CapacityProposalEntity proposal(UUID owner, AdjustmentPayload step, String status) {
        CapacityProposalEntity p = new CapacityProposalEntity();
        p.setCreatedBy(owner);
        p.setWeekStart(step.day().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
        p.setDay(step.day());
        p.setKind(step.kind().name());
        p.setBundle(AdjustmentDraft.toBundle(List.of(AdjustmentDraft.of(step))));
        p.setTitle("például: rövidebb edzés");
        p.setGeneratorVersion((short) 1);
        p.setStatus(status);
        return proposals.saveAndFlush(p);
    }

    private CapacityPatternEntity pattern(UUID owner, String key, int evidence, int consistent, String weekday) {
        CapacityPatternEntity e = new CapacityPatternEntity();
        e.setCreatedBy(owner);
        e.setKey(key);
        e.setEvidence(evidence);
        e.setConsistent(consistent);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", "például: a csütörtök a gyenge pontod.");
        payload.put("line", "például: a csütörtök a gyenge pontod.");
        payload.put("body", "például: 4 napból 3.");
        payload.put("contrast", true);
        if (weekday != null) {
            payload.put("weekday", weekday);
        }
        e.setPayload(payload);
        return patterns.saveAndFlush(e);
    }

    /** An accepted shorter session that he then did: the outcome says short, the day's verdict, good. */
    @Test
    void outcomeFilledFromLoggedSession() {
        RegisteredUser user = registerUser("kap-outcome");
        LocalDate day = today.minusDays(3);
        var meso = train.createActiveMeso(user.id());
        WorkoutSessionEntity template = sessionOn(user.id(), meso.getId(), day, "Pull 1");
        train.createWorkoutInstance(user.id(), template, day, "completed");
        CapacityProposalEntity p = proposal(user.id(),
            new AdjustmentPayload.ShortenSession(day, 40), "accepted");

        int written = learning.fillOutcomes(user.id(), today);

        assertThat(written).isEqualTo(1);
        Map<String, Object> o = proposals.findById(p.getId()).orElseThrow().getOutcome();
        assertThat(o).containsEntry("session", "short").containsEntry("sleepPending", false);
        assertThat(o.get("verdict")).isNotNull();
        assertThat(o.get("good")).isInstanceOf(Boolean.class);
        assertThat(o.get("word")).isIn("bevált", "nem segített");
        assertThat((String) o.get("sub")).startsWith("Rövidebben edzettél");
        // idempotent: a filled outcome (night known) is not rewritten
        assertThat(learning.fillOutcomes(user.id(), today)).isZero();
    }

    /** An open proposal about a past day becomes ignored, with its outcome; one about today is left alone. */
    @Test
    void undecidedBecomesIgnored() {
        RegisteredUser user = registerUser("kap-ignored");
        CapacityProposalEntity past = proposal(user.id(),
            new AdjustmentPayload.ShiftBedtime(today.minusDays(2), LocalTime.of(23, 15)), "open");
        CapacityProposalEntity now = proposal(user.id(),
            new AdjustmentPayload.ShiftBedtime(today, LocalTime.of(23, 15)), "open");

        learning.fillOutcomes(user.id(), today);

        CapacityProposalEntity settled = proposals.findById(past.getId()).orElseThrow();
        assertThat(settled.getStatus()).isEqualTo("ignored");
        assertThat(settled.getOutcome()).containsEntry("word", "nem döntöttél").containsEntry("session", null);
        assertThat(proposals.findById(now.getId()).orElseThrow().getStatus()).isEqualTo("open");
    }

    /** Yesterday's night is not over at 03:30: the outcome waits for it and the next pass completes it. */
    @Test
    void yesterdaysNightIsPendingUntilTheNextPass() {
        RegisteredUser user = registerUser("kap-pending");
        CapacityProposalEntity p = proposal(user.id(),
            new AdjustmentPayload.ShiftBedtime(today.minusDays(1), LocalTime.of(23, 15)), "accepted");

        learning.fillOutcomes(user.id(), today);
        assertThat(proposals.findById(p.getId()).orElseThrow().getOutcome()).containsEntry("sleepPending", true);

        // the next night's pass revisits it (still no sleep logged → no longer pending: the night is behind him)
        assertThat(learning.fillOutcomes(user.id(), today.plusDays(1))).isEqualTo(1);
        assertThat(proposals.findById(p.getId()).orElseThrow().getOutcome()).containsEntry("sleepPending", false);
    }

    /** A pattern no longer found is zeroed, never soft-deleted (the unique index counts deleted rows). */
    @Test
    void fadedPatternIsZeroedNotDeleted() {
        RegisteredUser user = registerUser("kap-faded");
        pattern(user.id(), "late-call-sleep-loss", 5, 4, null);

        learning.refreshPatterns(user.id(), today);

        CapacityPatternEntity row = patterns.findByCreatedByAndDeletedFalse(user.id()).stream()
            .filter(e -> e.getKey().equals("late-call-sleep-loss")).findFirst().orElseThrow();
        assertThat(row.getEvidence()).isZero();
        assertThat(row.getConsistent()).isZero();
        assertThat(learning.shownPatterns(user.id())).isEmpty();
    }

    /** The new-season hints list the shown weekday pattern with its weekday; a hidden one stays out. */
    @Test
    void hintsListWeekdayOverload() {
        RegisteredUser user = registerUser("kap-hints");
        pattern(user.id(), "weekday-overload:THURSDAY", 4, 3, "THURSDAY");
        pattern(user.id(), "weekday-overload:MONDAY", 2, 2, "MONDAY");

        CapacitySeasonHints hints = getForBody("/api/capacity/season-hints", user.headers(), HttpStatus.OK,
            CapacitySeasonHints.class);

        assertThat(hints.getHints()).singleElement().satisfies(h -> {
            assertThat(h.getKey()).isEqualTo("weekday-overload:THURSDAY");
            assertThat(h.getWeekday()).isEqualTo("THURSDAY");
            assertThat(h.getEvidence()).isEqualTo(4);
            assertThat(h.getConsistent()).isEqualTo(3);
            assertThat(h.getBody()).isNotBlank();
        });
    }

    /** The week read carries the shown patterns and last week's decided proposals with their outcome word. */
    @Test
    void weekCarriesPatternsAndEarlierWeeks() {
        RegisteredUser user = registerUser("kap-history");
        pattern(user.id(), "weekday-overload:THURSDAY", 4, 3, "THURSDAY");
        CapacityProposalEntity last = proposal(user.id(),
            new AdjustmentPayload.ShiftBedtime(thisMonday.minusDays(4), LocalTime.of(23, 15)), "accepted");
        last.setOutcome(Map.of("word", "bevált", "sub", "például: a nap rendben lett", "good", true));
        proposals.saveAndFlush(last);

        CapacityWeek w = getForBody("/api/capacity/week?monday=" + thisMonday, user.headers(), HttpStatus.OK,
            CapacityWeek.class);

        assertThat(w.getPatterns()).extracting(CapacityPattern::getKey).containsExactly("weekday-overload:THURSDAY");
        assertThat(w.getHistory()).singleElement().satisfies(h -> {
            assertThat(h.getProposalId()).isEqualTo(last.getId());
            assertThat(h.getWord()).isEqualTo("bevált");
            assertThat(h.getGood()).isTrue();
        });
    }

    /** The Sunday preview fills next week's proposals for an owner the learning pass visits. */
    @Test
    void sundayPreviewGeneratesNextWeek() {
        RegisteredUser user = registerUser("kap-sunday");
        LocalDate nextMonday = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        LocalDate thursday = nextMonday.plusDays(3);
        var meso = train.createActiveMeso(user.id());
        sessionOn(user.id(), meso.getId(), thursday, "Pull 1");
        for (String[] span : new String[][] {{"07:00", "11:00"}, {"12:00", "13:00"}, {"13:30", "14:30"}}) {
            CalendarEventEntity e = calendar.createEvent(user.id(), thursday, "Egyeztetés " + span[0],
                Instant.parse(thursday + "T" + span[0] + ":00Z"), Instant.parse(thursday + "T" + span[1] + ":00Z"));
            e.setAttendeeCount(4);
            events.saveAndFlush(e);
        }
        // he is known to the pass: a proposal of an earlier week
        proposal(user.id(), new AdjustmentPayload.ShiftBedtime(thisMonday.minusDays(5), LocalTime.of(23, 0)), "declined");

        new SundayPreviewJob(proposalService, learning, scores).run();

        assertThat(proposals.findByCreatedByAndWeekStartAndDeletedFalse(user.id(), nextMonday)).isNotEmpty();
    }
}
