package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.SetLegKind;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Pure policy: who may carry a technique or the challenge, which leg kinds fit, the cap weight (mezo-r36n9.80).
 * Since mezo-r36n9.98 (owner, 2026-11-19) one exercise may carry a technique AND the day's challenge: the last
 * working set then runs the technique's legs first and the challenge's half reps (one {@code partials} leg) last.
 */
public final class TechniqueRules {

    public static final String NOT_STABLE = "TRAIN_TECHNIQUE_NOT_STABLE";
    public static final String NOT_LENGTHENED = "TRAIN_TECHNIQUE_NOT_LENGTHENED";

    private TechniqueRules() {}

    /**
     * First violated rule, or empty. A plain row (no technique, no challenge) is always fine. A technique and the
     * challenge together are fine (mezo-r36n9.98); both need a stable exercise, partials and the challenge also a
     * lengthened-friendly one.
     */
    public static Optional<String> check(Technique t, boolean challenge, CatalogAttributes.Attrs a) {
        boolean tech = carries(t);
        if (!tech && !challenge) return Optional.empty();
        if (!a.stable()) return Optional.of(NOT_STABLE);
        if ((t == Technique.PARTIALS || challenge) && !a.lengthenedFriendly()) {
            return Optional.of(NOT_LENGTHENED);
        }
        return Optional.empty();
    }

    /** Leg kinds a logged set with this technique may carry (the challenge's trailing partials leg aside). */
    public static Set<SetLegKind> allowedLegKinds(Technique t) {
        return switch (t == null ? Technique.NONE : t) {
            case REST_DROP, DROP -> Set.of(SetLegKind.DROP);
            case MYO, REST_PAUSE -> Set.of(SetLegKind.MINI);
            case PARTIALS -> Set.of(SetLegKind.PARTIALS);
            case NONE -> Set.of();
        };
    }

    /**
     * The legs of a logged set fit its technique: every leg of an allowed kind, except that a non-partials
     * technique set may end in ONE {@code partials} leg — the day challenge's half reps after the technique
     * (mezo-r36n9.98). A set without a technique fits only no legs.
     */
    public static boolean legsFit(Technique t, List<SetLegKind> kinds) {
        if (kinds.isEmpty()) return true;
        if (!carries(t)) return false;
        Set<SetLegKind> allowed = allowedLegKinds(t);
        for (int i = 0; i < kinds.size(); i++) {
            SetLegKind k = kinds.get(i);
            if (k == null) return false;
            if (allowed.contains(k)) continue;
            boolean trailingChallenge = k == SetLegKind.PARTIALS && i == kinds.size() - 1;
            if (!trailingChallenge) return false;
        }
        return true;
    }

    /**
     * The extra set-equivalents a row adds over its plain count against the caps: {@code cfg - 1} for its technique
     * and {@code cfg - 1} for the challenge, so a row carrying both adds {@code 2 × (cfg - 1)} (mezo-r36n9.98: the
     * set runs the technique and then the half reps). A {@code partials} technique on the challenge row is the
     * challenge itself and counts once. 0 when the block's flag is off or the row carries neither.
     */
    public static int capExtra(Technique t, boolean challenge, boolean enabled, int capWeightCfg) {
        if (!enabled) return 0;
        boolean tech = carries(t) && !(challenge && t == Technique.PARTIALS);
        int extras = (tech ? 1 : 0) + (challenge ? 1 : 0);
        return extras * Math.max(0, capWeightCfg - 1);
    }

    /** {@link #capExtra} of a template/run exercise row. */
    public static int capExtra(ExerciseEntity e, boolean enabled,
                               int capWeightCfg) {
        return capExtra(Technique.fromWire(e.getTechnique()), e.isChallenge(), enabled, capWeightCfg);
    }

    /**
     * The setup a challenge's half reps are done in, for comparing records (mezo-r36n9.98): the set's technique
     * wire value when it is a real technique before the half reps ({@code rest_drop}, {@code drop}, {@code myo}),
     * else {@code none} (a plain challenge set carries {@code partials} or nothing).
     */
    public static String challengeSetup(Technique setTechnique) {
        return carries(setTechnique) && setTechnique != Technique.PARTIALS ? setTechnique.wire() : SETUP_NONE;
    }

    /** {@link #challengeSetup} of a plain challenge. */
    public static final String SETUP_NONE = "none";

    private static boolean carries(Technique t) {
        return t != null && t != Technique.NONE;
    }
}
