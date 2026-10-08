package io.mrkuhne.mezo.feature.quest;

import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestSelector;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Deterministic catalog selection: slot composition, day-type filter, distinct metrics, cooldown. */
class QuestSelectorIT extends AbstractIntegrationTest {

    @Autowired private RecoveryPeriodPopulator recoveryPeriodPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private QuestSelector selector;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailyQuestRepository repository;

    private static final LocalDate DATE = LocalDate.of(2026, 7, 11);

    @Test
    void testGenerate_shouldPickRestBodyAndOneFuelBioWithDistinctMetrics_whenNoActiveMeso() {
        UUID owner = userPopulator.createUser("sel-a@test.hu").getId();

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        assertThat(quests).hasSize(3);
        assertThat(quests).extracting(DailyQuestEntity::getSlot)
            .containsExactlyInAnyOrder(DailyQuestEntity.SLOT_BODY, DailyQuestEntity.SLOT_FUELBIO,
                DailyQuestEntity.SLOT_GROWTH);
        // no active meso → REST day → the BODY slot must hold the rest-day quest
        assertThat(quests).filteredOn(q -> q.getSlot().equals(DailyQuestEntity.SLOT_BODY))
            .first().extracting(DailyQuestEntity::getCatalogKey).isEqualTo("body_rest_sleep");
        // distinct-metric rule: rest-day BODY is sleep_target → FUELBIO must not be bio_sleep
        assertThat(quests).extracting(q -> q.getTarget().metric()).doesNotHaveDuplicates();
        // protein requires a goal prescription → never picked without one
        assertThat(quests).extracting(DailyQuestEntity::getCatalogKey).doesNotContain("bio_protein");
    }

    @Test
    void testGenerate_shouldPickSameKeys_whenRegeneratedForSameUserAndDate() {
        UUID owner = userPopulator.createUser("sel-b@test.hu").getId();
        List<DailyQuestEntity> first = selector.generate(owner, DATE);
        List<String> firstKeys = first.stream().map(DailyQuestEntity::getCatalogKey).toList();

        // soft-delete (@SQLDelete) frees the partial unique index AND hides the rows from the
        // cooldown window — a regeneration for the same (user, date) must pick the same keys
        repository.deleteAll(first);
        List<String> secondKeys = selector.generate(owner, DATE).stream()
            .map(DailyQuestEntity::getCatalogKey).toList();

        assertThat(secondKeys).isEqualTo(firstKeys);
    }

    @Test
    void testGenerate_shouldExcludeCooldownKeys_whenPickedRecently() {
        UUID owner = userPopulator.createUser("sel-c@test.hu").getId();
        List<String> day1 = selector.generate(owner, DATE).stream()
            .map(DailyQuestEntity::getCatalogKey).toList();
        List<String> day2 = selector.generate(owner, DATE.plusDays(1)).stream()
            .map(DailyQuestEntity::getCatalogKey).toList();
        // FUELBIO keys carry cooldownDays >= 2 → the day-2 FUELBIO pick must differ from day-1's
        String bio1 = day1.stream().filter(k -> k.startsWith("bio_")).findFirst().orElseThrow();
        String bio2 = day2.stream().filter(k -> k.startsWith("bio_")).findFirst().orElseThrow();
        assertThat(bio2).isNotEqualTo(bio1);
    }

    private void goalWithProteinPrescription(UUID owner) {
        goalPopulator.createGoalFull(owner, DATE.minusDays(2), DATE.plusWeeks(20),
            new GoalPrescriptionJson(null, "formula",
                List.of(new GoalPrescriptionJson.Segment(1, 30, "vágás", 2600, 180, 250, 80,
                    null, null, null, null, null, null, null)),
                null, null),
            4, "06:30", "22:30");
    }

    private boolean anyDayPicksProtein(UUID owner) {
        for (int i = 0; i < 40; i++) {
            LocalDate d = DATE.plusDays(i * 5L); // spaced past the cooldown window
            if (selector.generate(owner, d).stream().anyMatch(q -> "protein_target".equals(q.getTarget().metric()))) {
                return true;
            }
        }
        return false;
    }

    /** Kihagyás S3 (mezo-q4xt2.3): on a sick day (GUIDANCE) the protein quest is never offered; water stays. */
    @Test
    void testGenerate_shouldNeverOfferProteinQuest_onAGuidanceDay() {
        UUID withPeriod = userPopulator.createUser("sel-g1@test.hu").getId();
        UUID without = userPopulator.createUser("sel-g2@test.hu").getId();
        goalWithProteinPrescription(withPeriod);
        goalWithProteinPrescription(without);
        recoveryPeriodPopulator.ended(withPeriod, Reason.ILLNESS, DATE.minusDays(1), DATE.plusDays(400));

        // control: without the period the protein quest does come up over the same dates
        assertThat(anyDayPicksProtein(without)).isTrue();
        assertThat(anyDayPicksProtein(withPeriod)).isFalse();
    }

    @Test
    void testGenerate_shouldKeepWaterQuestEligible_onAGuidanceDay() {
        UUID owner = userPopulator.createUser("sel-g3@test.hu").getId();
        goalWithProteinPrescription(owner);
        recoveryPeriodPopulator.ended(owner, Reason.STOMACH, DATE.minusDays(1), DATE.plusDays(400));

        boolean water = false;
        for (int i = 0; i < 40 && !water; i++) {
            water = selector.generate(owner, DATE.plusDays(i * 5L)).stream()
                .anyMatch(q -> "water_target".equals(q.getTarget().metric()));
        }
        assertThat(water).isTrue();
    }
}
