package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.techcore.text.TextFold;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Shared render helpers for the V0.5 toolsets — the snapshot's num() idiom + arg clamping.
 * Public: {@link #exerciseLine} is also called from {@code companion.service.ContextSnapshotAssembler}
 * (same companion feature slice — see {@code ArchitectureTest#feature_slices_are_cycle_free}, which
 * slices per top-level feature, not per sub-package; {@code companion.service} already depends on
 * {@code companion.tools} for {@code CompanionToolRegistry}/{@code ToolCallAudit}).
 */
public final class ToolText {

    /** The snapshot's honest-absence marker. PUBLIC since mezo-4jux: the feed generators must be
     *  able to tell that a block rendered as absent, so they stop offering the model a reference
     *  candidate for a source that produced nothing (a "Gyógyszer" provenance chip appeared on a
     *  card whose own body said no medication was recorded). Referenced, never re-spelled. */
    public static final String NO_DATA = "nincs adat";

    private ToolText() {
    }

    /** Locale-independent compact number: strip trailing zeros, plain (non-scientific) string.
     *  Public because every prompt/snapshot renderer needs exactly this rendering — it was
     *  copy-pasted into three of them while this helper stayed package-private. */
    public static String num(BigDecimal v) {
        return v == null ? "?" : v.stripTrailingZeros().toPlainString();
    }

    /** Hungarian locale for figures that end up QUOTED BACK to the user — the same
     *  {@code Locale.of("hu")} {@code FlagFactRenderer} uses, so the two cannot disagree. */
    private static final Locale HU = Locale.of("hu");

    /**
     * The ceiling of every hand-entered 1..10 self-rating in the product, declared once.
     *
     * <p>Each of these is 1..10 at its own source of truth — sleep quality
     * ({@code api/feature/sleep/sleep.yml}), check-in energy and stress
     * ({@code api/feature/checkin/checkin.yml}), sport intensity
     * ({@code ck_sport_session_intensity}) — and each was ALSO rendered against a hardcoded "/5"
     * in at least one renderer (mezo-b6zt and its siblings). The worst shape it took: the day
     * narrative said "energia 8/5" while the context snapshot said "energia 8/10", so two prompts
     * feeding the same model contradicted each other. The ceiling lives here so a fourth drift has
     * nowhere to live.
     */
    public static final int RATING_MAX = 10;

    /** "8/10" — the shared self-rating fragment. Null-safe: an unrated field must render NOTHING,
     *  and "null/10" must never reach a prompt, so callers keep their "omit entirely" branch. */
    public static String rating(Integer value) {
        return value == null ? null : value + "/" + RATING_MAX;
    }

    /** Sleep quality — {@link #rating} under the name its five call sites read best. */
    public static String sleepQuality(Integer quality) {
        return rating(quality);
    }

    /**
     * The goal trajectory in Hungarian (mezo-padz). {@code GoalEntity.trajectory} stores the raw
     * {@code cut|bulk|maintain} (DB CHECK), and the renderers used to emit it verbatim — the ONE
     * non-Hungarian label in otherwise fully Hungarian blocks, so the model invented its own
     * phrasing instead of reading one ("a Lean Gain célod, ami a súlyod fenntartását célozza").
     *
     * <p>{@code maintain} is spelled out as RECOMP on the repo owner's own definition: hold body
     * weight while strength and muscle go UP. Rendered as a bare "súlytartás" it reads as "do
     * nothing", the opposite of the prescription.
     *
     * <p>Lives HERE, not privately in one renderer, because two of them need it — the context
     * snapshot's {@code [Cél]} block and {@code GoalTools}' goal line — and a second copy is
     * exactly how the wording would drift apart. (Deliberately NOT the wording of
     * {@code goal.service.GoalSuggestionTriggerService#huTrajectory}, whose bare "tartás" for
     * {@code maintain} is precisely the reading these blocks must not produce; that one serves a
     * different feature slice and its own surface.)
     *
     * <p>An unrecognised value falls through verbatim rather than throwing: a widened DB CHECK
     * must degrade to an untranslated label, never take a whole snapshot down.
     */
    public static String huTrajectory(String trajectory) {
        if (trajectory == null) {
            return NO_DATA;
        }
        return switch (trajectory) {
            case "cut" -> "fogyás";
            case "bulk" -> "tömegelés";
            case "maintain" -> "súlytartás (recomp: testsúly tartása mellett erő- és "
                    + "izomgyarapodás, hízás nélkül)";
            default -> trajectory;
        };
    }

    /**
     * Display figure for a number the model will QUOTE BACK to the user: Hungarian decimal comma,
     * fixed precision. The deliberate counterpart to {@link #num}, which is locale-INDEPENDENT and
     * unrounded because it feeds payloads the model only parses. Using {@code num} for
     * user-destined figures put "83.694 kg" and "-0.244 kg" on the same screen as "4,5 óra"
     * (mezo-a64t) — a decimal point inside Hungarian prose, at a precision nobody asked for.
     *
     * @param decimals how precise the user's own sentence should be — pick this per QUANTITY, not
     *                 per call site (a weight 1, a weekly rate 2), or one figure renders two ways
     */
    public static String huNum(BigDecimal v, int decimals) {
        return v == null ? "?" : String.format(HU, "%." + decimals + "f", v);
    }

    /** Null-safe window clamp: the model may omit the arg (fallback) or overshoot (min/max). */
    static int clamp(Integer value, int min, int max, int fallback) {
        return value == null ? fallback : Math.clamp(value, min, max);
    }

    /**
     * "{name} {workingSets}×{repMin}-{repMax}" — the compact exercise descriptor shared by
     * {@code TrainTools} (get_training_plan) and {@code ContextSnapshotAssembler} (Ma:/Holnap:).
     * Null-guarded: a missing rep range (or set count) must never render the literal "null" into
     * the LLM prompt, so each piece is rendered only when present.
     */
    public static String exerciseLine(String name, Integer workingSets, Integer repMin, Integer repMax) {
        StringBuilder b = new StringBuilder(name).append(' ').append(workingSets != null ? workingSets : "?");
        if (repMin != null && repMax != null) {
            b.append('×').append(repMin).append('-').append(repMax);
        }
        return b.toString();
    }

    /**
     * "sport: {sport} {time} {kind} ({durationMin} perc)" — one scheduled sport slot resolved onto a
     * date. Shared by {@code TrainTools} (get_training_plan) and {@code ContextSnapshotAssembler}
     * (Ma:/Holnap:) so the tool and the prompt snapshot can never again disagree about a day's sport
     * (mezo-ajp). Optional pieces are omitted rather than rendered as "null".
     */
    public static String sportLine(String sport, String time, String kind, Integer durationMin) {
        StringBuilder b = new StringBuilder("sport: ").append(sport);
        if (time != null) {
            b.append(' ').append(time);
        }
        if (kind != null) {
            b.append(' ').append(kind);
        }
        if (durationMin != null) {
            b.append(" (").append(durationMin).append(" perc)");
        }
        return b.toString();
    }

    /**
     * "gym ({dayLabel}): {exercises}" — or "pihenőnap (gym)" when the day has no exercises. The gym
     * half of a day, shared by {@code TrainTools} (get_training_plan) and
     * {@code ContextSnapshotAssembler} (Ma:/Holnap:) exactly the way {@link #sportLine} shares the
     * sport half (mezo-4qu). Both used to render this themselves, and the duplication is what let
     * them drift: the criterion below — a present-but-EMPTY meso template day is a REST day, not a
     * gym day — had to be fixed twice, and the weekend-training hallucination (mezo-650a) lived in
     * the copy that was missed. One helper, one criterion, no third drift.
     *
     * @param dayLabel the template day's label; only read when {@code exerciseLines} is non-empty
     * @param exerciseLines already-rendered {@link #exerciseLine} strings, in display order
     */
    public static String gymLine(String dayLabel, List<String> exerciseLines) {
        return exerciseLines.isEmpty()
                ? "pihenőnap (gym)"
                : "gym (" + dayLabel + "): " + String.join(", ", exerciseLines);
    }

    /**
     * Lowercase + NFD accent-strip — "Túrós" → "turos", so a Hungarian name is findable without
     * diacritics (the {@code ClinicalOutputCheck.fold} idiom, promoted here for tool matching).
     * The body promoted to {@code techcore.text.TextFold} (bd mezo-06o0.1) so {@code feature.people}
     * can share it without importing {@code feature.companion}; this method now delegates.
     */
    public static String fold(String text) {
        return TextFold.fold(text);
    }

    /**
     * A free-text tool filter split into folded search tokens (mezo-sxe). Single characters are
     * dropped — a 1-char needle matches nearly everything and is never what the user meant; if
     * that leaves nothing, the whole folded needle is kept as the single token so a deliberate
     * short filter still searches for itself rather than silently matching all rows.
     */
    public static List<String> searchTokens(String filter) {
        String folded = fold(filter).trim();
        List<String> tokens = Arrays.stream(folded.split("[\\s,;]+"))
                .filter(t -> t.length() > 1)
                .toList();
        return tokens.isEmpty() ? (folded.isEmpty() ? List.of() : List.of(folded)) : tokens;
    }

    /** Folded substring containment — the per-field primitive behind {@link #searchTokens}. */
    public static boolean containsFolded(String value, String foldedToken) {
        return value != null && fold(value).contains(foldedToken);
    }
}
