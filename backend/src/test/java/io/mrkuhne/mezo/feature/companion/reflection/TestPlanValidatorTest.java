package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.DerivedSeriesService;
import io.mrkuhne.mezo.feature.companion.reflection.service.TestPlanValidator;
import io.mrkuhne.mezo.feature.companion.reflection.service.TestPlanValidator.RawTestPlan;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Reflexió S3 (mezo-eq85.3): the "Gemini phrases, code decides" gate on the LLM's proposed test
 * plan. Plain JUnit — {@link DerivedSeriesService} is a hand-written stub with a fixed key set, so
 * the whole contract (unknown key dropped, self-pair dropped, lag clamped, direction defaulted,
 * gates from config not from the model) is pinned without a Spring context.
 */
class TestPlanValidatorTest {

    private static final UUID OWNER = UUID.randomUUID();
    private static final Set<String> KNOWN = Set.of("people:anna", "sleep-duration-h", "text-mood");

    private final TestPlanValidator validator = new TestPlanValidator(knownKeys(KNOWN), properties());

    @Test
    void testValidate_shouldAcceptKnownKeysAndFillGateDefaults_whenPlanIsUsable() {
        Optional<TestPlanEnvelope> plan = validator.validate(
                OWNER, new RawTestPlan("people:anna", "sleep-duration-h", 1, "positive"));

        assertThat(plan).hasValueSatisfying(envelope -> {
            assertThat(envelope.seriesA()).isEqualTo("people:anna");
            assertThat(envelope.seriesB()).isEqualTo("sleep-duration-h");
            assertThat(envelope.lagDays()).isEqualTo(1);
            assertThat(envelope.expectedDirection()).isEqualTo(TestPlanEnvelope.DIRECTION_POSITIVE);
            assertThat(envelope.minN()).isEqualTo(8);
            assertThat(envelope.minGroupN()).isEqualTo(3);
            assertThat(envelope.windowDays()).isEqualTo(60);
        });
    }

    @Test
    void testValidate_shouldReject_whenASeriesIsUnknown() {
        assertThat(validator.validate(OWNER,
                new RawTestPlan("nincs-ilyen", "sleep-duration-h", 1, "positive"))).isEmpty();
        assertThat(validator.validate(OWNER,
                new RawTestPlan("people:anna", "nincs-ilyen", 1, "positive"))).isEmpty();
    }

    @Test
    void testValidate_shouldReject_whenBothSidesAreTheSameSeries() {
        assertThat(validator.validate(OWNER,
                new RawTestPlan("people:anna", "People:Anna", 1, "positive"))).isEmpty();
    }

    @Test
    void testValidate_shouldReject_whenPlanIsNullOrKeysAreBlank() {
        assertThat(validator.validate(OWNER, null)).isEmpty();
        assertThat(validator.validate(OWNER,
                new RawTestPlan("  ", "sleep-duration-h", 1, "positive"))).isEmpty();
        assertThat(validator.validate(OWNER,
                new RawTestPlan("people:anna", null, 1, "positive"))).isEmpty();
    }

    @Test
    void testValidate_shouldClampLagToZeroThreeAndDefaultDirectionToPositive() {
        assertThat(validator.validate(OWNER,
                new RawTestPlan("people:anna", "sleep-duration-h", 9, null)))
                .hasValueSatisfying(plan -> {
                    assertThat(plan.lagDays()).isEqualTo(3);
                    assertThat(plan.expectedDirection()).isEqualTo(TestPlanEnvelope.DIRECTION_POSITIVE);
                });
        assertThat(validator.validate(OWNER,
                new RawTestPlan("people:anna", "sleep-duration-h", -4, "csökken")))
                .hasValueSatisfying(plan -> {
                    assertThat(plan.lagDays()).isZero();
                    assertThat(plan.expectedDirection()).isEqualTo(TestPlanEnvelope.DIRECTION_POSITIVE);
                });
        assertThat(validator.validate(OWNER,
                new RawTestPlan("people:anna", "sleep-duration-h", null, "NEGATIVE")))
                .hasValueSatisfying(plan -> {
                    assertThat(plan.lagDays()).isZero();
                    assertThat(plan.expectedDirection()).isEqualTo(TestPlanEnvelope.DIRECTION_NEGATIVE);
                });
    }

    @Test
    void testAvailableSeries_shouldListWhatTheUserActuallyHas() {
        assertThat(validator.availableSeries(OWNER)).containsExactlyInAnyOrderElementsOf(KNOWN);
    }

    private static DerivedSeriesService knownKeys(Set<String> keys) {
        return new DerivedSeriesService(null, null) {
            @Override
            public boolean isKnown(UUID userId, String key) {
                return keys.contains(key);
            }

            @Override
            public List<String> availableSeries(UUID userId) {
                return List.copyOf(keys);
            }

            @Override
            public Map<LocalDate, Double> series(UUID userId, String key, LocalDate from, LocalDate to) {
                return Map.of();
            }
        };
    }

    /** Only {@code patterns} matters here; the rest is null on purpose (the
     *  {@code GeminiEmbeddingAdapterRecordingTest} precedent for this heavy record). */
    private static CompanionProperties properties() {
        return new CompanionProperties(null, null, null, null, null, null, null, null, null, null,
                null,
                new CompanionProperties.Patterns("0 40 2 * * *", 60, 8, 3, 7, 100, List.of()),
                null, null, null, null, null, null, List.of());
    }
}
