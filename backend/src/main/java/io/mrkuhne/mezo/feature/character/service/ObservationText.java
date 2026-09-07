package io.mrkuhne.mezo.feature.character.service;

import java.util.regex.Pattern;

/**
 * Reading-side cleanup for observation text (mezo-xlvr). Feedback observations written before
 * this change carry a machine prefix — {@code "[<claim uuid>] "} — that {@link CharacterService}
 * used to hand straight to the feed, so the Karakter feed showed a raw uuid to the user. New rows
 * no longer carry it ({@link CharacterFeedbackService}); this strips it off the old ones at read
 * time, so nothing has to be migrated and the claim link (the observation's own signal refIds)
 * is untouched.
 */
public final class ObservationText {

    /** A leading claim-id prefix: exactly one bracketed UUID and one space. A bracketed word that
     *  is NOT a uuid is ordinary text and stays. */
    private static final Pattern CLAIM_ID_PREFIX = Pattern.compile(
            "^\\[[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}] ");

    private ObservationText() {
    }

    public static String stripClaimIdPrefix(String text) {
        if (text == null) {
            return null;
        }
        return CLAIM_ID_PREFIX.matcher(text).replaceFirst("");
    }
}
