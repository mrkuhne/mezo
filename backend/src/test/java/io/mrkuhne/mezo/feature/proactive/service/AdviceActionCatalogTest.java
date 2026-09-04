package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope.Action;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * S5 (bd mezo-d58h.5, spec §6): the per-{@code adviceKey} mapping to offered actions, and the
 * missing-sleep-goal gate on {@code sleep_debt}'s {@code shift_sleep_anchor} offer.
 */
class AdviceActionCatalogTest {

    private final SleepGoalRepository repository = mock(SleepGoalRepository.class);
    private final AdviceMutationPort shiftSleepAnchorPort = mock(AdviceMutationPort.class);
    private final AdviceMutationPort lightenTomorrowPort = mock(AdviceMutationPort.class);
    private final AdviceActionCatalog catalog;

    AdviceActionCatalogTest() {
        when(shiftSleepAnchorPort.actionKey()).thenReturn(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        when(lightenTomorrowPort.actionKey()).thenReturn(AdviceActionKey.LIGHTEN_TOMORROW);
        catalog = new AdviceActionCatalog(repository, List.of(shiftSleepAnchorPort, lightenTomorrowPort));
    }

    @Test
    void testForCard_shouldOfferShiftSleepAnchor_whenSleepDebtAndGoalRowExists() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.of(new SleepGoalEntity()));

        List<Action> actions = catalog.forCard(user, FlagKey.SLEEP_DEBT);

        assertThat(actions).hasSize(1);
        Action action = actions.get(0);
        assertThat(action.key()).isEqualTo(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        assertThat(action.label()).isNotBlank();
        assertThat(action.params()).containsEntry("minutes", -30);
    }

    @Test
    void testForCard_shouldOfferNothing_whenSleepDebtAndNoGoalRow() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.empty());

        assertThat(catalog.forCard(user, FlagKey.SLEEP_DEBT)).isEmpty();
    }

    /** mezo-d58h.5 review fix: {@code SleepAnchorShiftAdapter} carries its own feature-switch
     *  gate independent of this catalog — with the switch off (so Spring never registers the
     *  port) but a stale {@code sleep_goal} row still present, the OLD behavior offered
     *  {@code shift_sleep_anchor} anyway and {@code AdviceApplyService#apply} 500'd with
     *  {@code PROACTIVE_ADVICE_ACTION_PORT_MISSING} for a user who did nothing wrong. The catalog
     *  must consult the actual port registry, not just the sleep-goal row. */
    @Test
    void testForCard_shouldOfferNothing_whenShiftSleepAnchorPortIsNotRegistered() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.of(new SleepGoalEntity()));
        AdviceActionCatalog catalogWithNoPorts = new AdviceActionCatalog(repository, List.of());

        assertThat(catalogWithNoPorts.forCard(user, FlagKey.SLEEP_DEBT)).isEmpty();
    }

    /** S6 (bd mezo-d58h.6): {@code joint_overuse}'s round-2 offer — cross-checked against {@code
     *  ignored_nudge} below so a copy-paste mapping error (offering the wrong action for the
     *  wrong key) fails a test instead of shipping. */
    @Test
    void testForCard_shouldOfferLightenTomorrow_whenJointOveruse() {
        UUID user = UUID.randomUUID();

        List<Action> actions = catalog.forCard(user, FlagKey.JOINT_OVERUSE);

        assertThat(actions).hasSize(1);
        Action action = actions.get(0);
        assertThat(action.key()).isEqualTo(AdviceActionKey.LIGHTEN_TOMORROW);
        assertThat(action.label()).isNotBlank();
        assertThat(action.params()).containsEntry("delta", -1);
    }

    @Test
    void testForCard_shouldOfferNothing_whenJointOveruseAndLightenTomorrowPortIsNotRegistered() {
        UUID user = UUID.randomUUID();
        AdviceActionCatalog catalogWithNoPorts = new AdviceActionCatalog(repository, List.of());

        assertThat(catalogWithNoPorts.forCard(user, FlagKey.JOINT_OVERUSE)).isEmpty();
    }

    /** S6: {@code ignored_nudge}'s round-2 offer keeps the SAME sleep-goal-row precondition as
     *  {@code sleep_debt}'s {@code shift_sleep_anchor} offer — even though {@code ignored_nudge}'s
     *  own rule gate happens to guarantee a goal row exists before it can ever raise, the catalog
     *  must not assume that and re-checks the repository itself. */
    @Test
    void testForCard_shouldOfferShiftSleepAnchor_whenIgnoredNudgeAndGoalRowExists() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.of(new SleepGoalEntity()));

        List<Action> actions = catalog.forCard(user, FlagKey.IGNORED_NUDGE);

        assertThat(actions).hasSize(1);
        Action action = actions.get(0);
        assertThat(action.key()).isEqualTo(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        assertThat(action.label()).isNotBlank();
        assertThat(action.params()).containsEntry("minutes", -30);
    }

    @Test
    void testForCard_shouldOfferNothing_whenIgnoredNudgeAndNoGoalRow() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.empty());

        assertThat(catalog.forCard(user, FlagKey.IGNORED_NUDGE)).isEmpty();
    }

    @Test
    void testForCard_shouldOfferNothing_whenIgnoredNudgeAndShiftSleepAnchorPortIsNotRegistered() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.of(new SleepGoalEntity()));
        AdviceActionCatalog catalogWithNoPorts = new AdviceActionCatalog(repository, List.of());

        assertThat(catalogWithNoPorts.forCard(user, FlagKey.IGNORED_NUDGE)).isEmpty();
    }

    @Test
    void testForCard_neitherJointOveruseNorIgnoredNudge_shouldCarryTheOthersAction() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.of(new SleepGoalEntity()));

        List<Action> jointOveruseActions = catalog.forCard(user, FlagKey.JOINT_OVERUSE);
        List<Action> ignoredNudgeActions = catalog.forCard(user, FlagKey.IGNORED_NUDGE);

        assertThat(jointOveruseActions).extracting(Action::key).doesNotContain(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        assertThat(ignoredNudgeActions).extracting(Action::key).doesNotContain(AdviceActionKey.LIGHTEN_TOMORROW);
    }

    @Test
    void testForCard_shouldOfferNothing_forMissingSleepGoalCard() {
        UUID user = UUID.randomUUID();

        assertThat(catalog.forCard(user, SetupCheckService.CHECK_MISSING_SLEEP_GOAL)).isEmpty();
    }

    @Test
    void testForCard_shouldOfferNothing_forAnUnmappedKey() {
        UUID user = UUID.randomUUID();

        assertThat(catalog.forCard(user, FlagKey.MISSED_WORKOUTS)).isEmpty();
    }

    /** Spec §5: "up to 2 action buttons" — a future contributor adding a third entry to any key
     *  fails here rather than shipping a cramped card. */
    @Test
    void testForCard_shouldNeverExceedTheTwoActionCap() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.of(new SleepGoalEntity()));

        for (String adviceKey : List.of(FlagKey.SLEEP_DEBT, SetupCheckService.CHECK_MISSING_SLEEP_GOAL,
                FlagKey.MISSED_WORKOUTS, FlagKey.LOGGING_GAP, FlagKey.JOINT_OVERUSE, FlagKey.IGNORED_NUDGE)) {
            assertThat(catalog.forCard(user, adviceKey).size())
                .as("adviceKey %s", adviceKey)
                .isLessThanOrEqualTo(AdviceActionCatalog.MAX_ACTIONS_PER_CARD);
        }
    }
}
