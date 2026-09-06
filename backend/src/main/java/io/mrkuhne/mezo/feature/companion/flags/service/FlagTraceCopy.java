package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict.ClearEvidence;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * The other two thirds of the renderer family {@link FlagFactRenderer} starts (spec 2026-09-05 §5):
 * plain-Hungarian explanations of a CLEAR verdict ("I checked and it is fine") and an UNAVAILABLE
 * one ("I could not check"). Same deterministic, no-estimate contract, same Hungarian locale.
 *
 * <p>Every {@code metric} below is read off an actual {@code FlagVerdict.clear(...)} call site in
 * {@code service/rule/}; every reason code is an {@link UnavailableReason} member.
 * {@code FlagTraceCopyTest} pins both sets, so a round-2 rule that invents a new metric or gate
 * fails the build here rather than shipping a raw key onto the observer.
 *
 * <p>Both lookups FALL BACK rather than throw — an unmapped key must never break the read surface
 * (the {@link FlagCatalog} argument).
 */
public final class FlagTraceCopy {

    /** Read-side only: the rule has no trace row yet, so the engine has never judged it. NOT an
     *  {@link UnavailableReason} — no rule ever produces it; {@code FlagTraceReadService} does. */
    public static final String NOT_EVALUATED_YET = "not_evaluated_yet";

    /** Hungarian date without the trailing period, so the {@code -i} suffix below reads as
     *  orthography wants it ("2026. 09. 03-i"), not as "2026. 09. 03.-i". */
    private static final DateTimeFormatter FROZEN_ON = DateTimeFormatter.ofPattern("yyyy. MM. dd");

    private FlagTraceCopy() {
    }

    /**
     * The RAISED sentence, in the two shapes a raise can take.
     *
     * <p>A {@code logged} raise is the one the day's log row belongs to, so its numbers ARE the
     * numbers of this raise — nothing to qualify. A {@code suppressed_by_cooldown} raise writes no
     * log row at all ({@code FlagService} logs only on the LOGGED branch), so the freshest frozen
     * payload the read side can find belongs to an EARLIER raise. Those numbers are still the
     * rule's most recent real evidence and are worth showing — but they must be shown AS earlier
     * numbers. Presenting them under today's {@code changedAt} without saying when they were
     * measured is exactly the "old figures dressed up as today's measurement" dishonesty the
     * observer exists to avoid, so the date is part of the sentence, not an optional garnish.
     */
    public static String raisedText() {
        return "A szabály jelzett.";
    }

    /** The suppressed raise with no frozen payload behind it — nothing to date. */
    public static String suppressedRaiseText() {
        return "A szabály igaz, de nemrég szólt már — most csendben maradt.";
    }

    /** The suppressed raise WITH a frozen payload: same sentence, plus when the numbers are from.
     *  See {@link #raisedText()} for why the date is mandatory here. */
    public static String suppressedRaiseText(LocalDate frozenOn) {
        return suppressedRaiseText()
            + " Az alábbi számok a %s-i jelzésből valók.".formatted(FROZEN_ON.format(frozenOn));
    }

    /** The extra evidence row appended to a suppressed raise's facts, naming the day the numbers
     *  were frozen. One line, same voice as {@code FlagFactRenderer}'s rows. */
    public static String frozenNumbersFact(LocalDate frozenOn) {
        return "Ezek a számok a %s-i jelzésből valók, nem mai mérés."
            .formatted(FROZEN_ON.format(frozenOn));
    }

