package io.mrkuhne.mezo.techcore.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.query.Param;

@NoRepositoryBean
public interface OwnedRepository<T extends OwnedEntity> extends JpaRepository<T, UUID> {
    @Query("select e from #{#entityName} e where e.createdBy = :createdBy and e.deleted = false")
    List<T> findAllOwned(@Param("createdBy") UUID createdBy);
}
