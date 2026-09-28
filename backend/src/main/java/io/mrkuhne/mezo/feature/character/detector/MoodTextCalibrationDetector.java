package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Mood × text calibration (Check-in 2.0, mezo-ck2, spec §3.7) — do you write the way you rate?
 * Pairs the day's check-in {@code mood} mean (1..10) with the day's text mood read off the journal
 * / chat by the reflection extractor ({@code text_signal.mood}, newest version, {@code sure} only,
 * on its own 1..5 scale), rescaled linearly onto 1..10: {@code 1 + (v - 1) * 9 / 4}.
 *
 * <p>A day AGREES when the two sit within {@link #AGREE_WITHIN} points. Over the 8-week series,
 * with at least {@link #MIN_PAIRED_DAYS} paired days, the state is the agreement band
 * ({@code egyezik} ≥ {@link #AGREE_HIGH}, {@code eltér} < {@link #AGREE_LOW}, else {@code részben})
 * plus a direction when the mean gap is at least {@link #DIRECTION_GAP} ("the check-in rates
 * higher/lower than the text reads"). It is a mirror about two self-reports, never a verdict on
 * which one is "true" — the wording says so.
 *
 * <p>State-change gate: the band or direction must change for the signal to fire again.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class MoodTextCalibrationDetector implements CharacterDetector {

    static final int MIN_PAIRED_DAYS = 8;
    static final double AGREE_WITHIN = 2.0;
    static final double AGREE_HIGH = 0.7;
    static final double AGREE_LOW = 0.4;
    static final double DIRECTION_GAP = 1.5;

    @Override
    public String key() {
        return "mood-text-calibration";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        StringBuilder sb = new StringBuilder("Az elmúlt 8 hét ").append(today.paired())
                .append(" olyan napján, amikor hangulatot is jelöltél a check-inben, és a naplódból vagy a beszélgetéseidből is kiolvasható volt a hangulat, ")
                .append(today.agreeing()).append(" napon (").append(TrailingWindow.pct(today.rate()))
                .append("%) egyezett a kettő (2 ponton belül; a szöveg 1–5-ös skáláját 1–10-re átszámolva) — ")
                .append(switch (today.band()) {
                    case "egyezik" -> "úgy írsz, ahogy értékelsz.";
                    case "elter" -> "a kettő többnyire máshol áll.";
                    default -> "részben egyezik.";
                });
        if (today.direction() != null) {
            sb.append(" Átlagosan ").append(TrailingWindow.hu(BigDecimal.valueOf(Math.abs(today.meanGap())), 1))
                    .append(" ponttal ").append("fel".equals(today.direction()) ? "magasabbra" : "alacsonyabbra")
                    .append(" értékeled a hangulatod a check-inben, mint amit a szöveged mutat.");
        }
        sb.append(" Két önjelentés tükre, nem ítélet arról, melyik az igaz.");
        int salience = "elter".equals(today.band()) ? 4 : 3;
        return List.of(new DetectorSignal(key(), "pszichologus", sb.toString(), salience));
    }

    record State(String key, String band, String direction, int paired, int agreeing, double rate,
                 double meanGap) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, Double> text = new HashMap<>();
        for (DetectorInput.TextMoodPoint t : in.trend().textMoods()) {
            if (!t.date().isAfter(asOf) && t.mood() != null) {
                text.put(t.date(), rescale(t.mood().doubleValue()));
            }
        }
        int paired = 0;
        int agreeing = 0;
        double gapSum = 0;
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            Double t = text.get(c.date());
            if (c.mood() == null || t == null || c.date().isAfter(asOf)) {
                continue;
            }
            double gap = c.mood().doubleValue() - t;
            paired++;
            gapSum += gap;
            if (Math.abs(gap) <= AGREE_WITHIN) {
                agreeing++;
            }
        }
        if (paired < MIN_PAIRED_DAYS) {
            return null;
        }
        double rate = (double) agreeing / paired;
        double meanGap = gapSum / paired;
        String band = rate >= AGREE_HIGH ? "egyezik" : rate < AGREE_LOW ? "elter" : "reszben";
        String direction = meanGap >= DIRECTION_GAP ? "fel" : meanGap <= -DIRECTION_GAP ? "le" : null;
        return new State(band + (direction == null ? "" : "|" + direction), band, direction, paired, agreeing,
                rate, meanGap);
    }

    /** text_signal's 1..5 onto the check-in's 1..10, linearly (1 → 1, 3 → 5,5, 5 → 10). */
    static double rescale(double v5) {
        return 1 + (v5 - 1) * 9.0 / 4.0;
    }
}
