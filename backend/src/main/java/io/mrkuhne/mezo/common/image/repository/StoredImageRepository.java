package io.mrkuhne.mezo.common.image.repository;

import io.mrkuhne.mezo.common.image.entity.StoredImageEntity;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StoredImageRepository extends JpaRepository<StoredImageEntity, UUID> {

    Optional<StoredImageEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    /** Hard deletes — the bytes must go. Return the row count so callers can tell "was there". */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from StoredImageEntity i where i.createdBy = :owner and i.id = :id")
    int deleteOwned(@Param("owner") UUID owner, @Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from StoredImageEntity i where i.createdBy = :owner and i.id in :ids")
    int deleteOwnedIn(@Param("owner") UUID owner, @Param("ids") Collection<UUID> ids);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from StoredImageEntity i where i.createdBy = :owner")
    int deleteAllOwned(@Param("owner") UUID owner);
}
