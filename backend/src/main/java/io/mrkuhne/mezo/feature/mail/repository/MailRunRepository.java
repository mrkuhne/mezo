package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailRun rows. */
public interface MailRunRepository extends JpaRepository<MailRunEntity, UUID> {

    /** A run of the owner started in {@code [from, to)} could not use the model (cap hit or model down). */
    boolean existsByCreatedByAndRulesOnlyTrueAndStartedAtGreaterThanEqualAndStartedAtLessThan(UUID createdBy,
                                                                                            Instant from, Instant to);
}
