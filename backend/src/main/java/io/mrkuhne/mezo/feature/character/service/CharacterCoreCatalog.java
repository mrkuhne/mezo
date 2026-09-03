package io.mrkuhne.mezo.feature.character.service;

import java.util.List;

/** The 7 CORE dimensions (Karakter spec §2) + the single META dimension (round-4 spec §4.2) —
 *  all seeded lazily, never deleted. META is the companion's own self-audit: its claims are ABOUT
 *  THE SYSTEM (prediction calibration, quest calibration, fact-triage hit rate), owned by the
 *  Szkeptikus, and sit beside — never inside — the user's seven dimensions. */
public final class CharacterCoreCatalog {

    public record CoreDimension(String key, String title, String expertKey) {}

    public static final String KIND_CORE = "CORE";
    public static final String KIND_META = "META";

    public static final List<CoreDimension> CORE = List.of(
            new CoreDimension("physical", "Fizikai", "doki"),
            new CoreDimension("athletic", "Sportolói", "edzo"),
            new CoreDimension("nutrition", "Táplálkozási", "taplalkozo"),
            new CoreDimension("recovery", "Alvás & regeneráció", "szomnologus"),
            new CoreDimension("mental", "Mentális & érzelmi", "pszichologus"),
            new CoreDimension("discipline", "Motiváció & fegyelem", "drill"),
            new CoreDimension("life", "Élet & kapcsolatok", "antropologus"));

    public static final List<CoreDimension> META = List.of(
            new CoreDimension("self-audit", "A társ önvizsgálata", "szkeptikus"));

    /** CORE in catalog order, then META — the seeding and the "known dimension key" order. */
    public static final List<CoreDimension> SEEDED = java.util.stream.Stream
            .concat(CORE.stream(), META.stream()).toList();

    /** {@code "CORE"} / {@code "META"} for a seeded key; null for anything else (a CHAPTER). */
    public static String kindOf(String key) {
        if (CORE.stream().anyMatch(c -> c.key().equals(key))) {
            return KIND_CORE;
        }
        if (META.stream().anyMatch(m -> m.key().equals(key))) {
            return KIND_META;
        }
        return null;
    }

    private CharacterCoreCatalog() {}
}
