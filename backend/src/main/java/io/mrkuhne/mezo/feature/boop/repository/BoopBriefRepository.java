package io.mrkuhne.mezo.feature.boop.repository;

import io.mrkuhne.mezo.feature.boop.entity.BoopBriefEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoopBriefRepository extends JpaRepository<BoopBriefEntity, UUID> {

    Optional<BoopBriefEntity> findByCreatedByAndDate(UUID createdBy, LocalDate date);

    /** Atomic capped increment of the manual regeneration count: 1 = counted, 0 = the cap is reached.
     *  Clears the persistence context so no managed copy keeps the old count. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update BoopBriefEntity b set b.regenCount = b.regenCount + 1 "
        + "where b.createdBy = :owner and b.date = :date and b.regenCount < :limit")
    int incrementRegen(@Param("owner") UUID owner, @Param("date") LocalDate date, @Param("limit") int limit);
}
