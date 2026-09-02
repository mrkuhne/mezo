package io.mrkuhne.mezo.feature.people.service;

import java.time.LocalDate;
import java.util.List;

/**
 * Egy személy hangulat-íve és az abból olvasott irány (Emberek S6, mezo-06o0.8).
 *
 * @param readings heti olvasatok 1..5 skálán, IDŐRENDBEN (a legrégebbi elöl); csak azok a
 *                 hetek szerepelnek, ahol volt legalább egy tónusozott említés
 * @param startWeek a legelső olvasat hetének hétfője — ebből tudja a felület, milyen
 *                 időablakot címkézzen; {@code null}, ha nincs olvasat
 * @param direction {@code up} | {@code down} | {@code flat}
 * @param reason   magyar, determinisztikus indoklás az irány alatt; {@code null}, ha nincs
 *                 mit indokolni (nincs olvasat)
 */
public record PersonAffectTrend(List<Integer> readings, LocalDate startWeek, String direction,
    String reason) {

    public static final String DIRECTION_UP = "up";
    public static final String DIRECTION_DOWN = "down";
    public static final String DIRECTION_FLAT = "flat";

    /** Nincs egyetlen tónusozott említés sem — az ív üres, az irány lapos, nincs indoklás. */
    public static final PersonAffectTrend EMPTY =
        new PersonAffectTrend(List.of(), null, DIRECTION_FLAT, null);
}
