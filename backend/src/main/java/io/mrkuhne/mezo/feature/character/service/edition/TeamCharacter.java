package io.mrkuhne.mezo.feature.character.service.edition;

import java.util.Locale;
import java.util.Map;

/** Az 5 boop + a Szkeptikus (spec 2026-09-24 §3.4). A FE `logic/team.ts` tükre — a két tábla
 *  eset-listáját a TeamCharacterTest és a team.test.ts ugyanúgy rögzíti. */
public enum TeamCharacter {
    SZUNYA, MOCOR, FALAT, DERU, MEZO, SZKEPTIKUS;

    private static final Map<String, TeamCharacter> PERSONA = Map.of(
            "szomnologus", SZUNYA, "edzo", MOCOR, "drill", MOCOR, "taplalkozo", FALAT,
            "pszichologus", DERU, "doki", DERU, "antropologus", MEZO, "mezo", MEZO, "szkeptikus", SZKEPTIKUS);
    private static final Map<String, TeamCharacter> DOMAIN = Map.of(
            "sleep", SZUNYA, "train", MOCOR, "fuel", FALAT, "mind", DERU, "body", DERU, "other", MEZO);

    public String key() { return name().toLowerCase(Locale.ROOT); }
    public boolean postable() { return this != SZKEPTIKUS; }
    public static TeamCharacter forPersona(String expertKey) { return PERSONA.getOrDefault(expertKey, MEZO); }
    public static TeamCharacter forMetricDomain(String domain) { return DOMAIN.getOrDefault(domain, MEZO); }
    public static TeamCharacter postableOr(TeamCharacter c) { return c.postable() ? c : MEZO; }
}
