package io.mrkuhne.mezo.feature.season.repository;

import io.mrkuhne.mezo.feature.season.entity.SeasonAllowedRecipeEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SeasonAllowedRecipeRepository
    extends JpaRepository<SeasonAllowedRecipeEntity, SeasonAllowedRecipeEntity.Key> {

    List<SeasonAllowedRecipeEntity> findBySeasonId(UUID seasonId);

    long countBySeasonId(UUID seasonId);

    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("delete from SeasonAllowedRecipeEntity a where a.seasonId = :seasonId")
    void deleteBySeasonId(@Param("seasonId") UUID seasonId);
}
