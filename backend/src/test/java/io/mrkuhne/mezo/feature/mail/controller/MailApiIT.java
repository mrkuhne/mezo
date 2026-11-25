package io.mrkuhne.mezo.feature.mail.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.containing;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetup;
import io.mrkuhne.mezo.api.dto.MailDigestResponse;
import io.mrkuhne.mezo.api.dto.MailFeedbackRequest;
import io.mrkuhne.mezo.api.dto.MailGoogleConnectRequest;
import io.mrkuhne.mezo.api.dto.MailMailboxRequest;
import io.mrkuhne.mezo.api.dto.MailMailboxResponse;
import io.mrkuhne.mezo.api.dto.MailRulesRequest;
import io.mrkuhne.mezo.api.dto.MailRulesResponse;
import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.entity.MailItemEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMessageEntity;
import io.mrkuhne.mezo.feature.mail.repository.MailMailboxRepository;
import io.mrkuhne.mezo.feature.mail.service.imap.GreenMailReaders;
import io.mrkuhne.mezo.feature.mail.service.imap.MailReader;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MailPopulator;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

/**
 * The morning-post REST contract over HTTP against an in-process GreenMail IMAPS server (mezo-r36n9.39). Every
 * address, subject and password is invented.
 */
@TestPropertySource(properties = "mezo.mail.enabled=true")
class MailApiIT extends ApiIntegrationTest {

    private static final String PASSWORD = "app-password-1234";
    private static final GreenMail GREEN_MAIL = new GreenMail(
        new ServerSetup(0, "127.0.0.1", ServerSetup.PROTOCOL_IMAPS));

    private static final String CLIENT_ID = "123456-abcdef.apps.googleusercontent.com";
    private static final String REDIRECT = "com.googleusercontent.apps.123456-abcdef:/oauth2redirect";
    private static final WireMockServer GOOGLE = new WireMockServer(wireMockConfig().dynamicPort());

    static {
        GREEN_MAIL.start();
        GOOGLE.start();
    }

    @DynamicPropertySource
    static void imap(DynamicPropertyRegistry registry) {
        registry.add("mezo.mail.imap-host", () -> "127.0.0.1");
        registry.add("mezo.mail.imap-port", () -> GREEN_MAIL.getImaps().getPort());
        registry.add("mezo.mail.google.client-id", () -> CLIENT_ID);
        registry.add("mezo.mail.google.token-url", () -> GOOGLE.baseUrl() + "/token");
        registry.add("mezo.mail.google.revoke-url", () -> GOOGLE.baseUrl() + "/revoke");
        registry.add("mezo.mail.google.api-url", () -> GOOGLE.baseUrl() + "/gmail/v1");
    }

    @TestConfiguration
    static class ReaderConfig {
        @Bean
        @Primary
        MailReader greenMailReader(MailProperties props) {
            return GreenMailReaders.trusting(props);
        }
    }

    @Autowired private MailPopulator mail;
    @Autowired private MailMailboxRepository mailboxes;
    @Autowired private io.mrkuhne.mezo.feature.mail.repository.MailMessageRepository messages;
    @Autowired private io.mrkuhne.mezo.feature.mail.repository.MailItemRepository items;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private io.mrkuhne.mezo.feature.mail.service.MailCredentialCipher cipher;

    private String freshAddress() {
        String address = "mirror-" + UUID.randomUUID() + "@example.test";
        GREEN_MAIL.setUser(address, address, PASSWORD);
        return address;
    }

    private MailMailboxResponse connect(RegisteredUser u, String address) {
        return putForBody("/api/mail/mailbox", new MailMailboxRequest().address(address).appPassword(PASSWORD),
            u.headers(), HttpStatus.OK, MailMailboxResponse.class);
    }

    @Test
    void noMailboxIsStateNoneNotNotFound() {
        RegisteredUser u = registerUser("mail none");
        MailMailboxResponse r = getForBody("/api/mail/mailbox", u.headers(), HttpStatus.OK, MailMailboxResponse.class);
        assertThat(r.getState()).isEqualTo("none");
        assertThat(r.getAddress()).isNull();
    }

    @Test
    void aBadPasswordIs422AndNothingIsStored() {
        RegisteredUser u = registerUser("mail bad");
        String address = freshAddress();
        String body = exchangeForBody(org.springframework.http.HttpMethod.PUT, "/api/mail/mailbox",
            new MailMailboxRequest().address(address).appPassword("wrong-password-9999"), u.headers(),
            HttpStatus.UNPROCESSABLE_CONTENT, String.class);
        assertThat(body).contains("MAIL_AUTH_FAILED").doesNotContain("wrong-password-9999");
        assertThat(jdbc.queryForObject("select count(*) from mail_mailbox where created_by = ?", Long.class, u.id()))
            .isZero();
    }

