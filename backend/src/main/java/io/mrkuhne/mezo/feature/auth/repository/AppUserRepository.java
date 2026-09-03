package io.mrkuhne.mezo.feature.auth.repository;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface AppUserRepository extends JpaRepository<AppUserEntity, UUID> {
    Optional<AppUserEntity> findByEmail(String email);
    boolean existsByEmail(String email);

    /** Cheap presence stamp — called by CurrentUser at most every 5 minutes per user. */
    @Modifying
    @Transactional
    @Query("update AppUserEntity u set u.lastSeenAt = :at where u.id = :id")
    void touchLastSeen(@Param("id") UUID id, @Param("at") Instant at);
}
