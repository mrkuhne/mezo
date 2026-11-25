package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.mail.entity.MailFeedbackEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailFolderCursorEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailItemEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMessageEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailSenderRuleEntity;
import io.mrkuhne.mezo.feature.mail.repository.MailFeedbackRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailFolderCursorRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailItemRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailMailboxRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailMessageRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailRunRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailSenderRuleRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Boop Levél rows (mezo-r36n9.38). Every address, subject and figure is invented. */
@TestComponent
@RequiredArgsConstructor
public class MailPopulator {

    private final MailMailboxRepository mailboxRepository;
    private final MailFolderCursorRepository cursorRepository;
    private final MailRunRepository runRepository;
    private final MailMessageRepository messageRepository;
    private final MailItemRepository itemRepository;
    private final MailFeedbackRepository feedbackRepository;
    private final MailSenderRuleRepository senderRuleRepository;

    public MailMailboxEntity mailbox(UUID owner) {
        MailMailboxEntity e = new MailMailboxEntity();
        e.setCreatedBy(owner);
        e.setAddress("mirror-" + UUID.randomUUID() + "@example.test");
        e.setSecretCipher(new byte[] {1, 2, 3});
        e.setSecretNonce(new byte[] {4, 5, 6});
        e.setState("connected");
        return mailboxRepository.saveAndFlush(e);
    }

    public MailFolderCursorEntity cursor(UUID owner, UUID mailboxId, String folder) {
        MailFolderCursorEntity e = new MailFolderCursorEntity();
        e.setCreatedBy(owner);
        e.setMailboxId(mailboxId);
        e.setFolder(folder);
        e.setUidvalidity(1L);
        e.setLastUid(0L);
        return cursorRepository.saveAndFlush(e);
    }

    public MailRunEntity run(UUID owner, UUID mailboxId) {
        MailRunEntity e = new MailRunEntity();
        e.setCreatedBy(owner);
        e.setMailboxId(mailboxId);
        e.setStartedAt(Instant.parse("2026-11-21T07:00:00Z"));
        e.setTrigger("cron");
        e.setOutcome("ok");
        return runRepository.saveAndFlush(e);
    }

    public MailMessageEntity message(UUID owner, UUID mailboxId, Long gmMsgid) {
        MailMessageEntity e = new MailMessageEntity();
        e.setCreatedBy(owner);
        e.setMailboxId(mailboxId);
        e.setGmMsgid(gmMsgid);
        e.setMessageId("<" + UUID.randomUUID() + "@example.test>");
        e.setContentHash(UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", ""));
        e.setFolder("INBOX");
        e.setUid(1L);
        e.setUidvalidity(1L);
        e.setReceivedAt(Instant.parse("2026-11-21T06:00:00Z"));
        e.setFromAddr("shop@example.test");
        e.setVia("gmail");
        e.setSubject("Kitalált tárgy");
        return messageRepository.saveAndFlush(e);
    }

    /** A parcel item; carrier + parcelKey identify the parcel (one row per parcel). */
    public MailItemEntity item(UUID owner, UUID messageId, String carrier, String parcelKey) {
        MailItemEntity e = new MailItemEntity();
        e.setCreatedBy(owner);
        e.setMessageId(messageId);
        e.setGrp("parcel");
        e.setCategory("parcel");
        e.setTitle("Kitalált csomag");
        e.setSummary("Úton van.");
        e.setWhy("Csomag érkezik.");
        e.setCarrier(carrier);
        e.setParcelKey(parcelKey);
        e.setParcelState("in_transit");
        e.setStateChangedAt(Instant.parse("2026-11-21T06:00:00Z"));
        e.setOpenUntil(Instant.parse("2026-11-28T06:00:00Z"));
        e.setSource("rule");
        return itemRepository.saveAndFlush(e);
    }

    public MailFeedbackEntity feedback(UUID owner, UUID itemId, String verdict) {
        MailFeedbackEntity e = new MailFeedbackEntity();
        e.setCreatedBy(owner);
        e.setItemId(itemId);
        e.setVerdict(verdict);
        e.setFromAddr("shop@example.test");
        e.setSummary("Kitalált összefoglaló");
        return feedbackRepository.saveAndFlush(e);
    }

    public MailSenderRuleEntity senderRule(UUID owner, String pattern, String kind) {
        MailSenderRuleEntity e = new MailSenderRuleEntity();
        e.setCreatedBy(owner);
        e.setPattern(pattern);
        e.setKind(kind);
        e.setOrigin("owner");
        return senderRuleRepository.saveAndFlush(e);
    }
}
