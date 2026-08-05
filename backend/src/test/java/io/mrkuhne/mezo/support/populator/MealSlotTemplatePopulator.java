package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.fuel.entity.MealSlotJson;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotTemplateEntity;
import io.mrkuhne.mezo.feature.fuel.repository.MealSlotTemplateRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the meal_slot_template aggregate — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class MealSlotTemplatePopulator {

    private final MealSlotTemplateRepository repository;

    /** A valid 3-slot 'rest' template summing to 100% budget. */
    public MealSlotTemplateEntity restTemplate(UUID owner) {
        return template(owner, "rest", List.of(
            new MealSlotJson("Reggeli", "breakfast", "standard", "wake", null, 30, 30),
            new MealSlotJson("Ebéd", "lunch", "standard", "fixed", "13:00", null, 40),
            new MealSlotJson("Vacsora", "dinner", "standard", "fixed", "19:00", null, 30)));
    }

    public MealSlotTemplateEntity template(UUID owner, String dayType, List<MealSlotJson> slots) {
        MealSlotTemplateEntity e = new MealSlotTemplateEntity();
        e.setCreatedBy(owner);
        e.setDayType(dayType);
        e.setSlots(slots);
        return repository.saveAndFlush(e);
    }
}
