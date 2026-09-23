package io.mrkuhne.mezo.feature.companion.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.config.DayReviewWarmupProperties;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DayReviewWarmupJobTest {

    @Mock private UserFanOut userFanOut;
    @Mock private DayReviewService dayReviewService;

    private DayReviewWarmupJob job(int catchUpDays) {
        return new DayReviewWarmupJob(userFanOut, dayReviewService,
            new DayReviewWarmupProperties("0 50 2 * * *", catchUpDays));
    }

    private void runBodyFor(AppUserEntity... users) {
        doAnswer(inv -> {
            Consumer<AppUserEntity> body = inv.getArgument(1);
            for (AppUserEntity u : users) body.accept(u);
            return null;
        }).when(userFanOut).forEachActiveUser(anyString(), any());
    }

    private static AppUserEntity user() {
        AppUserEntity u = new AppUserEntity();
        u.setId(UUID.randomUUID());
        return u;
    }

    @Test
    void testRun_shouldAssembleEveryDayOfTheWindow_whenUsersAreActive() {
        AppUserEntity a = user();
        runBodyFor(a);
        LocalDate yesterday = LocalDate.now().minusDays(1);

        job(3).run();

        verify(dayReviewService).assemble(a.getId(), yesterday);
        verify(dayReviewService).assemble(a.getId(), yesterday.minusDays(1));
        verify(dayReviewService).assemble(a.getId(), yesterday.minusDays(2));
        verifyNoMoreInteractions(dayReviewService);
    }

    @Test
    void testRun_shouldContinueWithTheNextDateAndUser_whenOneAssembleThrows() {
        AppUserEntity a = user();
        AppUserEntity b = user();
        runBodyFor(a, b);
        LocalDate yesterday = LocalDate.now().minusDays(1);
        when(dayReviewService.assemble(a.getId(), yesterday)).thenThrow(new IllegalStateException("boom"));

        job(2).run();

        verify(dayReviewService).assemble(a.getId(), yesterday.minusDays(1));
        verify(dayReviewService).assemble(b.getId(), yesterday);
        verify(dayReviewService).assemble(b.getId(), yesterday.minusDays(1));
    }
}
