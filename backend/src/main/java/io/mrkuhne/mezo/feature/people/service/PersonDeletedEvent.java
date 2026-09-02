package io.mrkuhne.mezo.feature.people.service;

import java.util.UUID;

/**
 * Soft-delete-et jelző esemény ({@code deletePerson}, és a jelölt-elvetés, ami szintén
 * soft-delete). A {@link PersonSavedEvent} fogyasztója a törölt sort már nem látja
 * (a findere {@code ...AndDeletedFalse}), ezért a törlésnek saját eseménye kell, különben
 * a PERSON node örökre aktív maradna (mezo-06o0.4).
 */
public record PersonDeletedEvent(UUID userId, UUID personId) {
}
