package io.mrkuhne.mezo.feature.mail.service.imap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.icegreen.greenmail.user.GreenMailUser;
import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetup;
import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.service.imap.MailReader.FolderBatch;
import io.mrkuhne.mezo.feature.mail.service.imap.MailReader.FolderState;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.mail.Flags;
import jakarta.mail.Folder;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import java.util.Properties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Plain JUnit against an in-process GreenMail IMAPS server (no Spring, no DB). Fixtures are invented. */
class ImapMailReaderIT {

    private static final String ADDRESS = "boop-test@example.test";
    private static final String PASSWORD = "app-password-1234";

    private static final java.time.Clock CLOCK =
        java.time.Clock.fixed(java.time.Instant.parse("2026-11-20T10:00:00Z"), java.time.ZoneOffset.UTC);

    private GreenMail greenMail;
    private GreenMailUser user;
    private ImapMailReader reader;

    @BeforeEach
    void start() {
        greenMail = new GreenMail(new ServerSetup(0, "127.0.0.1", ServerSetup.PROTOCOL_IMAPS));
        greenMail.start();
        user = greenMail.setUser(ADDRESS, ADDRESS, PASSWORD);
        MailProperties props = new MailProperties("k", "0 0 8,15 * * *", "Europe/Budapest", 0.15, 7, 8, 36, 3, 90, 8,
            6000, 30, 10, "127.0.0.1", greenMail.getImaps().getPort(), MailProperties.Google.of(null));
        Properties extra = new Properties();
        extra.put("mail.imaps.ssl.trust", "*"); // GreenMail's self-signed certificate; test only
        extra.put("mail.imaps.ssl.checkserveridentity", "false");
        reader = new ImapMailReader(props, extra, CLOCK);
    }

    @AfterEach
    void stop() {
        greenMail.stop();
    }

    private MimeMessage simple(String subject, String body) throws Exception {
        MimeMessage m = new MimeMessage((Session) null);
        m.setFrom(new InternetAddress("shop@example.test", "Példa Bolt", "UTF-8"));
        m.setRecipients(MimeMessage.RecipientType.TO, ADDRESS);
        m.setSubject(subject, "UTF-8");
        m.setHeader("List-Unsubscribe", "<https://example.test/u>");
        m.setHeader("Message-ID", "<" + subject.hashCode() + "@example.test>");
        m.setText(body, "UTF-8");
        return m;
    }

    private void deliverThree() throws Exception {
        user.deliver(simple("one", "first"));
        user.deliver(simple("two", "second"));
        user.deliver(simple("three", "third"));
    }

    @Test
    void fetchFromZeroReturnsAllOldestFirst() throws Exception {
        deliverThree();
        FolderBatch batch = reader.fetch(ADDRESS, PASSWORD, "INBOX", new FolderState(0, 0), 50);
        assertThat(batch.mails()).hasSize(3);
        assertThat(batch.mails()).extracting(FetchedMail::uid).isSorted();
        assertThat(batch.mails().get(0).headers().subject()).isEqualTo("one");
        assertThat(batch.mails().get(0).uidValidity()).isEqualTo(batch.uidValidity());
        assertThat(batch.mails().get(0).gmMsgId()).isNull();
    }

    @Test
    void fetchSinceLastUidReturnsOnlyNewer() throws Exception {
        deliverThree();
        FolderBatch all = reader.fetch(ADDRESS, PASSWORD, "INBOX", new FolderState(0, 0), 50);
        long second = all.mails().get(1).uid();
        FolderBatch batch = reader.fetch(ADDRESS, PASSWORD, "INBOX",
            new FolderState(all.uidValidity(), second), 50);
        assertThat(batch.mails()).hasSize(1);
        assertThat(batch.mails().get(0).headers().subject()).isEqualTo("three");
    }

    @Test
    void maxCapsTheBatchOldestFirst() throws Exception {
        deliverThree();
        FolderBatch batch = reader.fetch(ADDRESS, PASSWORD, "INBOX", new FolderState(0, 0), 2);
        assertThat(batch.mails()).extracting(m -> m.headers().subject()).containsExactly("one", "two");
    }

