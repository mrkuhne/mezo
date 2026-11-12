package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInSnapshotEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CravingKind;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * The ONE prompt-side rendering of a check-in's answers (Check-in 2.0, mezo-ck2, spec §3.1) —
 * shared by the chat snapshot, the daily summary, the {@code get_recovery} tool and the meal
 * coach, so four prompts feeding one model can never describe the same row differently (the
 * mezo-b6zt lesson, where two renderers disagreed on the same two columns' ceiling).
 *
 * <p>Every answered item renders in the fixed {@link CheckInItem} order, e.g.
 * {@code "energia 7/10, hangulat 8/10, …, fáj: térd, derék 5/10, …, sóvárgás 7/10 (édes), …,
 * a nap: 7/10"}. NULL is "not answered" (skipped or not asked) and renders NOTHING — never a
 * default, never "null/10". Whether an item was skipped or simply not asked is not rendered:
 * both mean "no answer" to the model. A quick-exit save is marked {@code (gyors kitöltés)}, so
 * the model reads the missing slot items as "not asked", not as a cold shoulder.
 *
 * <p>The note is NOT rendered here — each caller has its own note cap and quoting.
 */
public final class CheckInText {

    private static final Locale HU = Locale.of("hu");

    /** The 1..10 scales' ceiling. */
    static final int SCALE_MAX = 10;

    /** Appended when the row was saved via "Most csak ennyi" after the core five. */
    public static final String QUICK_EXIT_SUFFIX = " (gyors kitöltés)";

    private CheckInText() {
    }

    /** Every answered item, comma-separated; {@code ""} when nothing was answered. */
    public static String render(CheckInEntity c) {
        List<String> parts = new ArrayList<>();
        rating(parts, "energia", c.getEnergy());
        rating(parts, "hangulat", c.getMood());
        rating(parts, "stressz", c.getStress());
        rating(parts, "testi érzés", c.getBody());
        rating(parts, "fejtisztaság", c.getMental());
        rating(parts, "kipihentség", c.getRested());
        rating(parts, "izomláz", c.getSoreness());
        pain(parts, c);
        rating(parts, "motiváció", c.getMotivation());
        rating(parts, "éhség", c.getHunger());
        craving(parts, c);
        rating(parts, "emésztés", c.getDigestion());
        rating(parts, "kapcsolódás", c.getConnection());
        rating(parts, "a nap:", c.getDayRating());
        if (parts.isEmpty()) {
            return "";
        }
        return String.join(", ", parts) + (c.isQuickExit() ? QUICK_EXIT_SUFFIX : "");
    }

    /**
     * The biomarker snapshot's one line (Boop B3, mezo-r36n9.13, spec §7.3), e.g.
     * {@code "pulzus 78, HRV 38 (szokott 50), 7 420 lépés"}; {@code ""} when there is no snapshot or it holds
     * none of these readings. A server-filled day total says so ({@code "(egész nap)"}), so the model never
     * reads a whole day's steps as the count up to the check-in. Sleep minutes are left out, as in the
     * spec's line (the sleep log is rendered by its own readers).
     */
    public static String snapshotLine(CheckInSnapshotEntity s) {
        if (s == null) {
            return "";
        }
        List<String> parts = new ArrayList<>();
        if (s.getHrBpm() != null) {
            parts.add("pulzus " + s.getHrBpm());
        }
        if (s.getHrvMs() != null) {
            parts.add("HRV " + Math.round(s.getHrvMs())
                + (s.getHrvUsualMs() == null ? "" : " (szokott " + Math.round(s.getHrvUsualMs()) + ")"));
        }
        if (s.getSteps() != null) {
            parts.add(grouped(s.getSteps()) + " lépés" + (Boolean.TRUE.equals(s.getStepsIsDayTotal()) ? " (egész nap)" : ""));
        }
        return String.join(", ", parts);
    }

    /** Hungarian digit grouping with a plain space: 7420 → "7 420". */
    private static String grouped(int value) {
        String digits = Integer.toString(Math.abs(value));
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) {
                out.append(' ');
            }
            out.append(digits.charAt(i));
        }
        return (value < 0 ? "-" : "") + out;
    }

    /** "fáj: térd, derék 5/10" | "nem fáj semmi" | nothing when the pain gate was not answered. */
    private static void pain(List<String> parts, CheckInEntity c) {
        if (c.getPain() == null) {
            return;
        }
        if (!c.getPain()) {
            parts.add("nem fáj semmi");
            return;
        }
        List<PainRegion> regions = c.getPainRegions();
        String where = regions == null || regions.isEmpty()
            ? "fáj valami"
            : "fáj: " + regions.stream().map(r -> r.label().toLowerCase(HU)).collect(Collectors.joining(", "));
        String intensity = rating(c.getPainIntensity());
        parts.add(intensity == null ? where : where + " " + intensity);
    }

    /** "sóvárgás 7/10 (édes)" — the kinds only when they were answered. */
    private static void craving(List<String> parts, CheckInEntity c) {
        String value = rating(c.getCraving());
        if (value == null) {
            return;
        }
        List<CravingKind> kinds = c.getCravingKinds();
        parts.add("sóvárgás " + value + (kinds == null || kinds.isEmpty() ? ""
            : " (" + kinds.stream().map(k -> k.label().toLowerCase(HU)).collect(Collectors.joining(", ")) + ")"));
    }

    /** "7/10" or null — every Check-in 2.0 scale is 1..10 ({@code @Max(10)} on the entity, CHECK
     *  {@code ck_check_in_<col>_range}). The same ceiling as {@code ToolText.RATING_MAX}; not
     *  imported from there because biometrics must not depend on companion (ArchitectureTest's
     *  cycle-free slices). */
    static String rating(Integer value) {
        return value == null ? null : value + "/" + SCALE_MAX;
    }

    private static void rating(List<String> parts, String label, Integer value) {
        String rendered = rating(value);
        if (rendered != null) {
            parts.add(label + " " + rendered);
        }
    }
}
