package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.ProtocolPopulator;
import io.mrkuhne.mezo.support.populator.SupplementIntakePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)): a protocol item missed on
 * {@code consecutiveMissedDays} consecutive DUE days, but only where a real habit existed first —
 * see {@code ProtocolLapseRule}'s own javadoc for the three load-bearing bounds this file proves
 * (peri-workout due-day gate, {@code startedOn} lower bound, window-ends-yesterday) plus the
 * per-item cooldown.
 */
class FlagEvaluatorProtocolLapseIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private ProtocolPopulator protocolPopulator;
    @Autowired private SupplementIntakePopulator supplementIntakePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private ProtocolRepository protocolRepository;

    private static final LocalDate TODAY = LocalDate.now();

    private record Fixture(UUID owner, UUID pantryItemId) {}

    private List<String> keys(UUID owner) {
        return raisedKeys(evaluator.evaluate(owner));
    }

    /** The keys that actually RAISED — the old evaluate() return, reconstructed. */
    private static List<String> raisedKeys(List<FlagVerdict> verdicts) {
        return verdicts.stream()
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(FlagVerdict::flagKey)
            .toList();
    }

    private static FlagVerdict verdictFor(List<FlagVerdict> verdicts, String flagKey) {
        return verdicts.stream().filter(v -> flagKey.equals(v.flagKey())).findFirst().orElseThrow();
    }

    private Optional<FlagPayloadEnvelope.ProtocolLapse> payload(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.PROTOCOL_LAPSE.equals(v.flagKey()))
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(v -> v.payload().protocolLapse())
            .findFirst();
    }

    /** An item in a NON-peri zone (due every day), started 40 days ago, with intakes logged on
     *  every day from 30 days ago through {@code lastTaken} inclusive. */
    private Fixture habitItem(String name, String slotKey, LocalDate lastTaken) {
        UUID owner = userPopulator.createUser().getId();
        UUID pantry = pantryItemPopulator.createSupplement(owner, name).getId();
        UUID protocolId = protocolPopulator.createActiveProtocol(owner).getId();
        protocolPopulator.createProtocolItemAt(owner, protocolId, pantry, slotKey, null,
            TODAY.minusDays(40).atStartOfDay(ZoneId.systemDefault()).toInstant());
        for (LocalDate d = TODAY.minusDays(30); !d.isAfter(lastTaken); d = d.plusDays(1)) {
            supplementIntakePopulator.createIntake(owner, pantry, d, slotKey);
        }
        return new Fixture(owner, pantry);
    }

    /** The detection: due yesterday and the day before, missed both, after a month of taking it. */
    @Test
    void raises_on_the_second_consecutive_missed_due_day() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(3));

        assertThat(keys(f.owner())).contains(FlagKey.PROTOCOL_LAPSE);
        assertThat(payload(f.owner())).hasValueSatisfying(p -> {
            assertThat(p.itemName()).isEqualTo("Magnézium");
            assertThat(p.consecutiveMissedDueDays()).isEqualTo(2);
            assertThat(p.missedDueDates())
                .containsExactly(TODAY.minusDays(2).toString(), TODAY.minusDays(1).toString());
            assertThat(p.lastTakenDate()).isEqualTo(TODAY.minusDays(3).toString());
        });
    }

    /** ONE missed day is an implicit grace day — the rule never speaks on it. */
    @Test
    void stays_silent_on_a_single_missed_due_day() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(2));

        assertThat(keys(f.owner())).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** Today is still in progress: an item taken through yesterday, with nothing logged today,
     *  is NOT lapsing. This is the window-ends-yesterday bound. */
    @Test
    void stays_silent_when_only_today_is_missing() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(1));

        assertThat(keys(f.owner())).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** A freshly added item has no habit to lose: started 3 days ago, missed the last two, but
     *  fewer than min-history-due-days of history exist. */
    @Test
    void stays_silent_when_the_item_is_too_new_to_have_a_habit() {
        UUID owner = userPopulator.createUser().getId();
        UUID pantry = pantryItemPopulator.createSupplement(owner, "Kreatin").getId();
        UUID protocolId = protocolPopulator.createActiveProtocol(owner).getId();
        protocolPopulator.createProtocolItemAt(owner, protocolId, pantry, "wake", null,
            TODAY.minusDays(3).atStartOfDay(ZoneId.systemDefault()).toInstant());
        supplementIntakePopulator.createIntake(owner, pantry, TODAY.minusDays(3), "wake");

        assertThat(keys(owner)).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** A habit that never really existed: 30 due days, taken on only 9 of them (30%), then two
     *  misses. Below min-history-adherence ⇒ silence. */
    @Test
    void stays_silent_when_prior_adherence_was_below_the_threshold() {
        UUID owner = userPopulator.createUser().getId();
        UUID pantry = pantryItemPopulator.createSupplement(owner, "Cink").getId();
        UUID protocolId = protocolPopulator.createActiveProtocol(owner).getId();
        protocolPopulator.createProtocolItemAt(owner, protocolId, pantry, "evening", null,
            TODAY.minusDays(40).atStartOfDay(ZoneId.systemDefault()).toInstant());
        for (int i = 3; i <= 30; i += 3) {
            supplementIntakePopulator.createIntake(owner, pantry, TODAY.minusDays(i), "evening");
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** No active protocol at all is setup-check territory, never a lapse. */
    @Test
    void stays_silent_when_there_is_no_active_protocol() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(keys(owner)).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** A peri-workout item is not DUE on a rest day, so two trainingless days are not two misses.
     *  The fixture logs no completed workouts at all. */
    @Test
    void stays_silent_when_the_missed_days_were_rest_days_for_a_peri_workout_item() {
        Fixture f = habitItem("BCAA", "post_workout", TODAY.minusDays(3));

        assertThat(keys(f.owner())).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** The positive half of the peri-workout gate: a {@code post_workout} item genuinely raises
     *  when it IS due — i.e. on a day with a completed gym session — and was missed on the two
     *  most-recent such days. A {@code dueOn} that always returned {@code false} for peri zones
     *  would pass every other test in this file but would also make this one fail, since nothing
     *  would ever be "due" enough to accumulate a miss run. */
    @Test
    void raises_for_a_peri_workout_item_on_days_it_was_actually_due() {
        UUID owner = userPopulator.createUser().getId();
        UUID pantry = pantryItemPopulator.createSupplement(owner, "BCAA").getId();
        UUID protocolId = protocolPopulator.createActiveProtocol(owner).getId();
        protocolPopulator.createProtocolItemAt(owner, protocolId, pantry, "post_workout", null,
            TODAY.minusDays(40).atStartOfDay(ZoneId.systemDefault()).toInstant());

        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity templateDay = trainPopulator.createTemplateDay(owner, meso.getId(), "Push nap");
        // Completed gym instances on every day from 32 days ago through yesterday — this makes
        // the item DUE on every one of those days, both across the history window and across the
        // two most-recent days it is missed on.
        for (LocalDate d = TODAY.minusDays(32); !d.isAfter(TODAY.minusDays(1)); d = d.plusDays(1)) {
            trainPopulator.createWorkoutInstance(owner, templateDay, d, "completed");
        }
        // Taken on every due day from 30 days ago through 3 days ago — then missed on the last two.
        for (LocalDate d = TODAY.minusDays(30); !d.isAfter(TODAY.minusDays(3)); d = d.plusDays(1)) {
            supplementIntakePopulator.createIntake(owner, pantry, d, "post_workout");
        }

        assertThat(keys(owner)).contains(FlagKey.PROTOCOL_LAPSE);
        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.itemName()).isEqualTo("BCAA");
            assertThat(p.consecutiveMissedDueDays()).isEqualTo(2);
            assertThat(p.missedDueDates())
                .containsExactly(TODAY.minusDays(2).toString(), TODAY.minusDays(1).toString());
            assertThat(p.lastTakenDate()).isEqualTo(TODAY.minusDays(3).toString());
        });
    }

    /** The per-ITEM cooldown: a raise for this item 3 days ago suppresses it, even though the
     *  key-level cooldown (24h) has long expired. */
    @Test
    void stays_silent_when_the_same_item_was_already_announced_inside_the_per_item_cooldown() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(3));
        flagLogPopulator.raiseAt(f.owner(), FlagKey.PROTOCOL_LAPSE, FlagKey.SOURCE_SWEEP,
            FlagPayloadEnvelope.protocolLapse(new FlagPayloadEnvelope.ProtocolLapse(
                f.pantryItemId().toString(), "Magnézium", "evening", 2, 2,
                List.of(), null, 14, 12, 0.857, 0.60)),
            Instant.now().minus(3, ChronoUnit.DAYS));

        assertThat(keys(f.owner())).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** ...but a DIFFERENT item is not suppressed by that raise — this is why the key-level
     *  cooldown is 24h and the 7-day guard is per item. */
    @Test
    void still_raises_for_a_different_item_inside_the_per_item_cooldown() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(3));
        UUID other = pantryItemPopulator.createSupplement(f.owner(), "D3-vitamin").getId();
        UUID protocolId = protocolRepository
            .findByCreatedByAndStatusAndDeletedFalse(f.owner(), "active").orElseThrow().getId();
        protocolPopulator.createProtocolItemAt(f.owner(), protocolId, other, "wake", null,
            TODAY.minusDays(40).atStartOfDay(ZoneId.systemDefault()).toInstant());
        for (LocalDate d = TODAY.minusDays(30); !d.isAfter(TODAY.minusDays(3)); d = d.plusDays(1)) {
            supplementIntakePopulator.createIntake(f.owner(), other, d, "wake");
        }
        flagLogPopulator.raiseAt(f.owner(), FlagKey.PROTOCOL_LAPSE, FlagKey.SOURCE_SWEEP,
            FlagPayloadEnvelope.protocolLapse(new FlagPayloadEnvelope.ProtocolLapse(
                f.pantryItemId().toString(), "Magnézium", "evening", 2, 2,
                List.of(), null, 14, 12, 0.857, 0.60)),
            Instant.now().minus(3, ChronoUnit.DAYS));

        assertThat(payload(f.owner())).hasValueSatisfying(p ->
            assertThat(p.itemName()).isEqualTo("D3-vitamin"));
    }
}
