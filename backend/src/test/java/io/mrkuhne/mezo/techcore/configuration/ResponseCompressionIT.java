package io.mrkuhne.mezo.techcore.configuration;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;

/**
 * Pins {@code server.compression} (mezo-l5lvh): a large JSON answer is gzipped for a client that
 * asks for it, and left alone for one that does not. Uses the JDK client directly because it
 * never decompresses transparently, so the wire encoding stays observable.
 */
class ResponseCompressionIT extends ApiIntegrationTest {

    private static final String LARGE_JSON_URI = "/api/train/exercises";

    @LocalServerPort private int port;

    @Test
    void testLargeJson_shouldBeGzipped_whenClientAcceptsGzip() throws Exception {
        HttpResponse<byte[]> plain = get(null);
        HttpResponse<byte[]> gzipped = get("gzip");

        assertThat(plain.statusCode()).isEqualTo(200);
        assertThat(plain.headers().firstValue(HttpHeaders.CONTENT_ENCODING)).isEmpty();
        assertThat(plain.body().length)
            .withFailMessage("fixture endpoint must exceed the 2 KB compression floor")
            .isGreaterThan(2048);

        assertThat(gzipped.statusCode()).isEqualTo(200);
        assertThat(gzipped.headers().firstValue(HttpHeaders.CONTENT_ENCODING)).contains("gzip");
        assertThat(gzipped.body().length).isLessThan(plain.body().length);
    }

    private HttpResponse<byte[]> get(String acceptEncoding) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + LARGE_JSON_URI))
            .header(HttpHeaders.AUTHORIZATION, ownerAuthHeaders().getFirst(HttpHeaders.AUTHORIZATION));
        if (acceptEncoding != null) {
            request.header(HttpHeaders.ACCEPT_ENCODING, acceptEncoding);
        }
        return HttpClient.newHttpClient().send(request.build(), HttpResponse.BodyHandlers.ofByteArray());
    }
}
