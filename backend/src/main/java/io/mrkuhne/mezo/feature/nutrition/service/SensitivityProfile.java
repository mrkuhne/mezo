package io.mrkuhne.mezo.feature.nutrition.service;

import java.util.List;

public record SensitivityProfile(List<Sensitivity> items, NovaRule novaRule) {

    /** What an owner with no saved row gets: nothing listed, the default NOVA rule on. */
    public static SensitivityProfile defaults() {
        return new SensitivityProfile(List.of(), NovaRule.defaults());
    }
}
