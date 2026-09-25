package io.mrkuhne.mezo.feature.companion.reflection;

import io.mrkuhne.mezo.feature.companion.reflection.service.ObservationContextService;
import io.mrkuhne.mezo.feature.companion.reflection.config.ObservationContextProperties;
import io.mrkuhne.mezo.feature.companion.repository.PersonalRecordQuery;
import tools.jackson.databind.ObjectMapper;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@Transactional
class ObservationContextServiceIT extends AbstractIntegrationTest {
    @Autowired ObservationContextService context;
    @Autowired PersonalRecordQuery records;
    @Autowired ObjectMapper json;
    @Autowired UserPopulator users;
    @Autowired JournalPopulator journals;
    @Autowired CheckInPopulator checkins;
    @Autowired SleepLogPopulator sleeps;
    @Autowired TrainPopulator train;
    @Autowired RunningPopulator running;
    @Autowired io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository runs;
    @Autowired io.mrkuhne.mezo.feature.train.repository.SportSessionRepository sports;
    @Autowired AiConversationPopulator conversations;
    @Autowired AiMessagePopulator messages;
    @Autowired JournalEntryRepository journalRepository;
    @Autowired WorkoutSessionRepository sessions;

    @Test
    void testCollect_shouldJoinDatedOriginalNotesAndMetrics_whenYesterdayHasNoSignal() {
        var owner = users.createUser().getId();
        var day = LocalDate.now();
        var earlier = day.minusDays(6);
        var journal = journals.createEntry(owner, earlier, "Nehéz munkahelyi megbeszélés", "quickinput");
        var gratitude = journals.createGratitude(owner, earlier, "Jó baráti séta", "connection");
        var checkin = checkins.createCheckIn(owner, earlier.plusDays(1), "08:00", 2, 5, "Feszült reggel");
        var sleep = sleeps.createSleepLog(owner, earlier.plusDays(1), "23:00", "07:00", new BigDecimal("8"), 7, 1, "Sok gondolat");
        var result = context.collect(owner, day);
        assertThat(result.references()).contains("journal_entry:" + journal.getId(), "gratitude_entry:" + gratitude.getId(),
                "check_in:" + checkin.getId(), "sleep_log:" + sleep.getId());
        assertThat(result.text()).contains("Nehéz munkahelyi", "Jó baráti séta", "Feszült reggel", "Sok gondolat", "energy", "stress", earlier.toString());
        assertThat(result.evidence().get("journal_entry:" + journal.getId())).contains(earlier.toString(), "Nehéz munkahelyi");
        assertThatThrownBy(() -> result.references().add("fake")).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void testCollect_shouldExcludeForeignDeletedAssistantAndOutOfWindowSources_whenCollectingEvidence() {
        var owner = users.createUser().getId();
        var other = users.createUser().getId();
        var day = LocalDate.now();
        journals.createEntry(other, day, "FOREIGN", "quickinput");
        var deleted = journals.createEntry(owner, day, "DELETED", "quickinput");
        journalRepository.delete(deleted);
        journalRepository.flush();
        journals.createEntry(owner, day.minusDays(28), "TOO_OLD", "quickinput");
        journals.createEntry(owner, day.plusDays(1), "FUTURE", "quickinput");
        var conversation = conversations.conversation(owner);
        messages.message(conversation, "assistant", "ASSISTANT_INVENTION");
        var user = messages.message(conversation, "user", "USER_EXPERIENCE");
        var result = context.collect(owner, day);
        assertThat(result.text()).contains("USER_EXPERIENCE").doesNotContain("FOREIGN", "DELETED", "TOO_OLD", "FUTURE", "ASSISTANT_INVENTION");
        assertThat(result.references()).containsExactly("ai_message:" + user.getId());
    }

    @Test
    void testCollect_shouldUseWorkoutOccurrenceDateAndHideDeletedParents_whenReadingExerciseNotes() {
        var owner = users.createUser().getId();
        var day = LocalDate.now();
        var meso = train.createActiveMeso(owner);
        var workout = train.createWorkoutSession(owner, meso.getId(), "A", "gym", 0, "completed");
        workout.setDate(day.minusDays(3));
        workout.setClosingNote("Munka után könnyebb lett");
        train.save(workout);
        var exercise = train.createExercise(owner, workout.getId(), "Evezés", "hát", "compound");
        exercise.setNote("Vállam fáradt");
        train.save(exercise);
        var result = context.collect(owner, day);
        assertThat(result.evidence().get("exercise:" + exercise.getId())).contains(day.minusDays(3).toString(), "Vállam fáradt");
        assertThat(result.text()).contains("Munka után könnyebb lett");
        sessions.delete(workout);
        sessions.flush();
        assertThat(context.collect(owner, day).references()).doesNotContain("exercise:" + exercise.getId());
    }
    @Test
    void testCollect_shouldBoundOutputAndRetainDifferentSources_whenJournalIsBusy() {
        var owner = users.createUser().getId();
        var day = LocalDate.now();
        for (int i = 0; i < 12; i++) journals.createEntry(owner, day, "Hosszú napló ".repeat(100), "quickinput");
        var checkin = checkins.createCheckIn(owner, day, "08:00", 2, 5, "Fontos checkin");
        var bounded = new ObservationContextService(records,
                new ObservationContextProperties(28, 3, 30, 150, 1200), json);
        var result = bounded.collect(owner, day);
        assertThat(result.text()).hasSizeLessThanOrEqualTo(1200);
        assertThat(result.references()).contains("check_in:" + checkin.getId());
        assertThat(result.references().stream().filter(ref -> ref.startsWith("journal_entry:"))).hasSizeLessThanOrEqualTo(3);
        assertThat(result.evidence().keySet()).allSatisfy(ref -> assertThat(result.text()).contains(ref));
    }

    @Test
    void testExists_shouldValidateOriginalOwnerVisibleSources_whenRecheckingHistoricalReferences() {
        var owner = users.createUser().getId();
        var other = users.createUser().getId();
        var old = journals.createEntry(owner, LocalDate.now().minusDays(80), "Régi saját forrás", "quickinput");
        String ref = "journal_entry:" + old.getId();
        assertThat(context.exists(owner, ref)).isTrue();
        assertThat(context.exists(other, ref)).isFalse();
        assertThat(context.exists(owner, "journal_entry:not-an-id")).isFalse();
        assertThat(context.exists(owner, "pattern:" + old.getId())).isFalse();
        var conversation = conversations.conversation(owner);
        var assistant = messages.message(conversation, "assistant", "Nem saját bizonyíték");
        assertThat(context.exists(owner, "ai_message:" + assistant.getId())).isFalse();
        journalRepository.delete(old);
        journalRepository.flush();
        assertThat(context.exists(owner, ref)).isFalse();
    }

    @Test
    void testCollect_shouldIncludeRunAndSportNotesWithMetrics_whenRecordedOutsideJournal() {
        var owner = users.createUser().getId();
        var day = LocalDate.now();
        var block = running.createSprintBlock(owner);
        var run = running.createRunLog(owner, block.getId(), 1, "tue-sprint", day.minusDays(2), 6, 8, null, null, 30);
        run.setNotes("A kinti futás után kitisztult a fejem");
        runs.saveAndFlush(run);
        var sport = train.createSportSession(owner, day.minusDays(1));
        sport.setNotes("Jó társaságban röplabdáztam");
        sports.saveAndFlush(sport);
        var result = context.collect(owner, day);
        assertThat(result.evidence().get("run_session_log:" + run.getId()))
                .contains(day.minusDays(2).toString(), "kitisztult", "rpe_actual=8");
        assertThat(result.evidence().get("sport_session:" + sport.getId()))
                .contains(day.minusDays(1).toString(), "Jó társaságban", "duration_min");
    }

    @Test
    void testFetch_shouldReturnStructuredRecord_whenReReadingCheckIn() {
        var owner = users.createUser().getId();
        var today = LocalDate.now();
        var checkin = checkins.createCheckIn(owner, today, "08:00", 6, 3, "Meglepően jól indult a hét");
        var rec = context.fetch(owner, "check_in:" + checkin.getId()).orElseThrow();
        assertThat(rec.source()).isEqualTo("check_in");
        assertThat(rec.date()).isEqualTo(today.toString());
        assertThat(rec.time()).isEqualTo("08:00");
        assertThat(rec.quote()).isEqualTo("Meglepően jól indult a hét");
        assertThat(rec.fields()).containsEntry("energy", "6").containsEntry("stress", "3");
        assertThat(rec.fields()).doesNotContainKey("note"); // prose lives in quote, not fields
        assertThat(rec.fields()).doesNotContainKey("id");   // OMITTED_FIELDS filtered
    }

    @Test
    void testFetch_shouldCapQuoteAt500Chars_whenSourceTextIsLonger() {
        var owner = users.createUser().getId();
        // plain ASCII: no surrogate pair can land on the cut boundary
        var longText = "a".repeat(600);
        var journal = journals.createEntry(owner, LocalDate.now(), longText, "quickinput");
        var rec = context.fetch(owner, "journal_entry:" + journal.getId()).orElseThrow();
        assertThat(rec.quote()).hasSize(500);
    }

    @Test
    void testFetch_shouldRejectNullMalformedUnknownAndForeignRefs_whenReReadingSources() {
        var owner = users.createUser().getId();
        var other = users.createUser().getId();
        var checkin = checkins.createCheckIn(owner, LocalDate.now(), "08:00", 6, 3, "Feszült reggel");
        assertThat(context.fetch(owner, null)).isEmpty();
        assertThat(context.fetch(owner, "nonsense")).isEmpty();
        assertThat(context.fetch(owner, "person:" + UUID.randomUUID())).isEmpty(); // not in SOURCES
        assertThat(context.fetch(other, "check_in:" + checkin.getId())).isEmpty(); // foreign
        assertThat(context.fetch(owner, "check_in:not-a-uuid")).isEmpty(); // well-formed source, invalid UUID
        var conversation = conversations.conversation(owner);
        var assistant = messages.message(conversation, "assistant", "Nem saját bizonyíték");
        assertThat(context.fetch(owner, "ai_message:" + assistant.getId())).isEmpty(); // non-original
    }

    @Test
    void testFetch_shouldJoinAllProseFields_whenRecordHasMoreThanOne() {
        var owner = users.createUser().getId();
        var day = LocalDate.now();
        var meso = train.createActiveMeso(owner);
        var workout = train.createWorkoutSession(owner, meso.getId(), "A", "gym", 0, "completed");
        workout.setDate(day);
        workout.setNote("Terv: nehéz nap");
        workout.setClosingNote("Munka után könnyebb lett");
        train.save(workout);
        var rec = context.fetch(owner, "workout_session:" + workout.getId()).orElseThrow();
        assertThat(rec.quote()).isEqualTo("Terv: nehéz nap — Munka után könnyebb lett");
    }

}
