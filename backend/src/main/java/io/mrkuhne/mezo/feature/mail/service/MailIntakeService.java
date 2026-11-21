package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.service.MailIntakeStore.NewMessage;
import io.mrkuhne.mezo.feature.mail.service.MailIntakeStore.RunOutcome;
import io.mrkuhne.mezo.feature.mail.service.imap.FetchedMail;
import io.mrkuhne.mezo.feature.mail.service.imap.ImapMailReader;
import io.mrkuhne.mezo.feature.mail.service.imap.MailReader;
import io.mrkuhne.mezo.feature.mail.service.imap.MailReader.FolderBatch;
import io.mrkuhne.mezo.feature.mail.service.redact.MailRedactor;
import io.mrkuhne.mezo.feature.mail.service.redact.RedactedMail;
import io.mrkuhne.mezo.feature.mail.service.rules.MailHeaders;
import io.mrkuhne.mezo.feature.mail.service.rules.MailRules;
import io.mrkuhne.mezo.feature.mail.service.rules.RuleVerdict;
import io.mrkuhne.mezo.feature.mail.service.rules.SenderRule;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Reads the new mail of the owner's mirror mailbox into {@code mail_message} (spec §5.1–§5.3). One run reads
 * {@code INBOX} then {@code [Gmail]/Spam}, each from its own cursor, at most 200 mails per folder. The IMAP calls
 * and the rules run outside any transaction; each folder batch is stored (and its cursor advanced) in one short
 * transaction by {@link MailIntakeStore}. Nothing is ever written to the mailbox. The raw text is never stored:
 * it travels in memory to the classifier in {@link IntakeResult}.
 */
