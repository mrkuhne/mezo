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

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.character.config.CharacterCouncilProperties;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionService;
import java.time.LocalDate;
import java.util.List;
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

    private CharacterCouncilJob job(int catchUpDays) {
        var properties = new CharacterCouncilProperties("0 */15 * * * *", "UTC", "00:00", catchUpDays, 6, 60, 3);
        return new CharacterCouncilJob(users, council, properties, observationService, runLog, runs, editionsProvider);
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

        job(3).run();

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

        job(2).run();

        ArgumentCaptor<LocalDate> councilDays = ArgumentCaptor.forClass(LocalDate.class);
        verify(council, times(2)).run(eq(owner.getId()), councilDays.capture());
        List<LocalDate> captured = councilDays.getAllValues();
        LocalDate today = captured.get(captured.size() - 1);

        // the council threw for EVERY day, including today — the edition still runs for today
        verify(teamEditionService, times(1)).run(eq(owner.getId()), eq(today));
    }
}
