package io.mrkuhne.mezo.feature.auth.repository;

import io.mrkuhne.mezo.feature.auth.entity.InviteEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InviteRepository extends JpaRepository<InviteEntity, UUID> {

    /** Pessimistic row lock — two concurrent registrations with one code serialize here. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InviteEntity i where i.code = :code")
    Optional<InviteEntity> findByCodeForUpdate(@Param("code") String code);

    boolean existsByCode(String code);

    List<InviteEntity> findAllByOrderByCreatedAtDesc();
}
