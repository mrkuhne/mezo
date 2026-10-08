package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy;
import java.util.List;
import java.util.stream.Collectors;

/**
 * The one Hungarian wording of a Fuel day's kímélő-mód mode and skipped meals (Kihagyás S3),
 * shared by the coach snapshot's Fuel block and the {@code get_fuel_log} tool so the two cannot
 * drift. Pure — the mode comes from the Fuel day response, the skips from {@code PlannedSkipService}.
 */
public final class FuelModeText {

    private FuelModeText() {
    }

    /** The tag a day line carries when its kcal target is not judged (GUIDANCE / ESTIMATE). */
    public static final String UNJUDGED_TAG = " · kímélő nap (nincs értékelve)";

    /** True when the day's kcal target must not be judged: GUIDANCE or ESTIMATE
     *  ({@code RecoveryFuelMode.unjudged()}). */
    public static boolean isUnjudged(FuelDayResponse day) {
        return day.getFuelMode() == FuelDayResponse.FuelModeEnum.GUIDANCE
                || day.getFuelMode() == FuelDayResponse.FuelModeEnum.ESTIMATE;
    }

    /** GUIDANCE: no calorie target at all — consumption only, and a coaching instruction. */
    public static String guidanceLine(FuelDayResponse day) {
        MacroSet c = day.getConsumed();
        MacroSet t = day.getTargets();
        String cause = day.getRecoveryCategory() == FuelDayResponse.RecoveryCategoryEnum.STOMACH
                ? "gyomorrontás" : "betegség";
        return "Kímélő mód (" + cause + "): ma nincs kalóriacél. Eddig " + ToolText.num(c.getKcal())
                + " kcal, fehérje " + ToolText.num(c.getP()) + " g, víz " + ToolText.num(c.getWater())
                + "/" + ToolText.num(t.getWater()) + " ml. Ne mérd semmihez az evést, ne említs hiányt; "
                + "folyadék és könnyű étel.";
    }

    /** What follows the normal line on an ESTIMATE / MAINTENANCE day; empty otherwise. */
    public static String suffix(FuelDayResponse day) {
        FuelDayResponse.FuelModeEnum mode = day.getFuelMode();
        if (mode == FuelDayResponse.FuelModeEnum.ESTIMATE) {
            return " (úton van: a keret csak tájékoztató, becsült nap — ne kérd számon)";
        }
        if (mode == FuelDayResponse.FuelModeEnum.MAINTENANCE) {
            return " (sérülés: nem kell kevesebbet enned; a fehérje a fő cél)";
        }
        return "";
    }

    /** "; kihagyott étkezés: Ebéd (nem éhes) — tudatos kihagyás, nem mulasztás." or empty. */
    public static String skips(List<PlannedSkipPolicy.Row> skips) {
        if (skips == null || skips.isEmpty()) {
            return "";
        }
        return "; kihagyott étkezés: " + skips.stream()
                .map(r -> slotLabel(r.sessionKey()) + " (" + reasonLabel(r) + ")")
                .collect(Collectors.joining(", ")) + " — tudatos kihagyás, nem mulasztás.";
    }

    private static String slotLabel(String sessionKey) {
        String slot = sessionKey == null ? "" : sessionKey.split("#", 2)[0];
        return switch (slot) {
            case "breakfast" -> "Reggeli";
            case "lunch" -> "Ebéd";
            case "dinner" -> "Vacsora";
            case "snack" -> "Snack";
            default -> slot;
        };
    }

    private static String reasonLabel(PlannedSkipPolicy.Row r) {
        return switch (r.reason()) {
            case NOT_HUNGRY -> "nem éhes";
            case NO_TIME -> "nincs ideje";
            case STOMACH -> "gyomorrontás";
            case ILLNESS -> "beteg";
            case TRAVEL -> "úton";
            case OTHER -> r.reasonText() == null || r.reasonText().isBlank() ? "egyéb" : r.reasonText();
            case NONE -> "ok nélkül";
            default -> r.reason().name().toLowerCase();
        };
    }
}
