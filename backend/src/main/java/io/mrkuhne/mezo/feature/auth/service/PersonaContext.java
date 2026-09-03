package io.mrkuhne.mezo.feature.auth.service;

/**
 * Who a prompt speaks about (S6, mezo-qw37.6). Plain display name as the user typed it at
 * registration/onboarding — no first-name splitting (Hungarian and Western name order cannot be
 * told apart) and no case inflection in this slice (spec §10).
 */
public record PersonaContext(String userName) {

    /** Used when the user row cannot be loaded — reads naturally in every template position. */
    public static final PersonaContext FALLBACK = new PersonaContext("a felhasználó");

    public static PersonaContext of(String name) {
        if (name == null || name.isBlank()) {
            return FALLBACK;
        }
        return new PersonaContext(name.strip());
    }
}
