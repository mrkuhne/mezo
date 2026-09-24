package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamEditionPostEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamEditionPostRepository extends JpaRepository<TeamEditionPostEntity, UUID> {

    List<TeamEditionPostEntity> findByEditionIdInOrderByEditionIdAscRankAsc(Collection<UUID> editionIds);
}
