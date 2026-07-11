package io.mrkuhne.mezo.feature.activity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** activity_log DDL + jsonb extract envelope + owner-scoped reads (mezo-jzca). */
class ActivityLogEntityIT extends AbstractIntegrationTest {

    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityLogRepository repository;

    @Test
    void testSave_shouldRoundTripJsonbExtract_whenPersisted() {
        UUID owner = userPopulator.createUser("act-a@test.hu").getId();
        ActivityLogEntity e = activityPopulator.activity(owner, LocalDate.of(2026, 7, 11),
            "Olvastam 30 percet", "learning", 15, ActivityLogEntity.BY_AI);

        ActivityLogEntity found = repository.findByIdAndCreatedBy(e.getId(), owner).orElseThrow();
        assertThat(found.getExtracted().durationMin()).isEqualTo(30);
        assertThat(found.getSkillKey()).isEqualTo("learning");
        assertThat(found.getXpAwarded()).isEqualTo(15);
    }

    @Test
    void testFindDay_shouldReturnOwnRowsNewestFirst_whenTwoUsersLog() {
        UUID a = userPopulator.createUser("act-b@test.hu").getId();
        UUID b = userPopulator.createUser("act-c@test.hu").getId();
        LocalDate d = LocalDate.of(2026, 7, 11);
        activityPopulator.activity(a, d, "Meditáltam", "mindfulness", 10, ActivityLogEntity.BY_AI);
        activityPopulator.activity(b, d, "Főztem", "cooking", 10, ActivityLogEntity.BY_USER);

        assertThat(repository.findByCreatedByAndOccurredOnOrderByCreatedAtDesc(a, d))
            .hasSize(1)
            .allSatisfy(r -> assertThat(r.getText()).isEqualTo("Meditáltam"));
    }
}
