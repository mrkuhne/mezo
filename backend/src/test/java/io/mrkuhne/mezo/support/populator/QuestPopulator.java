package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.entity.QuestTargetEnvelope;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code daily_quest} rows (gamified growth E1, bd mezo-df7q). */
@TestComponent
@RequiredArgsConstructor
public class QuestPopulator {

    private final DailyQuestRepository repository;

    public DailyQuestEntity quest(UUID createdBy, LocalDate questDate, String slot, String catalogKey,
                                  String skillKey, String skillKind, String metric, BigDecimal threshold,
                                  int xp, String status) {
        DailyQuestEntity e = new DailyQuestEntity();
        e.setCreatedBy(createdBy);
        e.setQuestDate(questDate);
        e.setSlot(slot);
        e.setCatalogKey(catalogKey);
        e.setSkillKey(skillKey);
        e.setSkillKind(skillKind);
        e.setTitle("Teszt küldetés");
        e.setWhy("Teszt indoklás.");
        e.setTarget(new QuestTargetEnvelope(metric, threshold));
        e.setXp(xp);
        e.setStatus(status);
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return repository.saveAndFlush(e);
    }
}
