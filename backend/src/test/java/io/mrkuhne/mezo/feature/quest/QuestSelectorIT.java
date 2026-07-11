package io.mrkuhne.mezo.feature.quest;

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
}
