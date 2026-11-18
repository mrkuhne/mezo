package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Repository for {@link MesoWeekProposalEntity}; keyed by run + week, so not the house OwnedRepository. */
public interface MesoWeekProposalRepository extends JpaRepository<MesoWeekProposalEntity, UUID> {

    /** The live {@code weekly} proposal of a run's week (at most one — partial unique index). */
    @Query("select p from MesoWeekProposalEntity p where p.createdBy = :createdBy and p.mesocycleId = :mesocycleId"
        + " and p.kind = '" + MesoWeekProposalEntity.KIND_WEEKLY + "' and p.week = :week")
    Optional<MesoWeekProposalEntity> findWeekly(
        @Param("createdBy") UUID createdBy, @Param("mesocycleId") UUID mesocycleId, @Param("week") int week);

    /** The latest applied (or auto-applied) {@code weekly} proposal strictly before {@code beforeWeek}. */
    @Query("select p from MesoWeekProposalEntity p where p.createdBy = :createdBy and p.mesocycleId = :mesocycleId"
        + " and p.kind = '" + MesoWeekProposalEntity.KIND_WEEKLY + "'"
        + " and p.status in ('" + MesoWeekProposalEntity.STATUS_APPLIED + "', '"
        + MesoWeekProposalEntity.STATUS_AUTO_APPLIED + "') and p.week < :beforeWeek"
        + " order by p.week desc limit 1")
    Optional<MesoWeekProposalEntity> findLatestApplied(
        @Param("createdBy") UUID createdBy, @Param("mesocycleId") UUID mesocycleId,
        @Param("beforeWeek") int beforeWeek);

    /**
     * The closed (applied, auto-applied or expired) {@code weekly} proposals strictly before {@code beforeWeek},
     * latest week first — the post-deload restore looks for the first one still carrying a restore.
     */
    @Query("select p from MesoWeekProposalEntity p where p.createdBy = :createdBy and p.mesocycleId = :mesocycleId"
        + " and p.kind = '" + MesoWeekProposalEntity.KIND_WEEKLY + "'"
        + " and p.status in ('" + MesoWeekProposalEntity.STATUS_APPLIED + "', '"
        + MesoWeekProposalEntity.STATUS_AUTO_APPLIED + "', '" + MesoWeekProposalEntity.STATUS_EXPIRED + "')"
        + " and p.week < :beforeWeek order by p.week desc")
    List<MesoWeekProposalEntity> findClosedWeeklyBefore(
        @Param("createdBy") UUID createdBy, @Param("mesocycleId") UUID mesocycleId,
        @Param("beforeWeek") int beforeWeek);

    /** Every still-{@code pending} proposal of a run (weekly and tier_change) strictly before {@code beforeWeek}. */
    @Query("select p from MesoWeekProposalEntity p where p.createdBy = :createdBy and p.mesocycleId = :mesocycleId"
        + " and p.status = '" + MesoWeekProposalEntity.STATUS_PENDING + "' and p.week < :beforeWeek"
        + " order by p.week asc")
    List<MesoWeekProposalEntity> findPendingBefore(
        @Param("createdBy") UUID createdBy, @Param("mesocycleId") UUID mesocycleId,
        @Param("beforeWeek") int beforeWeek);

    /** The run's still-{@code pending} {@code tier_change} proposals, newest first (the read endpoint shows them). */
    @Query("select p from MesoWeekProposalEntity p where p.createdBy = :createdBy and p.mesocycleId = :mesocycleId"
        + " and p.kind = '" + MesoWeekProposalEntity.KIND_TIER_CHANGE + "'"
        + " and p.status = '" + MesoWeekProposalEntity.STATUS_PENDING + "' order by p.createdAt desc")
    List<MesoWeekProposalEntity> findPendingTierChanges(
        @Param("createdBy") UUID createdBy, @Param("mesocycleId") UUID mesocycleId);

    /** One proposal of the caller's run by id (the decisions endpoint); absent for another user or run. */
    Optional<MesoWeekProposalEntity> findByIdAndCreatedByAndMesocycleId(UUID id, UUID createdBy, UUID mesocycleId);

    /** Every applied (or auto-applied) {@code weekly} proposal of a run, oldest week first. */
    @Query("select p from MesoWeekProposalEntity p where p.createdBy = :createdBy and p.mesocycleId = :mesocycleId"
        + " and p.kind = '" + MesoWeekProposalEntity.KIND_WEEKLY + "'"
        + " and p.status in ('" + MesoWeekProposalEntity.STATUS_APPLIED + "', '"
        + MesoWeekProposalEntity.STATUS_AUTO_APPLIED + "') order by p.week asc")
    List<MesoWeekProposalEntity> findAllApplied(
        @Param("createdBy") UUID createdBy, @Param("mesocycleId") UUID mesocycleId);
}
