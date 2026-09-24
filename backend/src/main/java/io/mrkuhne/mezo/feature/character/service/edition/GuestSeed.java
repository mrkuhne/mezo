package io.mrkuhne.mezo.feature.character.service.edition;

/**
 * Egy vendég-sor magja egy kiadás-jelöltön (H4, mezo-a9bo7.15): KI szólhat hozzá a poszthoz, és
 * mi a becsületes visszaesése, ha a hang-hívás nem ad neki átengedhető sort.
 *
 * <p>{@code fallbackText} a konzílium-szálaknál a meglévő cross-talk reakció / a Szkeptikus
 * érve (ez már elhangzott, tehát nem kitalált); a két doménes mintapárnál null — ott nincs mit
 * idézni, a vendég a hang nélkül egyszerűen kimarad.
 */
public record GuestSeed(TeamCharacter character, String fallbackText) {
}
