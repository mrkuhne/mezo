package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.repository.PlannedSkipRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PlannedSkipPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persistence IT for {@link PlannedSkipEntity} (Kihagyás S1, mezo-q4xt2.1, spec 2026-09-28 §8):
 * the unique index rejects a duplicate (user, kind, date, target identity), a soft-deleted skip
 * frees its target for recreation, and the DB CHECK rejects a target/kind mismatch — the
 * {@code SportSlotSkipPersistenceIT} precedent for asserting a DB constraint via
 * {@code DataIntegrityViolationException}.
 */
@Transactional
class PlannedSkipPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate DATE = LocalDate.parse("2026-09-23"); // a Wednesday

    @Autowired private PlannedSkipPopulator populator;
    @Autowired private PlannedSkipRepository repository;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void testSave_shouldRoundTripSportSkip_whenPersisted() {
        UUID user = ownerId();
        PlannedSkipEntity saved = populator.create(
            user, DATE, Kind.SPORT, 2, "18:00", null, Reason.TIRED);

        PlannedSkipEntity reloaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getCreatedBy()).isEqualTo(user);
        assertThat(reloaded.getDate()).isEqualTo(DATE);
        assertThat(reloaded.getKind()).isEqualTo(Kind.SPORT);
        assertThat(reloaded.getDayOfWeek()).isEqualTo(2);
        assertThat(reloaded.getTime()).isEqualTo("18:00");
        assertThat(reloaded.getSessionKey()).isNull();
        assertThat(reloaded.getReasonCategory()).isEqualTo(Reason.TIRED);
    }

    @Test
    void testSave_shouldRejectDuplicate_whenSameTargetAndDate() {
        UUID user = ownerId();
        populator.create(user, DATE, Kind.GYM, null, null, null, Reason.NONE);

        PlannedSkipEntity duplicate = new PlannedSkipEntity();
        duplicate.setCreatedBy(user);
        duplicate.setDate(DATE);
        duplicate.setKind(Kind.GYM);

        assertThatThrownBy(() -> populator.save(duplicate))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testSave_shouldAllowRecreate_whenPreviousSoftDeleted() {
        UUID user = ownerId();
        PlannedSkipEntity row = populator.create(user, DATE, Kind.GYM, null, null, null, Reason.NONE);
        populator.softDelete(row);

        PlannedSkipEntity recreated = populator.create(user, DATE, Kind.GYM, null, null, null, Reason.NONE);

        assertThat(recreated.getId()).isNotEqualTo(row.getId());
    }

    @Test
    void testSave_shouldRejectBadTarget_whenGymCarriesTime() {
        UUID user = ownerId();

        PlannedSkipEntity bad = new PlannedSkipEntity();
        bad.setCreatedBy(user);
        bad.setDate(DATE);
        bad.setKind(Kind.GYM);
        bad.setTime("18:00");

        assertThatThrownBy(() -> populator.save(bad))
            .isInstanceOf(DataIntegrityViolationException.class);
    }
}
