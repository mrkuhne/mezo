package io.mrkuhne.mezo.feature.biometrics.checkin.entity;

/**
 * Check-in 2.0 pain regions (mezo-ck2) — the fixed, side-less list of the "Hol fáj?" figure.
 * The constant names are the stored values ({@code check_in.pain_regions}, CHECK
 * {@code ck_check_in_pain_regions}) and the contract's {@code PainRegion} enum; {@link #label()}
 * is the Hungarian display label the sheet and every prompt renderer use.
 */
public enum PainRegion {
    FEJ("Fej"),
    NYAK("Nyak"),
    VALL("Váll"),
    KONYOK("Könyök"),
    CSUKLO_KEZ("Csukló, kéz"),
    FELSO_HAT("Felső hát"),
    DEREK("Derék"),
    CSIPO("Csípő"),
    HAS("Has"),
    TERD("Térd"),
    BOKA_LABFEJ("Boka, lábfej"),
    EGYEB("Egyéb");

    private final String label;

    PainRegion(String label) {
        this.label = label;
    }

    /** Hungarian display label, e.g. "Csukló, kéz". */
    public String label() {
        return label;
    }
}
