package io.mrkuhne.mezo.feature.companion.flags.repository;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanionFlagLogRepository extends JpaRepository<CompanionFlagLogEntity, UUID> {

    Optional<CompanionFlagLogEntity> findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, String flagKey);

    List<CompanionFlagLogEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    /** Cooldown gate: is there a raise of this flag newer than {@code since}? */
    @Query("""
        SELECT count(f) > 0 FROM CompanionFlagLogEntity f
        WHERE f.createdBy = :createdBy AND f.flagKey = :flagKey AND f.createdAt >= :since
        """)
    boolean existsRaiseSince(
        @Param("createdBy") UUID createdBy, @Param("flagKey") String flagKey, @Param("since") Instant since);

    /**
     * all_healthy's quiet-window gate: any genuine problem raise since {@code since}? {@code
     * logging_gap} is excluded on purpose — it names a data-availability gap (a domain has gone
     * stale), not a health/behavior problem, so a user who tracks sleep and check-ins tightly but
     * logs meals loosely must not have {@code all_healthy} blocked for a full quiet-days window
     * every time {@code logging_gap} fires (review fix, bd mezo-d58h.2). {@code missed_workouts}
     * stays counted — it IS a behavior signal, unlike a data gap. {@code all_healthy} itself is
     * excluded as before: {@link io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator}
     * only runs this rule when nothing else raised that same evaluation, so the two never land on
     * the same day regardless of this query.
     *
     * <p>S6 (bd mezo-d58h.6) extends the same argument to {@code ignored_nudge}: it names the
     * app's OWN nudging failing to land (a delivery/behavior-change-channel problem), not a
     * health/behavior problem of the user's, so it joins {@code logging_gap} in the exclusion
     * list. The other five S6 keys (acute_bad_day, load_fuel_mismatch, rapid_weight_loss,
     * joint_overuse, late_eating) are genuine problem signals like {@code missed_workouts} and
     * stay counted.
     */
    @Query("""
        SELECT count(f) > 0 FROM CompanionFlagLogEntity f
        WHERE f.createdBy = :createdBy AND f.flagKey NOT IN ('all_healthy', 'logging_gap', 'ignored_nudge')
        AND f.createdAt >= :since
        """)
    boolean existsProblemRaiseSince(@Param("createdBy") UUID createdBy, @Param("since") Instant since);
}
