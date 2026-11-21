package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailMailbox rows — queries are added by the pipeline tasks that need them. */
public interface MailMailboxRepository extends JpaRepository<MailMailboxEntity, UUID> {
}
