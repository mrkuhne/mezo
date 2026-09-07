package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Reflexió S3 (bd mezo-eq85.3, spec 2026-09-06 §4.2): the gate between what the model PROPOSED and
 * what the engine will actually TEST. "Gemini phrases, code decides" lives here — the model may
 * name two series, a lag and a direction; everything that decides whether the resulting hypothesis
 * can ever be confirmed (the sample-size gates, the window) comes from
 * {@code mezo.companion.patterns}, never from the answer.
 *
 * <p>A plan survives only when BOTH series are real for THIS user ({@link
 * DerivedSeriesService#isKnown}) and are not the same series — a hypothesis about a person the user
 * never wrote about, or about a series correlated with itself, is not falsifiable, it is noise.
 * Anything else is dropped silently: an unusable plan means the proposal degrades to a qualitative
 * {@code ai_hypothesis}, never a broken nightly run.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class TestPlanValidator {

    /** The largest lag the nightly evaluation will ever test — beyond it the alignment is noise. */
    private static final int MAX_LAG_DAYS = 3;

    private final DerivedSeriesService derivedSeriesService;
    private final CompanionProperties properties;

    /** The test plan exactly as the LLM proposed it — every field is suspect until validated. */
    public record RawTestPlan(String seriesA, String seriesB, Integer lagDays, String expectedDirection) {
    }

    /** A validated, gate-filled plan, or empty when the proposal cannot be tested. */
    public Optional<TestPlanEnvelope> validate(UUID userId, RawTestPlan raw) {
        if (raw == null || isBlank(raw.seriesA()) || isBlank(raw.seriesB())) {
            return Optional.empty();
        }
        String seriesA = raw.seriesA().trim();
        String seriesB = raw.seriesB().trim();
        if (seriesA.equalsIgnoreCase(seriesB)) {
            log.debug("Test plan names the same series on both sides ({}) — not falsifiable", seriesA);
            return Optional.empty();
        }
        if (!derivedSeriesService.isKnown(userId, seriesA) || !derivedSeriesService.isKnown(userId, seriesB)) {
            log.debug("Test plan names a series unknown for user {} ({} / {}) — dropped",
                    userId, seriesA, seriesB);
            return Optional.empty();
        }
        CompanionProperties.Patterns gates = properties.patterns();
        return Optional.of(new TestPlanEnvelope(seriesA, seriesB, lag(raw.lagDays()),
                direction(raw.expectedDirection()), gates.minN(), gates.minGroupN(),
                gates.lookbackDays()));
    }

    /** The series menu the proposal prompt may offer — see {@link DerivedSeriesService#availableSeries}. */
    public List<String> availableSeries(UUID userId) {
        return derivedSeriesService.availableSeries(userId);
    }

    private static int lag(Integer lagDays) {
        return lagDays == null ? 0 : Math.clamp(lagDays, 0, MAX_LAG_DAYS);
    }

    /** Negative only when the model said so in as many words; anything else predicts "together up". */
    private static String direction(String expectedDirection) {
        return expectedDirection != null
                && TestPlanEnvelope.DIRECTION_NEGATIVE.equals(expectedDirection.trim().toLowerCase(Locale.ROOT))
                ? TestPlanEnvelope.DIRECTION_NEGATIVE
                : TestPlanEnvelope.DIRECTION_POSITIVE;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
