package io.mrkuhne.mezo.feature.mail.service.imap;

import java.util.List;

/** Read-only access to a mailbox. Never writes to it. Errors: MAIL_AUTH_FAILED, MAIL_UNREACHABLE. */
public interface MailReader {

    /** The per-folder cursor: UIDVALIDITY and the highest UID already taken. */
    record FolderState(long uidValidity, long lastUid) { }

    /** A batch, oldest UID first; {@code uidValidity} is the folder's current one (0 when the folder is absent). */
    record FolderBatch(long uidValidity, List<FetchedMail> mails) { }

    /** Opens and closes a connection; throws MAIL_AUTH_FAILED / MAIL_UNREACHABLE. */
    void verify(String address, String password);

    /**
     * Mails of {@code folder} with a UID above {@code since.lastUid()}, at most {@code max}, oldest first. A changed
     * UIDVALIDITY restarts from the beginning of the folder. A missing folder is an empty batch.
     */
    FolderBatch fetch(String address, String password, String folder, FolderState since, int max);
}
