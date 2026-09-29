package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryDayReleaseEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import io.mrkuhne.mezo.feature.train.repository.RecoveryDayReleaseRepository;
import io.mrkuhne.mezo.feature.train.repository.RecoveryPeriodRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for {@link RecoveryPeriodEntity} (Kihagyás S2, mezo-q4xt2.2) — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB constraints (the one-open-period unique index, the
 * category/estimate CHECKs) fire.
 */
@TestComponent
@RequiredArgsConstructor
public class RecoveryPeriodPopulator {

    private final RecoveryPeriodRepository repository;
    private final RecoveryDayReleaseRepository releases;

    public RecoveryPeriodEntity open(UUID createdBy, Reason category, LocalDate start, Estimate estimate) {
        RecoveryPeriodEntity p = new RecoveryPeriodEntity();
        p.setCreatedBy(createdBy);
        p.setCategory(category);
        p.setEstimate(estimate);
        p.setStartDate(start);
        return repository.saveAndFlush(p);
    }

    public RecoveryPeriodEntity ended(UUID createdBy, Reason category, LocalDate start, LocalDate endedOn) {
        RecoveryPeriodEntity p = new RecoveryPeriodEntity();
        p.setCreatedBy(createdBy);
        p.setCategory(category);
        p.setEstimate(Estimate.UNKNOWN);
        p.setStartDate(start);
        p.setEndedOn(endedOn);
        return repository.saveAndFlush(p);
    }

    /** "Ma mégis edzek" on {@code date} of {@code period} ({@code lighten} = keep the lightening). */
    public RecoveryDayReleaseEntity release(RecoveryPeriodEntity period, LocalDate date, boolean lighten) {
        RecoveryDayReleaseEntity r = new RecoveryDayReleaseEntity();
        r.setCreatedBy(period.getCreatedBy());
        r.setPeriodId(period.getId());
        r.setDate(date);
        r.setLighten(lighten);
        return releases.saveAndFlush(r);
    }

    /** Persist a hand-built (e.g. deliberately invalid) row — DB CHECK/unique index violation tests. */
    public RecoveryPeriodEntity save(RecoveryPeriodEntity entity) {
        return repository.saveAndFlush(entity);
    }

    /** Soft-delete a period (repository {@code delete} → {@code @SQLDelete} flips is_deleted). */
    public void softDelete(RecoveryPeriodEntity entity) {
        repository.delete(entity);
        repository.flush();
    }
}
