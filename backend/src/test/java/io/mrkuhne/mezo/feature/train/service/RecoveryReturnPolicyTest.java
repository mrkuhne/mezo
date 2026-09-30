package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import java.time.LocalDate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class RecoveryReturnPolicyTest {

    @ParameterizedTest(name = "decide({0}, {1}) -> {2}/{3}/ramp{4}")
    @CsvSource({
        "2026-09-01, 2026-09-02, CONTINUE, 1, 1",
        "2026-09-01, 2026-09-03, CONTINUE, 2, 1",
        "2026-09-01, 2026-09-04, RESUME, 3, 2",
        "2026-09-01, 2026-09-10, RESUME, 9, 2",
        "2026-09-01, 2026-09-11, STEP_BACK, 10, 2",
    })
    void decide_returnsCorrectDecision(
        String startStr,
        String endedOnStr,
        String expectedRule,
        int expectedDaysOut,
        int expectedRampSessions
    ) {
        LocalDate start = LocalDate.parse(startStr);
        LocalDate endedOn = LocalDate.parse(endedOnStr);
        RecoveryReturnPolicy.Rule rule = RecoveryReturnPolicy.Rule.valueOf(expectedRule);

        RecoveryReturnPolicy.Decision decision = RecoveryReturnPolicy.decide(start, endedOn);

        assertThat(decision.rule()).isEqualTo(rule);
        assertThat(decision.daysOut()).isEqualTo(expectedDaysOut);
        assertThat(decision.rampSessions()).isEqualTo(expectedRampSessions);
    }

    @ParameterizedTest(name = "expectedEnd({0}, {1}) -> {2}")
    @CsvSource({
        "2026-09-01, TODAY, 2026-09-01",
        "2026-09-01, FEW_DAYS, 2026-09-03",
        "2026-09-01, WEEK, 2026-09-07",
        "2026-09-01, UNKNOWN, null",
    })
    void expectedEnd_returnsCorrectDate(String startStr, String estimateStr, String expectedStr) {
        LocalDate start = LocalDate.parse(startStr);
        RecoveryPeriodEntity.Estimate estimate =
            RecoveryPeriodEntity.Estimate.valueOf(estimateStr);

        LocalDate result = RecoveryReturnPolicy.expectedEnd(start, estimate);

        LocalDate expected = expectedStr.equals("null") ? null : LocalDate.parse(expectedStr);
        assertThat(result).isEqualTo(expected);
    }

    @ParameterizedTest(name = "shiftDays(mesoStart=09-07, today={0}, targetWeek={1}) -> {2}")
    @CsvSource({
        "2026-09-29, 3, 7",
        "2026-10-06, 3, 14",
        "2026-09-22, 4, 0",
    })
    void shiftDays_returnsCorrectShift(String todayStr, int targetWeek, int expectedDaysShift) {
        LocalDate mesoStart = LocalDate.of(2026, 9, 7); // Monday
        LocalDate today = LocalDate.parse(todayStr);

        int result = RecoveryReturnPolicy.shiftDays(mesoStart, today, targetWeek);

        assertThat(result).isEqualTo(expectedDaysShift);
    }

    @ParameterizedTest(name = "targetWeek({0}, {1}) -> {2}")
    @CsvSource({
        "CONTINUE, 1, -1",
        "CONTINUE, 4, -1",
        "RESUME, 1, 1",
        "RESUME, 3, 3",
        "RESUME, 4, 4",
        "STEP_BACK, 1, 1",
        "STEP_BACK, 2, 1",
        "STEP_BACK, 4, 3",
    })
    void targetWeek_returnsCorrectWeek(String ruleStr, int weekAtStart, int expectedTargetWeek) {
        RecoveryReturnPolicy.Rule rule = RecoveryReturnPolicy.Rule.valueOf(ruleStr);

        int result = RecoveryReturnPolicy.targetWeek(rule, weekAtStart);

        assertThat(result).isEqualTo(expectedTargetWeek);
    }
}
