package io.mrkuhne.mezo.feature.mail.service.imap;

import io.mrkuhne.mezo.feature.mail.service.rules.MailHeaders;
import java.time.Instant;

/**
 * One mail as read from the mailbox. {@code plain} / {@code html} are the first text/plain and text/html parts
 * (attachments are never read); {@code gmMsgId} is null when the server lacks {@code X-GM-EXT-1}.
 */
public record FetchedMail(
        String folder,
        long uid,
        long uidValidity,
        Long gmMsgId,
        String messageId,
        Instant receivedAt,
        MailHeaders headers,
        String plain,
        String html) {
}
