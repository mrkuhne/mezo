package io.mrkuhne.mezo.feature.biometrics.checkin.repository;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CheckInRepository extends OwnedRepository<CheckInEntity> {
    List<CheckInEntity> findByCreatedByAndDateOrderBySlotTime(UUID createdBy, LocalDate date);

    Optional<CheckInEntity> findByCreatedByAndDateAndSlotTime(UUID createdBy, LocalDate date, String slotTime);

    /** Latest check-in across days (date, then slot) for the companion context snapshot. */
    Optional<CheckInEntity> findFirstByCreatedByAndDeletedFalseOrderByDateDescSlotTimeDesc(UUID createdBy);

    /**
     * W1.5 note-embedding candidates (mezo-b3pp.5): live check-ins up to and including
     * {@code through} whose note is substantive, oldest first. A null note fails the length
     * predicate in SQL, so no explicit null branch is needed.
     */
    @Query("""
        select c from CheckInEntity c
        where c.createdBy = :createdBy and c.date <= :through and length(c.note) >= :minChars
        order by c.date asc, c.slotTime asc
        """)
    List<CheckInEntity> findNoteCandidates(@Param("createdBy") UUID createdBy,
                                           @Param("through") LocalDate through,
                                           @Param("minChars") int minChars);
}
