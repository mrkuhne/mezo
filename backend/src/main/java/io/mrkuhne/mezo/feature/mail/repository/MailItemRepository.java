package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailItemEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailItem rows — queries are added by the pipeline tasks that need them. */
public interface MailItemRepository extends JpaRepository<MailItemEntity, UUID> {
}
