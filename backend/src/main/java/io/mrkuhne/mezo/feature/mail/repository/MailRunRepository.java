package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailRun rows. */
public interface MailRunRepository extends JpaRepository<MailRunEntity, UUID> {

    /** The latest run of the owner started in {@code [from, to)}: whether the day is rules-only follows it alone. */
    Optional<MailRunEntity> findFirstByCreatedByAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtDesc(
        UUID createdBy, Instant from, Instant to);

    /** The owner's most recent run (cooldown anchor fallback, last fetched count). */
    Optional<MailRunEntity> findFirstByCreatedByOrderByStartedAtDesc(UUID createdBy);
}
