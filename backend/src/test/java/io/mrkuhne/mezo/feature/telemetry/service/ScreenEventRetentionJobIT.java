package io.mrkuhne.mezo.feature.telemetry.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.telemetry.entity.ScreenEventEntity;
import io.mrkuhne.mezo.feature.telemetry.repository.ScreenEventRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The nightly hard-delete: only rows past the retention window go (bd mezo-o5cz, spec §7). */
class ScreenEventRetentionJobIT extends AbstractIntegrationTest {

    @Autowired private ScreenEventRetentionJob job;
    @Autowired private ScreenEventRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRun_shouldDeleteOnlyRowsPastTheRetentionWindow_whenBothOldAndFreshExist() {
        AppUserEntity user = userPopulator.createUser();
        // retention-days is 90: 91 days back is out, 89 days back is in, today is obviously in.
        repository.save(row(user, "/old", Duration.ofDays(91)));
        repository.save(row(user, "/edge", Duration.ofDays(89)));
        repository.save(row(user, "/fresh", Duration.ZERO));

        job.run();

        assertThat(repository.findAll()).extracting(ScreenEventEntity::getScreen)
                .containsExactlyInAnyOrder("/edge", "/fresh");
    }

    private static ScreenEventEntity row(AppUserEntity user, String screen, Duration age) {
        var row = new ScreenEventEntity();
        row.setCreatedBy(user.getId());
        row.setScreen(screen);
        row.setOccurredAt(Instant.now().minus(age));
        return row;
    }
}
