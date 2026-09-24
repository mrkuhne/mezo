package io.mrkuhne.mezo.feature.character.service.edition;

import java.time.Instant;

/** Egy korábbi (utolsó 7 napi) kiadás-megjelenés — az ismétlés-tilalomhoz. */
public record PriorShowing(String sourceKey, Instant shownAt) {
}
