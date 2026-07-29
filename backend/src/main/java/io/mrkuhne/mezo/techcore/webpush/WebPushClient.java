package io.mrkuhne.mezo.techcore.webpush;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Web Push (RFC 8030) transport: signs, encrypts and POSTs one message to a push service, mapping
 * every response to a {@link WebPushResult}. The project's second outbound HTTP client — obtains
 * and configures its {@link RestClient} the same way {@code OffClient} does (Fuel P6, mezo-bka).
 *
 * <p><b>Never propagates.</b> {@link #send} is called in a loop over a user's devices (Task 6's
 * {@code PushSender}), so one bad device — a stale subscription, a malformed key, a hung push
 * service, an oversized payload — must not abort the rest. Every failure path, including the
 * crypto exceptions {@link VapidSigner} and {@link Aes128GcmEncryptor} raise, is caught here and
 * turned into a {@link WebPushResult}; none of their {@code HttpStatus} metadata reaches a client
 * on this outbound path, so it is not consulted — only the {@code SystemMessage} code would be,
 * and only if a cause needed distinguishing (none currently do).
 */
@Slf4j
@Component
public class WebPushClient {

    /** How much of a push endpoint (a capability URL) is safe to put in a log line. */
    private static final int ENDPOINT_LOG_PREFIX_LEN = 40;

    /**
     * {@link Aes128GcmEncryptor#encrypt} emits {@code 86 (RFC 8188 header) + plaintext.length + 1
     * (delimiter) + 16 (GCM tag)} bytes and 500s once that exceeds its fixed 4096-byte
     * {@code recordSize} — i.e. above 4079 plaintext bytes. Checked here so an oversized payload
     * short-circuits to {@link WebPushResult#TOO_LARGE} before spending a crypto call (and a
     * generic {@code WEBPUSH_ENCRYPT_FAILED}) on something already known to be undeliverable.
     * Task 6 truncates bodies before they get here; this is the backstop, not the primary control.
     */
    private static final int MAX_PLAINTEXT_BYTES = 4079;

    private final VapidSigner vapidSigner;
    private final Aes128GcmEncryptor encryptor;
    private final WebPushProperties properties;
    private final RestClient rest;

    public WebPushClient(
            VapidSigner vapidSigner,
            Aes128GcmEncryptor encryptor,
            WebPushProperties properties,
            RestClient.Builder builder) {
        this.vapidSigner = vapidSigner;
        this.encryptor = encryptor;
        this.properties = properties;
        HttpClientSettings settings = HttpClientSettings.defaults()
            .withTimeouts(Duration.ofMillis(properties.timeoutMs()), Duration.ofMillis(properties.timeoutMs()));
        this.rest = builder
            .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .build();
    }

    /**
     * Encrypts {@code payloadJson} for one subscription and POSTs it to the subscription's
     * endpoint. Never throws — every failure, including a thrown crypto or transport exception,
     * is mapped to {@link WebPushResult#FAILED}.
     */
    public WebPushResult send(WebPushSubscriptionKeys keys, String payloadJson) {
        byte[] plaintext = payloadJson.getBytes(StandardCharsets.UTF_8);
        if (plaintext.length > MAX_PLAINTEXT_BYTES) {
            log.warn("Push payload too large ({} bytes) for endpoint {}...", plaintext.length,
                logPrefix(keys.endpoint()));
            return WebPushResult.TOO_LARGE;
        }
        try {
            String origin = pushOrigin(keys.endpoint());
            byte[] body = encryptor.encrypt(keys.p256dh(), keys.auth(), plaintext);
            String authorization = vapidSigner.authorizationHeader(origin, Instant.now());

            ResponseEntity<Void> response = rest.post()
                .uri(keys.endpoint())
                .header(HttpHeaders.AUTHORIZATION, authorization)
                .header(HttpHeaders.CONTENT_ENCODING, "aes128gcm")
                .header(HttpHeaders.CONTENT_TYPE, "application/octet-stream")
                .header("TTL", String.valueOf(properties.defaultTtlSeconds()))
                .header("Urgency", "normal")
                .body(body)
                .retrieve()
                .onStatus(status -> true, (req, res) -> { })
                .toBodilessEntity();

            return mapStatus(response.getStatusCode().value(), keys.endpoint());
        } catch (Exception e) {
            log.warn("Push send failed for endpoint {}...: {}", logPrefix(keys.endpoint()), e.getMessage());
            return WebPushResult.FAILED;
        }
    }

    private WebPushResult mapStatus(int status, String endpoint) {
        return switch (status) {
            case 200, 201, 202 -> WebPushResult.SENT;
            case 404, 410 -> WebPushResult.GONE;
            case 413 -> WebPushResult.TOO_LARGE;
            case 429 -> WebPushResult.THROTTLED;
            default -> {
                log.warn("Push send got unexpected status {} for endpoint {}...", status, logPrefix(endpoint));
                yield WebPushResult.FAILED;
            }
        };
    }

    /** {@code scheme://host[:port]} — no path, no trailing slash — the form {@code VapidSigner}'s aud validation requires. */
    private static String pushOrigin(String endpoint) {
        URI uri = URI.create(endpoint);
        String portSegment = uri.getPort() == -1 ? "" : ":" + uri.getPort();
        return uri.getScheme() + "://" + uri.getHost() + portSegment;
    }

    /** First {@value #ENDPOINT_LOG_PREFIX_LEN} chars only — an endpoint is a capability URL. */
    private static String logPrefix(String endpoint) {
        return endpoint.length() <= ENDPOINT_LOG_PREFIX_LEN ? endpoint : endpoint.substring(0, ENDPOINT_LOG_PREFIX_LEN);
    }
}
