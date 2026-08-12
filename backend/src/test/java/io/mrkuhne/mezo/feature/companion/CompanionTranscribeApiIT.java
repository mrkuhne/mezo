package io.mrkuhne.mezo.feature.companion;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.TranscriptionResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;

/** Voice note -> transcript through the generated CompanionVoiceApi, against the fake LLM (mezo-at8x.4). */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.transcription.max-audio-bytes=10000")
class CompanionTranscribeApiIT extends ApiIntegrationTest {

    private static final String PATH = "/api/companion/transcribe";

    private static HttpEntity<org.springframework.core.io.ByteArrayResource> audioPart(String content, String mime) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.parseMediaType(mime));
        return new HttpEntity<>(photoPart(content.getBytes(UTF_8), "note.wav"), h);
    }

    private static LinkedMultiValueMap<String, Object> parts(String content, String mime) {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("audio", audioPart(content, mime));
        return parts;
    }

    @Test
    void testTranscribe_shouldReturnTheTranscript_whenAudioCarriesSentinel() {
        ResponseEntity<TranscriptionResponse> res = postMultipartForResponse(
            PATH, parts("[fake-transcript:Ma reggel 7 órát aludtam.]", "audio/wav"),
            TranscriptionResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().getText()).isEqualTo("Ma reggel 7 órát aludtam.");
    }

    /** MediaRecorder labels its blobs "audio/webm;codecs=opus" — the parameters must not matter. */
    @Test
    void testTranscribe_shouldAcceptTheMime_whenCodecParameterIsPresent() {
        ResponseEntity<TranscriptionResponse> res = postMultipartForResponse(
            PATH, parts("[fake-transcript:Fáradt vagyok.]", "audio/webm;codecs=opus"),
            TranscriptionResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getText()).isEqualTo("Fáradt vagyok.");
    }

    /** Silence is a legitimate outcome, not an error — the composer simply stays as it was. */
    @Test
    void testTranscribe_shouldReturnEmptyText_whenTheClipCarriesNoSpeech() {
        ResponseEntity<TranscriptionResponse> res = postMultipartForResponse(
            PATH, parts("[fake-transcript:]", "audio/wav"), TranscriptionResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getText()).isEmpty();
    }

    @Test
    void testTranscribe_shouldReturn400_whenAudioOversized() {
        ResponseEntity<String> res = postMultipartForResponse(
            PATH, parts("x".repeat(10001), "audio/wav"), String.class); // cap lowered above

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "audio", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testTranscribe_shouldReturn400_whenMimeUnsupported() {
        ResponseEntity<String> res = postMultipartForResponse(
            PATH, parts("not audio", "image/png"), String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "audio", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testTranscribe_shouldReturn400_whenAudioMissing() {
        ResponseEntity<String> res =
            postMultipartForResponse(PATH, new LinkedMultiValueMap<>(), String.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
