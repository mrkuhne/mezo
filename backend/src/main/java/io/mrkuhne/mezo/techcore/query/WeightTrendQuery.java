package io.mrkuhne.mezo.techcore.query;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** Read-only cross-feature query seam for the owner's derived weight trend. */
public interface WeightTrendQuery {

    WeightTrendResponse computeTrend(UUID userId);

    /**
     * Rögzített-e a felhasználó mérlegelést erre a napra? A napi értékelés state-döntéséhez kell
     * (mezo-jcpt.8): a {@code DayInputs} nem hordoz súlyt, ezért egy olyan nap, amelynek EGYETLEN
     * rekordja egy mérlegelés, {@code empty}-t kapott, miközben a FE {@code thin}-t vezet le
     * ugyanarra. A jel ezen a seamen jön be, hogy a {@code DayInputs} — és a motor 27 rögzített
     * unit-tesztje — érintetlen maradjon.
     */
    boolean hasEntryOn(UUID userId, LocalDate date);

    /**
     * The owner's weigh-ins inside {@code [from, to]}, same-day entries averaged (the trend's own
     * daily collapse), date-ascending; a day without a weigh-in is absent. The learned-expenditure
     * filter's scale observations (mezo-zz91i) — read through this seam so the goal slice gains no
     * new edge into biometrics (the frozen biometrics↔goal cycle, mezo-ah18.15).
     */
    Map<LocalDate, BigDecimal> dailyMeanWeightKg(UUID userId, LocalDate from, LocalDate to);
}
