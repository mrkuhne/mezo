package io.mrkuhne.mezo.feature.companion.service;

/** A metrikák élet-domén besorolása a Motor tab csoportosításához (mezo-18bx). */
public enum MetricDomain {

    SLEEP("Alvás"),
    TRAIN("Edzés"),
    FUEL("Táplálkozás"),
    MIND("Mentális & társas"),
    BODY("Test"),
    OTHER("Egyéb");

    private final String labelHu;

    MetricDomain(String labelHu) {
        this.labelHu = labelHu;
    }

    public String labelHu() {
        return labelHu;
    }

    /** Wire-kulcs a contractnak (kisbetűs enum-név). */
    public String wireKey() {
        return name().toLowerCase(java.util.Locale.ROOT);
    }
}
