package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeartbeatNoteRepository extends JpaRepository<HeartbeatNoteEntity, UUID> {

    Optional<HeartbeatNoteEntity> findByCreatedByAndNoteDateAndWindowKey(
            UUID createdBy, LocalDate noteDate, String windowKey);

    /** The GET's read: the day's newest note (evening beats midday by generation time). */
    Optional<HeartbeatNoteEntity> findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc(
            UUID createdBy, LocalDate noteDate);
}
