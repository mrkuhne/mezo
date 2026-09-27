package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionHitEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamChatExceptionHitRepository extends JpaRepository<TeamChatExceptionHitEntity, UUID> {

    long countByExceptionIdAndHitOnGreaterThanEqualAndDeletedFalse(UUID exceptionId, LocalDate since);

    boolean existsByExceptionIdAndHitOnAndDeletedFalse(UUID exceptionId, LocalDate hitOn);

    Optional<TeamChatExceptionHitEntity> findFirstByExceptionIdAndThreadIdAndSourceAndDeletedFalse(
            UUID exceptionId, UUID threadId, String source);
}
