package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import tools.jackson.databind.JsonNode;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * The exercise demo images are served by the backend (mezo-r36n9.97.1) at {@code /exercises/<file>},
 * publicly (the iPhone app loads them without an auth header), as long-cached JPEGs.
 */
class ExerciseImagesIT extends ApiIntegrationTest {

    @Test
    void testGetImage_shouldReturnJpeg_whenUnauthenticated() {
        ResponseEntity<byte[]> res = rest.exchange("/exercises/barbell-row-a.jpg", HttpMethod.GET, null, byte[].class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_JPEG);
        assertThat(res.getBody()).isNotEmpty();
        assertThat(res.getHeaders().getCacheControl()).contains("max-age=604800");
    }

    @Test
    void testCatalog_shouldResolveEveryImagePath_whenLoadedFromContent() throws Exception {
        JsonNode catalog;
        try (InputStream in = new ClassPathResource("content/exercise-catalog.json").getInputStream()) {
            catalog = objectMapper.readTree(in);
        }
        List<String> paths = new ArrayList<>();
        for (JsonNode row : catalog) {
            for (String field : List.of("imageStartUrl", "imageEndUrl")) {
                if (row.hasNonNull(field)) {
                    paths.add(row.get(field).asText());
                }
            }
        }

        assertThat(paths).hasSize(248);
        assertThat(paths).allSatisfy(p ->
            assertThat(new ClassPathResource("static" + p).exists()).as(p).isTrue());
    }

    @Test
    void testUnknownImage_shouldReturn404_whenMissing() {
        ResponseEntity<String> res = rest.exchange("/exercises/nope-a.jpg", HttpMethod.GET, null, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
