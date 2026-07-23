package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

/**
 * The pantry-photo switch OFF state (configuration_conventions.md: both switch states tested):
 * the {@code PantryPhotoController} bean disappears -> the photo path 404s; every other pantry
 * switch stays on (only the photo switch is flipped here).
 */
@TestPropertySource(properties = "mezo.feature.pantry-photo.enabled=false")
class PantryPhotoDisabledApiIT extends ApiIntegrationTest {

    @Test
    void testPhoto_shouldReturn404_whenPhotoSwitchOff() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.IMAGE_JPEG);
        var parts = new org.springframework.util.LinkedMultiValueMap<String, Object>();
        parts.add("photo", new HttpEntity<>(
                photoPart("x".getBytes(StandardCharsets.UTF_8), "label.jpg"), h));

        ResponseEntity<String> res = postMultipartForResponse("/api/pantry-import/photo", parts, String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
