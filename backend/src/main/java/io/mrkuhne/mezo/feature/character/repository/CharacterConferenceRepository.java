package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterConferenceRepository extends JpaRepository<CharacterConferenceEntity, UUID> {
    /** JSON array due-date predicate cannot be expressed by a derived finder. */
    @org.springframework.data.jpa.repository.Query(value = """
            select c.* from character_conference c where c.created_by = :owner and c.is_deleted = false
              and exists (select 1 from jsonb_array_elements(c.followups->'items') f
                where f->>'status' = 'WAITING' and (f->>'dueOn')::date <= :day)
            order by c.generated_at asc limit :limit
            """, nativeQuery = true)
    List<CharacterConferenceEntity> findDueFollowups(@org.springframework.data.repository.query.Param("owner") UUID owner,
            @org.springframework.data.repository.query.Param("day") LocalDate day,
            @org.springframework.data.repository.query.Param("limit") int limit);

    List<CharacterConferenceEntity> findByCreatedByOrderByGeneratedAtDesc(UUID createdBy, org.springframework.data.domain.Pageable pageable);

    List<Summary> findByCreatedByOrderByGeneratedAtDesc(UUID createdBy);

    Optional<CharacterConferenceEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    Optional<CharacterConferenceEntity> findFirstByCreatedByOrderByGeneratedAtDesc(UUID createdBy);

    /** The idempotency lookup for the weekly konzílium (Karakter spec §6, mezo-1gim.5): a live
     *  WEEKLY row already exists for this owner+week -> the service returns it instead of running
     *  the round again. */
    Optional<CharacterConferenceEntity> findByCreatedByAndKindAndWeekStart(UUID createdBy, String kind,
                                                                            LocalDate weekStart);

    /** The idempotency lookup for the monthly bootstrap konzílium (Karakter S4, mezo-1gim.6): a
     *  live BOOTSTRAP row already exists for this owner -> the service throws CONFLICT rather than
     *  running the round again (bootstrap is one-time-ever, unlike WEEKLY's per-week key). */
    Optional<CharacterConferenceEntity> findFirstByCreatedByAndKindOrderByGeneratedAtDesc(UUID createdBy, String kind);

    /** Projection so the list endpoint never loads full transcripts. */
    interface Summary {
        UUID getId();

        String getKind();

        LocalDate getWeekStart();

        Instant getGeneratedAt();

        ConferenceOutcomeEnvelope getOutcome();
    }
}
