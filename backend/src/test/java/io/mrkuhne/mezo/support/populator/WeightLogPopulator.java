package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/**
 * Test data factory for the WeightLog aggregate — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB CHECKs fire. Seeds the raw {@code {date, weightKg}}
 * rows the EWMA weight-trend engine reads via {@code findAllOwned}.
 */
@TestComponent
@RequiredArgsConstructor
public class WeightLogPopulator {

    private final WeightLogRepository weightLogRepository;

    /** JPA-managed shared EntityManager — the {@code @CreationTimestamp} backdate needs a native
     *  update; field-injected {@code @PersistenceContext} is the house exception to constructor DI
     *  (see {@code ResetDatabase}). */
    @PersistenceContext
    private EntityManager em;

    /** Persists a single weigh-in for {@code owner} on {@code date}. */
    public WeightLogEntity createWeightLog(UUID owner, LocalDate date, BigDecimal weightKg) {
        WeightLogEntity e = new WeightLogEntity();
        e.setCreatedBy(owner); // ownership set server-side style
        e.setDate(date);
        e.setWeightKg(weightKg);
        return weightLogRepository.saveAndFlush(e);
    }

    /** Weight log with a controlled created_at (habit weigh-in-cutoff tests). The native
     *  {@code created_at} backdate needs its own transaction — the base IT is non-transactional. */
    @Transactional
    public WeightLogEntity createWeightLogAt(UUID owner, LocalDate date, BigDecimal weightKg,
        Instant createdAt) {
        WeightLogEntity e = createWeightLog(owner, date, weightKg);
        em.createNativeQuery("update weight_log set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", e.getId()).executeUpdate();
        em.clear();
        return weightLogRepository.findById(e.getId()).orElseThrow();
    }
}
