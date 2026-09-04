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
    private final AdviceActionCatalog catalog = new AdviceActionCatalog(repository);

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
                FlagKey.MISSED_WORKOUTS, FlagKey.LOGGING_GAP)) {
            assertThat(catalog.forCard(user, adviceKey).size())
                .as("adviceKey %s", adviceKey)
                .isLessThanOrEqualTo(AdviceActionCatalog.MAX_ACTIONS_PER_CARD);
        }
    }
}
