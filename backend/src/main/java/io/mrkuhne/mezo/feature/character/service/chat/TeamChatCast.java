package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.util.Map;
import java.util.Optional;

/**
 * spec 2026-09-26 §5.2 — the ONE place a rule gets a voice; FlagCatalog domains are NOT
 * TeamCharacter.forMetricDomain keys (training ≠ train), so this map is explicit.
 */
public final class TeamChatCast {

    private static final Map<String, TeamCharacter> OWNER = Map.ofEntries(
            Map.entry(FlagKey.SLEEP_DEBT, TeamCharacter.SZUNYA),
            Map.entry(FlagKey.IGNORED_NUDGE, TeamCharacter.SZUNYA),
            Map.entry(FlagKey.LATE_EATING, TeamCharacter.FALAT),
            Map.entry(FlagKey.LOAD_FUEL_MISMATCH, TeamCharacter.MOCOR),
            Map.entry(FlagKey.ENERGY_DIP_MEAL_TIMING, TeamCharacter.FALAT),
            Map.entry(FlagKey.PROTOCOL_LAPSE, TeamCharacter.FALAT),
            Map.entry(FlagKey.MEAL_RHYTHM_DRIFT, TeamCharacter.FALAT),
            Map.entry(FlagKey.JOINT_OVERUSE, TeamCharacter.MOCOR),
            Map.entry(FlagKey.MISSED_WORKOUTS, TeamCharacter.MOCOR),
            Map.entry(FlagKey.RAPID_WEIGHT_LOSS, TeamCharacter.DERU),
            Map.entry(FlagKey.ACUTE_BAD_DAY, TeamCharacter.DERU),
            Map.entry(FlagKey.SUSTAINED_STRESS, TeamCharacter.DERU),
            Map.entry(FlagKey.RECOVERY_NEEDED, TeamCharacter.DERU),
            Map.entry(FlagKey.MOMENTUM_AT_RISK, TeamCharacter.MEZO),
            Map.entry(FlagKey.LOGGING_GAP, TeamCharacter.MEZO));

    private static final Map<String, TeamCharacter> GUEST = Map.ofEntries(
            Map.entry(FlagKey.LATE_EATING, TeamCharacter.SZUNYA),
            Map.entry(FlagKey.LOAD_FUEL_MISMATCH, TeamCharacter.FALAT),
            Map.entry(FlagKey.ENERGY_DIP_MEAL_TIMING, TeamCharacter.DERU),
            Map.entry(FlagKey.RAPID_WEIGHT_LOSS, TeamCharacter.FALAT),
            Map.entry(FlagKey.RECOVERY_NEEDED, TeamCharacter.SZUNYA),
            Map.entry(FlagKey.MOMENTUM_AT_RISK, TeamCharacter.MOCOR));

    private TeamChatCast() {
    }

    public static Optional<TeamCharacter> ownerOf(String flagKey) {
        return Optional.ofNullable(OWNER.get(flagKey));
    }

    public static Optional<TeamCharacter> guestOf(String flagKey) {
        return Optional.ofNullable(GUEST.get(flagKey));
    }
}
