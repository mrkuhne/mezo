package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrend;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrendCalculator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class PersonAffectTrendCalculatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 2);   // szerda
    private final PersonAffectTrendCalculator calculator = new PersonAffectTrendCalculator();

    private static MentionEntity mention(LocalDate day, String tone, Integer intensity) {
        MentionEntity m = new MentionEntity();
        m.setTs(day.atStartOfDay().toInstant(ZoneOffset.UTC));
        m.setTone(tone);
        m.setIntensity(intensity == null ? null : intensity.shortValue());
        return m;
    }

    @Test
    void calculate_shouldReturnEmpty_whenNoTonedMention() {
        assertThat(calculator.calculate(List.of(mention(TODAY, null, null)), TODAY))
            .isEqualTo(PersonAffectTrend.EMPTY);
    }

    @Test
    void calculate_shouldScorePositiveHigh_andNegativeLow() {
        PersonAffectTrend up = calculator.calculate(List.of(mention(TODAY, "positive", 3)), TODAY);
        PersonAffectTrend down = calculator.calculate(List.of(mention(TODAY, "negative", 3)), TODAY);
        assertThat(up.readings()).containsExactly(5);
        assertThat(down.readings()).containsExactly(1);
    }

    @Test
    void calculate_shouldDefaultIntensity_whenNull() {
        // hiányzó intenzitás = 2 (a skála közepe), tehát pozitív -> 3 + 2*(2/3) ≈ 4
        assertThat(calculator.calculate(List.of(mention(TODAY, "positive", null)), TODAY).readings())
            .containsExactly(4);
    }

    @Test
    void calculate_shouldBucketByWeek_oldestFirst_andSkipEmptyWeeks() {
        List<MentionEntity> mentions = List.of(
            mention(TODAY.minusWeeks(3), "negative", 2),
            mention(TODAY, "positive", 2));           // a köztes két hét üres
        PersonAffectTrend trend = calculator.calculate(mentions, TODAY);
        assertThat(trend.readings()).hasSize(2);      // az üres hetek NEM kapnak kitalált pontot
        assertThat(trend.readings().getFirst()).isLessThan(trend.readings().getLast());
        assertThat(trend.startWeek()).isEqualTo(LocalDate.of(2026, 8, 10));   // 3 héttel korábbi hétfő
    }

    @Test
    void calculate_shouldCapAtEightReadings_keepingTheNewest() {
        List<MentionEntity> mentions = new java.util.ArrayList<>();
        for (int w = 11; w >= 0; w--) {
            mentions.add(mention(TODAY.minusWeeks(w), "neutral", 2));
        }
        PersonAffectTrend trend = calculator.calculate(mentions, TODAY);
        assertThat(trend.readings()).hasSize(8);
        // 12 különálló hét (w=11..0); a legújabb 8 megtartása a 4 legrégebbit (w=11..8) dobja,
        // a legrégebbi megtartott a w=7 hete -> TODAY.minusWeeks(7) hétfője.
        assertThat(trend.startWeek()).isEqualTo(LocalDate.of(2026, 7, 13));
    }

    @Test
    void calculate_shouldReportDown_withHungarianReason() {
        List<MentionEntity> mentions = List.of(
            mention(TODAY.minusWeeks(3), "positive", 3),
            mention(TODAY.minusWeeks(2), "positive", 3),
            mention(TODAY.minusWeeks(1), "negative", 3),
            mention(TODAY, "negative", 3));
        PersonAffectTrend trend = calculator.calculate(mentions, TODAY);
        assertThat(trend.direction()).isEqualTo(PersonAffectTrend.DIRECTION_DOWN);
        assertThat(trend.reason()).isEqualTo("többször nehéz tónus, mint korábban");
    }

    @Test
    void calculate_shouldReportFlat_whenTooFewReadings() {
        List<MentionEntity> mentions = List.of(
            mention(TODAY.minusWeeks(1), "positive", 3),
            mention(TODAY, "negative", 3));
        assertThat(calculator.calculate(mentions, TODAY).direction())
            .isEqualTo(PersonAffectTrend.DIRECTION_FLAT);
    }
}
