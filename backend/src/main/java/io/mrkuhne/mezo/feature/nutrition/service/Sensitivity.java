package io.mrkuhne.mezo.feature.nutrition.service;

/** One entry of the owner's profile: an EU-14 allergen key or free text, at a level, with a note. */
public record Sensitivity(String key, SensitivityLevel level, String note) {
}
