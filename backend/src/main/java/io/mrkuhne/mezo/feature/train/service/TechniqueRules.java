package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.SetLegKind;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import java.util.Optional;
import java.util.Set;

/** Pure policy: who may carry a technique or the challenge, which leg kinds fit, the cap weight (mezo-r36n9.80). */
public final class TechniqueRules {

    public static final String NOT_STABLE = "TRAIN_TECHNIQUE_NOT_STABLE";
    public static final String NOT_LENGTHENED = "TRAIN_TECHNIQUE_NOT_LENGTHENED";
    public static final String ON_CHALLENGE = "TRAIN_TECHNIQUE_ON_CHALLENGE";

    private TechniqueRules() {}

    /** First violated rule, or empty. A plain row (no technique, no challenge) is always fine. */
    public static Optional<String> check(Technique t, boolean challenge, CatalogAttributes.Attrs a) {
        boolean tech = t != null && t != Technique.NONE;
        if (!tech && !challenge) return Optional.empty();
        if (tech && challenge) return Optional.of(ON_CHALLENGE);
        if (!a.stable()) return Optional.of(NOT_STABLE);
        if ((t == Technique.PARTIALS || challenge) && !a.lengthenedFriendly()) {
            return Optional.of(NOT_LENGTHENED);
        }
        return Optional.empty();
    }

    /** Leg kinds a logged set with this technique may carry. */
    public static Set<SetLegKind> allowedLegKinds(Technique t) {
        return switch (t == null ? Technique.NONE : t) {
            case REST_DROP, DROP -> Set.of(SetLegKind.DROP);
            case MYO -> Set.of(SetLegKind.MINI);
            case PARTIALS -> Set.of(SetLegKind.PARTIALS);
            case NONE -> Set.of();
        };
    }

    /**
     * Cap weight of a row: its technique set weighs {@code capWeightCfg} (2) instead of 1 against the exercise and
     * session caps when it carries a technique/challenge in an enabled block — {@code sets + capExtra}; else sets.
     * A row with no set has no technique set (0).
     */
    public static int capWeight(int sets, Technique t, boolean challenge, boolean enabled, int capWeightCfg) {
        return sets > 0 ? sets + capExtra(t, challenge, enabled, capWeightCfg) : 0;
    }

    /** The extra set-equivalents a row's technique set adds over its plain count: cfg - 1, or 0 when it carries none. */
    public static int capExtra(Technique t, boolean challenge, boolean enabled, int capWeightCfg) {
        boolean tech = t != null && t != Technique.NONE;
        return enabled && (tech || challenge) ? Math.max(0, capWeightCfg - 1) : 0;
    }

    /** {@link #capExtra} of a template/run exercise row. */
    public static int capExtra(ExerciseEntity e, boolean enabled,
                               int capWeightCfg) {
        return capExtra(Technique.fromWire(e.getTechnique()), e.isChallenge(), enabled, capWeightCfg);
    }
}
