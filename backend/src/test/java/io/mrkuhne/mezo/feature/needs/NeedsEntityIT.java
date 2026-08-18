package io.mrkuhne.mezo.feature.needs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.needs.entity.NeedsDayEntity;
import io.mrkuhne.mezo.feature.needs.repository.NeedsDayRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.NeedsPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

/** needs_day DDL + entity round-trip + (created_by, needs_date) unique index (mezo-dhzk). */
class NeedsEntityIT extends AbstractIntegrationTest {

    @Autowired private UserPopulator userPopulator;
    @Autowired private NeedsPopulator needsPopulator;
    @Autowired private NeedsDayRepository needsDayRepository;

    @Test
    void testSave_shouldRoundTrip_whenValidRow() {
        UUID owner = userPopulator.createUser("needs-a@test.hu").getId();
        LocalDate date = LocalDate.now();
        NeedsDayEntity saved = needsPopulator.needsDay(
            owner, date, new int[] {80, 70, 60, 50, 90, 100}, 5, false, 12, 3);

        NeedsDayEntity found = needsDayRepository
            .findByCreatedByAndNeedsDateAndDeletedFalse(owner, date)
            .orElseThrow();

        assertThat(found.getId()).isEqualTo(saved.getId());
        assertThat(found.getCreatedBy()).isEqualTo(owner);
        assertThat(found.getNeedsDate()).isEqualTo(date);
        assertThat(found.getEnergia()).isEqualTo(80);
        assertThat(found.getHidratacio()).isEqualTo(70);
        assertThat(found.getPihenes()).isEqualTo(60);
        assertThat(found.getMozgas()).isEqualTo(50);
        assertThat(found.getLelek()).isEqualTo(90);
        assertThat(found.getRend()).isEqualTo(100);
        assertThat(found.getGreenCount()).isEqualTo(5);
        assertThat(found.isAllGreen()).isFalse();
        assertThat(found.getXpAwarded()).isEqualTo(12);
        assertThat(found.getStreakDays()).isEqualTo(3);
        assertThat(found.isDeleted()).isFalse();
    }

    @Test
    void testUniqueIndex_shouldReject_whenDuplicateDate() {
        UUID owner = userPopulator.createUser("needs-b@test.hu").getId();
        LocalDate date = LocalDate.now();
        needsPopulator.needsDay(owner, date, new int[] {80, 70, 60, 50, 90, 100}, 6, true, 20, 4);

        assertThatThrownBy(() -> needsPopulator.needsDay(
                owner, date, new int[] {10, 20, 30, 40, 50, 60}, 0, false, 0, 0))
            .isInstanceOf(DataIntegrityViolationException.class);
    }
}