    @Test
    void connectStoresSealedAndNeverEchoesThePassword() {
        RegisteredUser u = registerUser("mail connect");
        String address = freshAddress();
        MailMailboxResponse r = connect(u, address);
        assertThat(r.getState()).isEqualTo("connected");
        assertThat(r.getAddress()).isEqualTo(address);

        String raw = getForBody("/api/mail/mailbox", u.headers(), HttpStatus.OK, String.class);
        assertThat(raw).doesNotContain(PASSWORD).doesNotContainIgnoringCase("password").doesNotContainIgnoringCase("secret");
        assertThat(jdbc.queryForObject(
            "select secret_cipher is not null and secret_nonce is not null from mail_mailbox where created_by = ?",
            Boolean.class, u.id())).isTrue();

        // replacing reuses the row: one live mailbox per user
        connect(u, freshAddress());
        assertThat(jdbc.queryForObject(
            "select count(*) from mail_mailbox where created_by = ? and is_deleted = false", Long.class, u.id()))
            .isEqualTo(1L);
    }

    @Test
    void deleteDisconnectsAndNullsBothSecretColumns() {
        RegisteredUser u = registerUser("mail delete");
        connect(u, freshAddress());
        MailMailboxResponse r = exchangeForBody(org.springframework.http.HttpMethod.DELETE, "/api/mail/mailbox", null,
            u.headers(), HttpStatus.OK, MailMailboxResponse.class);
        assertThat(r.getState()).isEqualTo("disconnected");
        assertThat(jdbc.queryForObject(
            "select secret_cipher is null and secret_nonce is null and state = 'disconnected' from mail_mailbox "
                + "where created_by = ? and is_deleted = false", Boolean.class, u.id())).isTrue();
    }

