package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdaptiveReviewJobTest {

    @Test
    void runsEveryUserAndIsolatesFailures() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        AppUserEntity a = user();
        AppUserEntity b = user();
        when(users.findAll()).thenReturn(List.of(a, b));
        when(service.reviewUser(eq(a.getId()), any())).thenThrow(new RuntimeException("boom"));

        new AdaptiveReviewJob(users, service).run();

        verify(service).reviewUser(eq(b.getId()), any()); // b still reviewed despite a's failure
    }

    private static AppUserEntity user() {
        AppUserEntity u = new AppUserEntity();
        u.setId(UUID.randomUUID());
        return u;
    }
}
