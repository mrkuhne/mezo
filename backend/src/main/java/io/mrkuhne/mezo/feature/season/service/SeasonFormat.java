package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** The system map's short Hungarian headlines, formatted on the server (pure). */
final class SeasonFormat {

    private SeasonFormat() {
    }

    /** "4 edzés", "4 edzés + 2 röpi", "2 röpi"; null with no weekly session. */
    static String training(SeasonDraftJson d) {
        int gym = d.gymDaysOrEmpty().size();
        List<SeasonDraftJson.SportSlot> sport = d.sportOrEmpty();
        String sportPart = sport.isEmpty() ? null : sport.size() + " " + sportName(sport);
        if (gym == 0) {
            return sportPart;
        }
        return sportPart == null ? gym + " edzés" : gym + " edzés + " + sportPart;
    }

    private static String sportName(List<SeasonDraftJson.SportSlot> sport) {
        String first = sport.get(0).sport();
        boolean same = sport.stream().allMatch(s -> first.equals(s.sport()));
        if (!same) {
            return "sport";
        }
        return switch (first) {
            case "volleyball" -> "röpi";
            case "trx" -> "TRX";
            case "cross" -> "cross";
            default -> "sport";
        };
    }

    /** "2 440 kcal" (space as the thousands separator). */
    static String kcal(int kcal) {
        String digits = Integer.toString(Math.abs(kcal));
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) {
                b.append(' ');
            }
            b.append(digits.charAt(i));
        }
        return (kcal < 0 ? "-" : "") + b + " kcal";
    }

    /** "8 ó 6 p", "8 ó". */
    static String hoursMinutes(int minutes) {
        return minutes % 60 == 0 ? (minutes / 60) + " ó" : (minutes / 60) + " ó " + (minutes % 60) + " p";
    }

    /** Maintain (no target): "82,0 kg"; with a target: "84,1 → 82"; null without a trend. */
    static String weight(BigDecimal trendKg, BigDecimal targetKg) {
        if (trendKg == null) {
            return null;
        }
        String now = trendKg.setScale(1, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
        if (targetKg == null) {
            return now + " kg";
        }
        return now + " → " + targetKg.stripTrailingZeros().toPlainString().replace('.', ',');
    }
}
