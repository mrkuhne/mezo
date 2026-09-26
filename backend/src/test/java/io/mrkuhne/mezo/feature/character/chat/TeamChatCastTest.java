package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.chat.TeamChatCast;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.api.Test;

class TeamChatCastTest {

    /** Every rule constant on FlagKey (the SOURCE_* markers are not rules). */
    static Stream<String> ruleKeys() throws IllegalAccessException {
        List<String> keys = new ArrayList<>();
        for (Field f : FlagKey.class.getFields()) {
            if (Modifier.isStatic(f.getModifiers()) && f.getType() == String.class && !f.getName().startsWith("SOURCE_")) {
                keys.add((String) f.get(null));
            }
        }
        return keys.stream();
    }

    @ParameterizedTest @MethodSource("ruleKeys")
    void everyRuleHasAnOwnerExceptAllHealthy(String key) {
        assertThat(TeamChatCast.ownerOf(key).isPresent()).isEqualTo(!FlagKey.ALL_HEALTHY.equals(key));
    }

    @Test void specTable() {
        assertThat(TeamChatCast.ownerOf(FlagKey.SLEEP_DEBT)).contains(TeamCharacter.SZUNYA);
        assertThat(TeamChatCast.ownerOf(FlagKey.IGNORED_NUDGE)).contains(TeamCharacter.SZUNYA);
        assertThat(TeamChatCast.ownerOf(FlagKey.LATE_EATING)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.guestOf(FlagKey.LATE_EATING)).contains(TeamCharacter.SZUNYA);
        assertThat(TeamChatCast.ownerOf(FlagKey.LOAD_FUEL_MISMATCH)).contains(TeamCharacter.MOCOR);
        assertThat(TeamChatCast.guestOf(FlagKey.LOAD_FUEL_MISMATCH)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.ownerOf(FlagKey.ENERGY_DIP_MEAL_TIMING)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.guestOf(FlagKey.ENERGY_DIP_MEAL_TIMING)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.ownerOf(FlagKey.PROTOCOL_LAPSE)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.ownerOf(FlagKey.MEAL_RHYTHM_DRIFT)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.ownerOf(FlagKey.JOINT_OVERUSE)).contains(TeamCharacter.MOCOR);
        assertThat(TeamChatCast.ownerOf(FlagKey.MISSED_WORKOUTS)).contains(TeamCharacter.MOCOR);
        assertThat(TeamChatCast.ownerOf(FlagKey.RAPID_WEIGHT_LOSS)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.guestOf(FlagKey.RAPID_WEIGHT_LOSS)).contains(TeamCharacter.FALAT);
        assertThat(TeamChatCast.ownerOf(FlagKey.ACUTE_BAD_DAY)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.ownerOf(FlagKey.SUSTAINED_STRESS)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.ownerOf(FlagKey.RECOVERY_NEEDED)).contains(TeamCharacter.DERU);
        assertThat(TeamChatCast.guestOf(FlagKey.RECOVERY_NEEDED)).contains(TeamCharacter.SZUNYA);
        assertThat(TeamChatCast.ownerOf(FlagKey.MOMENTUM_AT_RISK)).contains(TeamCharacter.MEZO);
        assertThat(TeamChatCast.guestOf(FlagKey.MOMENTUM_AT_RISK)).contains(TeamCharacter.MOCOR);
        assertThat(TeamChatCast.ownerOf(FlagKey.LOGGING_GAP)).contains(TeamCharacter.MEZO);
        assertThat(TeamChatCast.guestOf(FlagKey.SLEEP_DEBT)).isEmpty();
    }
}
