package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.intention.entity.DailyIntentionEntity;
import io.mrkuhne.mezo.feature.intention.entity.IntentionCreedEntity;
import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import io.mrkuhne.mezo.feature.intention.repository.DailyIntentionRepository;
import io.mrkuhne.mezo.feature.intention.repository.IntentionCreedRepository;
import io.mrkuhne.mezo.feature.intention.repository.IntentionFocusRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class IntentionPopulator {

    private final IntentionCreedRepository creedRepository;
    private final IntentionFocusRepository focusRepository;
    private final DailyIntentionRepository dailyRepository;

    public IntentionFocusEntity focus(UUID owner, LocalDate date, String text) {
        IntentionFocusEntity e = new IntentionFocusEntity();
        e.setCreatedBy(owner);
        e.setFocusDate(date);
        e.setText(text);
        return focusRepository.saveAndFlush(e);
    }

    public IntentionCreedEntity creed(UUID owner, String text) {
        IntentionCreedEntity e = new IntentionCreedEntity();
        e.setCreatedBy(owner);
        e.setText(text);
        return creedRepository.saveAndFlush(e);
    }

    public DailyIntentionEntity reflection(UUID owner, LocalDate date, String value) {
        DailyIntentionEntity e = new DailyIntentionEntity();
        e.setCreatedBy(owner);
        e.setIntentionDate(date);
        e.setReflection(value);
        return dailyRepository.saveAndFlush(e);
    }
}
