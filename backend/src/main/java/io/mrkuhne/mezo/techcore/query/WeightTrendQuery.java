package io.mrkuhne.mezo.techcore.query;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import java.time.LocalDate;
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
}
