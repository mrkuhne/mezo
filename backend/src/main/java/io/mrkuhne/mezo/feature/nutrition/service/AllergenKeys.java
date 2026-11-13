package io.mrkuhne.mezo.feature.nutrition.service;

import java.util.Set;

/** The EU-14 mandatory allergen keys. Any other sensitivity key is free text with no structured state. */
public final class AllergenKeys {

    public static final Set<String> EU14 = Set.of(
        "gluten", "crustaceans", "eggs", "fish", "peanuts", "soybeans", "milk",
        "nuts", "celery", "mustard", "sesame", "sulphites", "lupin", "molluscs");

    private AllergenKeys() {
    }

    public static boolean isEu14(String key) {
        return key != null && EU14.contains(key);
    }
}
