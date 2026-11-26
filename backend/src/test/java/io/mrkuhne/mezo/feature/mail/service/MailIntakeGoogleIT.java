package io.mrkuhne.mezo.feature.mail.service;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.repository.MailMailboxRepository;
import io.mrkuhne.mezo.feature.mail.service.MailIntakeService.IntakeResult;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MailPopulator;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

/**
 * The intake of a Google mailbox through a stub Google (token + Gmail REST) and a real Postgres (spec §12). The
 * stored path after the fetch is the IMAP one. Every address, subject and body is invented.
 */
@TestPropertySource(properties = "mezo.mail.enabled=true")
class MailIntakeGoogleIT extends AbstractIntegrationTest {

    private static final String CLIENT_ID = "123456-abcdef.apps.googleusercontent.com";
    private static final String BASE = "/gmail/v1/users/me";
    private static final WireMockServer GOOGLE = new WireMockServer(wireMockConfig().dynamicPort());

    static {
        GOOGLE.start();
    }

    @DynamicPropertySource
    static void google(DynamicPropertyRegistry registry) {
        registry.add("mezo.mail.google.client-id", () -> CLIENT_ID);
        registry.add("mezo.mail.google.token-url", () -> GOOGLE.baseUrl() + "/token");
        registry.add("mezo.mail.google.revoke-url", () -> GOOGLE.baseUrl() + "/revoke");
        registry.add("mezo.mail.google.api-url", () -> GOOGLE.baseUrl() + "/gmail/v1");
    }

    @Autowired private DatabasePopulator db;
    @Autowired private MailPopulator mail;
    @Autowired private MailIntakeService intake;
    @Autowired private MailCredentialCipher cipher;
    @Autowired private MailMailboxRepository mailboxes;
    @Autowired private JdbcTemplate jdbc;

    private UUID owner;
    private MailMailboxEntity mailbox;

    @BeforeEach
    void setUp() {
        GOOGLE.resetAll();
        owner = db.populateUser("mail-g-" + UUID.randomUUID() + "@test.local");
        mailbox = mail.mailbox(owner);
        mailbox.setKind("google");
        mailbox.setAddress("owner@gmail.example");
        MailCredentialCipher.Sealed sealed = cipher.seal("rt-secret-1");
        mailbox.setSecretCipher(sealed.cipher());
        mailbox.setSecretNonce(sealed.nonce());
        mailbox = mailboxes.saveAndFlush(mailbox);
        GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withHeader("Content-Type",
            "application/json").withBody("{\"access_token\":\"at-2\",\"expires_in\":3600}")));
    }

    private static String raw(String messageId, String subject, String body) throws Exception {
        MimeMessage m = new MimeMessage((Session) null);
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

    private static void stubJson(String path, String body) {
        GOOGLE.stubFor(get(urlPathEqualTo(path)).willReturn(aResponse().withHeader("Content-Type",
            "application/json").withBody(body)));
    }

    private long count(String sql, Object... args) {
        Long n = jdbc.queryForObject(sql, Long.class, args);
        return n == null ? 0 : n;
    }

    @Test
    void firstRunStoresInboxAndSpamAndSavesTheHistoryCursorThenFollowsHistory() throws Exception {
        stubJson(BASE + "/profile", "{\"historyId\":\"5000\"}");
        GOOGLE.stubFor(get(urlPathEqualTo(BASE + "/messages")).withQueryParam("labelIds", equalTo("INBOX"))
            .willReturn(aResponse().withHeader("Content-Type", "application/json")
                .withBody("{\"messages\":[{\"id\":\"1a\"}]}")));
        GOOGLE.stubFor(get(urlPathEqualTo(BASE + "/messages")).withQueryParam("labelIds", equalTo("SPAM"))
            .willReturn(aResponse().withHeader("Content-Type", "application/json")
                .withBody("{\"messages\":[{\"id\":\"1b\"}]}")));
        stubJson(BASE + "/messages/1a", "{\"id\":\"1a\",\"labelIds\":[\"INBOX\"],\"internalDate\":\"1764064800000\","
            + "\"raw\":\"" + raw("<g1@example.test>", "Heti hírlevél", "Kitalált tartalom egy.") + "\"}");
        stubJson(BASE + "/messages/1b", "{\"id\":\"1b\",\"labelIds\":[\"SPAM\"],\"internalDate\":\"1764064900000\","
            + "\"raw\":\"" + raw("<g2@example.test>", "Továbbított", "Kitalált tartalom kettő.") + "\"}");

        IntakeResult first = intake.intake(owner, "manual");

        assertThat(first.failed()).isFalse();
        assertThat(first.mails()).hasSize(2);
        assertThat(first.mails().get(0).redacted().text()).contains("Kitalált");
        assertThat(count("select count(*) from mail_message where mailbox_id = ?", mailbox.getId())).isEqualTo(2);
        assertThat(count("select count(*) from mail_message where mailbox_id = ? and folder = '[Gmail]/Spam' "
            + "and gm_msgid = 27", mailbox.getId())).isEqualTo(1);
        assertThat(count("select last_uid from mail_folder_cursor where mailbox_id = ? and folder = 'gmail-api'",
            mailbox.getId())).isEqualTo(5000);

        // second run: history, nothing new, the cursor still moves
        stubJson(BASE + "/history", "{\"historyId\":\"5010\"}");
        IntakeResult second = intake.intake(owner, "manual");

        assertThat(second.failed()).isFalse();
        assertThat(second.mails()).isEmpty();
        GOOGLE.verify(getRequestedFor(urlPathEqualTo(BASE + "/history")).withQueryParam("startHistoryId",
            equalTo("5000")));
        assertThat(count("select last_uid from mail_folder_cursor where mailbox_id = ? and folder = 'gmail-api'",
            mailbox.getId())).isEqualTo(5010);
        assertThat(count("select count(*) from mail_message where mailbox_id = ?", mailbox.getId())).isEqualTo(2);
        assertThat(count("select count(*) from mail_run where mailbox_id = ?", mailbox.getId())).isEqualTo(2);
    }

    @Test
    void aWithdrawnGrantMarksTheMailboxAuthFailed() {
        GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withStatus(400)
            .withBody("{\"error\":\"invalid_grant\"}")));

        IntakeResult result = intake.intake(owner, "cron");

        assertThat(result.failed()).isTrue();
        assertThat(mailboxes.findById(mailbox.getId()).orElseThrow().getState()).isEqualTo("auth_failed");
        assertThat(count("select count(*) from mail_run where mailbox_id = ? and outcome = 'auth_failed'",
            mailbox.getId())).isEqualTo(1);
    }
}