    @Test
    void runWithinTheCooldownIs429() {
        RegisteredUser u = registerUser("mail cooldown");
        connect(u, freshAddress());
        jdbc.update("update mail_mailbox set last_run_at = ? where created_by = ?",
            java.sql.Timestamp.from(Instant.now().minus(Duration.ofMinutes(2))), u.id());
        String body = exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/run", null,
            u.headers(), HttpStatus.TOO_MANY_REQUESTS, String.class);
        assertThat(body).contains("MAIL_RUN_COOLDOWN");
    }

    @Test
    void runWithoutAConnectedMailboxIs409() {
        RegisteredUser u = registerUser("mail notconnected");
        String none = exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/run", null,
            u.headers(), HttpStatus.CONFLICT, String.class);
        assertThat(none).contains("MAIL_NOT_CONNECTED");
        connect(u, freshAddress());
        exchangeForBody(org.springframework.http.HttpMethod.DELETE, "/api/mail/mailbox", null, u.headers(),
            HttpStatus.OK, String.class);
        exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/run", null, u.headers(),
            HttpStatus.CONFLICT, String.class);
    }

    @Test
    void aManualRunIsAcceptedAndRunsForThisUserOnly() {
        RegisteredUser u = registerUser("mail run");
        RegisteredUser other = registerUser("mail run other");
        connect(u, freshAddress());
        connect(other, freshAddress());
        exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/run", null, u.headers(),
            HttpStatus.ACCEPTED, String.class);
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
            assertThat(jdbc.queryForObject("select count(*) from mail_run where created_by = ? and trigger = 'manual'",
                Long.class, u.id())).isEqualTo(1L));
        assertThat(jdbc.queryForObject("select count(*) from mail_run where created_by = ?", Long.class, other.id()))
            .isZero();
        // the second request is inside the cooldown (restart-safe: read from the database)
        exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/run", null, u.headers(),
            HttpStatus.TOO_MANY_REQUESTS, String.class);
    }

    @Test
    void digestShapeForAPopulatedDay() {
        RegisteredUser u = registerUser("mail digest");
        MailMailboxEntity box = mail.mailbox(u.id());
        MailMessageEntity msg = mail.message(u.id(), box.getId(), 1_234_567_890_123L);
        MailItemEntity parcel = mail.item(u.id(), msg.getId(), "gls", "KEY-1");
        MailMessageEntity bank = mail.message(u.id(), box.getId(), 99L);
        bank.setFromAddr("info@otpbank.hu");
        bank.setSubject(null);
        messages.saveAndFlush(bank);
        MailItemEntity sens = mail.item(u.id(), bank.getId(), null, null);
        sens.setGrp("sensitive");
        sens.setCategory("sensitive");
        sens.setTitle("OTP Bank");
        sens.setSummary("");
        sens.setWhy("");
        sens.setParcelState(null);
        sens.setCarrier(null);
        sens.setParcelKey(null);
        sens.setSource("rule");
        items.saveAndFlush(sens);
        MailMessageEntity news = mail.message(u.id(), box.getId(), 77L);
        news.setFromName("Heti Receptek");
        messages.saveAndFlush(news);
        // The folded „A többi" follows the fetch (created_at inside the queried day), not the arrival: the
        // auditing column is now(), so a test written on 2026-11-21 silently went red from the 22nd. Pin it.
        jdbc.update("update mail_message set created_at = ? where id = ?",
            java.sql.Timestamp.from(Instant.parse("2026-11-21T06:00:00Z")), news.getId());
        MailItemEntity newsItem = mail.item(u.id(), news.getId(), null, null);
        newsItem.setGrp("rest");
        newsItem.setCategory("hírlevél");
        newsItem.setTitle("Öt vacsora a hétre");
        newsItem.setSummary("Kitalált összefoglaló.");
        newsItem.setWhy("");
        newsItem.setParcelState(null);
        newsItem.setCarrier(null);
        newsItem.setParcelKey(null);
        newsItem.setSource("rule");
        items.saveAndFlush(newsItem);

        MailDigestResponse d = getForBody("/api/mail/digest?date=2026-11-21", u.headers(), HttpStatus.OK,
            MailDigestResponse.class);
        assertThat(d.getHeatSlots()).hasSize(12);
        assertThat(d.getMailboxState()).isEqualTo("connected");
        assertThat(d.getParcels()).hasSize(1);
        var p = d.getParcels().getFirst();
        assertThat(p.getId()).isEqualTo(parcel.getId());
        assertThat(p.getGroup()).isEqualTo("parcel");
        assertThat(p.getCarrier()).isEqualTo("gls");
        assertThat(p.getParcelState()).isEqualTo("in_transit");
        assertThat(p.getFromAddress()).isEqualTo("shop@example.test");
        assertThat(p.getGmailMessageId()).isEqualTo("1234567890123");
        assertThat(p.getScreen()).isNotNull();
        assertThat(d.getSensitive()).hasSize(1);
        var sc = d.getSensitive().getFirst();
        assertThat(sc.getTitle()).isEqualTo("info@otpbank.hu"); // sender only
        assertThat(sc.getSummary()).isEmpty();
        assertThat(sc.getFromAddress()).isEqualTo("info@otpbank.hu");
        assertThat(d.getPeople()).isEmpty();
        assertThat(d.getRest()).hasSize(1);
        var group = d.getRest().getFirst();
        assertThat(group.getCategory()).isEqualTo("hírlevél");
        assertThat(group.getCount()).isEqualTo(1);
        assertThat(group.getItems()).hasSize(1);
        assertThat(group.getItems().getFirst().getTitle()).isEqualTo("Öt vacsora a hétre");
        assertThat(group.getItems().getFirst().getSummary()).isEqualTo("Kitalált összefoglaló.");
        assertThat(group.getItems().getFirst().getFromName()).isEqualTo("Heti Receptek");
        // a sensitive mail is never a line under "A többi"
        assertThat(d.getRest()).flatExtracting(g -> g.getItems()).extracting(i -> i.getTitle()).doesNotContain("OTP Bank");
        assertThat(d.getRulesOnly()).isFalse();
    }

    @Test
    void feedbackOnAForeignItemIs404AndOwnIs204() {
        RegisteredUser u = registerUser("mail fb owner");
        RegisteredUser other = registerUser("mail fb other");
        MailMailboxEntity box = mail.mailbox(u.id());
        MailMessageEntity msg = mail.message(u.id(), box.getId(), 7L);
        MailItemEntity item = mail.item(u.id(), msg.getId(), "gls", "KEY-2");
        String url = "/api/mail/items/" + item.getId() + "/feedback";
        String body = exchangeForBody(org.springframework.http.HttpMethod.POST, url,
            new MailFeedbackRequest().verdict("nope"), other.headers(), HttpStatus.NOT_FOUND, String.class);
        assertThat(body).contains("MAIL_ITEM_NOT_FOUND");
        exchangeForBody(org.springframework.http.HttpMethod.POST, url, new MailFeedbackRequest().verdict("interest"),
            u.headers(), HttpStatus.NO_CONTENT, String.class);
        assertThat(jdbc.queryForObject("select verdict from mail_feedback where created_by = ?", String.class, u.id()))
            .isEqualTo("interest");
        exchangeForBody(org.springframework.http.HttpMethod.POST, url, new MailFeedbackRequest().verdict("maybe"),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void rulesShowTheSeedReadOnlyAndPutReplacesOnlyTheOwnerRules() {
        RegisteredUser u = registerUser("mail rules");
        MailRulesResponse before = getForBody("/api/mail/rules", u.headers(), HttpStatus.OK, MailRulesResponse.class);
        assertThat(before.getSensitive()).anyMatch(r -> "seed".equals(r.getOrigin()) && "@otpbank.hu".equals(r.getPattern()));
        assertThat(before.getSilent()).isEmpty();

        MailRulesResponse after = putForBody("/api/mail/rules", new MailRulesRequest()
            .sensitive(List.of("Doctor@Example.test")).silent(List.of("@spam.example.test"))
            .always(List.of("friend@example.test")), u.headers(), HttpStatus.OK, MailRulesResponse.class);
        assertThat(after.getSensitive()).anyMatch(r -> "owner".equals(r.getOrigin())
            && "doctor@example.test".equals(r.getPattern()));
        assertThat(after.getSensitive()).anyMatch(r -> "seed".equals(r.getOrigin()));
        assertThat(after.getSilent()).extracting(r -> r.getPattern()).containsExactly("@spam.example.test");

        // a second PUT replaces, never accumulates, and an empty list clears
        MailRulesResponse cleared = putForBody("/api/mail/rules", new MailRulesRequest()
            .sensitive(List.of()).silent(List.of()).always(List.of("friend@example.test")), u.headers(),
            HttpStatus.OK, MailRulesResponse.class);
        assertThat(cleared.getSilent()).isEmpty();
        assertThat(cleared.getSensitive()).allMatch(r -> "seed".equals(r.getOrigin()));
        assertThat(cleared.getAlways()).hasSize(1);

        exchangeForBody(org.springframework.http.HttpMethod.PUT, "/api/mail/rules", new MailRulesRequest()
            .sensitive(List.of("not a pattern")).silent(List.of()).always(List.of()), u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
    }

    // ── Sign in with Google (spec §12) ──────────────────────────────────────────────────────────────────

    private static String idToken(String email) {
        java.util.Base64.Encoder enc = java.util.Base64.getUrlEncoder().withoutPadding();
        String payload = "{\"iss\":\"https://accounts.google.com\",\"aud\":\"" + CLIENT_ID + "\",\"email\":\""
            + email + "\",\"email_verified\":true}";
        return enc.encodeToString("{\"alg\":\"RS256\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8)) + "."
            + enc.encodeToString(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)) + ".sig";
    }

    private static void stubGoogleExchange(String email) {
        GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withHeader("Content-Type",
            "application/json").withBody("{\"access_token\":\"at-secret\",\"refresh_token\":\"rt-secret-1\","
            + "\"expires_in\":3600,\"id_token\":\"" + idToken(email) + "\"}")));
    }

    private static MailGoogleConnectRequest googleRequest(String redirect) {
        return new MailGoogleConnectRequest().code("code-secret-1").codeVerifier("v".repeat(43)).redirectUri(redirect);
    }

    @Test
    void googleConnectStoresKindAndSealedRefreshTokenAndNeverEchoesIt() {
        GOOGLE.resetAll();
        stubGoogleExchange("owner-g@gmail.example");
        RegisteredUser u = registerUser("mail google");

        String raw = exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/google",
            googleRequest(REDIRECT), u.headers(), HttpStatus.OK, String.class);

        assertThat(raw).doesNotContain("rt-secret-1").doesNotContain("at-secret").doesNotContain("code-secret-1");
        MailMailboxResponse r = getForBody("/api/mail/mailbox", u.headers(), HttpStatus.OK, MailMailboxResponse.class);
        assertThat(r.getKind()).isEqualTo("google");
        assertThat(r.getAddress()).isEqualTo("owner-g@gmail.example");
        assertThat(r.getState()).isEqualTo("connected");
        assertThat(r.getGoogleClientId()).isEqualTo(CLIENT_ID);
        MailMailboxEntity stored = mailboxes.findByCreatedBy(u.id()).orElseThrow();
        assertThat(stored.getKind()).isEqualTo("google");
        assertThat(new String(stored.getSecretCipher(), java.nio.charset.StandardCharsets.ISO_8859_1))
            .doesNotContain("rt-secret-1");
        assertThat(cipher.open(new io.mrkuhne.mezo.feature.mail.service.MailCredentialCipher.Sealed(
            stored.getSecretCipher(), stored.getSecretNonce()))).isEqualTo("rt-secret-1");
    }

    @Test
    void googleConnectRefusedByGoogleIs422AndNothingIsStored() {
        GOOGLE.resetAll();
        GOOGLE.stubFor(post(urlPathEqualTo("/token")).willReturn(aResponse().withStatus(400)
            .withBody("{\"error\":\"invalid_grant\"}")));
        RegisteredUser u = registerUser("mail google bad");

        String body = exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/google",
            googleRequest(REDIRECT), u.headers(), HttpStatus.UNPROCESSABLE_CONTENT, String.class);

        assertThat(body).contains("MAIL_AUTH_FAILED").doesNotContain("code-secret-1");
        assertThat(jdbc.queryForObject("select count(*) from mail_mailbox where created_by = ?", Long.class, u.id()))
            .isZero();
    }

    @Test
    void googleConnectWithAForeignRedirectIs400() {
        GOOGLE.resetAll();
        RegisteredUser u = registerUser("mail google redirect");
        String body = exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/google",
            googleRequest("https://evil.example/cb"), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertThat(body).contains("MAIL_GOOGLE_REDIRECT_INVALID");
        GOOGLE.verify(0, postRequestedFor(urlPathEqualTo("/token")));
    }

    @Test
    void disconnectingAGoogleMailboxRevokesTheTokenAtGoogleThenNullsIt() {
        GOOGLE.resetAll();
        stubGoogleExchange("owner-r@gmail.example");
        GOOGLE.stubFor(post(urlPathEqualTo("/revoke")).willReturn(aResponse().withStatus(200)));
        RegisteredUser u = registerUser("mail google revoke");
        exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/google", googleRequest(REDIRECT),
            u.headers(), HttpStatus.OK, String.class);

        MailMailboxResponse r = exchangeForBody(org.springframework.http.HttpMethod.DELETE, "/api/mail/mailbox", null,
            u.headers(), HttpStatus.OK, MailMailboxResponse.class);

        assertThat(r.getState()).isEqualTo("disconnected");
        GOOGLE.verify(postRequestedFor(urlPathEqualTo("/revoke")).withRequestBody(equalTo("token=rt-secret-1")));
        assertThat(jdbc.queryForObject(
            "select secret_cipher is null and secret_nonce is null from mail_mailbox where created_by = ?",
            Boolean.class, u.id())).isTrue();
    }

    @Test
    void aFailingRevokeNeverBlocksTheDisconnect() {
        GOOGLE.resetAll();
        stubGoogleExchange("owner-f@gmail.example");
        GOOGLE.stubFor(post(urlPathEqualTo("/revoke")).willReturn(aResponse().withStatus(500)));
        RegisteredUser u = registerUser("mail google revoke fail");
        exchangeForBody(org.springframework.http.HttpMethod.POST, "/api/mail/mailbox/google", googleRequest(REDIRECT),
            u.headers(), HttpStatus.OK, String.class);

        MailMailboxResponse r = exchangeForBody(org.springframework.http.HttpMethod.DELETE, "/api/mail/mailbox", null,
            u.headers(), HttpStatus.OK, MailMailboxResponse.class);

        assertThat(r.getState()).isEqualTo("disconnected");
    }

    @Test
    void anImapMailboxReportsKindImap() {
        RegisteredUser u = registerUser("mail kind imap");
        connect(u, freshAddress());
        MailMailboxResponse r = getForBody("/api/mail/mailbox", u.headers(), HttpStatus.OK, MailMailboxResponse.class);
        assertThat(r.getKind()).isEqualTo("imap");
    }

    @Test
    void everyOperationNeedsAToken() {
        exchangeForBody(org.springframework.http.HttpMethod.GET, "/api/mail/mailbox", null, null,
            HttpStatus.UNAUTHORIZED, String.class);
        exchangeForBody(org.springframework.http.HttpMethod.GET, "/api/mail/digest", null, null,
            HttpStatus.UNAUTHORIZED, String.class);
    }
}
