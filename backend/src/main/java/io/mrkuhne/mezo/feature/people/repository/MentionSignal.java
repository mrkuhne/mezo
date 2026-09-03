package io.mrkuhne.mezo.feature.people.repository;

import java.time.Instant;
import java.util.UUID;

/**
 * Egy említés HANGULAT-JELE — pontosan az a négy mező, amiből a heti szám, az utolsó említés
 * ideje és a hangulat-ív felépül (mezo-cc6x). A többi oszlop (`excerpt`, `source`,
 * `contextLabel`, `tiedTo*`, `sourceRef*`) sosem kell ehhez a számításhoz, és a chat-pillanatkép
 * MINDEN beszélgetési körben újraolvassa — ezért projekció, nem entitás: nincs szabadszöveg a
 * hálózaton, és nincs managed entitás a hívó tranzakciójának persistence contextjében
 * (a `prepareTurn` read-write, tehát a flush minden behúzott entitást dirty-checkelne).
 *
 * @param personId a személy, akire az említés vonatkozik
 * @param ts       az említés ideje
 * @param tone     a tónus; {@code null}, amíg az éjszakai kör nem töltötte
 * @param intensity 1..3; {@code null} a chip-es és az S4 előtti soroknál
 */
public record MentionSignal(UUID personId, Instant ts, String tone, Short intensity) {}
