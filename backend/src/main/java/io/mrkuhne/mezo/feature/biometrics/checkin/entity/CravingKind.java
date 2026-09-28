package io.mrkuhne.mezo.feature.biometrics.checkin.entity;

/**
 * Check-in 2.0 craving kinds (mezo-ck2) — "Mit kívánsz?", asked when the craving answer is 4+.
 * Constant names are the stored values ({@code check_in.craving_kinds}, CHECK
 * {@code ck_check_in_craving_kinds}) and the contract's {@code CravingKind} enum.
 */
public enum CravingKind {
    EDES("Édes"),
    SOS("Sós"),
    ZSIROS("Zsíros"),
    BARMIT("Bármit");

    private final String label;

    CravingKind(String label) {
        this.label = label;
    }

    /** Hungarian display label, e.g. "Édes". */
    public String label() {
        return label;
    }
}
