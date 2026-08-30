package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterConferenceRepository extends JpaRepository<CharacterConferenceEntity, UUID> {

    List<Summary> findByCreatedByOrderByGeneratedAtDesc(UUID createdBy);

    Optional<CharacterConferenceEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    Optional<CharacterConferenceEntity> findFirstByCreatedByOrderByGeneratedAtDesc(UUID createdBy);

    /** The idempotency lookup for the weekly konzílium (Karakter spec §6, mezo-1gim.5): a live
     *  WEEKLY row already exists for this owner+week -> the service returns it instead of running
     *  the round again. */
    Optional<CharacterConferenceEntity> findByCreatedByAndKindAndWeekStart(UUID createdBy, String kind,
                                                                            LocalDate weekStart);

    /** Projection so the list endpoint never loads full transcripts. */
    interface Summary {
        UUID getId();

        String getKind();

        LocalDate getWeekStart();

        Instant getGeneratedAt();
    }
}
