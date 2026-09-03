package io.mrkuhne.mezo.feature.companion.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/**
 * Daily evaluation (mezo-jcpt.4) — the 6-dimension day-score engine's tuning knobs bind from
 * yml, and a mis-tuned weight vector (dimension weights must sum to 1.0) fails loudly at boot
 * rather than silently mis-scoring every day.
 */
class DayEvaluationPropertiesTest {

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(DayEvaluationProperties.class)
    static class TestConfig {
    }

    private final ApplicationContextRunner contextRunner =
            new ApplicationContextRunner().withUserConfiguration(TestConfig.class);

    private static final String[] VALID_PROPS = {
        "mezo.companion.day-evaluation.weights.nutrition=0.30",
        "mezo.companion.day-evaluation.weights.quality=0.15",
        "mezo.companion.day-evaluation.weights.training=0.20",
        "mezo.companion.day-evaluation.weights.sleep=0.15",
        "mezo.companion.day-evaluation.weights.logging=0.10",
        "mezo.companion.day-evaluation.weights.rhythm=0.10",
        "mezo.companion.day-evaluation.nutrition.kcal-under-band=0.10",
        "mezo.companion.day-evaluation.nutrition.kcal-over-band=0.05",
        "mezo.companion.day-evaluation.nutrition.kcal-slope=3.0",
        "mezo.companion.day-evaluation.nutrition.protein-under-band=0.05",
        "mezo.companion.day-evaluation.nutrition.protein-slope=2.5",
        "mezo.companion.day-evaluation.nutrition.carb-fat-band=0.15",
        "mezo.companion.day-evaluation.nutrition.carb-fat-slope=1.5",
        "mezo.companion.day-evaluation.workout-day-kcal-widen=150",
        "mezo.companion.day-evaluation.sleep-target-h=7.5",
        "mezo.companion.day-evaluation.rhythm-window-days=7",
        "mezo.companion.day-evaluation.rhythm-min-days=3",
        "mezo.companion.day-evaluation.log-timely-min=120"
    };

    @Test
    void testBinding_shouldBindTheDefaultWeightVector_whenYmlIsValid() {
        contextRunner.withPropertyValues(VALID_PROPS).run(context -> {
            assertThat(context).hasNotFailed();
            DayEvaluationProperties properties = context.getBean(DayEvaluationProperties.class);

            assertThat(properties.weights().nutrition()).isEqualTo(0.30);
            assertThat(properties.weights().quality()).isEqualTo(0.15);
            assertThat(properties.weights().training()).isEqualTo(0.20);
            assertThat(properties.weights().sleep()).isEqualTo(0.15);
            assertThat(properties.weights().logging()).isEqualTo(0.10);
            assertThat(properties.weights().rhythm()).isEqualTo(0.10);
            assertThat(properties.nutrition().kcalUnderBand()).isEqualTo(0.10);
            assertThat(properties.nutrition().kcalOverBand()).isEqualTo(0.05);
            assertThat(properties.nutrition().kcalSlope()).isEqualTo(3.0);
            assertThat(properties.nutrition().proteinUnderBand()).isEqualTo(0.05);
            assertThat(properties.nutrition().proteinSlope()).isEqualTo(2.5);
            assertThat(properties.nutrition().carbFatBand()).isEqualTo(0.15);
            assertThat(properties.nutrition().carbFatSlope()).isEqualTo(1.5);
            assertThat(properties.workoutDayKcalWiden()).isEqualTo(150);
            assertThat(properties.sleepTargetH()).isEqualTo(7.5);
            assertThat(properties.rhythmWindowDays()).isEqualTo(7);
            assertThat(properties.rhythmMinDays()).isEqualTo(3);
            assertThat(properties.logTimelyMin()).isEqualTo(120);
        });
    }

    @Test
    void testBinding_shouldFailStartup_whenWeightsDoNotSumToOne() {
        // 0.30 + 0.15 + 0.20 + 0.15 + 0.10 + 0.00 = 0.90 — a silently-mistuned weight vector would
        // otherwise mis-score every day forever; it must fail loudly at boot instead.
        contextRunner.withPropertyValues(VALID_PROPS)
                .withPropertyValues("mezo.companion.day-evaluation.weights.rhythm=0.00")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(BindValidationException.class);
                });
    }
}
