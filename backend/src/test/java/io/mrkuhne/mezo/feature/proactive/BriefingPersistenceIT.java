package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.BriefingContentEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BriefingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** briefing jsonb envelope round-trip + the partial-unique regeneration contract (spec §3). */
@Transactional
class BriefingPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 6);

    @Autowired private BriefingRepository briefingRepository;
    @Autowired private BriefingPopulator briefingPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTripContentEnvelope_whenReloaded() {
        UUID user = userPopulator.createUser("briefing-rt@test.local").getId();
        BriefingEntity saved = briefingPopulator.briefing(user, DAY);

        BriefingEntity reloaded = briefingRepository
                .findByCreatedByAndBriefingDate(user, DAY).orElseThrow();

        assertThat(reloaded.getId()).isEqualTo(saved.getId());
        assertThat(reloaded.getContent().eyebrow()).isEqualTo("Reggeli briefing");
        assertThat(reloaded.getContent().body()).containsExactly("Jó reggelt, Daniel!");
        assertThat(reloaded.getContent().refs())
                .containsExactly(new BriefingContentEnvelope.Ref("Sleep", "regeneráció"));
        assertThat(reloaded.getGeneratedAt()).isNotNull();
    }

    @Test
    void testSave_shouldRejectSecondLiveRowForSameDay_whenUniqueIndexHolds() {
        UUID user = userPopulator.createUser("briefing-uq@test.local").getId();
        briefingPopulator.briefing(user, DAY);

        assertThatThrownBy(() -> briefingPopulator.briefing(user, DAY))
                .hasMessageContaining("uq_briefing_created_by_briefing_date");
    }

    @Test
    void testSoftDelete_shouldAllowRegeneration_whenOldRowDeleted() {
        UUID user = userPopulator.createUser("briefing-regen@test.local").getId();
        BriefingEntity first = briefingPopulator.briefing(user, DAY);
        briefingRepository.delete(first);   // @SQLDelete -> is_deleted = true
        briefingRepository.flush();

        BriefingEntity second = briefingPopulator.briefing(user, DAY);

        assertThat(second.getId()).isNotEqualTo(first.getId());
        assertThat(briefingRepository.findByCreatedByAndBriefingDate(user, DAY))
                .hasValueSatisfying(b -> assertThat(b.getId()).isEqualTo(second.getId()));
    }

    @Test
    void testFindByCreatedByAndBriefingDate_shouldReturnEmpty_whenOtherUsersRow() {
        UUID owner = userPopulator.createUser("briefing-own@test.local").getId();
        UUID other = userPopulator.createUser("briefing-other@test.local").getId();
        briefingPopulator.briefing(other, DAY);

        assertThat(briefingRepository.findByCreatedByAndBriefingDate(owner, DAY)).isEmpty();
    }
}
