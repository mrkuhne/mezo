package io.mrkuhne.mezo.feature.mail.repository;

import io.mrkuhne.mezo.feature.mail.entity.MailFolderCursorEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** MailFolderCursor rows — queries are added by the pipeline tasks that need them. */
public interface MailFolderCursorRepository extends JpaRepository<MailFolderCursorEntity, UUID> {

    Optional<MailFolderCursorEntity> findByMailboxIdAndFolder(UUID mailboxId, String folder);

    /** Cursors of a mailbox whose address changed no longer mean anything (another mailbox's UIDs). */
    List<MailFolderCursorEntity> findByMailboxId(UUID mailboxId);
}
