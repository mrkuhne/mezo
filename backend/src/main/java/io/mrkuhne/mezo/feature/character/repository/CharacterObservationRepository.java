package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterObservationRepository extends JpaRepository<CharacterObservationEntity, UUID> {

    List<CharacterObservationEntity> findByCreatedByOrderByDayDescCreatedAtDesc(UUID createdBy, Pageable pageable);

    boolean existsByCreatedByAndExpertKeyAndDay(UUID createdBy, String expertKey, LocalDate day);

    /** The week's not-yet-consumed observations, oldest first (Karakter spec §6, mezo-1gim.5). */
    List<CharacterObservationEntity> findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** Run-detail resolution for a NIGHTLY row (Gépterem, mezo-1gim.14): every observation
     *  recorded for that owned day, regardless of consumption state.
     *
     *  <p>Excludes {@code expertKey} rows equal to the given key — used to keep Daniel's own
     *  feedback observations (see {@code CharacterFeedbackService#USER_EXPERT_KEY}) out of the
     *  NIGHTLY run detail, since they share the same {@code day} as that night's pipeline output
     *  but were never produced by it (final review, mezo-1gim.14, M5). */
    List<CharacterObservationEntity> findByCreatedByAndDayAndExpertKeyNotOrderByCreatedAtAsc(
            UUID createdBy, LocalDate day, String excludedExpertKey);

    /** Run-detail resolution for a WEEKLY/MONTHLY/BOOTSTRAP row (Gépterem, mezo-1gim.14): the
     *  observations that specific conference consumed. */
    List<CharacterObservationEntity> findByCreatedByAndConsumedByConferenceIdOrderByDayAscCreatedAtAsc(
            UUID createdBy, UUID consumedByConferenceId);
}
