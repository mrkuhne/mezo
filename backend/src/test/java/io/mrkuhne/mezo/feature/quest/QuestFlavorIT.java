package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestFlavor;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** Flavor rewrite (E3): companion voice on title/why ONLY; catalog copy on any bad answer. */
@ActiveProfiles("companion-fake")
class QuestFlavorIT extends AbstractIntegrationTest {

    @Autowired private QuestFlavor flavor;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private DailyQuestRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRewrite_shouldOverwriteTitleAndWhy_whenScriptedAnswerValid() {
        UUID owner = userPopulator.createUser("flavor-a@test.hu").getId();
        DailyQuestEntity q = questPopulator.quest(owner, LocalDate.now(), DailyQuestEntity.SLOT_FUELBIO,
            "bio_water", "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15,
            DailyQuestEntity.STATUS_OFFERED);
        // the sentinel rides the quest title into the fake's user message
        q.setTitle("Igyál vizet [fake-quest-flavor:[{\"title\":\"A hidratált Daniel ma is iszik 2,5 litert\","
            + "\"why\":\"A tegnapi edzés után a tested ma vizet kér — add meg neki.\"}]]");
        repository.saveAndFlush(q);

        flavor.rewrite(List.of(q));

        DailyQuestEntity reloaded = repository.findByIdAndCreatedBy(q.getId(), owner).orElseThrow();
        assertThat(reloaded.getTitle()).isEqualTo("A hidratált Daniel ma is iszik 2,5 litert");
        assertThat(reloaded.getWhy()).startsWith("A tegnapi edzés után");
        assertThat(reloaded.getTarget().metric()).isEqualTo("water_target"); // economy untouched
        assertThat(reloaded.getXp()).isEqualTo(15);
    }

    @Test
    void testRewrite_shouldKeepCatalogCopy_whenAnswerIsGarbage() {
        UUID owner = userPopulator.createUser("flavor-b@test.hu").getId();
        DailyQuestEntity q = questPopulator.quest(owner, LocalDate.now(), DailyQuestEntity.SLOT_FUELBIO,
            "bio_water", "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15,
            DailyQuestEntity.STATUS_OFFERED);
        q.setTitle("Igyál vizet [fake-quest-flavor:ez nem json]");
        repository.saveAndFlush(q);

        flavor.rewrite(List.of(q));

        assertThat(repository.findByIdAndCreatedBy(q.getId(), owner).orElseThrow().getTitle())
            .startsWith("Igyál vizet"); // untouched
    }

    @Test
    void testRewrite_shouldKeepCatalogCopy_whenAnswerCountMismatches() {
        UUID owner = userPopulator.createUser("flavor-c@test.hu").getId();
        DailyQuestEntity q = questPopulator.quest(owner, LocalDate.now(), DailyQuestEntity.SLOT_FUELBIO,
            "bio_water", "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15,
            DailyQuestEntity.STATUS_OFFERED);
        q.setTitle("Igyál vizet [fake-quest-flavor:[]]"); // empty array ≠ 1 quest
        repository.saveAndFlush(q);

        flavor.rewrite(List.of(q));

        assertThat(repository.findByIdAndCreatedBy(q.getId(), owner).orElseThrow().getTitle())
            .startsWith("Igyál vizet");
    }

    @Test
    void testRewrite_shouldKeepCatalogCopy_whenLlmFails() {
        UUID owner = userPopulator.createUser("flavor-d@test.hu").getId();
        DailyQuestEntity q = questPopulator.quest(owner, LocalDate.now(), DailyQuestEntity.SLOT_FUELBIO,
            "bio_water", "recovery", "LIFE", "water_target", new BigDecimal("2500"), 15,
            DailyQuestEntity.STATUS_OFFERED);
        q.setTitle("Igyál vizet [fake-fail]");
        repository.saveAndFlush(q);

        flavor.rewrite(List.of(q));

        assertThat(repository.findByIdAndCreatedBy(q.getId(), owner).orElseThrow().getTitle())
            .startsWith("Igyál vizet");
    }
}