@Service
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailIntakeService {

    static final String SPAM_FOLDER = "[Gmail]/Spam";
    static final List<String> FOLDERS = List.of("INBOX", SPAM_FOLDER);
    static final int BATCH_MAX = 200;

    private static final String ERROR_CODE = "MAIL_INTAKE_ERROR";
    private static final Map<UUID, ReentrantLock> LOCKS = new ConcurrentHashMap<>();
    private static final Logger LOG = LoggerFactory.getLogger(MailIntakeService.class);

    /** A mail stored by this run, with what the classifier needs in memory only. */
    public record IntakedMail(UUID messageId, MailHeaders headers, String rawText, RedactedMail redacted,
                              RuleVerdict verdict) {
    }

    /**
     * The result of a run. {@code runId} is null when the mailbox was skipped (none, no secret, disconnected).
     * {@code failed} is true when the run hit auth failure or an unreachable server; {@code mails} still holds
     * whatever was stored before the failure.
     */
    public record IntakeResult(UUID runId, List<IntakedMail> mails, boolean failed) {
    }

    private final MailReader reader;
    private final MailIntakeStore store;
    private final MailCredentialCipher cipher;
    private final MailProperties properties;
    private final MailHealth health;
    private final ObjectProvider<Clock> clock;

    public MailIntakeService(MailReader reader, MailIntakeStore store, MailCredentialCipher cipher,
                             MailProperties properties, MailHealth health, ObjectProvider<Clock> clock) {
        this.reader = reader;
        this.store = store;
        this.cipher = cipher;
        this.properties = properties;
        this.health = health;
        this.clock = clock;
    }

    public IntakeResult intake(UUID userId, String trigger) {
        Optional<MailMailboxEntity> found = store.mailbox(userId);
        if (found.isEmpty() || found.get().getSecretCipher() == null || found.get().getSecretNonce() == null
            || MailIntakeStore.STATE_DISCONNECTED.equals(found.get().getState())) {
            return new IntakeResult(null, List.of(), false);
        }
        MailMailboxEntity mailbox = found.get();
        ReentrantLock lock = LOCKS.computeIfAbsent(mailbox.getId(), id -> new ReentrantLock());
        if (!lock.tryLock()) {
            return new IntakeResult(null, List.of(), false); // single flight: a run for this mailbox is in progress
        }
        try {
            return run(userId, trigger, mailbox);
        } finally {
            lock.unlock();
        }
    }

    private IntakeResult run(UUID userId, String trigger, MailMailboxEntity mailbox) {
        Instant started = now();
        List<IntakedMail> stored = new ArrayList<>();
        int fetched = 0;
        String outcome = MailIntakeStore.OUTCOME_OK;
        String errorCode = null;
        try {
            String password = cipher.open(new MailCredentialCipher.Sealed(mailbox.getSecretCipher(),
                mailbox.getSecretNonce()));
            List<SenderRule> rules = store.ownerRules(userId);
            for (String folder : FOLDERS) {
                fetched += readFolder(userId, mailbox, password, folder, rules, stored);
            }
        } catch (SystemRuntimeErrorException e) {
            errorCode = e.getMessages().isEmpty() ? null : e.getMessages().get(0).getCode();
            outcome = ImapMailReader.UNREACHABLE.equals(errorCode) ? MailIntakeStore.OUTCOME_UNREACHABLE
                : MailIntakeStore.OUTCOME_AUTH_FAILED; // an unreadable stored secret needs re-entering, like a refused one
            LOG.warn("mail intake run failed: {}", errorCode);
        } catch (RuntimeException e) {
            errorCode = ERROR_CODE;
            outcome = MailIntakeStore.OUTCOME_ERROR;
            LOG.warn("mail intake run failed unexpectedly: {}", e.getClass().getSimpleName());
        }
        UUID runId = store.recordRun(userId, mailbox, new RunOutcome(trigger, started, now(), fetched, stored.size(),
            outcome, errorCode));
        health.refresh();
        return new IntakeResult(runId, List.copyOf(stored), !MailIntakeStore.OUTCOME_OK.equals(outcome));
    }

    /** Reads one folder, stores the batch + cursor in one transaction, returns how many mails were fetched. */
    private int readFolder(UUID userId, MailMailboxEntity mailbox, String password, String folder,
                           List<SenderRule> rules, List<IntakedMail> stored) {
        FolderBatch batch = reader.fetch(mailbox.getAddress(), password, folder,
            store.cursor(mailbox.getId(), folder), BATCH_MAX);
        if (batch.mails().isEmpty()) {
            return 0; // the cursor stays as it is (a UIDVALIDITY change is simply rescanned next run)
        }
        List<Prepared> prepared = new ArrayList<>();
        long highest = 0;
        for (FetchedMail mail : batch.mails()) {
            highest = Math.max(highest, mail.uid()); // the cursor moves past a mail even when it is skipped
            try {
                prepared.add(prepare(mail, rules));
            } catch (RuntimeException e) {
                LOG.warn("mail uid {} in {} skipped: {}", mail.uid(), folder, e.getClass().getSimpleName());
            }
        }
        List<Optional<UUID>> ids = store.storeBatch(userId, mailbox.getId(), folder, batch.uidValidity(), highest,
            prepared.stream().map(Prepared::row).toList());
        for (int i = 0; i < prepared.size(); i++) {
            Prepared p = prepared.get(i);
            ids.get(i).ifPresent(id -> stored.add(new IntakedMail(id, p.mail().headers(), p.rawText(), p.redacted(),
                p.verdict())));
        }
        return batch.mails().size();
    }

    private record Prepared(FetchedMail mail, String rawText, RedactedMail redacted, RuleVerdict verdict,
                            NewMessage row) {
    }

    private Prepared prepare(FetchedMail mail, List<SenderRule> rules) {
        MailHeaders h = mail.headers();
        String rawText = MailRedactor.plainText(mail.plain(), mail.html());
        RedactedMail redacted = MailRedactor.redact(mail.plain(), mail.html(), properties.bodyMaxChars());
        RuleVerdict verdict = MailRules.decide(h, rawText, redacted, rules);
        boolean sensitive = verdict instanceof RuleVerdict.Sensitive;
        String messageId = mail.messageId() == null || mail.messageId().isBlank()
            ? "<nomsgid:" + mail.uidValidity() + "." + mail.uid() + "@" + mail.folder() + ">"
            : mail.messageId().strip();
        String hashed = sensitive ? h.from() + "\n" + h.subject() : redacted.text();
        NewMessage row = new NewMessage(mail.gmMsgId(), cut(messageId, 998), sha256(messageId + "\n" + normalize(hashed)),
            mail.folder(), mail.uid(), mail.uidValidity(), mail.receivedAt() == null ? now() : mail.receivedAt(),
            cut(h.from(), 254), h.fromName().isEmpty() ? null : cut(h.fromName(), 200), MailRules.via(h),
            sensitive ? null : h.subject(), sensitive ? null : redacted.text(), sensitive);
        return new Prepared(mail, rawText, redacted, verdict, row);
    }

    private static String normalize(String text) {
        return text == null ? "" : text.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static String cut(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new AssertionError(e); // SHA-256 is mandatory on every JVM
        }
    }

    private Instant now() {
        return clock.getIfAvailable(Clock::systemUTC).instant();
    }
}
