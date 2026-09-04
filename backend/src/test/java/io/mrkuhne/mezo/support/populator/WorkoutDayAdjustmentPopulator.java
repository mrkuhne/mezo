package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.WorkoutDayAdjustmentEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutDayAdjustmentRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for {@link WorkoutDayAdjustmentEntity} (proactive coaching S5, mezo-d58h.5)
 * — see docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB constraints (the unique index, the set_delta CHECK) fire.
 */
@TestComponent
@RequiredArgsConstructor
public class WorkoutDayAdjustmentPopulator {

    private final WorkoutDayAdjustmentRepository repository;

    /**
     * JPA-managed shared EntityManager — the {@code rawInsert} method needs it for native
     * queries to test DB constraints (e.g. CHECK violations that bean validation would catch first).
     * Field-injected {@code @PersistenceContext} is the house exception to constructor DI (see
     * {@code ResetDatabase}).
     */
    @PersistenceContext
    private EntityManager em;

    public WorkoutDayAdjustmentEntity createAdjustment(
        UUID createdBy, LocalDate date, Short setDelta) {
        WorkoutDayAdjustmentEntity a = new WorkoutDayAdjustmentEntity();
        a.setCreatedBy(createdBy);
        a.setDate(date);
        a.setSetDelta(setDelta);
        return repository.saveAndFlush(a);
    }

    /**
     * Persist a hand-built (e.g. deliberately out-of-range) row — DB CHECK violation tests. Uses
     * native query to bypass bean validation so the DB CHECK is what fires.
     */
    public void rawInsert(UUID createdBy, LocalDate date, Short setDelta) {
        em.createNativeQuery(
                "insert into workout_day_adjustment (created_by, date, set_delta) values (:createdBy, :date, :setDelta)")
            .setParameter("createdBy", createdBy)
            .setParameter("date", date)
            .setParameter("setDelta", setDelta)
            .executeUpdate();
        em.flush();
    }

    /** Soft-delete an adjustment (repository {@code delete} → {@code @SQLDelete} flips is_deleted). */
    public void softDelete(WorkoutDayAdjustmentEntity entity) {
        repository.delete(entity);
        repository.flush();
    }
}
