package io.mrkuhne.mezo.feature.llmlog.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties.Budget;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * The USD cap's config contract (mezo-ozri.6).
 *
 * <p>The three thresholds only mean anything ASCENDING: a config that degrades at 90 and stops at 70
 * jumps straight to the pause, and the "cheaper model" step it advertises is unreachable. Jakarta's
 * per-field annotations cannot express a cross-field ordering, so this is an {@code @AssertTrue} —
 * and this test is what makes it fail at BOOT rather than surfacing months later as an account that
 * mysteriously never got the gentle steps.
 */
class LlmBudgetPropertiesTest {

    private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
    private final Validator validator = FACTORY.getValidator();

    private static Budget budget(int degrade, int throttle, int stop) {
        return new Budget(true, new BigDecimal("5.00"), 30, degrade, throttle, stop, Set.of(), Set.of());
    }

    @Test
    void testValidate_shouldAccept_whenTheThresholdsAscend() {
        assertThat(validator.validate(budget(70, 90, 100))).isEmpty();
    }

    @Test
    void testValidate_shouldReject_whenDegradeIsNotBelowThrottle() {
        assertThat(validator.validate(budget(95, 90, 100))).isNotEmpty();
    }

    @Test
    void testValidate_shouldReject_whenThrottleIsNotBelowStop() {
        assertThat(validator.validate(budget(70, 100, 100))).isNotEmpty();
    }

    /**
     * The binder hands a record component null both for an omitted key and for an explicitly empty
     * one, and shipping with no override lists is the normal state — so null must become empty here,
     * not an NPE on the pre-flight path of every LLM call.
     */
    @Test
    void testConstruct_shouldDefaultTheListsToEmpty_whenTheYamlOmitsThem() {
        Budget budget = new Budget(true, new BigDecimal("5.00"), 30, 70, 90, 100, null, null);

        assertThat(budget.throttledFeatures()).isEmpty();
        assertThat(budget.exemptFeatures()).isEmpty();
    }
}
