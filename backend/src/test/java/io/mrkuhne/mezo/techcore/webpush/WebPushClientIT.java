package io.mrkuhne.mezo.techcore.webpush;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import java.util.Base64;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WebPushClientIT {

    private WireMockServer server;
    private WebPushClient client;

    @BeforeEach
    void setUp() {
        server = new WireMockServer(0);
        server.start();
        client = TestWebPush.clientWithGeneratedKeys(); // see Step 2
    }

    @AfterEach
    void tearDown() { server.stop(); }

    private WebPushSubscriptionKeys keys() {
        return new WebPushSubscriptionKeys(
            server.baseUrl() + "/push/abc", TestWebPush.UA_PUBLIC, TestWebPush.AUTH);
    }

    @Test
    void testSend_shouldReturnSent_when201() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(201)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.SENT);
    }

    @Test
    void testSend_shouldReturnGone_when410() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(410)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.GONE);
    }

    @Test
    void testSend_shouldReturnGone_when404() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(404)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.GONE);
    }

    @Test
    void testSend_shouldSendVapidAndAes128gcmHeaders_when201() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(201)));
        client.send(keys(), "{\"title\":\"t\"}");

        var sent = server.getAllServeEvents().getFirst().getRequest();
        assertThat(sent.getHeader("Authorization")).startsWith("vapid t=");
        assertThat(sent.getHeader("Content-Encoding")).isEqualTo("aes128gcm");
        assertThat(sent.getHeader("TTL")).isEqualTo("3600");
        assertThat(sent.getBody()).isNotEmpty();
    }

    @Test
    void testSend_shouldReturnFailed_when500() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(500)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.FAILED);
    }

    // === Beyond the brief: pinning tests for behaviours a happy-path-only suite would hide ======

    @Test
    void testSend_shouldPostTheEncryptedEnvelope_notThePlaintextJson_when201() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(201)));
        String payload = "{\"title\":\"secret-marker\"}";

        client.send(keys(), payload);

        byte[] body = server.getAllServeEvents().getFirst().getRequest().getBody();
        // RFC 8188 header (86) + payload + delimiter (1) + GCM tag (16) — never the raw JSON.
        assertThat(body).hasSize(86 + payload.getBytes(UTF_8).length + 17);
        assertThat(new String(body, UTF_8)).doesNotContain("secret-marker").doesNotContain("title");
    }

    @Test
    void testSend_shouldSignTheDerivedOrigin_notTheFullEndpointWithPath() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(201)));

        client.send(keys(), "{\"title\":\"t\"}");

        var sent = server.getAllServeEvents().getFirst().getRequest();
        String authHeader = sent.getHeader("Authorization");
        String jwt = authHeader.substring("vapid t=".length(), authHeader.indexOf(", k="));
        String claims = new String(Base64.getUrlDecoder().decode(jwt.split("\\.")[1]), UTF_8);

        // scheme://host:port only — no /push/abc path — matching VapidSigner's PUSH_ORIGIN regex.
        assertThat(claims).contains("\"aud\":\"" + server.baseUrl() + "\"");
    }

    @Test
    void testSend_shouldReturnFailed_whenTransportFails() {
        // Nothing listens on port 1 -> connection refused, an exception thrown deep inside
        // RestClient — must be caught, never propagated to a caller looping over devices.
        WebPushSubscriptionKeys unreachable = new WebPushSubscriptionKeys(
            "http://localhost:1/push/abc", TestWebPush.UA_PUBLIC, TestWebPush.AUTH);
        assertThat(client.send(unreachable, "{\"title\":\"t\"}")).isEqualTo(WebPushResult.FAILED);
    }

    @Test
    void testSend_shouldReturnFailed_whenSubscriptionKeyMaterialIsMalformed() {
        // Not valid base64url -> Aes128GcmEncryptor throws SystemRuntimeErrorException
        // (WEBPUSH_KEY_INVALID) -> must be caught here too, not just the VapidSigner exceptions.
        WebPushSubscriptionKeys badKeys = new WebPushSubscriptionKeys(
            server.baseUrl() + "/push/abc", "not-valid-base64url!!", TestWebPush.AUTH);
        assertThat(client.send(badKeys, "{\"title\":\"t\"}")).isEqualTo(WebPushResult.FAILED);
        assertThat(server.getAllServeEvents()).isEmpty(); // never even reached the wire
    }

    @Test
    void testSend_shouldReturnTooLarge_whenPlaintextExceedsRecordCeiling() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(201)));
        // The encryptor's fixed 4096-byte recordSize leaves 4079 plaintext bytes before it 500s;
        // one byte over must short-circuit to TOO_LARGE without ever attempting the encrypt+POST.
        String oversized = "x".repeat(4080);

        assertThat(client.send(keys(), oversized)).isEqualTo(WebPushResult.TOO_LARGE);
        assertThat(server.getAllServeEvents()).isEmpty();
    }

    @Test
    void testSend_shouldReturnTooLarge_whenPushServiceResponds413() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(413)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.TOO_LARGE);
    }

    @Test
    void testSend_shouldReturnThrottled_when429() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(429)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.THROTTLED);
    }
}
