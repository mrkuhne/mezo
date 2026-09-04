package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MeWeekDay;
import io.mrkuhne.mezo.api.dto.MeWeekSubscores;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * B3 (mezo-8tp8): {@code renderDayLine} is the SINGLE formatter shared by {@code
 * WeeklyReviewGenerator}'s LLM gather payload and {@code WeekContextRenderer}'s {@code [Heti
 * adatok]} block — the branch's most load-bearing seam. Both existing call sites only assert
 * substrings of the rendered line; these two cases pin the EXACT string for a fully-populated day
 * and a fully-sparse day, so a format change (a reordered field, a renamed label, a dropped
 * separator) fails loudly here instead of silently drifting the LLM payload.
 */
class MeWeekServiceRenderDayLineTest {

    @Test
    void fullyPopulatedDayRendersTheExactLine() {
        MeWeekDay day = MeWeekDay.builder()
                .date(LocalDate.of(2026, 6, 15)) // Monday -> "H"
                .score(87)
                .subscores(new MeWeekSubscores().sleep(90).nutrition(80).logging(70).training(95))
                .kcal(BigDecimal.valueOf(2500))
                .kcalTarget(BigDecimal.valueOf(2600))
                .proteinG(BigDecimal.valueOf(180))
                .weightKg(BigDecimal.valueOf(82.5))
                .sleepMin(125)
                .sleepQuality(BigDecimal.valueOf(8.5))
                .checkinCount(3)
                .workoutCount(1)
                .xp(1200)
                .build();

        String line = MeWeekService.renderDayLine(day);

        assertThat(line).isEqualTo("- 2026-06-15 (H): score 87 [alvás 90 · fuel 80 · checkin 70 · aktivitás 95], "
                + "2500 kcal / cél 2600, fehérje 180g, súly 82.5, alvás 2ó5p (8.5), "
                + "3 check-in, 1 edzés, 1200 XP");
    }

    @Test
    void sparseDayRendersAllNullsAsTheDashPlaceholder() {
        MeWeekDay day = MeWeekDay.builder()
                .date(LocalDate.of(2026, 6, 16)) // Tuesday -> "K"
                .build();

        String line = MeWeekService.renderDayLine(day);

        assertThat(line).isEqualTo("- 2026-06-16 (K): score – [alvás – · fuel – · checkin – · aktivitás –], "
                + "– kcal / cél –, fehérje –g, súly –, alvás –, "
                + "0 check-in, 0 edzés, – XP");
    }
}
