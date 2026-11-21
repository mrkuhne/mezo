package io.mrkuhne.mezo.feature.mail.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetup;
import io.micrometer.core.instrument.MeterRegistry;
import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMessageEntity;
import io.mrkuhne.mezo.feature.mail.repository.MailMailboxRepository;
import io.mrkuhne.mezo.feature.mail.service.MailIntakeService.IntakeResult;
import io.mrkuhne.mezo.feature.mail.service.imap.GreenMailReaders;
import io.mrkuhne.mezo.feature.mail.service.imap.MailReader;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MailPopulator;
import jakarta.mail.Folder;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.time.Instant;
import java.util.Properties;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

/**
 * The morning-post intake against an in-process GreenMail IMAPS server and a real Postgres (mezo-r36n9.38).
 * Not {@code @Transactional}: the intake commits per batch. Every address, subject and body is invented.
 */
@TestPropertySource(properties = "mezo.mail.enabled=true")
class MailIntakeIT extends AbstractIntegrationTest {

    private static final String PASSWORD = "app-password-1234";
    private static final GreenMail GREEN_MAIL = new GreenMail(
        new ServerSetup(0, "127.0.0.1", ServerSetup.PROTOCOL_IMAPS));

    static {
        GREEN_MAIL.start();
    }

    @DynamicPropertySource
    static void imap(DynamicPropertyRegistry registry) {
        registry.add("mezo.mail.imap-host", () -> "127.0.0.1");
        registry.add("mezo.mail.imap-port", () -> GREEN_MAIL.getImaps().getPort());
    }

    @AfterAll
    static void stopServer() {
        // the server is shared by the (cached) context; it stops with the JVM
    }

    /** The reader that trusts GreenMail's self-signed certificate; replaces the production one. */
    @TestConfiguration
    static class ReaderConfig {
        @Bean
        @Primary
        MailReader greenMailReader(MailProperties props) {
            return new ControllableReader(GreenMailReaders.trusting(props));
        }
    }

    /** Delegates to the real reader; a test can make it fail, add a malformed mail, or block mid-run. */
    static final class ControllableReader implements MailReader {
        static volatile String failFolder;
        static volatile RuntimeException failWith;
        static volatile boolean addMalformed;
        static volatile java.util.concurrent.CountDownLatch entered;
        static volatile java.util.concurrent.CountDownLatch release;

        private final MailReader delegate;

        ControllableReader(MailReader delegate) {
            this.delegate = delegate;
        }

        static void reset() {
            failFolder = null;
            failWith = null;
            addMalformed = false;
            entered = null;
            release = null;
        }

        @Override
        public void verify(String address, String password) {
            delegate.verify(address, password);
        }

