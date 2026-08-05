package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SlotTemplateListResponse;
import io.mrkuhne.mezo.api.dto.SlotTemplateRequest;
import io.mrkuhne.mezo.api.dto.SlotTemplateResponse;
import io.mrkuhne.mezo.api.dto.SlotTemplateSlot;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealSlotTemplatePopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the generated {@code FuelApi} slot-template CRUD contract (bd mezo-7102). */
class SlotTemplateApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MealSlotTemplatePopulator mealSlotTemplatePopulator;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testListSlotTemplates_shouldReturnEmpty_whenNoneSaved() {
        SlotTemplateListResponse res =
            getForBody("/api/fuel/slot-templates", ownerAuthHeaders(), HttpStatus.OK, SlotTemplateListResponse.class);

        assertThat(res.getTemplates()).isEmpty();
    }

    @Test
    void testPutSlotTemplate_shouldCreateThenUpdate_whenCalledTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        SlotTemplateRequest first = SlotTemplateRequest.builder()
            .slots(List.of(
                slot("Pre-workout snack", "snack", "pre_workout", "training_start", null, -45, 8),
                slot("Post-workout breakfast", "breakfast", "post_workout", "training_end", null, 30, 32),
                slot("Vacsora", "dinner", "standard", "fixed", "19:00", null, 60)))
            .build();

        SlotTemplateResponse created = putForBody("/api/fuel/slot-templates/training_am", first, auth,
            HttpStatus.OK, SlotTemplateResponse.class);
        assertThat(created.getDayType()).isEqualTo(SlotTemplateResponse.DayTypeEnum.TRAINING_AM);
        assertThat(created.getSlots()).hasSize(3);

        SlotTemplateRequest updated = SlotTemplateRequest.builder()
            .slots(List.of(
                slot("Pre-workout snack", "snack", "pre_workout", "training_start", null, -45, 10),
                slot("Post-workout breakfast", "breakfast", "post_workout", "training_end", null, 30, 30),
                slot("Vacsora", "dinner", "standard", "fixed", "19:00", null, 60)))
            .build();
        putForBody("/api/fuel/slot-templates/training_am", updated, auth, HttpStatus.OK, SlotTemplateResponse.class);

        SlotTemplateListResponse listed =
            getForBody("/api/fuel/slot-templates", auth, HttpStatus.OK, SlotTemplateListResponse.class);
        assertThat(listed.getTemplates()).hasSize(1);
        assertThat(listed.getTemplates().get(0).getSlots())
            .extracting(SlotTemplateSlot::getBudgetPct)
            .containsExactly(10, 30, 60);
    }

    @Test
    void testPutSlotTemplate_shouldReject_whenBudgetSumOff() {
        SlotTemplateRequest bad = SlotTemplateRequest.builder()
            .slots(List.of(
                slot("Reggeli", "breakfast", "standard", "wake", null, 30, 40),
                slot("Vacsora", "dinner", "standard", "fixed", "19:00", null, 50)))
            .build();

        String body = putForBody("/api/fuel/slot-templates/rest", bad, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "FUEL_SLOT_TEMPLATE_BUDGET_SUM");
    }

    @Test
    void testPutSlotTemplate_shouldReject_whenTrainingAnchorOnRestDay() {
        SlotTemplateRequest bad = SlotTemplateRequest.builder()
            .slots(List.of(
                slot("Pre-workout snack", "snack", "pre_workout", "training_start", null, -45, 40),
                slot("Vacsora", "dinner", "standard", "fixed", "19:00", null, 60)))
            .build();

        String body = putForBody("/api/fuel/slot-templates/rest", bad, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "FUEL_SLOT_TEMPLATE_ANCHOR_INVALID");
    }

    @Test
    void testPutSlotTemplate_shouldReject_whenDayTypeUnknown() {
        SlotTemplateRequest req = SlotTemplateRequest.builder()
            .slots(List.of(
                slot("Reggeli", "breakfast", "standard", "wake", null, 30, 40),
                slot("Vacsora", "dinner", "standard", "fixed", "19:00", null, 60)))
            .build();

        String body = putForBody("/api/fuel/slot-templates/weekend", req, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "dayType", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testDeleteSlotTemplate_shouldSoftDelete_whenExists() {
        HttpHeaders auth = ownerAuthHeaders();
        mealSlotTemplatePopulator.restTemplate(ownerId());

        deleteAndExpect("/api/fuel/slot-templates/rest", auth, HttpStatus.NO_CONTENT);

        SlotTemplateListResponse listed =
            getForBody("/api/fuel/slot-templates", auth, HttpStatus.OK, SlotTemplateListResponse.class);
        assertThat(listed.getTemplates()).isEmpty();

        deleteAndExpect("/api/fuel/slot-templates/rest", auth, HttpStatus.NOT_FOUND);
    }

    @Test
    void testListSlotTemplates_shouldNotLeakOtherUsers_whenForeignRowExists() {
        UUID other = databasePopulator.populateUser("other@x.hu");
        mealSlotTemplatePopulator.restTemplate(other);

        SlotTemplateListResponse res =
            getForBody("/api/fuel/slot-templates", ownerAuthHeaders(), HttpStatus.OK, SlotTemplateListResponse.class);

        assertThat(res.getTemplates()).isEmpty();
    }

    private static SlotTemplateSlot slot(String label, String slotKind, String role, String anchorType,
                                          String time, Integer offsetMin, int budgetPct) {
        return SlotTemplateSlot.builder()
            .label(label)
            .slotKind(slotKind)
            .role(role)
            .anchorType(anchorType)
            .time(time)
            .offsetMin(offsetMin)
            .budgetPct(budgetPct)
            .build();
    }
}
