package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isA;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.service.ExpenditureWeekLearnedEvent;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

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

        new AdaptiveReviewJob(users, service, expenditureLearning, prefs(true), mock(ApplicationEventPublisher.class)).run();

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
            .thenReturn(Optional.of(row(0, List.of(), "STABLE")));
        when(expenditureLearning.reviewWeek(eq(b.getId()), any())).thenReturn(Optional.empty());

        new AdaptiveReviewJob(users, service, expenditureLearning, prefs(true), mock(ApplicationEventPublisher.class)).run();

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

        new AdaptiveReviewJob(users, service, expenditureLearning, prefs(true), mock(ApplicationEventPublisher.class)).run();

        verify(expenditureLearning).reviewWeek(eq(a.getId()), eq(weekStart.minusWeeks(1)));
    }

    @Test
    void switchOffLearnsSilentlyAndStillOffersTheWeightOnlyCorrection() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        ExpenditureLearningService expenditureLearning = mock(ExpenditureLearningService.class);
        AppUserEntity a = user();
        when(users.findAll()).thenReturn(List.of(a));
        when(expenditureLearning.reviewWeek(eq(a.getId()), any()))
            .thenReturn(Optional.of(row(0, List.of(), "STABLE")));

        new AdaptiveReviewJob(users, service, expenditureLearning, prefs(false), mock(ApplicationEventPublisher.class)).run();

        verify(expenditureLearning).reviewWeek(eq(a.getId()), any()); // learning continues silently
        verify(service).reviewUser(eq(a.getId()), any()); // owner decision P3: the weight-only suggestion
    }

    // ── Task 6 (mezo-3n2so): the Monday bell ─────────────────────────────

    @Test
    void publishesTheBellWhenEnabledAndTheRowIsWorthSaying() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        ExpenditureLearningService expenditureLearning = mock(ExpenditureLearningService.class);
        ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
        AppUserEntity a = user();
        when(users.findAll()).thenReturn(List.of(a));
        ExpenditureEstimateEntity row = row(60, List.of(), "UPDATED");
        when(expenditureLearning.reviewWeek(eq(a.getId()), any())).thenReturn(Optional.of(row));

        new AdaptiveReviewJob(users, service, expenditureLearning, prefs(true), publisher).run();

        verify(publisher).publishEvent(isA(ExpenditureWeekLearnedEvent.class));
    }

    @Test
    void doesNotPublishWhenTheSwitchIsOff() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        ExpenditureLearningService expenditureLearning = mock(ExpenditureLearningService.class);
        ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
        AppUserEntity a = user();
        when(users.findAll()).thenReturn(List.of(a));
        when(expenditureLearning.reviewWeek(eq(a.getId()), any())).thenReturn(Optional.of(row(60, List.of(), "UPDATED")));

        new AdaptiveReviewJob(users, service, expenditureLearning, prefs(false), publisher).run();

        verify(publisher, never()).publishEvent(any());
    }

    @Test
    void doesNotPublishWhenTheRowIsNotWorthSaying() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        ExpenditureLearningService expenditureLearning = mock(ExpenditureLearningService.class);
        ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
        AppUserEntity a = user();
        when(users.findAll()).thenReturn(List.of(a));
        // step 0, no excluded days, not HOLDING: nothing worth saying.
        when(expenditureLearning.reviewWeek(eq(a.getId()), any())).thenReturn(Optional.of(row(0, List.of(), "STABLE")));

        new AdaptiveReviewJob(users, service, expenditureLearning, prefs(true), publisher).run();

        verify(publisher, never()).publishEvent(any());
    }

    @Test
    void doesNotPublishWhenTheRowIsAbsent() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        ExpenditureLearningService expenditureLearning = mock(ExpenditureLearningService.class);
        ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
        AppUserEntity a = user();
        when(users.findAll()).thenReturn(List.of(a));
        when(expenditureLearning.reviewWeek(eq(a.getId()), any())).thenReturn(Optional.empty());

        new AdaptiveReviewJob(users, service, expenditureLearning, prefs(true), publisher).run();

        verify(publisher, never()).publishEvent(any());
    }

    private static DietPreferencesPort prefs(boolean learningEnabled) {
        DietPreferencesPort port = mock(DietPreferencesPort.class);
        when(port.resolve(any())).thenReturn(
            new DietPreferences("balanced", null, null, null, "moderate", 3000, 30, 0, learningEnabled));
        return port;
    }

    private static AppUserEntity user() {
        AppUserEntity u = new AppUserEntity();
        u.setId(UUID.randomUUID());
        return u;
    }

    private static ExpenditureEstimateEntity row(int stepKcal, List<ExcludedIntakeDayJson> excluded, String status) {
        ExpenditureEstimateEntity e = new ExpenditureEstimateEntity();
        e.setId(UUID.randomUUID());
        e.setWeekStart(LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1));
        e.setStatus(status);
        e.setStepKcal(stepKcal);
        e.setExcludedDays(excluded);
        return e;
    }
}