    /** One sentence saying why the rule is quiet, in the rule's own numbers. */
    public static String clearText(ClearEvidence evidence) {
        if (evidence == null) {
            return "A szabály lefutott, és nem talált problémát.";
        }
        String metric = evidence.metric();
        Double observed = evidence.observed();
        Double threshold = evidence.threshold();
        String detail = evidence.detail();
        return switch (metric == null ? "" : metric) {
            case "deficit_hours" -> "Alvásadósság %s óra/éjszaka — a %s órás küszöb alatt."
                .formatted(num(observed), num(threshold));
            case "stress_days_over" -> "%s nap a stresszküszöb fölött — a jelzéshez %s kellene."
                .formatted(num(observed), num(threshold));
            case "bad_checkins" -> "%s rossz check-in ma — a jelzéshez %s kellene."
                .formatted(num(observed), num(threshold));
            case "load_avg_min" -> "A 7 napos terhelés %s perc — a %s perces küszöb alatt."
                .formatted(num(observed), num(threshold));
            case "fuel_arms_fired" -> "A terhelés magas, de sem a kalória-, sem az alvásoldal nem "
                + "esett a küszöb alá.";
            case "weight_trend_pct_wk" -> "A súlytrend %s%%/hét — a %s%%/hét küszöbnél lassabb fogyás."
                .formatted(num(observed), num(threshold));
            case "trajectory" -> "A célod tudatos fogyás (%s), így a gyors fogyás nem probléma."
                .formatted(detail);
            case "shoulder_strain_avg" -> "A vállterhelés átlaga %s — a %s küszöb alatt."
                .formatted(num(observed), num(threshold));
            case "tomorrow_muscle" -> "A holnapi edzés nem vállfókuszú (%s).".formatted(detail);
            case "nudge_run_nights" -> "%s este futott a sorozat — a jelzéshez %s egymást követő "
                .formatted(num(observed), num(threshold))
                + "este kellene (%s).".formatted(detail);
            case "late_meal_days" -> "%s késői vacsora az utolsó napokban — a jelzéshez %s kellene."
                .formatted(num(observed), num(threshold));
            case "stale_domains" -> "%s elavult napló — a jelzéshez %s kellene (%s)."
                .formatted(num(observed), num(threshold), detail == null || detail.isBlank() ? "—" : detail);
            case "longest_missed_run" -> "A leghosszabb kihagyott sorozat %s nap — a jelzéshez %s kellene."
                .formatted(num(observed), num(threshold));
            case "habits_recent_avg" -> "Napi %s teljesített szokás — a %s-es visszaesési küszöb fölött."
                .formatted(num(observed), num(threshold));
            case "missed_gym_days" -> "Nincs kihagyott edzésnap az ablakban.";
            case "signals_matched" -> "%s regenerációs jel a szükséges %s-ból (hiányzik: %s)."
                .formatted(num(observed), num(threshold), detail == null || detail.isBlank() ? "—" : detail);
            case "quiet_days" -> "Még nem telt el %s csendes nap.".formatted(num(threshold));
            case "other_flags_raised" -> "Ma más szabály jelzett, így a „minden rendben\" nem áll fenn.";
            default -> "A szabály lefutott, és nem talált problémát.";
        };
    }

    /** The expandable evidence rows for a CLEAR verdict: the sentence, plus the raw
     *  measured-vs-threshold pair when there is one. Never fabricates a number. */
    public static List<String> clearFacts(ClearEvidence evidence) {
        List<String> facts = new ArrayList<>();
        facts.add(clearText(evidence));
        if (evidence != null && evidence.observed() != null && evidence.threshold() != null) {
            facts.add("Mért érték: %s · küszöb: %s"
                .formatted(num(evidence.observed()), num(evidence.threshold())));
        }
        return List.copyOf(facts);
    }

    /** One sentence saying why the rule could not judge. {@code reasonCode} is lower-cased, as
     *  {@code companion_flag_trace.reason_code} stores it. */
    public static String unavailableText(String reasonCode) {
        return switch (reasonCode == null ? "" : reasonCode) {
            case "not_enough_logged_nights" -> "Túl kevés rögzített éjszaka — nincs mit mérni.";
            case "not_enough_logged_days" -> "Túl kevés rögzített nap a kalória- és az alvásoldalon.";
            case "not_enough_checkins" -> "Ma túl kevés check-in — egy rossz válasz még nem egy nap.";
            case "no_checkin_data" -> "Nincs stressz-check-in az ablakban.";
            case "no_data_in_window" -> "Nincs megfigyelés az ablakban.";
            case "no_habit_baseline" -> "Nincs szokás-alapvonal — nincs honnan visszaesni.";
            case "no_gym_schedule" -> "Nincs edzésterv, amihez mérni lehetne.";
            case "schedule_younger_than_window" -> "Az edzésterv fiatalabb az ablaknál.";
            case "no_weight_trend" -> "Nincs súlytrend mára.";
            case "no_active_goal" -> "Nincs aktív cél — a trajektória nem olvasható.";
            case "no_strain_data" -> "Nincs vállterhelés-adat az ablakban.";
            case "no_planned_session" -> "Nincs holnapra tervezett edzés.";
            case "no_sleep_goal_row" -> "Nincs alváscél rögzítve — a lefekvési horgony ismeretlen.";
            case "notifications_off" -> "Az értesítések ki vannak kapcsolva — nem tudni, ment-e emlékeztető.";
            case "unlogged_night" -> "Rögzítetlen éjszaka a sorozatban.";
            case "no_meal_data" -> "Nincs étkezés-adat az ablakban.";
            case NOT_EVALUATED_YET -> "Ez a szabály még nem futott le ezen a napon.";
            default -> "A szabály nem tudta megítélni ezt a napot.";
        };
    }

    /** Hungarian decimal comma, one fraction digit — the same formatter the card's facts use. */
    private static String num(Double value) {
        return value == null ? "—" : FlagFactRenderer.num(value);
    }
}
