package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.TranscriptionResponse;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Voice note -> text (mezo-at8x.4): ONE multimodal call, nothing persisted — the transcript
 * goes straight back to the chat composer, which sends it as an ordinary message.
 *
 * <p>Transcribing server-side (rather than in the browser's Web Speech API) is a deliberate
 * platform call: Web Speech is absent or unreliable exactly where this app is used — iOS Safari
 * and installed PWAs — while this path works anywhere {@code MediaRecorder} does.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class TranscriptionService {

    static final String SYSTEM_PROMPT = """
        Transcribe the attached audio recording VERBATIM. Rules:
        - Output ONLY the transcript text — no quotes, no commentary, no timestamps,
          no "Here is the transcription", nothing else.
        - Keep the speaker's own language (usually Hungarian) and their wording.
        - Apply normal punctuation and capitalization.
        - If the recording contains no intelligible speech, output nothing at all.
        """;

    /** Answers longer than this are the model chatting, not transcribing — treated as unusable. */
    private static final int MAX_TRANSCRIPT_CHARS = 8_000;

    private final CompanionLlm companionLlm;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    public TranscriptionResponse transcribe(UUID userId, MultipartFile audio) {
        Clip clip = validated(audio);
        String answer = llmCallContextHolder.runWith(
            new LlmCallContext("companion", "transcribe", null, null),
            () -> companionLlm.complete(SYSTEM_PROMPT, "", new CompanionLlm.InlineAudio(clip.bytes(), clip.mime())));
        String text = normalize(answer);
        log.info("Voice note transcribed for {}: {} bytes ({}) -> {} chars",
            userId, clip.bytes().length, clip.mime(), text.length());
        return TranscriptionResponse.builder().text(text).build();
    }

    private record Clip(byte[] bytes, String mime) {}

    /** Size/mime service-level checks (message-bearing 400s; container caps are the safety net). */
    private Clip validated(MultipartFile f) {
        if (f == null || f.isEmpty() || f.getSize() > properties.transcription().maxAudioBytes()) {
            throw badAudio();
        }
        String mime = baseMime(f.getContentType());
        // MediaRecorder labels its blobs with the codec too ("audio/webm;codecs=opus") — the
        // parameters are the browser's business, so only the base type is matched.
        if (mime == null || !properties.transcription().allowedMimeTypes().contains(mime)) {
            throw badAudio();
        }
        try {
            return new Clip(f.getBytes(), mime);
        } catch (Exception e) {
            throw badAudio();
        }
    }

    private static String baseMime(String contentType) {
        if (contentType == null) {
            return null;
        }
        int semicolon = contentType.indexOf(';');
        return (semicolon < 0 ? contentType : contentType.substring(0, semicolon)).trim().toLowerCase();
    }

    /**
     * An empty answer is a legitimate outcome (silence), so it is NOT an error — the composer
     * simply stays as it was. An oversized answer means the model narrated instead of
     * transcribing; that IS unusable and gets the honest 502.
     */
    private static String normalize(String answer) {
        String text = answer == null ? "" : answer.strip();
        if (text.length() > MAX_TRANSCRIPT_CHARS) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("COMPANION_TRANSCRIBE_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
        return text;
    }

    private static SystemRuntimeErrorException badAudio() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "audio").build(), HttpStatus.BAD_REQUEST);
    }
}
