package io.mrkuhne.mezo.feature.companion.tools;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;

/**
 * Shared render helpers for the V0.5 toolsets — the snapshot's num() idiom + arg clamping.
 * Public: {@link #exerciseLine} is also called from {@code companion.service.ContextSnapshotAssembler}
 * (same companion feature slice — see {@code ArchitectureTest#feature_slices_are_cycle_free}, which
 * slices per top-level feature, not per sub-package; {@code companion.service} already depends on
 * {@code companion.tools} for {@code CompanionToolRegistry}/{@code ToolCallAudit}).
 */
public final class ToolText {

    static final String NO_DATA = "nincs adat";

    private ToolText() {
    }

    /** Locale-independent compact number: strip trailing zeros, plain (non-scientific) string.
     *  Public because every prompt/snapshot renderer needs exactly this rendering — it was
     *  copy-pasted into three of them while this helper stayed package-private. */
    public static String num(BigDecimal v) {
        return v == null ? "?" : v.stripTrailingZeros().toPlainString();
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
     * Lowercase + NFD accent-strip — "Túrós" → "turos", so a Hungarian name is findable without
     * diacritics (the {@code ClinicalOutputCheck.fold} idiom, promoted here for tool matching).
     */
    public static String fold(String text) {
        return text == null ? ""
                : Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
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
