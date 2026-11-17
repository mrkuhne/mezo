package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
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
}
