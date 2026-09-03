package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.llmlog.service.LlmActorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class UserFanOutIT extends AbstractIntegrationTest {

    @Autowired private UserFanOut userFanOut;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LlmActorResolver llmActorResolver;

    @Test
    void testActiveUsers_shouldSkipDisabledAndNotOnboarded_whenMixed() {
        AppUserEntity active = userPopulator.createUser("fan-active@test.local");
        AppUserEntity disabled = userPopulator.createUser("fan-disabled@test.local");
        disabled.setStatus(AppUserEntity.UserStatus.DISABLED);
        userPopulator.save(disabled);
        AppUserEntity notOnboarded = userPopulator.createUser("fan-fresh@test.local");
        notOnboarded.setOnboardedAt(null);
        userPopulator.save(notOnboarded);

        List<UUID> ids = userFanOut.activeUsers().stream().map(AppUserEntity::getId).toList();

        assertThat(ids).contains(active.getId()).doesNotContain(disabled.getId(), notOnboarded.getId());
    }

    @Test
    void testForEachActiveUser_shouldRunBodyAsTheUser_andIsolateFailures() {
        AppUserEntity a = userPopulator.createUser("fan-a@test.local");
        AppUserEntity b = userPopulator.createUser("fan-b@test.local");
        List<UUID> actors = new ArrayList<>();
        // The throw must deterministically precede at least one surviving body — not just happen
        // to hit user "a" — otherwise iteration order (no ORDER BY on the finder) could put the
        // throwing user last and this would stay green even with the try/catch removed.
        AtomicBoolean first = new AtomicBoolean(true);

        userFanOut.forEachActiveUser("test-job", user -> {
            actors.add(llmActorResolver.currentActor());
            if (first.getAndSet(false)) {
                throw new UnsupportedOperationException("boom");
            }
        });

        assertThat(actors).hasSizeGreaterThanOrEqualTo(2).contains(a.getId(), b.getId());
        assertThat(llmActorResolver.currentActor()).isNull(); // context cleared after the loop
    }

    @Test
    void testPopulator_shouldCreateOnboardedActiveUsers_byDefault() {
        AppUserEntity user = userPopulator.createUser();
        assertThat(user.getStatus()).isEqualTo(AppUserEntity.UserStatus.ACTIVE);
        assertThat(user.getOnboardedAt()).isNotNull().isBeforeOrEqualTo(Instant.now());
    }
}
