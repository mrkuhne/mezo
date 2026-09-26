package io.mrkuhne.mezo.feature.character.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Task 10 (mezo-a9bo7.23): the team chat push budget as a pure static lookup. Plain unit test —
 * no Spring involvement, matching the {@code AdvicePriorityTest} precedent it delegates to.
 */
class TeamChatPushPolicyTest {

    // ACUTE_BAD_DAY outranks LOAD_FUEL_MISMATCH, which outranks SLEEP_DEBT, which outranks
    // LOGGING_GAP (AdvicePriority.ORDER) — used throughout to exercise the severity comparison.

    @Test
    void firstPushOfTheDay_alwaysPushes() {
        assertThat(TeamChatPushPolicy.shouldPush(FlagKey.LOGGING_GAP, List.of(), 2)).isTrue();
    }

    @Test
    void secondPush_pushesWhenMoreSevereThanEveryPushedFlag() {
        assertThat(TeamChatPushPolicy.shouldPush(FlagKey.ACUTE_BAD_DAY, List.of(FlagKey.SLEEP_DEBT), 2)).isTrue();
    }

    @Test
    void secondPush_silentWhenNotMoreSevere() {
        assertThat(TeamChatPushPolicy.shouldPush(FlagKey.SLEEP_DEBT, List.of(FlagKey.ACUTE_BAD_DAY), 2)).isFalse();
    }

    @Test
    void secondPush_silentOnATie() {
        assertThat(TeamChatPushPolicy.shouldPush(FlagKey.SLEEP_DEBT, List.of(FlagKey.SLEEP_DEBT), 2)).isFalse();
    }

    @Test
    void secondPush_mustOutrankEveryPushedFlag_notJustOne() {
        assertThat(TeamChatPushPolicy.shouldPush(FlagKey.LOAD_FUEL_MISMATCH,
                List.of(FlagKey.ACUTE_BAD_DAY, FlagKey.SLEEP_DEBT), 3)).isFalse();
    }

    @Test
    void thirdPush_silentEvenWhenMoreSevereThanEverythingPushed_theBudgetIsSpent() {
        assertThat(TeamChatPushPolicy.shouldPush(FlagKey.ACUTE_BAD_DAY,
                List.of(FlagKey.SLEEP_DEBT, FlagKey.LOGGING_GAP), 2)).isFalse();
    }
}
