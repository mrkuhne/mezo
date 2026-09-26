package io.mrkuhne.mezo.feature.character.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.lenient;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.character.config.CharacterCouncilProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterCouncilEditionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterRunEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterCouncilEditionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

/**
 * Unit test for {@link CharacterCouncilJob} (Task 5 fix round 1): proves the esti-kiadás call
 * fires ONLY for today (never for a catch-up day), and fires EVEN IF the council itself threw for
 * that day — mirrors {@code DayReviewWarmupJobTest}'s Mockito idiom (no Spring context; the job
 * has no injectable {@link java.time.Clock}, so "today" is read from the actual invocation
 * arguments the job passed to {@code council.run}, never hard-coded against the wall clock).
 */
@ExtendWith(MockitoExtension.class)
class CharacterCouncilJobTest {

    @Mock private UserFanOut users;
    @Mock private CharacterCouncilService council;
    @Mock private CharacterObservationService observationService;
    @Mock private CharacterRunLog runLog;
    @Mock private CharacterRunRepository runs;
    @Mock private ObjectProvider<TeamEditionService> editionsProvider;
    @Mock private TeamEditionService teamEditionService;
    @Mock private CharacterCouncilEditionRepository councilEditions;

    /** 21:00 — past ready-at, before the 23:30 publish-anyway deadline. */
    private static final ZonedDateTime EVENING = ZonedDateTime.of(2026, 9, 26, 21, 0, 0, 0, ZoneId.of("UTC"));
    private static final LocalDate TODAY = EVENING.toLocalDate();

    private CharacterCouncilJob job(int catchUpDays) {
        var properties = new CharacterCouncilProperties("0 */15 * * * *", "UTC", "21:00", catchUpDays, 6, 60, 3, "23:30");
        return new CharacterCouncilJob(users, council, properties, observationService, runLog, runs, editionsProvider,
                councilEditions);
    }

    private void councilToday(String status, int attempts) {
        var edition = new CharacterCouncilEditionEntity();
        edition.setStatus(status);
        edition.setAttempts(attempts);
        lenient().when(councilEditions.findByCreatedByAndDay(any(), eq(TODAY))).thenReturn(Optional.of(edition));
    }

    private void runBodyFor(AppUserEntity... fanOutUsers) {
        doAnswer(inv -> {
            Consumer<AppUserEntity> body = inv.getArgument(1);
            for (AppUserEntity u : fanOutUsers) body.accept(u);
            return null;
        }).when(users).forEachActiveUser(anyString(), any());
    }

    /** {@code TeamEditionService} is behind an {@code ObjectProvider} — route ifAvailable to the mock. */
    private void editionServiceAvailable() {
        doAnswer(inv -> {
            Consumer<TeamEditionService> consumer = inv.getArgument(0);
            consumer.accept(teamEditionService);
            return null;
        }).when(editionsProvider).ifAvailable(any());
    }

    private static AppUserEntity user() {
        AppUserEntity u = new AppUserEntity();
        u.setId(UUID.randomUUID());
        return u;
    }

    @Test
    void run_callsEditionOnlyForToday_notForCatchUpDays() {
        AppUserEntity owner = user();
        runBodyFor(owner);
        editionServiceAvailable();
        councilToday("COMPLETED", 1);

        job(3).run(EVENING);

        ArgumentCaptor<LocalDate> councilDays = ArgumentCaptor.forClass(LocalDate.class);
        verify(council, times(3)).run(eq(owner.getId()), councilDays.capture());
        List<LocalDate> captured = councilDays.getAllValues();
        LocalDate today = captured.get(captured.size() - 1); // last loop iteration is offset==0
        assertThat(captured).hasSize(3).doesNotHaveDuplicates();

        verify(teamEditionService, times(1)).run(eq(owner.getId()), eq(today));
        for (LocalDate catchUpDay : captured.subList(0, captured.size() - 1)) {
            verify(teamEditionService, never()).run(owner.getId(), catchUpDay);
        }
    }

    @Test
    void run_callsEditionForToday_evenWhenCouncilThrowsForEveryDay() {
        AppUserEntity owner = user();
        runBodyFor(owner);
        editionServiceAvailable();
        doThrow(new RuntimeException("konzílium hiba")).when(council).run(any(), any());
        councilToday("FAILED", 3); // every retry used up — the council has settled

        job(2).run(EVENING);

        ArgumentCaptor<LocalDate> councilDays = ArgumentCaptor.forClass(LocalDate.class);
        verify(council, times(2)).run(eq(owner.getId()), councilDays.capture());
        List<LocalDate> captured = councilDays.getAllValues();
        LocalDate today = captured.get(captured.size() - 1);

        // the council threw for EVERY day, including today — the edition still runs for today
        verify(teamEditionService, times(1)).run(eq(owner.getId()), eq(today));
    }

    @Test
    void run_holdsEdition_whileTodaysCouncilStillHasRetriesLeft() {
        AppUserEntity owner = user();
        runBodyFor(owner);
        councilToday("FAILED", 1); // failed quietly once; the next tick retries it

        job(1).run(EVENING);

        verify(editionsProvider, never()).ifAvailable(any());
    }

    @Test
    void run_holdsEdition_whileTodaysCouncilIsProcessing() {
        AppUserEntity owner = user();
        runBodyFor(owner);
        councilToday("PROCESSING", 3);

        job(1).run(EVENING);

        verify(editionsProvider, never()).ifAvailable(any());
    }

    @Test
    void run_holdsEdition_whileTheCouncilHasNotStartedAndItsInputCanStillArrive() {
        AppUserEntity owner = user();
        runBodyFor(owner);
        var nightly = new CharacterRunEntity();
        nightly.setStatus("FAILED");
        nightly.setFailureCount(1);
        lenient().when(runs.findByCreatedByAndKindAndDay(any(), eq("NIGHTLY"), any())).thenReturn(Optional.of(nightly));

        job(1).run(EVENING);

        verify(editionsProvider, never()).ifAvailable(any());
    }

    @Test
    void run_publishesEdition_whenTheCouncilInputFailedForGood() {
        AppUserEntity owner = user();
        runBodyFor(owner);
        editionServiceAvailable();
        var nightly = new CharacterRunEntity();
        nightly.setStatus("FAILED");
        nightly.setFailureCount(3);
        lenient().when(runs.findByCreatedByAndKindAndDay(any(), eq("NIGHTLY"), any())).thenReturn(Optional.of(nightly));

        job(1).run(EVENING);

        verify(teamEditionService).run(owner.getId(), TODAY);
    }

    @Test
    void run_publishesEditionAnyway_atTheDeadline_evenIfTheCouncilIsStuck() {
        AppUserEntity owner = user();
        runBodyFor(owner);
        editionServiceAvailable();
        councilToday("PROCESSING", 1);

        job(1).run(EVENING.withHour(23).withMinute(30));

        verify(teamEditionService).run(owner.getId(), TODAY);
    }
}
