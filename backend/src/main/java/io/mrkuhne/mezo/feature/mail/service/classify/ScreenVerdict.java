package io.mrkuhne.mezo.feature.mail.service.classify;

/**
 * The screen's outcome (spec §5.4 step 4). Fail-closed: only {@link #CLEAN} may notify; {@link #UNKNOWN} (the model
 * did not answer in the required shape, or the call failed) is treated like {@link #FLAGGED} for notifying.
 */
public enum ScreenVerdict { FLAGGED, CLEAN, UNKNOWN }
