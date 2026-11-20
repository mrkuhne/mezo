package io.mrkuhne.mezo.feature.penz.service.net;

import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.boot.http.client.HttpRedirects;
import org.springframework.http.HttpHeaders;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * THE SSRF-guarded outbound GET of Boop Pénz (L6, mezo-r36n9.104) — every quote and news fetch goes through it.
 *
 * <p>The guard of {@code pantry/WebPageClient}, tightened:
 * <ul>
 *   <li>http/https only; no userinfo; no explicit port; no IP-literal host (dotted, bracketed or a bare number);
 *       never {@code localhost};</li>
 *   <li>a <b>host allow-list</b>: the host (lower-cased, trailing dot dropped) equals an allowed host or ends with
 *       {@code "." + allowed} — so {@code evilcnbc.com} and {@code cnbc.com.evil.io} fail for {@code cnbc.com};</li>
 *   <li><b>every</b> resolved address must be public (not loopback, private, link-local, any-local, multicast,
 *       CGNAT, ULA, reserved) — WebPageClient checks only the first;</li>
 *   <li>redirects are <b>never followed</b> ({@link HttpRedirects#DONT_FOLLOW}): a 30x is a failure;</li>
 *   <li>the body is read in chunks and dropped the moment it crosses the cap; explicit connect/read timeouts.</li>
 * </ul>
 * Like WebPageClient, the connection itself is not pinned to the checked address (the request factory is the
 * detected one, resolving again on connect); a DNS-rebinding race is bounded by the allow-list, which admits only
 * a few public provider domains.
 *
 * <p>Never throws for a fetch problem: the {@link FetchResult} carries the status or a short failure reason (never
 * a response body). {@code mezo.penz.allow-loopback-for-tests} (false in production) admits a loopback WireMock on
 * any port and nothing else.
 */
@Slf4j
@Component
public class PenzHttpFetcher {

    private static final Pattern NUMERIC_HOST = Pattern.compile("^[0-9.]+$|^0x[0-9a-f.x]+$");

    private final RestClient rest;
    private final PenzProperties props;

    public PenzHttpFetcher(RestClient.Builder builder, PenzProperties props) {
        this.props = props;
        HttpClientSettings settings = HttpClientSettings.defaults()
            .withRedirects(HttpRedirects.DONT_FOLLOW)
            .withTimeouts(Duration.ofMillis(props.fetchTimeoutMs()), Duration.ofMillis(props.fetchTimeoutMs()));
        this.rest = builder
            .defaultHeader(HttpHeaders.USER_AGENT, props.fetchUserAgent())
            .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .build();
    }

    /**
     * One guarded GET.
     *
     * @param allowedHosts the hosts (and their subdomains) this call may reach
     * @param maxBytes     the body cap; a longer body is a failure
     * @param accept       the Accept header
     */
    public FetchResult fetch(URI uri, Set<String> allowedHosts, long maxBytes, String accept) {
        Optional<String> refused = refusal(uri, allowedHosts, props.allowLoopbackForTests());
        if (refused.isEmpty()) {
            refused = addressRefusal(uri.getHost());
        }
        if (refused.isPresent()) {
            log.warn("penz fetch refused for host {}: {}", uri.getHost(), refused.get());
            return FetchResult.failed(0, refused.get());
        }
        try {
            return rest.get().uri(uri).header(HttpHeaders.ACCEPT, accept).exchange((request, response) -> {
                int status = response.getStatusCode().value();
                if (!response.getStatusCode().is2xxSuccessful()) {
                    return FetchResult.failed(status, "status " + status);
                }
                byte[] body = readCapped(response.getBody(), maxBytes);
                if (body == null) {
                    return FetchResult.failed(status, "body too large");
                }
                return new FetchResult(status, new String(body, charsetOf(response.getHeaders())), null);
            });
        } catch (RestClientException ex) {
            log.warn("penz fetch failed for host {}: {}", uri.getHost(), ex.getClass().getSimpleName());
            return FetchResult.failed(0, "transport " + ex.getClass().getSimpleName());
        }
    }

    /** The checks that need no DNS; empty = passes. Package-private for the unit test. */
    static Optional<String> refusal(URI uri, Set<String> allowedHosts, boolean allowLoopback) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            return Optional.of("refused: scheme");
        }
        if (uri.getRawUserInfo() != null) {
            return Optional.of("refused: userinfo");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            return Optional.of("refused: no host");
        }
        host = host.toLowerCase(Locale.ROOT);
        if (host.endsWith(".")) {
            host = host.substring(0, host.length() - 1);
        }
        if (allowLoopback && ("localhost".equals(host) || "127.0.0.1".equals(host))) {
            return Optional.empty(); // the IT WireMock — the switch is false outside tests
        }
        if (uri.getPort() != -1) {
            return Optional.of("refused: port");
        }
        if (host.startsWith("[") || host.contains(":") || NUMERIC_HOST.matcher(host).matches()) {
            return Optional.of("refused: ip literal");
        }
        if ("localhost".equals(host) || host.endsWith(".localhost")) {
            return Optional.of("refused: localhost");
        }
        for (String allowed : allowedHosts) {
            String a = allowed.toLowerCase(Locale.ROOT);
            if (host.equals(a) || host.endsWith("." + a)) {
                return Optional.empty();
            }
        }
        return Optional.of("refused: host not allowed");
    }

    private Optional<String> addressRefusal(String host) {
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress a : addresses) {
                if (!isPublic(a) && !(props.allowLoopbackForTests() && a.isLoopbackAddress())) {
                    return Optional.of("refused: private address");
                }
            }
            return Optional.empty();
        } catch (UnknownHostException ex) {
            return Optional.of("unknown host");
        }
    }

    /** True for a globally routable unicast address. Package-private for the unit test. */
    static boolean isPublic(InetAddress a) {
        if (a.isLoopbackAddress() || a.isSiteLocalAddress() || a.isLinkLocalAddress() || a.isAnyLocalAddress()
                || a.isMulticastAddress()) {
            return false;
        }
        byte[] b = a.getAddress();
        if (a instanceof Inet6Address) {
            return (b[0] & 0xfe) != 0xfc; // fc00::/7 unique-local
        }
        int b0 = b[0] & 0xff;
        int b1 = b[1] & 0xff;
        return b0 != 0                                   // 0.0.0.0/8
            && !(b0 == 100 && (b1 & 0xc0) == 64)          // 100.64.0.0/10 CGNAT
            && !(b0 == 192 && b1 == 0 && (b[2] & 0xff) == 0) // 192.0.0.0/24
            && !(b0 == 198 && (b1 & 0xfe) == 18)          // 198.18.0.0/15 benchmarking
            && b0 < 240;                                  // 240.0.0.0/4 reserved + broadcast
    }

    /** The body, or null once it crosses {@code cap} — never buffered beyond the cap. */
    private static byte[] readCapped(InputStream body, long cap) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        long total = 0;
        int read;
        while ((read = body.read(chunk)) != -1) {
            total += read;
            if (total > cap) {
                return null;
            }
            buffer.write(chunk, 0, read);
        }
        return buffer.toByteArray();
    }

    private static Charset charsetOf(HttpHeaders headers) {
        try {
            MediaType type = headers.getContentType();
            return type != null && type.getCharset() != null ? type.getCharset() : StandardCharsets.UTF_8;
        } catch (InvalidMediaTypeException ex) {
            return StandardCharsets.UTF_8;
        }
    }

    /**
     * The outcome of one fetch.
     *
     * @param status  the HTTP status, 0 when no response came (refused, unknown host, transport)
     * @param body    the body of a 2xx within the cap, else null
     * @param failure a short reason ({@code refused: …}, {@code status 404}, {@code body too large},
     *                {@code transport …}, {@code unknown host}); null on success. Never contains a body.
     */
    public record FetchResult(int status, String body, String failure) {

        static FetchResult failed(int status, String failure) {
            return new FetchResult(status, null, failure);
        }

        public boolean ok() {
            return failure == null;
        }
    }
}