        @Override
        public FolderBatch fetch(String address, String password, String folder, FolderState since, int max) {
            if (entered != null) {
                entered.countDown();
                try {
                    release.await(10, java.util.concurrent.TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            if (failWith != null && (failFolder == null || failFolder.equals(folder))) {
                throw failWith;
            }
            FolderBatch batch = delegate.fetch(address, password, folder, since, max);
            if (addMalformed && "INBOX".equals(folder)) {
                java.util.List<io.mrkuhne.mezo.feature.mail.service.imap.FetchedMail> mails =
                    new java.util.ArrayList<>(batch.mails());
                long uid = batch.mails().stream().mapToLong(m -> m.uid()).max().orElse(0) + 1;
                mails.add(0, new io.mrkuhne.mezo.feature.mail.service.imap.FetchedMail(folder, uid,
                    batch.uidValidity(), null, "<bad@example.test>", Instant.now(), null, "x", null));
                return new FolderBatch(batch.uidValidity(), mails);
            }
            return batch;
        }
    }

    private static SystemRuntimeErrorException unreachable() {
        return new SystemRuntimeErrorException(SystemMessage.error("MAIL_UNREACHABLE").build(),
            org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Autowired private DatabasePopulator db;
    @Autowired private MailPopulator mail;
    @Autowired private MailIntakeService intake;
    @Autowired private MailPurgeService purge;
    @Autowired private MailCredentialCipher cipher;
    @Autowired private MailMailboxRepository mailboxes;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MeterRegistry registry;
    @Autowired private MailHealth health;

    @org.junit.jupiter.api.AfterEach
    void resetReader() {
        ControllableReader.reset();
    }

    private UUID owner;
    private String address;
    private MailMailboxEntity mailbox;

    @BeforeEach
    void setUp() {
        owner = db.populateUser("mail-" + UUID.randomUUID() + "@test.local");
        address = "mirror-" + UUID.randomUUID() + "@example.test";
        GREEN_MAIL.setUser(address, address, PASSWORD);
        mailbox = mail.mailbox(owner);
        mailbox.setAddress(address);
        MailCredentialCipher.Sealed sealed = cipher.seal(PASSWORD);
        mailbox.setSecretCipher(sealed.cipher());
        mailbox.setSecretNonce(sealed.nonce());
        mailbox = mailboxes.saveAndFlush(mailbox);
    }

    private MimeMessage message(String messageId, String subject, String body, String from) throws Exception {
        MimeMessage m = new MimeMessage((Session) null);
        m.setFrom(new InternetAddress(from, "Példa Küldő", "UTF-8"));
        m.setRecipients(MimeMessage.RecipientType.TO, address);
        m.setSubject(subject, "UTF-8");
        m.setHeader("Message-ID", messageId);
        m.setText(body, "UTF-8");
        m.saveChanges();
        return m;
    }

    private void append(String folder, MimeMessage m) throws Exception {
        Properties p = new Properties();
        p.put("mail.imaps.ssl.trust", "*");
        p.put("mail.imaps.ssl.checkserveridentity", "false");
        try (Store store = Session.getInstance(p).getStore("imaps")) {
            store.connect("127.0.0.1", GREEN_MAIL.getImaps().getPort(), address, PASSWORD);
            Folder f = store.getFolder(folder);
            if (!f.exists()) {
                f.create(Folder.HOLDS_MESSAGES);
            }
            f.open(Folder.READ_WRITE);
            f.appendMessages(new jakarta.mail.Message[] {m});
            f.close(false);
        }
    }

    private long count(String sql, Object... args) {
        Long n = jdbc.queryForObject(sql, Long.class, args);
        return n == null ? 0 : n;
    }

    private double gauge(String name) {
        return registry.get(name).gauge().value();
    }

    @Test
    void newMailStoredOnceAcrossTwoRuns() throws Exception {
        append("INBOX", message("<a1@example.test>", "Heti hírlevél", "Kitalált tartalom egy.", "shop@example.test"));
        append("INBOX", message("<a2@example.test>", "Másik levél", "Kitalált tartalom kettő.", "shop@example.test"));

        IntakeResult first = intake.intake(owner, "manual");
        IntakeResult second = intake.intake(owner, "manual");

        assertThat(first.failed()).isFalse();
        assertThat(first.mails()).hasSize(2);
        assertThat(first.mails().get(0).redacted().text()).contains("Kitalált");
        assertThat(second.mails()).isEmpty();
        assertThat(count("select count(*) from mail_message where mailbox_id = ?", mailbox.getId())).isEqualTo(2);
        assertThat(count("select count(*) from mail_run where mailbox_id = ?", mailbox.getId())).isEqualTo(2);
        assertThat(count("select last_uid from mail_folder_cursor where mailbox_id = ? and folder = 'INBOX'",
            mailbox.getId())).isEqualTo(2);
    }

    @Test
    void spamThenInboxMoveIsOneItem() throws Exception {
        MimeMessage forwarded = message("<fw1@example.test>", "Továbbított értesítő", "Kitalált szöveg.",
            "noreply@example.test");
        append("[Gmail]/Spam", forwarded);
        assertThat(intake.intake(owner, "cron").mails()).hasSize(1);

        append("INBOX", forwarded);
        IntakeResult moved = intake.intake(owner, "cron");

        assertThat(moved.mails()).isEmpty();
        assertThat(count("select count(*) from mail_message where mailbox_id = ?", mailbox.getId())).isEqualTo(1);
    }

    @Test
    void uidValidityChangeRescansSevenDaysWithoutDuplicates() throws Exception {
        append("INBOX", message("<v1@example.test>", "Régi levél", "Kitalált régi tartalom.", "shop@example.test"));
        intake.intake(owner, "cron");
        jdbc.update("update mail_folder_cursor set uidvalidity = uidvalidity + 99 where mailbox_id = ?",
            mailbox.getId());

        IntakeResult again = intake.intake(owner, "cron");

        assertThat(again.failed()).isFalse();
        assertThat(again.mails()).isEmpty();
        assertThat(count("select count(*) from mail_message where mailbox_id = ?", mailbox.getId())).isEqualTo(1);
        assertThat(count("select uidvalidity from mail_folder_cursor where mailbox_id = ? and folder = 'INBOX'",
            mailbox.getId())).isNotEqualTo(0);
    }

    @Test
    void sensitiveMailStoresHeadersOnly() throws Exception {
        mail.senderRule(owner, "@bank.example.test", "sensitive");
        append("INBOX", message("<s1@example.test>", "Egyenleg: 12 345 Ft", "Kitalált banki szöveg.",
            "info@bank.example.test"));

        IntakeResult result = intake.intake(owner, "cron");

        assertThat(result.mails()).hasSize(1);
        MailMessageEntity stored = jdbc.query("select * from mail_message where mailbox_id = ?",
            (rs, i) -> {
                MailMessageEntity e = new MailMessageEntity();
                e.setSubject(rs.getString("subject"));
                e.setBodyRedacted(rs.getString("body_redacted"));
                e.setSensitive(rs.getBoolean("sensitive"));
                e.setFromAddr(rs.getString("from_addr"));
                return e;
            }, mailbox.getId()).get(0);
        assertThat(stored.getBodyRedacted()).isNull();
        assertThat(stored.getSubject()).isNull();
        assertThat(stored.isSensitive()).isTrue();
        assertThat(stored.getFromAddr()).isEqualTo("info@bank.example.test");
    }

    @Test
    void authFailureKeepsCursorAndMarksState() throws Exception {
        append("INBOX", message("<f1@example.test>", "Levél", "Kitalált tartalom.", "shop@example.test"));
        intake.intake(owner, "cron");
        long cursorBefore = count("select last_uid from mail_folder_cursor where mailbox_id = ? and folder = 'INBOX'",
            mailbox.getId());
        MailCredentialCipher.Sealed wrong = cipher.seal("revoked-password");
        jdbc.update("update mail_mailbox set secret_cipher = ?, secret_nonce = ? where id = ?",
            wrong.cipher(), wrong.nonce(), mailbox.getId());
        append("INBOX", message("<f2@example.test>", "Újabb levél", "Kitalált újabb tartalom.", "shop@example.test"));

        IntakeResult result = intake.intake(owner, "cron");

        assertThat(result.failed()).isTrue();
        assertThat(result.mails()).isEmpty();
        assertThat(jdbc.queryForObject("select state from mail_mailbox where id = ?", String.class, mailbox.getId()))
            .isEqualTo("auth_failed");
        assertThat(count("select last_uid from mail_folder_cursor where mailbox_id = ? and folder = 'INBOX'",
            mailbox.getId())).isEqualTo(cursorBefore);
        assertThat(jdbc.queryForObject("select outcome || ':' || error_code from mail_run where id = ?",
            String.class, result.runId())).isEqualTo("auth_failed:MAIL_AUTH_FAILED");
        assertThat(gauge("mezo.mail.auth.failed")).isEqualTo(1.0);
    }

    @Test
    void twoZeroRunsMarkSilent() throws Exception {
        intake.intake(owner, "cron");
        assertThat(streak()).isEqualTo(1);
        assertThat(state()).isEqualTo("connected");
        intake.intake(owner, "cron");
        assertThat(streak()).isEqualTo(2);
        assertThat(state()).isEqualTo("silent");
        assertThat(gauge("mezo.mail.zero.run.streak")).isEqualTo(2.0);

        append("INBOX", message("<z1@example.test>", "Levél", "Kitalált tartalom.", "shop@example.test"));
        intake.intake(owner, "cron");

        assertThat(streak()).isZero();
        assertThat(state()).isEqualTo("connected");
        assertThat(gauge("mezo.mail.zero.run.streak")).isZero();
        assertThat(gauge("mezo.mail.auth.failed")).isZero();
    }

    @Test
    void disconnectedMailboxIsSkipped() {
        jdbc.update("update mail_mailbox set state = 'disconnected' where id = ?", mailbox.getId());

        IntakeResult result = intake.intake(owner, "cron");

        assertThat(result.runId()).isNull();
        assertThat(result.mails()).isEmpty();
        assertThat(count("select count(*) from mail_run where mailbox_id = ?", mailbox.getId())).isZero();
    }

    @Test
    void purgeDropsBodiesAfterThirtyDays() {
        MailMessageEntity old = mail.message(owner, mailbox.getId(), null);
        MailMessageEntity fresh = mail.message(owner, mailbox.getId(), null);
        Instant now = Instant.parse("2026-11-21T08:00:00Z");
        jdbc.update("update mail_message set body_redacted = 'kitalált törzs', received_at = ? where id = ?",
            java.sql.Timestamp.from(now.minus(java.time.Duration.ofDays(31))), old.getId());
        jdbc.update("update mail_message set body_redacted = 'kitalált törzs', received_at = ? where id = ?",
            java.sql.Timestamp.from(now.minus(java.time.Duration.ofDays(29))), fresh.getId());

        int purged = purge.purge(now);

        assertThat(purged).isEqualTo(1);
        assertThat(jdbc.queryForObject("select body_redacted is null and body_purged from mail_message where id = ?",
            Boolean.class, old.getId())).isTrue();
        assertThat(jdbc.queryForObject("select body_redacted is not null and not body_purged from mail_message "
            + "where id = ?", Boolean.class, fresh.getId())).isTrue();
    }

    @Test
    void unexpectedExceptionStillWritesAnErrorRun() {
        ControllableReader.failWith = new RuntimeException("boom");

        IntakeResult result = intake.intake(owner, "cron");

        assertThat(result.failed()).isTrue();
        assertThat(result.runId()).isNotNull();
        assertThat(jdbc.queryForObject("select outcome || ':' || error_code from mail_run where id = ?",
            String.class, result.runId())).isEqualTo("error:MAIL_INTAKE_ERROR");
        assertThat(state()).isEqualTo("connected");
    }

    @Test
    void malformedMailIsSkippedAndTheRestStored() throws Exception {
        append("INBOX", message("<m1@example.test>", "Levél", "Kitalált tartalom.", "shop@example.test"));
        ControllableReader.addMalformed = true;

        IntakeResult result = intake.intake(owner, "cron");

        assertThat(result.failed()).isFalse();
        assertThat(result.mails()).hasSize(1);
        assertThat(count("select count(*) from mail_message where mailbox_id = ?", mailbox.getId())).isEqualTo(1);
        assertThat(count("select last_uid from mail_folder_cursor where mailbox_id = ? and folder = 'INBOX'",
            mailbox.getId())).isEqualTo(2); // advanced past the bad one
    }

    @Test
    void inboxOkSpamUnreachableKeepsInboxMailAndResetsStreak() throws Exception {
        jdbc.update("update mail_mailbox set zero_run_streak = 1 where id = ?", mailbox.getId());
        append("INBOX", message("<p1@example.test>", "Levél", "Kitalált tartalom.", "shop@example.test"));
        ControllableReader.failFolder = "[Gmail]/Spam";
        ControllableReader.failWith = unreachable();

        IntakeResult result = intake.intake(owner, "cron");

        assertThat(result.failed()).isTrue();
        assertThat(result.mails()).hasSize(1);
        assertThat(streak()).isZero();
        assertThat(state()).isEqualTo("connected");
        assertThat(jdbc.queryForObject("select outcome from mail_run where id = ?", String.class, result.runId()))
            .isEqualTo("unreachable");
    }

    @Test
    void disconnectedMailboxDoesNotRaiseTheGauges() {
        jdbc.update("update mail_mailbox set state = 'disconnected', zero_run_streak = 5 where id = ?",
            mailbox.getId());
        health.refresh();

        assertThat(gauge("mezo.mail.zero.run.streak")).isZero();
    }

    @Test
    void concurrentRunForTheSameMailboxIsSkipped() throws Exception {
        ControllableReader.entered = new java.util.concurrent.CountDownLatch(1);
        ControllableReader.release = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newSingleThreadExecutor();
        try {
            java.util.concurrent.Future<IntakeResult> first = pool.submit(() -> intake.intake(owner, "cron"));
            assertThat(ControllableReader.entered.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();

            IntakeResult second = intake.intake(owner, "manual");

            assertThat(second.runId()).isNull();
            assertThat(second.failed()).isFalse();
            ControllableReader.release.countDown();
            assertThat(first.get(20, java.util.concurrent.TimeUnit.SECONDS).runId()).isNotNull();
            assertThat(count("select count(*) from mail_run where mailbox_id = ?", mailbox.getId())).isEqualTo(1);
        } finally {
            ControllableReader.release.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void purgeAlsoDropsBodiesOfSoftDeletedRows() {
        MailMessageEntity gone = mail.message(owner, mailbox.getId(), null);
        Instant now = Instant.parse("2026-11-21T08:00:00Z");
        jdbc.update("update mail_message set body_redacted = 'kitalált törzs', is_deleted = true, received_at = ? "
            + "where id = ?", java.sql.Timestamp.from(now.minus(java.time.Duration.ofDays(31))), gone.getId());

        assertThat(purge.purge(now)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select body_redacted is null from mail_message where id = ?",
            Boolean.class, gone.getId())).isTrue();
    }

    private int streak() {
        return jdbc.queryForObject("select zero_run_streak from mail_mailbox where id = ?", Integer.class,
            mailbox.getId());
    }

    private String state() {
        return jdbc.queryForObject("select state from mail_mailbox where id = ?", String.class, mailbox.getId());
    }
}