    @Test
    void wrongPasswordIsAuthFailedWithoutLeakingIt() {
        assertThatThrownBy(() -> reader.fetch(ADDRESS, "wrong-secret-xyz", "INBOX", new FolderState(0, 0), 5))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                assertThat(e.getMessages().get(0).getCode()).isEqualTo("MAIL_AUTH_FAILED");
                assertThat(String.valueOf(e.getMessage())).doesNotContain("wrong-secret-xyz");
            });
        assertThatThrownBy(() -> reader.verify(ADDRESS, "wrong-secret-xyz"))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getMessages().get(0).getCode()).isEqualTo("MAIL_AUTH_FAILED"));
    }

    @Test
    void verifyPassesWithRightPassword() {
        reader.verify(ADDRESS, PASSWORD);
    }

    @Test
    void unreachableServerIsMailUnreachable() {
        MailProperties props = new MailProperties("k", "0 0 8,15 * * *", "Europe/Budapest", 0.15, 7, 8, 36, 3, 90, 8,
            6000, 30, 10, "127.0.0.1", 1, MailProperties.Google.of(null));
        ImapMailReader dead = new ImapMailReader(props, new Properties(), CLOCK);
        assertThatThrownBy(() -> dead.verify(ADDRESS, PASSWORD))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getMessages().get(0).getCode()).isEqualTo("MAIL_UNREACHABLE"));
    }

    @Test
    void readingLeavesMessagesUnseen() throws Exception {
        deliverThree();
        reader.fetch(ADDRESS, PASSWORD, "INBOX", new FolderState(0, 0), 50);
        Properties p = new Properties();
        p.put("mail.imaps.ssl.trust", "*");
        p.put("mail.imaps.ssl.checkserveridentity", "false");
        Session s = Session.getInstance(p);
        try (Store store = s.getStore("imaps")) {
            store.connect("127.0.0.1", greenMail.getImaps().getPort(), ADDRESS, PASSWORD);
            Folder f = store.getFolder("INBOX");
            f.open(Folder.READ_ONLY);
            for (jakarta.mail.Message m : f.getMessages()) {
                assertThat(m.isSet(Flags.Flag.SEEN)).isFalse();
            }
            f.close(false);
        }
    }

    @Test
    void missingFolderIsEmptyBatch() {
        FolderBatch batch = reader.fetch(ADDRESS, PASSWORD, "[Gmail]/Spam", new FolderState(0, 0), 50);
        assertThat(batch.mails()).isEmpty();
    }

    @Test
    void multipartWalkedAttachmentIgnoredAccentsSurvive() throws Exception {
        MimeMessage m = simple("Ajánlat", "ignored");
        MimeMultipart alt = new MimeMultipart("alternative");
        MimeBodyPart plain = new MimeBodyPart();
        plain.setText("Árvíztűrő tükörfúrógép", "ISO-8859-2");
        MimeBodyPart html = new MimeBodyPart();
        html.setContent("<p>Árvíztűrő</p>", "text/html; charset=UTF-8");
        alt.addBodyPart(plain);
        alt.addBodyPart(html);
        MimeBodyPart altPart = new MimeBodyPart();
        altPart.setContent(alt);
        MimeBodyPart attach = new MimeBodyPart();
        attach.setContent("SECRET-ATTACHMENT-TEXT", "text/plain");
        attach.setFileName("a.txt");
        attach.setDisposition("attachment");
        MimeMultipart mixed = new MimeMultipart("mixed");
        mixed.addBodyPart(altPart);
        mixed.addBodyPart(attach);
        m.setContent(mixed);
        m.saveChanges();
        user.deliver(m);

        FetchedMail mail = reader.fetch(ADDRESS, PASSWORD, "INBOX", new FolderState(0, 0), 5).mails().get(0);
        assertThat(mail.headers().subject()).isEqualTo("Ajánlat");
        assertThat(mail.headers().fromName()).isEqualTo("Példa Bolt");
        assertThat(mail.headers().from()).isEqualTo("shop@example.test");
        assertThat(mail.plain()).contains("Árvíztűrő tükörfúrógép").doesNotContain("SECRET-ATTACHMENT");
        assertThat(mail.html()).contains("Árvíztűrő");
        assertThat(mail.headers().values("List-Unsubscribe")).isNotEmpty();
        assertThat(mail.headers().values("To")).isNotEmpty();
        assertThat(mail.messageId()).isNotBlank();
        assertThat(mail.receivedAt()).isNotNull();
    }

    @Test
    void gmailIdsAreParsedFromFetchResponses() {
        var map = ImapMailReader.parseGmMsgIds(new org.eclipse.angus.mail.iap.Response[] {
            new org.eclipse.angus.mail.iap.Response("* 1 FETCH (UID 12 X-GM-MSGID 1278455344230334865)"),
            new org.eclipse.angus.mail.iap.Response("* 2 FETCH (X-GM-MSGID 77 UID 13)")});
        assertThat(map).containsEntry(12L, 1278455344230334865L).containsEntry(13L, 77L);
    }

    /** A message with a chosen INTERNALDATE, appended over IMAP (GreenMail's deliver() stamps "now"). */
    private void appendDated(String subject, java.time.Instant received) throws Exception {
        MimeMessage base = simple(subject, "body");
        base.saveChanges();
        MimeMessage dated = new MimeMessage(base) {
            @Override
            public java.util.Date getReceivedDate() {
                return java.util.Date.from(received);
            }
        };
        Properties p = new Properties();
        p.put("mail.imaps.ssl.trust", "*");
        p.put("mail.imaps.ssl.checkserveridentity", "false");
        try (Store store = Session.getInstance(p).getStore("imaps")) {
            store.connect("127.0.0.1", greenMail.getImaps().getPort(), ADDRESS, PASSWORD);
            Folder f = store.getFolder("INBOX");
            f.open(Folder.READ_WRITE);
            f.appendMessages(new jakarta.mail.Message[] {dated});
            f.close(false);
        }
    }

    @Test
    void firstRunAndUidValidityChangeReadOnlyTheLastSevenDays() throws Exception {
        appendDated("old", CLOCK.instant().minus(java.time.Duration.ofDays(8)));
        appendDated("recent", CLOCK.instant().minus(java.time.Duration.ofDays(1)));
        FolderBatch first = reader.fetch(ADDRESS, PASSWORD, "INBOX", new FolderState(0, 0), 50);
        assertThat(first.mails()).extracting(m -> m.headers().subject()).containsExactly("recent");
        FolderBatch changed = reader.fetch(ADDRESS, PASSWORD, "INBOX",
            new FolderState(first.uidValidity() + 99, 5), 50);
        assertThat(changed.mails()).extracting(m -> m.headers().subject()).containsExactly("recent");
        assertThat(changed.uidValidity()).isEqualTo(first.uidValidity());
    }

    @Test
    void oneMalformedMessageDegradesAndDoesNotFailTheBatch() throws Exception {
        user.deliver(simple("good-one", "fine"));
        String raw = "From: a@@b@@c\r\nTo: " + ADDRESS + "\r\nSubject: broken\r\nMessage-ID: <bad@example.test>\r\n"
            + "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=bogus-charset-xyz\r\nContent-Transfer-Encoding: quoted-printable\r\nDate: not a date\r\n\r\nbody =ZZ here\r\n";
        user.deliver(new MimeMessage(Session.getInstance(new Properties()),
            new java.io.ByteArrayInputStream(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8))));
        user.deliver(simple("good-two", "fine"));
        FolderBatch batch = reader.fetch(ADDRESS, PASSWORD, "INBOX", new FolderState(0, 0), 50);
        assertThat(batch.mails()).hasSize(3);
        FetchedMail bad = batch.mails().get(1);
        assertThat(bad.headers().subject()).isEqualTo("broken");
        assertThat(bad.headers().from()).isEmpty();
        assertThat(bad.plain()).contains("body");
        assertThat(batch.mails().get(2).plain()).isEqualTo("fine");
    }
}
