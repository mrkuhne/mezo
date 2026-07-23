package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.api.dto.SleepShotDraftResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepShotProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Extracted;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotDraftValidator.Score;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

/**
 * Sleep Cycle screenshot -> draft (mezo-66ab, spec D5/D6): ONE multimodal call, deterministic
 * confidence, nothing persisted — the FE confirms via the normal POST /api/biometrics/sleep.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLEEP_SHOT_SWITCH, havingValue = "true")
public class SleepShotService {

    private static final String SYSTEM_PROMPT = """
        You read a screenshot of the Sleep Cycle app. Return ONLY a JSON object, no prose:
        {"bedtime":"H:mm or HH:mm 24h from 'Went to bed'","wakeup":"from 'Woke up'",
        "asleepMin":total asleep minutes from 'Asleep' (e.g. 7h 29m -> 449),
        "inBedMin":total minutes from 'In bed',"awakeMin":minutes from the 'Awake' stage,
        "lightMin":minutes from 'Light',"remMin":minutes from 'Dream' (Dream IS REM),
        "deepMin":minutes from 'Deep',"qualityPct":the 0-100 'Sleep quality' number}
        Use null for anything not visible on the screenshot. Numbers as integers.
        """;

    private final ObjectProvider<SleepShotLlm> llm;
    private final SleepShotDraftValidator validator;
    private final SleepShotProperties props;
    private final ObjectMapper objectMapper;

    public SleepShotDraftResponse extract(UUID userId, MultipartFile photo) {
        Photo p = validated(photo);
        String answer = requireAvailable().complete(SYSTEM_PROMPT, "", p.bytes(), p.mime());
        Extracted e = normalize(parse(answer));
        Score score = validator.score(e, props.confidenceThreshold());
        log.info("Sleep screenshot draft for {}: confidence={} needsReview={}",
            userId, score.confidence(), score.needsReview());
        return SleepShotDraftResponse.builder()
            .bedtime(e.bedtime())
            .wakeup(e.wakeup())
            .durationH(e.asleepMin() == null ? null
                : BigDecimal.valueOf(e.asleepMin()).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP))
            .inBedMin(e.inBedMin())
            .awakeMin(e.awakeMin())
            .lightMin(e.lightMin())
            .remMin(e.remMin())
            .deepMin(e.deepMin())
            .sourceQualityPct(e.qualityPct())
            .confidence(score.confidence())
            .needsReview(score.needsReview())
            .build();
    }

    private record Photo(byte[] bytes, String mime) {}

    /** Size/mime service-level checks (message-bearing 400s; container caps are the safety net). */
    private Photo validated(MultipartFile f) {
        if (f == null || f.isEmpty()) {
            throw badPhoto();
        }
        if (f.getSize() > props.maxPhotoBytes()) {
            throw badPhoto();
        }
        String mime = f.getContentType();
        if (mime == null || !props.allowedMimeTypes().contains(mime)) {
            throw badPhoto();
        }
        try {
            return new Photo(f.getBytes(), mime);
        } catch (Exception e) {
            throw badPhoto();
        }
    }

    private static SystemRuntimeErrorException badPhoto() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
    }

    private SleepShotLlm requireAvailable() {
        SleepShotLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("SLEEP_SHOT_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    /** Same brace-window parse as the meal/pantry pipelines, with sleep-owned 502 semantics. */
    private Extracted parse(String answer) {
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return objectMapper.readValue(json, Extracted.class);
        } catch (Exception e) {
            log.warn("Sleep screenshot extraction unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                SystemMessage.error("SLEEP_SHOT_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }

    /** Zero-pad clock times (Sleep Cycle renders '0:42'); leave everything else as extracted. */
    private static Extracted normalize(Extracted e) {
        return new Extracted(pad(e.bedtime()), pad(e.wakeup()), e.asleepMin(), e.inBedMin(),
            e.awakeMin(), e.lightMin(), e.remMin(), e.deepMin(), e.qualityPct());
    }

    private static String pad(String hhmm) {
        if (hhmm == null) {
            return null;
        }
        String t = hhmm.strip();
        return t.matches("\\d:\\d{2}") ? "0" + t : t;
    }
}
