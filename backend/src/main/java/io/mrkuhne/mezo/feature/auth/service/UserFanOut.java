package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.List;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The per-user cron fan-out (S6, mezo-qw37.6, spec L1). Replaces {@code appUserRepository.findAll()}
 * in every {@code @Scheduled} job: only ACTIVE + onboarded accounts, each body executed under
 * {@link LlmActorContext#runAs} so {@code llm_log_history.created_by} names the user the job ran for,
 * and one failing user never aborts the run (the jobs keep their own finer-grained try/catch).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserFanOut {

    private final AppUserRepository appUserRepository;

    @Transactional(readOnly = true)
    public List<AppUserEntity> activeUsers() {
        return appUserRepository.findByStatusAndOnboardedAtIsNotNull(AppUserEntity.UserStatus.ACTIVE);
    }

    public void forEachActiveUser(String jobName, Consumer<AppUserEntity> body) {
        List<AppUserEntity> users = activeUsers();
        for (AppUserEntity user : users) {
            try {
                LlmActorContext.runAs(user.getId(), () -> body.accept(user));
            } catch (Throwable e) {
                // Throwable, not Exception/RuntimeException: Consumer.accept() cannot DECLARE a
                // checked exception, but a sneaky-throw (@SneakyThrows, Unsafe, a generic
                // rethrow) can still make one escape the body — and it must not abort the fan-out
                // either. See UserFanOutIT's sneaky-throw test.
                log.warn("{} failed for user {} — the fan-out continues", jobName, user.getId(), e);
            }
        }
        log.debug("{} fanned out over {} active user(s)", jobName, users.size());
    }
}
