package io.mrkuhne.mezo.feature.people.service;

import java.util.UUID;

/** S8 (mezo-d6ivw.12): a person named in a message — the read-only matcher's result. */
public record MatchedPerson(UUID id, String name) {}
