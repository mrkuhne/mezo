package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailFeedbackEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailFeedback rows — queries are added by the pipeline tasks that need them. */
public interface MailFeedbackRepository extends JpaRepository<MailFeedbackEntity, UUID> {
}
