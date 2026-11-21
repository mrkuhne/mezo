package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** MailRun rows. */
public interface MailRunRepository extends JpaRepository<MailRunEntity, UUID> {

    /**
     * The latest run of the owner started in {@code [from, to)} that did model-relevant work (classified mail or was
     * rules-only): an empty or failed-fetch run says nothing about the model, so it never hides a cap still in force.
     */
    @Query("select r from MailRunEntity r where r.createdBy = :user and r.startedAt >= :from and r.startedAt < :to "
        + "and (r.classified > 0 or r.rulesOnly = true) order by r.startedAt desc limit 1")
    Optional<MailRunEntity> latestModelRelevant(@Param("user") UUID createdBy, @Param("from") Instant from,
                                                @Param("to") Instant to);

    /** The owner's most recent run (cooldown anchor fallback, last fetched count). */
    Optional<MailRunEntity> findFirstByCreatedByOrderByStartedAtDesc(UUID createdBy);
}
