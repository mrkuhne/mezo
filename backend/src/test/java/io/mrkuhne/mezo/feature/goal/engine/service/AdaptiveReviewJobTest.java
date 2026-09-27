package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdaptiveReviewJobTest {

    @Test
    void runsEveryUserAndIsolatesFailures() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        ExpenditureLearningService expenditureLearning = mock(ExpenditureLearningService.class);
        AppUserEntity a = user();
        AppUserEntity b = user();
        when(users.findAll()).thenReturn(List.of(a, b));
        when(expenditureLearning.reviewWeek(any(), any())).thenReturn(Optional.empty());
        when(service.reviewUser(eq(a.getId()), any())).thenThrow(new RuntimeException("boom"));

        new AdaptiveReviewJob(users, service, expenditureLearning).run();

        verify(service).reviewUser(eq(b.getId()), any()); // b still reviewed despite a's failure
    }

    @Test
    void learningUserSkipsTheSuggestionFallback() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        ExpenditureLearningService expenditureLearning = mock(ExpenditureLearningService.class);
        AppUserEntity a = user();
        AppUserEntity b = user();
        when(users.findAll()).thenReturn(List.of(a, b));
        when(expenditureLearning.reviewWeek(eq(a.getId()), any()))
            .thenReturn(Optional.of(new ExpenditureEstimateEntity()));
        when(expenditureLearning.reviewWeek(eq(b.getId()), any())).thenReturn(Optional.empty());

        new AdaptiveReviewJob(users, service, expenditureLearning).run();

        verify(service, never()).reviewUser(eq(a.getId()), any()); // learning user: no fallback suggestion
        verify(service).reviewUser(eq(b.getId()), any()); // b is not a learning user: falls back
    }

    @Test
    void reviewsTheWeekThatEnded() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        ExpenditureLearningService expenditureLearning = mock(ExpenditureLearningService.class);
        AppUserEntity a = user();
        when(users.findAll()).thenReturn(List.of(a));
        when(expenditureLearning.reviewWeek(any(), any())).thenReturn(Optional.empty());
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        new AdaptiveReviewJob(users, service, expenditureLearning).run();

        verify(expenditureLearning).reviewWeek(eq(a.getId()), eq(weekStart.minusWeeks(1)));
    }

    private static AppUserEntity user() {
        AppUserEntity u = new AppUserEntity();
        u.setId(UUID.randomUUID());
        return u;
    }
}
