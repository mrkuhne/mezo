package io.mrkuhne.mezo.feature.character.service.edition;

import java.util.Locale;

/** A kiadás-poszt műfaja — a FE `FeedPostKind` kulcsai (teamFeed.ts). */
public enum EditionGenre {
    MEGFIGYELES, SEJTES, KERDES, KISERLET, ELOREJELZES, KONZILIUM, KERES, ERTEKELES;
    public String key() { return name().toLowerCase(Locale.ROOT); }
    /** A feltöltő műfajok: csak akkor mennek ki, ha a fő jelöltek 3 alatt maradnak. */
    public boolean filler() { return this == SEJTES || this == KERES; }
}
