package io.mrkuhne.mezo.feature.character.detector;

/** One code-detected signal (Karakter spec §5) — numbers computed by code, never by a model. */
public record DetectorSignal(String detectorKey, String expertKey, String summary, int salience) {}
