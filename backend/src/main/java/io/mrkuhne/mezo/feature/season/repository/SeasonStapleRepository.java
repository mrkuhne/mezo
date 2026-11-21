package io.mrkuhne.mezo.feature.season.repository;

import io.mrkuhne.mezo.feature.season.entity.SeasonStapleEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SeasonStapleRepository extends JpaRepository<SeasonStapleEntity, UUID> {

    List<SeasonStapleEntity> findByCreatedByOrderByPositionAsc(UUID owner);

    /** Rows ever written, deleted ones included — none means he never set his staples (the defaults are offered). */
    @Query(value = "select count(*) from season_staple where created_by = :owner", nativeQuery = true)
    long countEver(@Param("owner") UUID owner);
}
