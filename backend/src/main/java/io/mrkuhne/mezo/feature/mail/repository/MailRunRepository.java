package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailRun rows. */
public interface MailRunRepository extends JpaRepository<MailRunEntity, UUID> {

    /** The latest run of the owner started in {@code [from, to)} that could not use the model (cap hit or failure). */
    Optional<MailRunEntity> findFirstByCreatedByAndRulesOnlyTrueAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtDesc(
        UUID createdBy, Instant from, Instant to);
}
