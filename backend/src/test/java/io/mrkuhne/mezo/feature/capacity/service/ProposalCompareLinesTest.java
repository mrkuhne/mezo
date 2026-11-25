package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** K3 final review finding 5: a kcal figure never breaks from its unit at the end of a line. Figures are invented. */
class ProposalCompareLinesTest {

    @Test
    void kcalUnitIsJoinedByANoBreakSpace() {
        LocalDate thursday = LocalDate.of(2026, 11, 26);
        Effects e = new Effects(
            List.of(new Effects.DayEffect(thursday, "szoros", "rendben", 0.95, 0.7, 1250, 0)),
            List.of(), null, new Effects.WeekTotals(1, 17920, null), new Effects.WeekTotals(1, 17920, null), null,
            null);

        var extra = ProposalCompareLines.lines(e).stream()
            .filter(l -> l.label().endsWith("edzésnapi többlet")).findFirst().orElseThrow();

        assertThat(extra.before()).isEqualTo("1 250 kcal");
        assertThat(extra.after()).isEqualTo("0 kcal");
    }
}
