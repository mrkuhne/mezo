package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailFeedbackEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** MailFeedback rows: the owner's taps, newest first, and the recent deal verdicts used as few-shot examples. */
public interface MailFeedbackRepository extends JpaRepository<MailFeedbackEntity, UUID> {

    Optional<MailFeedbackEntity> findByCreatedByAndItemId(UUID createdBy, UUID itemId);

    List<MailFeedbackEntity> findByCreatedByOrderByUpdatedAtDescIdDesc(UUID createdBy);

    @Query("select f from MailFeedbackEntity f where f.createdBy = :owner and f.itemId in "
        + "(select i.id from MailItemEntity i where i.grp = 'deal') order by f.updatedAt desc, f.id desc")
    List<MailFeedbackEntity> recentDealFeedback(@Param("owner") UUID owner, Pageable page);
}
