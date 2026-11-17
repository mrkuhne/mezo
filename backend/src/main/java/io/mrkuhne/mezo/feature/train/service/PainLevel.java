package io.mrkuhne.mezo.feature.train.service;

/**
 * The strongest joint discomfort a user reported on an exercise recently (the after-exercise
 * *Nincs / Enyhe / Erős* answer, or a swap-time *nem esik jól*, which counts as {@link #MILD}).
 */
public enum PainLevel {
    NONE, MILD, STRONG
}
