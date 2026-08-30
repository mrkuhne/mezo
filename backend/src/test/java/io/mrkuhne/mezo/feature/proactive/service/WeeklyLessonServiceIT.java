package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WeeklyLessonResponse;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyLessonService.LessonProposal;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The weekly-candidate write policy of "A hét tanulságai" (mezo-d20.7.6) exercised DIRECTLY on
 * {@link WeeklyLessonService}: bounds-check, dedupe, the per-round cap, the archive-on-regenerate
 * rule and the week-scoped read. {@code WeeklyReviewGeneratorIT} covers the wiring through the
 * fake LLM, but its scripted sentinel rides in a {@code varchar(200)} memoir title — the long and
 * many-rowed inputs this matrix needs simply do not fit there.
 *
 * <p>No class-level {@code @Transactional} (the house IT rule); isolation comes from
 * {@code ResetDatabase}.
 */
@ActiveProfiles("companion-fake")
class WeeklyLessonServiceIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);

    @Autowired private WeeklyLessonService service;
    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private UserPopulator userPopulator;

    private static LessonProposal lesson(String text, String category, String evidence) {
        return new LessonProposal(text, category, evidence);
    }

    @Test
    void persistsSurvivorsAsUndecidedWeeklyCandidates() {
        UUID user = userPopulator.createUser("wl-ok@test.local").getId();

        assertThat(service.propose(user, WEEK_START,
                List.of(lesson("Edzés után korábban fekszel.", "train", "3 edzésnap")))).isEqualTo(1);

        assertThat(learnedFactRepository.findByCreatedByAndDeletedFalse(user)).singleElement()
                .satisfies(c -> {
                    assertThat(c.getSource()).isEqualTo(LearnedFactEntity.SOURCE_WEEKLY_REVIEW);
                    assertThat(c.getWeekStart()).isEqualTo(WEEK_START);
                    assertThat(c.getEvidence()).isEqualTo("3 edzésnap");
                    assertThat(c.getUserDecision()).isNull();
                    assertThat(c.getDerivedFromMessageId()).isNull();
                });
    }

    @Test
    void blankTextUnknownCategoryAndProseAreDropped() {
        UUID user = userPopulator.createUser("wl-bounds@test.local").getId();

        int written = service.propose(user, WEEK_START, java.util.Arrays.asList(
                lesson("   ", "train", null),
                lesson(null, "train", null),
                lesson("Ismeretlen kategória.", "sport", null),
                lesson("x".repeat(501), "life", null),
                null));

        assertThat(written).isZero();
        assertThat(learnedFactRepository.findByCreatedByAndDeletedFalse(user)).isEmpty();
    }

    @Test
    void anOverLongEvidenceLineIsNulledRatherThanTruncated() {
        UUID user = userPopulator.createUser("wl-evidence@test.local").getId();

        service.propose(user, WEEK_START, java.util.Arrays.asList(
                lesson("Hétvégén tovább alszol.", "health", "e".repeat(301)),
                lesson("Hétfőn kevesebbet eszel.", "fuel", "   ")));

        // the candidate still stands — only its unknown provenance stays unknown
        assertThat(learnedFactRepository.findByCreatedByAndDeletedFalse(user))
                .hasSize(2)
                .allSatisfy(c -> assertThat(c.getEvidence()).isNull());
    }

    @Test
    void dedupesAgainstConfirmedFactsOpenCandidatesAndTheBatch() {
        UUID user = userPopulator.createUser("wl-dedupe@test.local").getId();
        knowledgeFactPopulator.fact(user, "Reggel jobban edzel.", "train", 1);
        learnedFactPopulator.candidate(user, "Kávé után nyugtalan vagy.", "health", null);

        int written = service.propose(user, WEEK_START, List.of(
                lesson("  reggel JOBBAN   edzel. ", "train", null),
                lesson("Kávé után nyugtalan vagy.", "health", null),
                lesson("Vasárnap keveset alszol.", "health", null),
                lesson("vasárnap KEVESET alszol.", "health", null)));

        assertThat(written).isEqualTo(1);
        assertThat(learnedFactRepository.findByCreatedByAndWeekStartAndDeletedFalseOrderByCreatedAtDesc(
                user, WEEK_START)).singleElement()
                .satisfies(c -> assertThat(c.getCandidateText()).isEqualTo("Vasárnap keveset alszol."));
    }

    /** {@code mezo.companion.extraction.max-candidates-per-turn} = 3, reused as the weekly cap. */
    @Test
    void stopsAtThePerRoundCap() {
        UUID user = userPopulator.createUser("wl-cap@test.local").getId();

        int written = service.propose(user, WEEK_START, List.of(
                lesson("Egyes tanulság.", "life", null),
                lesson("Kettes tanulság.", "life", null),
                lesson("Hármas tanulság.", "life", null),
                lesson("Négyes tanulság.", "life", null)));

        assertThat(written).isEqualTo(3);
        assertThat(learnedFactRepository.findByCreatedByAndDeletedFalse(user)).hasSize(3);
    }

    @Test
    void archiveOpenKeepsDecidedCandidates() {
        UUID user = userPopulator.createUser("wl-archive@test.local").getId();
        LearnedFactEntity open = learnedFactPopulator.weeklyCandidate(
                user, WEEK_START, "Nyitott.", "life", null, null);
        LearnedFactEntity accepted = learnedFactPopulator.weeklyCandidate(
                user, WEEK_START, "Elfogadott.", "life", null, LearnedFactEntity.DECISION_ACCEPT);
        LearnedFactEntity otherWeek = learnedFactPopulator.weeklyCandidate(
                user, WEEK_START.minusWeeks(1), "Másik hét.", "life", null, null);

        assertThat(service.archiveOpen(user, WEEK_START)).isEqualTo(1);

        assertThat(learnedFactRepository.findByIdAndCreatedByAndDeletedFalse(open.getId(), user)).isEmpty();
        assertThat(learnedFactRepository.findByIdAndCreatedByAndDeletedFalse(accepted.getId(), user)).isPresent();
        assertThat(learnedFactRepository.findByIdAndCreatedByAndDeletedFalse(otherWeek.getId(), user)).isPresent();
    }

    @Test
    void listReturnsOnlyThatWeekAndCarriesTheDecision() {
        UUID user = userPopulator.createUser("wl-list@test.local").getId();
        learnedFactPopulator.weeklyCandidate(user, WEEK_START, "Ezen a héten.", "life", "2 nap",
                LearnedFactEntity.DECISION_REJECT);
        learnedFactPopulator.weeklyCandidate(user, WEEK_START.minusWeeks(1), "Múlt héten.", "life", null, null);
        learnedFactPopulator.candidate(user, "Csevegésből.", "life", null);

        List<WeeklyLessonResponse> lessons = service.list(user, WEEK_START);

        assertThat(lessons).singleElement().satisfies(l -> {
            assertThat(l.getCandidateText()).isEqualTo("Ezen a héten.");
            assertThat(l.getEvidence()).isEqualTo("2 nap");
            assertThat(l.getUserDecision()).isEqualTo(LearnedFactEntity.DECISION_REJECT);
            assertThat(l.getCreatedAt()).isNotNull();
        });
    }

    @Test
    void anotherUsersCandidatesAreNeverListedOrDeduped() {
        UUID user = userPopulator.createUser("wl-owner@test.local").getId();
        UUID other = userPopulator.createUser("wl-other@test.local").getId();
        learnedFactPopulator.weeklyCandidate(other, WEEK_START, "Idegen tanulság.", "life", null, null);

        assertThat(service.propose(user, WEEK_START, List.of(lesson("Idegen tanulság.", "life", null)))).isEqualTo(1);
        assertThat(service.list(user, WEEK_START)).hasSize(1);
        assertThat(service.list(other, WEEK_START)).hasSize(1);
    }
}
