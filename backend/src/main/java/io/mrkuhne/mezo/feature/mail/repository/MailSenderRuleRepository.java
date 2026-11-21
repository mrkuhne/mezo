package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailSenderRuleEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailSenderRule rows — queries are added by the pipeline tasks that need them. */
public interface MailSenderRuleRepository extends JpaRepository<MailSenderRuleEntity, UUID> {
}
