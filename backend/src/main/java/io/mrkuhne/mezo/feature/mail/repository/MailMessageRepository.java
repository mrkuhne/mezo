package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailMessageEntity;
import java.util.UUID;
import java.util.Optional;
import java.time.Instant;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailMessage rows — queries are added by the pipeline tasks that need them. */
public interface MailMessageRepository extends JpaRepository<MailMessageEntity, UUID> {

    Optional<MailMessageEntity> findByMailboxIdAndContentHash(UUID mailboxId, String contentHash);

    /**
     * Stores a message unless the mailbox already has it (same Gmail message id, or same content hash — the two
     * unique indexes); 0 means a duplicate. The hash column is {@code char(64)}.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into mail_message (created_by, mailbox_id, gm_msgid, message_id, content_hash, folder, uid,
                                  uidvalidity, received_at, from_addr, from_name, via, subject, body_redacted,
                                  sensitive)
        values (:createdBy, :mailboxId, :gmMsgid, :messageId, :contentHash, :folder, :uid,
                :uidvalidity, :receivedAt, :fromAddr, :fromName, :via, :subject, :bodyRedacted, :sensitive)
        on conflict do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("mailboxId") UUID mailboxId,
                       @Param("gmMsgid") Long gmMsgid, @Param("messageId") String messageId,
                       @Param("contentHash") String contentHash, @Param("folder") String folder,
                       @Param("uid") long uid, @Param("uidvalidity") long uidvalidity,
                       @Param("receivedAt") Instant receivedAt, @Param("fromAddr") String fromAddr,
                       @Param("fromName") String fromName, @Param("via") String via,
                       @Param("subject") String subject, @Param("bodyRedacted") String bodyRedacted,
                       @Param("sensitive") boolean sensitive);

    /** Raw bodies received before the cutoff are dropped, soft-deleted rows included; the row itself (and any item) stays. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        update mail_message set body_redacted = null, body_purged = true
        where body_purged = false and body_redacted is not null and received_at < :cutoff
        """, nativeQuery = true)
    int purgeBodiesBefore(@Param("cutoff") Instant cutoff);
}
