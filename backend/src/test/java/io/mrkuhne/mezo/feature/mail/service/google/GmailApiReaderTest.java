package io.mrkuhne.mezo.feature.mail.service.google;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.service.google.GmailApiReader.GmailBatch;
import io.mrkuhne.mezo.feature.mail.service.imap.FetchedMail;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The Gmail REST reader against a local stub; every address, subject and body is invented. */
class GmailApiReaderTest {

    private static final WireMockServer GMAIL = new WireMockServer(wireMockConfig().dynamicPort());
    private static final String BASE = "/gmail/v1/users/me";

    private GmailApiReader reader;

    @BeforeAll
    static void start() {
        GMAIL.start();
    }

    @AfterAll
    static void stop() {
        GMAIL.stop();
    }

    @BeforeEach
    void setUp() {
        GMAIL.resetAll();
        MailProperties.Google google = new MailProperties.Google("id.apps.googleusercontent.com", null,
            GMAIL.baseUrl() + "/token", GMAIL.baseUrl() + "/revoke", GMAIL.baseUrl() + "/gmail/v1");
        reader = new GmailApiReader(google, Clock.fixed(Instant.parse("2026-11-25T10:00:00Z"), ZoneOffset.UTC));
    }

    private static String raw(String messageId, String subject, String body) throws Exception {
        MimeMessage m = new MimeMessage((Session) null) {
            @Override
            protected void updateMessageID() {
                // keep the Message-ID the test set
            }
        };
        m.setFrom(new InternetAddress("shop@example.test", "Példa Küldő", "UTF-8"));
        m.setRecipients(MimeMessage.RecipientType.TO, "owner@gmail.example");
        m.setSubject(subject, "UTF-8");
        m.setHeader("Message-ID", messageId);
        m.setText(body, "UTF-8");
        m.saveChanges();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        m.writeTo(out);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(out.toByteArray());
    }

