package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.service.ExerciseSubstituteRanker.Signal;
import java.util.List;

/**
 * Renders a suggestion's {@link Signal}s into one Hungarian sentence (spec 2026-11-17 §6.2 step 4).
 * Pure, fixed phrases: never "legjobb", never a number, never an exercise or coach name. Sentence =
 * role phrase + „, " + second phrase + „." ({@link Signal#MILD_BEFORE} joins with „; "), capitalised
 * once; a custom exercise always reads the fixed {@link #CUSTOM_LINE}.
 */
public final class SubstituteReason {

    private SubstituteReason() {}

    static final String CUSTOM_LINE = "Saját gyakorlat — erről még keveset tudok.";

    /** Same as {@link #sentence(List, String, String)} without the candidate type. */
    public static String sentence(List<Signal> signals, String painJointHu) {
        return sentence(signals, painJointHu, null);
    }

    /**
     * @param painJointHu   the inflected object for {@link Signal#PAIN_TODAY} („a válladat"), or null
     * @param candidateType the candidate's catalogue type, worded by {@link Signal#OTHER_TYPE}
     */
    public static String sentence(List<Signal> signals, String painJointHu, String candidateType) {
        if (signals == null || signals.isEmpty()) {
            return "";
        }
        if (signals.contains(Signal.CUSTOM)) {
            return CUSTOM_LINE;
        }
        StringBuilder sb = new StringBuilder();
        for (Signal s : signals) {
            if (!sb.isEmpty()) {
                sb.append(s == Signal.MILD_BEFORE ? "; " : ", ");
            }
            sb.append(phrase(s, painJointHu, candidateType));
        }
        sb.append('.');
        return Character.toUpperCase(sb.charAt(0)) + sb.substring(1);
    }

    static String phrase(Signal s, String painJointHu, String candidateType) {
        return switch (s) {
            case SAME_ROLE -> "Ugyanazt a munkát végzi a tervben";
            case OTHER_TYPE -> "Ugyanazt az izmot éri, de " + typeWord(candidateType) + " mozgásként";
            case SPARES_JOINT -> "nem terheli azt, ami most nem esett jól";
            case GUIDED -> "vezetett mozgás, kíméletesebb az ízületnek";
            case PAIN_TODAY -> "kíméli " + (painJointHu == null || painJointHu.isBlank() ? "azt" : painJointHu)
                + ", amit ma jeleztél";
            case MILD_BEFORE -> "legutóbb enyhén érezted";
            case GOAL_HYPERTROPHY -> "stabil, könnyű benne terhelni — izomépítéshez jó";
            case GOAL_STRENGTH -> "erőcélhoz a szabadsúlyos változat áll a legközelebb";
            case GOAL_LOW_FATIGUE -> "kevésbé fáraszt, ebben a szakaszban ez számít";
            case LENGTHENED -> "megnyújtott helyzetben is jól terhel";
            case DONE_BEFORE -> "ezt már csináltad, így látod, hol tartasz";
            case NO_EQUIPMENT -> "eszköz nélkül is megy";
            case HAS_EQUIPMENT -> "és ehhez van eszközöd";
            case CUSTOM -> "saját gyakorlat — erről még keveset tudok";
        };
    }

    /** „összetett" / „izolált"; anything else (unknown or plyo) reads as „más". */
    private static String typeWord(String type) {
        if ("compound".equals(type)) {
            return "összetett";
        }
        if ("isolation".equals(type)) {
            return "izolált";
        }
        return "más";
    }
}
