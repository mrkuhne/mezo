package io.mrkuhne.mezo.feature.train.service;

/**
 * The training style as it applies to ONE exercise of today's session (mezo-r36n9.79): the style the
 * stamp used, the reserve after the effort ramp, the prescribed rest and the style's rep overshoot.
 * {@link #NONE} for an unstyled run (and for plyo, which is never stamped) — the prescription then runs
 * exactly as before. Pure.
 */
public record StyleContext(TrainingStyle effectiveStyle, int effectiveReserve, Integer restSec, int repOverflow) {

    public static final StyleContext NONE = new StyleContext(null, 0, null, 0);

    public boolean styled() {
        return effectiveStyle != null;
    }
}
