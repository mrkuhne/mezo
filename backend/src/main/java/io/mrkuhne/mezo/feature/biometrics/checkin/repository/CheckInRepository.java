package io.mrkuhne.mezo.feature.biometrics.checkin.repository;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.time.LocalDate;
import java.util.Collection;
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

    /** The user's most recent check-in by when it was SAVED. */
    Optional<CheckInEntity> findFirstByCreatedByAndDeletedFalseOrderBySavedAtDesc(UUID createdBy);

    /** Weekly review {@code stale} probe (mezo-p2tr): the most recently CREATED check-in inside
     *  the week — compared against the review's {@code generatedAt}, not its own {@code date}. */
    Optional<CheckInEntity> findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** B2 (mezo-8tp8): the check-ins inside a {@code [from, to]} date window — used by
     *  {@code DayScoreService}/{@code MeWeekService}'s per-day counts and energy averages, which
     *  previously loaded every check-in the user ever logged via {@link #findAllOwned} and
     *  filtered the window in Java. */
    List<CheckInEntity> findByCreatedByAndDeletedFalseAndDateBetween(UUID createdBy, LocalDate from, LocalDate to);

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

    /**
     * W1.5 lifecycle (mezo-b3pp.26): which of {@code ids} are still LIVE rows for this user —
     * a plain derived finder so {@code @SQLRestriction} applies, which is exactly what "live"
     * means here (unlike {@link #findNoteCandidates}, this is deliberately NOT length-gated).
     */
    List<CheckInEntity> findByCreatedByAndIdIn(UUID createdBy, Collection<UUID> ids);
}
