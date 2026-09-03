package io.mrkuhne.mezo.feature.train.service;

/** One learned interval: which profile component it belongs to, and how long it took. */
public record TimingObservation(String component, double seconds) {}
