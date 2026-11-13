package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

/**
 * The next-meal tip: one plain Hungarian sentence and the clause behind it. An offer, never a
 * verdict — no shaming, no "you should have", and no number the day did not already contain.
 */
public record Tip(String text, String reason) {
}
