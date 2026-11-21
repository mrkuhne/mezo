package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailRun rows — queries are added by the pipeline tasks that need them. */
public interface MailRunRepository extends JpaRepository<MailRunEntity, UUID> {
}
