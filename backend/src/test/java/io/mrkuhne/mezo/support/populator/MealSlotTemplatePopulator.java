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

    /** A 3-slot template whose every slot is FIXED-anchored — the only anchor kind the
     *  meal_rhythm_drift slot-drift arm can read (mezo-d58h.7.4), since relative anchors are
     *  resolved in the frontend only. Budgets sum to 100%. */
    public MealSlotTemplateEntity fixedTemplate(UUID owner, String dayType,
        String breakfast, String lunch, String dinner) {
        return template(owner, dayType, List.of(
            new MealSlotJson("Reggeli", "breakfast", "standard", "fixed", breakfast, null, 30),
            new MealSlotJson("Ebéd", "lunch", "standard", "fixed", lunch, null, 40),
            new MealSlotJson("Vacsora", "dinner", "standard", "fixed", dinner, null, 30)));
    }

    public MealSlotTemplateEntity template(UUID owner, String dayType, List<MealSlotJson> slots) {
        MealSlotTemplateEntity e = new MealSlotTemplateEntity();
        e.setCreatedBy(owner);
        e.setDayType(dayType);
        e.setSlots(slots);
        return repository.saveAndFlush(e);
    }
}