    private void stubProfile(String historyId) {
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/profile")).willReturn(json("{\"emailAddress\":\"owner@gmail.example\","
            + "\"historyId\":\"" + historyId + "\"}")));
    }

    private void stubList(String label, String... ids) {
        StringBuilder sb = new StringBuilder("{\"messages\":[");
        for (int i = 0; i < ids.length; i++) {
            sb.append(i == 0 ? "" : ",").append("{\"id\":\"").append(ids[i]).append("\",\"threadId\":\"t\"}");
        }
        sb.append("]}");
        if (ids.length == 0) {
            sb.setLength(0);
            sb.append("{\"resultSizeEstimate\":0}");
        }
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/messages")).withQueryParam("labelIds", equalTo(label))
            .withQueryParam("q", equalTo("newer_than:7d")).willReturn(json(sb.toString())));
    }

    private void stubMessage(String id, String labels, String internalDateMs, String rawMime) {
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/messages/" + id)).withQueryParam("format", equalTo("raw"))
            .willReturn(json("{\"id\":\"" + id + "\",\"labelIds\":[" + labels + "],\"internalDate\":\""
                + internalDateMs + "\",\"raw\":\"" + rawMime + "\"}")));
    }

    private static com.github.tomakehurst.wiremock.client.ResponseDefinitionBuilder json(String body) {
        return aResponse().withHeader("Content-Type", "application/json").withBody(body);
    }

    @Test
    void firstRunListsInboxAndSpamAndMapsFoldersAndDecodesAccents() throws Exception {
        stubProfile("5000");
        stubList("INBOX", "1a2b");
        stubList("SPAM", "ff01");
        stubMessage("1a2b", "\"INBOX\",\"UNREAD\"", "1764064800000", raw("<m1@example.test>", "Árvíztűrő tükörfúrógép",
            "Kitalált tartalom: őszi akció, 20% kedvezmény."));
        stubMessage("ff01", "\"SPAM\"", "1764064900000", raw("<m2@example.test>", "Továbbított", "Egy másik levél."));

        GmailBatch batch = reader.read("at-1", 0, 200);

        assertThat(batch.historyId()).isEqualTo(5000);
        assertThat(batch.mails()).hasSize(2);
        FetchedMail inbox = batch.mails().get(0);
        assertThat(inbox.folder()).isEqualTo("INBOX");
        assertThat(inbox.uid()).isZero();
        assertThat(inbox.uidValidity()).isZero();
        assertThat(inbox.gmMsgId()).isEqualTo(0x1a2bL);
        assertThat(inbox.messageId()).isEqualTo("<m1@example.test>");
        assertThat(inbox.receivedAt()).isEqualTo(Instant.ofEpochMilli(1764064800000L));
        assertThat(inbox.headers().subject()).isEqualTo("Árvíztűrő tükörfúrógép");
        assertThat(inbox.headers().from()).isEqualTo("shop@example.test");
        assertThat(inbox.headers().fromName()).isEqualTo("Példa Küldő");
        assertThat(inbox.plain()).contains("őszi akció");
        FetchedMail spam = batch.mails().get(1);
        assertThat(spam.folder()).isEqualTo("[Gmail]/Spam");
        assertThat(spam.gmMsgId()).isEqualTo(0xff01L);
        GMAIL.verify(getRequestedFor(urlPathEqualTo(BASE + "/messages/1a2b"))
            .withHeader("Authorization", equalTo("Bearer at-1")));
    }

    @Test
    void incrementalRunReadsOnlyAddedInboxAndSpamMessages() throws Exception {
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/history")).withQueryParam("startHistoryId", equalTo("5000"))
            .withQueryParam("historyTypes", equalTo("messageAdded")).willReturn(json("{\"history\":["
                + "{\"id\":\"5001\",\"messagesAdded\":[{\"message\":{\"id\":\"aa\",\"labelIds\":[\"INBOX\"]}}]},"
                + "{\"id\":\"5002\",\"messagesAdded\":[{\"message\":{\"id\":\"bb\",\"labelIds\":[\"SENT\"]}},"
                + "{\"message\":{\"id\":\"cc\",\"labelIds\":[\"SPAM\"]}}]}],\"historyId\":\"5003\"}")));
        stubMessage("aa", "\"INBOX\"", "1764064800000", raw("<a@example.test>", "Egy", "Első."));
        stubMessage("cc", "\"SPAM\"", "1764064800000", raw("<c@example.test>", "Három", "Harmadik."));

        GmailBatch batch = reader.read("at-1", 5000, 200);

        assertThat(batch.historyId()).isEqualTo(5003);
        assertThat(batch.mails()).extracting(FetchedMail::gmMsgId).containsExactly(0xaaL, 0xccL);
        assertThat(batch.mails()).extracting(FetchedMail::folder).containsExactly("INBOX", "[Gmail]/Spam");
        GMAIL.verify(0, getRequestedFor(urlPathEqualTo(BASE + "/messages/bb")));
    }

    @Test
    void incrementalRunFollowsPagination() throws Exception {
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/history")).withQueryParam("startHistoryId", equalTo("10"))
            .withQueryParam("pageToken", com.github.tomakehurst.wiremock.client.WireMock.absent())
            .willReturn(json("{\"history\":[{\"id\":\"11\",\"messagesAdded\":[{\"message\":{\"id\":\"a1\","
                + "\"labelIds\":[\"INBOX\"]}}]}],\"nextPageToken\":\"p2\",\"historyId\":\"99\"}")));
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/history")).withQueryParam("pageToken", equalTo("p2"))
            .willReturn(json("{\"history\":[{\"id\":\"12\",\"messagesAdded\":[{\"message\":{\"id\":\"a2\","
                + "\"labelIds\":[\"INBOX\"]}}]}],\"historyId\":\"99\"}")));
        stubMessage("a1", "\"INBOX\"", "1764064800000", raw("<p1@example.test>", "Egy", "x"));
        stubMessage("a2", "\"INBOX\"", "1764064800000", raw("<p2@example.test>", "Kettő", "y"));

        GmailBatch batch = reader.read("at-1", 10, 200);

        assertThat(batch.mails()).hasSize(2);
        assertThat(batch.historyId()).isEqualTo(99);
    }

    @Test
    void historyNotFoundFallsBackToABoundedFullSync() throws Exception {
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/history")).willReturn(aResponse().withStatus(404)
            .withBody("{\"error\":{\"code\":404}}")));
        stubProfile("7000");
        stubList("INBOX", "10");
        stubList("SPAM");
        stubMessage("10", "\"INBOX\"", "1764064800000", raw("<f@example.test>", "Teljes", "szinkron"));

        GmailBatch batch = reader.read("at-1", 4000, 200);

        assertThat(batch.historyId()).isEqualTo(7000);
        assertThat(batch.mails()).hasSize(1);
        assertThat(batch.mails().get(0).headers().subject()).isEqualTo("Teljes");
    }

    @Test
    void fullSyncIsCappedPerLabel() throws Exception {
        stubProfile("1");
        stubList("INBOX", "01", "02", "03");
        stubList("SPAM");
        for (String id : List.of("01", "02", "03")) {
            stubMessage(id, "\"INBOX\"", "1764064800000", raw("<c" + id + "@example.test>", "S" + id, "b" + id));
        }

        GmailBatch batch = reader.read("at-1", 0, 2);

        assertThat(batch.mails()).hasSize(2);
    }

    @Test
    void unauthorizedIsAuthFailedAndServerErrorIsUnreachable() {
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/profile")).willReturn(aResponse().withStatus(401)));
        assertThatThrownBy(() -> reader.read("bad", 0, 200)).hasMessageContaining("MAIL_AUTH_FAILED");
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/profile")).willReturn(aResponse().withStatus(500)));
        assertThatThrownBy(() -> reader.read("at-1", 0, 200)).hasMessageContaining("MAIL_UNREACHABLE");
    }

    private void stubProfileError(int status, String body) {
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/profile")).willReturn(aResponse().withStatus(status).withBody(body)));
    }

    private static String err(String reason, String state) {
        return "{\"error\":{\"code\":403,\"errors\":[{\"reason\":\"" + reason + "\"}],\"status\":\""
            + state + "\"}}";
    }

    @Test
    void rateLimitsAndAnUnenabledApiAreUnreachableNeverASignInAgain() {
        for (String reason : new String[] {"rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded",
            "accessNotConfigured"}) {
            stubProfileError(403, err(reason, "PERMISSION_DENIED"));
            assertThatThrownBy(() -> reader.read("at", 0, 200)).as(reason).hasMessageContaining("MAIL_UNREACHABLE");
        }
        stubProfileError(429, "{}");
        assertThatThrownBy(() -> reader.read("at", 0, 200)).hasMessageContaining("MAIL_UNREACHABLE");
        stubProfileError(403, "not json");
        assertThatThrownBy(() -> reader.read("at", 0, 200)).hasMessageContaining("MAIL_UNREACHABLE");
    }

    @Test
    void insufficientPermissionsAnd401AreAuthFailed() {
        stubProfileError(403, err("insufficientPermissions", "PERMISSION_DENIED"));
        assertThatThrownBy(() -> reader.read("at", 0, 200)).hasMessageContaining("MAIL_AUTH_FAILED");
        stubProfileError(403, "{\"error\":{\"status\":\"PERMISSION_DENIED\"}}");
        assertThatThrownBy(() -> reader.read("at", 0, 200)).hasMessageContaining("MAIL_AUTH_FAILED");
        stubProfileError(401, "{}");
        assertThatThrownBy(() -> reader.read("at", 0, 200)).hasMessageContaining("MAIL_AUTH_FAILED");
    }

    @Test
    void aCapHitInTheFirstRecordStillAdvancesTheCursor() throws Exception {
        GMAIL.stubFor(get(urlPathEqualTo(BASE + "/history")).willReturn(json("{\"history\":["
            + "{\"id\":\"101\",\"messagesAdded\":[{\"message\":{\"id\":\"aa\",\"labelIds\":[\"INBOX\"]}},"
            + "{\"message\":{\"id\":\"bb\",\"labelIds\":[\"INBOX\"]}}]}],\"historyId\":\"150\"}")));
        stubMessage("aa", "\"INBOX\"", "1764064800000", raw("<a@example.test>", "Egy", "x"));

        GmailBatch batch = reader.read("at", 100, 1);

        assertThat(batch.mails()).hasSize(1);
        assertThat(batch.historyId()).isEqualTo(101);
    }
}
