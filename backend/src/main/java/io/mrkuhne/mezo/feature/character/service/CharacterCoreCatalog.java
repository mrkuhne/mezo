package io.mrkuhne.mezo.feature.character.service;

import java.util.List;

/** The 7 CORE dimensions (Karakter spec §2) — seeded lazily, never deleted. */
public final class CharacterCoreCatalog {

    public record CoreDimension(String key, String title, String expertKey) {}

    public static final List<CoreDimension> CORE = List.of(
            new CoreDimension("physical", "Fizikai", "doki"),
            new CoreDimension("athletic", "Sportolói", "edzo"),
            new CoreDimension("nutrition", "Táplálkozási", "taplalkozo"),
            new CoreDimension("recovery", "Alvás & regeneráció", "szomnologus"),
            new CoreDimension("mental", "Mentális & érzelmi", "pszichologus"),
            new CoreDimension("discipline", "Motiváció & fegyelem", "drill"),
            new CoreDimension("life", "Élet & kapcsolatok", "antropologus"));

    private CharacterCoreCatalog() {}
}
