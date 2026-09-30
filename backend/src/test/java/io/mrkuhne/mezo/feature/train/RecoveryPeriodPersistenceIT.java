package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryDayReleaseEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import io.mrkuhne.mezo.feature.train.repository.RecoveryDayReleaseRepository;
import io.mrkuhne.mezo.feature.train.repository.RecoveryPeriodRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persistence IT for {@link RecoveryPeriodEntity} and {@link RecoveryDayReleaseEntity}
 * (Kihagyás S2, mezo-q4xt2.2, spec 2026-09-28 §9): the {@code idx_recovery_period_one_open}
 * unique index rejects a second open period for the same user, a soft-deleted period is
 * invisible, a release row round-trips, and {@code prevSets} jsonb round-trips.
 */
@Transactional
class RecoveryPeriodPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate START = LocalDate.parse("2026-09-23"); // a Wednesday

    @Autowired private RecoveryPeriodPopulator populator;
    @Autowired private RecoveryPeriodRepository repository;
    @Autowired private RecoveryDayReleaseRepository releaseRepository;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void testSave_shouldRoundTripOpenPeriod_whenFoundByOpenLookup() {
        UUID user = ownerId();
        populator.open(user, Reason.ILLNESS, START, Estimate.FEW_DAYS);

        RecoveryPeriodEntity found =
            repository.findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse(user).orElseThrow();

        assertThat(found.getCreatedBy()).isEqualTo(user);
        assertThat(found.getCategory()).isEqualTo(Reason.ILLNESS);
        assertThat(found.getEstimate()).isEqualTo(Estimate.FEW_DAYS);
        assertThat(found.getStartDate()).isEqualTo(START);
        assertThat(found.getEndedOn()).isNull();
    }

    @Test
    void testSave_shouldRejectSecondOpenPeriod_whenSameUser() {
        UUID user = ownerId();
        populator.open(user, Reason.ILLNESS, START, Estimate.FEW_DAYS);

        assertThatThrownBy(() -> populator.open(user, Reason.INJURY, START.plusDays(1), Estimate.WEEK))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testSave_shouldHideSoftDeletedPeriod_whenLookedUpByOpenLookup() {
        UUID user = ownerId();
        RecoveryPeriodEntity period = populator.open(user, Reason.STOMACH, START, Estimate.TODAY);
        populator.softDelete(period);

        assertThat(repository.findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse(user)).isEmpty();
    }

    @Test
    void testSave_shouldRoundTripReleaseRow_whenPersisted() {
        UUID user = ownerId();
        RecoveryPeriodEntity period = populator.open(user, Reason.TRAVEL, START, Estimate.UNKNOWN);

        RecoveryDayReleaseEntity release = new RecoveryDayReleaseEntity();
        release.setCreatedBy(user);
        release.setPeriodId(period.getId());
        release.setDate(START.plusDays(2));
        release.setLighten(true);
        releaseRepository.saveAndFlush(release);

        RecoveryDayReleaseEntity found = releaseRepository
            .findByCreatedByAndPeriodIdAndDateAndDeletedFalse(user, period.getId(), START.plusDays(2))
            .orElseThrow();

        assertThat(found.getPeriodId()).isEqualTo(period.getId());
        assertThat(found.getDate()).isEqualTo(START.plusDays(2));
        assertThat(found.isLighten()).isTrue();
    }

    @Test
    void testSave_shouldRoundTripPrevSetsJsonb_whenPersisted() {
        UUID user = ownerId();
        RecoveryPeriodEntity period = new RecoveryPeriodEntity();
        period.setCreatedBy(user);
        period.setCategory(Reason.INJURY);
        period.setEstimate(Estimate.WEEK);
        period.setStartDate(START);
        period.setPrevSets(Map.of("chest", 12));
        RecoveryPeriodEntity saved = populator.save(period);

        RecoveryPeriodEntity reloaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getPrevSets()).isEqualTo(Map.of("chest", 12));
    }
}
