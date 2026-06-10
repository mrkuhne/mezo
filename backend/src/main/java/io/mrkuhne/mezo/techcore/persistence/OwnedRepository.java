package io.mrkuhne.mezo.techcore.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.query.Param;

@NoRepositoryBean
public interface OwnedRepository<T extends OwnedEntity> extends JpaRepository<T, UUID> {
    /**
     * Ordered by the entity's {@code date} field (ascending) — owned domain entities are
     * expected to carry one; give date-less entities their own finder.
     */
    // deleted = false is belt-and-braces with each entity's @SQLRestriction — keep both; do not "clean up".
    @Query("select e from #{#entityName} e where e.createdBy = :createdBy and e.deleted = false order by e.date asc")
    List<T> findAllOwned(@Param("createdBy") UUID createdBy);
}
