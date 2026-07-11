package io.mrkuhne.mezo.feature.quest.repository;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyQuestRepository extends JpaRepository<DailyQuestEntity, UUID> {

    /** The day-card read: every row of the day incl. rerolled (service filters for display). */
    List<DailyQuestEntity> findByCreatedByAndQuestDateOrderBySlotAsc(UUID createdBy, LocalDate questDate);

    /** The reroll path's owned lookup. */
    Optional<DailyQuestEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    /** Daily reroll-cap count. */
    int countByCreatedByAndQuestDateAndStatus(UUID createdBy, LocalDate questDate, String status);

    /** Cooldown window read (selector filters per-key cooldownDays in code). */
    List<DailyQuestEntity> findByCreatedByAndQuestDateGreaterThanEqual(UUID createdBy, LocalDate from);

    /** Nightly finalize backstop: offered rows whose day has passed. */
    List<DailyQuestEntity> findByCreatedByAndStatusAndQuestDateBefore(UUID createdBy, String status, LocalDate before);
}
