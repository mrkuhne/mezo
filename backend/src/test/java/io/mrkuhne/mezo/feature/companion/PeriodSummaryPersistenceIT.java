package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * The W3.2 ladder table's schema contract (mezo-b3pp.13): one row per (granularity, period),
 * soft delete, and the DB-level granularity check.
 */
@Transactional
class PeriodSummaryPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 8, 17);

    @Autowired private PeriodSummaryRepository periodSummaryRepository;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    /** The DB-CHECK case needs a native insert to get around the entity's {@code @Pattern}. */
    @PersistenceContext private EntityManager em;

    @Test
    void testSave_shouldRoundTripWeekRow_whenPeriodIsAnIsoMonday() {
        UUID owner = userPopulator.createUser().getId();

        PeriodSummaryEntity saved = periodSummaryPopulator.periodSummary(
                owner, PeriodSummaryEntity.GRANULARITY_WEEK, MONDAY, "Erős hét volt.");

        PeriodSummaryEntity found = periodSummaryRepository
                .findByCreatedByAndGranularityAndPeriodStart(
                        owner, PeriodSummaryEntity.GRANULARITY_WEEK, MONDAY)
                .orElseThrow();
        assertThat(found.getId()).isEqualTo(saved.getId());
        assertThat(found.getSummaryText()).isEqualTo("Erős hét volt.");
    }

    @Test
    void testSave_shouldReject_whenSamePeriodIsSummarizedTwice() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_WEEK, MONDAY);

        assertThatThrownBy(() -> periodSummaryPopulator.periodSummary(
                owner, PeriodSummaryEntity.GRANULARITY_WEEK, MONDAY, "másik szöveg"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testSave_shouldAllowSamePeriodStart_whenGranularityDiffers() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate firstOfMonth = LocalDate.of(2026, 6, 1); // an ISO Monday AND a month start

        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_WEEK, firstOfMonth);
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, firstOfMonth);

        assertThat(periodSummaryRepository.findByCreatedByAndGranularityAndPeriodStart(
                owner, PeriodSummaryEntity.GRANULARITY_MONTH, firstOfMonth)).isPresent();
    }

    @Test
    void testDelete_shouldHideRowFromReads_whenSoftDeleted() {
        UUID owner = userPopulator.createUser().getId();
        PeriodSummaryEntity row = periodSummaryPopulator.periodSummary(
                owner, PeriodSummaryEntity.GRANULARITY_MONTH, LocalDate.of(2026, 8, 1));

        periodSummaryRepository.delete(row); // @SQLDelete -> soft delete
        periodSummaryRepository.flush();
        em.clear();

        assertThat(periodSummaryRepository.findById(row.getId())).isEmpty();
        assertThat(em.createNativeQuery(
                "select count(*) from period_summary where id = :id and is_deleted = true")
                .setParameter("id", row.getId())
                .getSingleResult()).isEqualTo(1L);
    }

    @Test
    void testInsert_shouldViolateCheckConstraint_whenGranularityIsUnknown() {
        UUID owner = userPopulator.createUser().getId();

        assertThatThrownBy(() -> {
            em.createNativeQuery("insert into period_summary (created_by, granularity, period_start, summary_text)"
                    + " values (:owner, 'year', :start, 'nope')")
                    .setParameter("owner", owner)
                    .setParameter("start", LocalDate.of(2026, 1, 1))
                    .executeUpdate();
            em.flush();
        }).hasMessageContaining("ck_period_summary_granularity");
    }
}
