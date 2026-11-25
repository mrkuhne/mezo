package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.entity.MailFolderCursorEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import io.mrkuhne.mezo.feature.mail.repository.MailFolderCursorRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailMailboxRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailMessageRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailRunRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailSenderRuleRepository;
import io.mrkuhne.mezo.feature.mail.service.imap.MailReader.FolderState;
import io.mrkuhne.mezo.feature.mail.service.rules.SenderRule;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The writes of the mail intake (mezo-r36n9.38), each one short transaction — the IMAP calls happen BEFORE,
 * outside any transaction. A batch goes in through the native {@code INSERT … ON CONFLICT DO NOTHING} and the
 * folder cursor advances in the SAME transaction, so a crash can never leave a cursor ahead of stored mail.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailIntakeStore {

    public static final String STATE_CONNECTED = "connected";
    public static final String STATE_AUTH_FAILED = "auth_failed";
    public static final String STATE_SILENT = "silent";
    public static final String STATE_DISCONNECTED = "disconnected";
    public static final String KIND_IMAP = "imap";
    public static final String KIND_GOOGLE = "google";
    /** The cursor folder of the Gmail API reader: {@code last_uid} holds the historyId, uidvalidity 0. */
    public static final String GMAIL_CURSOR = "gmail-api";
    public static final String OUTCOME_OK = "ok";
    public static final String OUTCOME_AUTH_FAILED = "auth_failed";
    public static final String OUTCOME_UNREACHABLE = "unreachable";
    public static final String OUTCOME_ERROR = "error";

    /** Two empty runs in a row and the mailbox is considered silent. */
    static final int SILENT_STREAK = 2;

    private final MailMailboxRepository mailboxes;
    private final MailFolderCursorRepository cursors;
    private final MailMessageRepository messages;
    private final MailRunRepository runs;
    private final MailSenderRuleRepository senderRules;

    /** One message ready to store: every column, already redacted or header-only. */
    public record NewMessage(Long gmMsgid, String messageId, String contentHash, String folder, long uid,
                             long uidvalidity, Instant receivedAt, String fromAddr, String fromName, String via,
                             String subject, String bodyRedacted, boolean sensitive) {
    }

    /** A finished run: what the mailbox state machine needs. */
    public record RunOutcome(String trigger, Instant startedAt, Instant finishedAt, int fetched, int stored,
                             String outcome, String errorCode) {
    }

    @Transactional(readOnly = true)
    public Optional<MailMailboxEntity> mailbox(UUID owner) {
        return mailboxes.findByCreatedBy(owner);
    }

    @Transactional(readOnly = true)
    public FolderState cursor(UUID mailboxId, String folder) {
        return cursors.findByMailboxIdAndFolder(mailboxId, folder)
            .map(c -> new FolderState(c.getUidvalidity(), c.getLastUid()))
            .orElse(new FolderState(0, 0));
    }

    /** The owner's live sender rules, as the pure rules engine reads them. */
    @Transactional(readOnly = true)
    public List<SenderRule> ownerRules(UUID owner) {
        List<SenderRule> out = new ArrayList<>();
        senderRules.findByCreatedBy(owner).forEach(r -> {
            try {
                out.add(new SenderRule(r.getPattern(), SenderRule.Kind.valueOf(r.getKind().toUpperCase(Locale.ROOT))));
            } catch (IllegalArgumentException ignored) {
                // an unknown kind (the column is check-constrained) is simply not a rule
            }
        });
        return out;
    }

    /**
     * Stores the batch and advances the folder cursor to {@code uidValidity} / {@code lastUid} in one transaction.
     * The result lines up with {@code batch}: the new row's id, or empty for a duplicate.
     */
    @Transactional
    public List<Optional<UUID>> storeBatch(UUID owner, UUID mailboxId, String folder, long uidValidity, long lastUid,
                                           List<NewMessage> batch) {
        List<Optional<UUID>> ids = new ArrayList<>();
        for (NewMessage m : batch) {
            int inserted = messages.insertIfAbsent(owner, mailboxId, m.gmMsgid(), m.messageId(), m.contentHash(),
                m.folder(), m.uid(), m.uidvalidity(), m.receivedAt(), m.fromAddr(), m.fromName(), m.via(),
                m.subject(), m.bodyRedacted(), m.sensitive());
            ids.add(inserted == 0 ? Optional.empty()
                : messages.findByMailboxIdAndContentHash(mailboxId, m.contentHash()).map(e -> e.getId()));
        }
        MailFolderCursorEntity cursor = cursors.findByMailboxIdAndFolder(mailboxId, folder).orElseGet(() -> {
            MailFolderCursorEntity c = new MailFolderCursorEntity();
            c.setCreatedBy(owner);
            c.setMailboxId(mailboxId);
            c.setFolder(folder);
            return c;
        });
        cursor.setUidvalidity(uidValidity);
        cursor.setLastUid(lastUid);
        cursors.saveAndFlush(cursor);
        return ids;
    }

    /**
     * Writes the run row and moves the mailbox state: auth failure marks {@code auth_failed}; unreachable keeps the
     * state; a run that stored nothing grows the zero-run streak (2 = {@code silent}); a run that stored mail
     * resets it and reconnects.
     */
    @Transactional
    public UUID recordRun(UUID owner, MailMailboxEntity mailbox, RunOutcome run) {
        MailRunEntity row = new MailRunEntity();
        row.setCreatedBy(owner);
        row.setMailboxId(mailbox.getId());
        row.setStartedAt(run.startedAt());
        row.setFinishedAt(run.finishedAt());
        row.setTrigger(run.trigger());
        row.setFetched(run.fetched());
        row.setOutcome(run.outcome());
        row.setErrorCode(run.errorCode());
        UUID runId = runs.saveAndFlush(row).getId();

        MailMailboxEntity m = mailboxes.findById(mailbox.getId()).orElseThrow();
        m.setLastRunAt(run.finishedAt());
        if (run.stored() > 0) {
            m.setZeroRunStreak(0); // mail arrived, even if a later folder failed
        }
        switch (run.outcome()) {
            case OUTCOME_AUTH_FAILED -> m.setState(STATE_AUTH_FAILED);
            case OUTCOME_OK -> {
                if (run.stored() > 0) {
                    m.setState(STATE_CONNECTED);
                } else {
                    m.setZeroRunStreak(m.getZeroRunStreak() + 1);
                    m.setState(m.getZeroRunStreak() >= SILENT_STREAK ? STATE_SILENT : STATE_CONNECTED);
                }
            }
            default -> { /* unreachable / error: the state stays as it was */ }
        }
        mailboxes.saveAndFlush(m);
        return runId;
    }

    /** Drops raw bodies received before {@code cutoff}; returns how many. */
    @Transactional
    public int purgeBodiesBefore(Instant cutoff) {
        return messages.purgeBodiesBefore(cutoff);
    }
}
