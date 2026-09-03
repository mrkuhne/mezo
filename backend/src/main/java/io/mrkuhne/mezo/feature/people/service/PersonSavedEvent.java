package io.mrkuhne.mezo.feature.people.service;

import java.util.UUID;

/**
 * Minden olyan írás után, ami a személy nevét, kapcsolatát, cadence-ét vagy státuszát
 * megváltoztathatja (create / update / jelölt-elfogadás). A W2.2 gráf-promóciós listener
 * fogyasztja, ami szinkronban tartja a PERSON node-ot — aktív személy aktív node-ot kap,
 * minden más archiválja. A people feature semmit nem tud a gráfról: ez egyirányú esemény,
 * nincs kör (mezo-06o0.4).
 */
public record PersonSavedEvent(UUID userId, UUID personId) {
}
