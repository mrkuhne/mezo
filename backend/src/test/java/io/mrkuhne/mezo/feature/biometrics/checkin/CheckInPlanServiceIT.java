package io.mrkuhne.mezo.feature.biometrics.checkin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.AdaptiveReason;
import io.mrkuhne.mezo.api.dto.CheckInItemId;
import io.mrkuhne.mezo.api.dto.CheckInItemKind;
import io.mrkuhne.mezo.api.dto.CheckInPlanItem;
import io.mrkuhne.mezo.api.dto.CheckInPlanOption;
import io.mrkuhne.mezo.api.dto.CheckInPlanResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInPlanService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** The question plan against the real {@code mezo.checkin.plan} config (mezo-ck2, spec §2.2–2.3). */
@Transactional
class CheckInPlanServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.parse("2026-06-15");
    private static final List<CheckInItemId> CORE = List.of(CheckInItemId.ENERGY, CheckInItemId.MOOD,
        CheckInItemId.STRESS, CheckInItemId.BODY, CheckInItemId.MENTAL);

    @Autowired private CheckInPlanService planService;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testPlan_shouldMatchSpecSlotPlans_whenEachSlotRequested() {
        UUID user = databasePopulator.populateUser("plan@test.local");

        assertThat(ids(planService.plan(user, DAY, "06:30"))).containsExactlyElementsOf(withCore(
            CheckInItemId.RESTED, CheckInItemId.SORENESS, CheckInItemId.PAIN, CheckInItemId.MOTIVATION)).hasSize(9);
        assertThat(ids(planService.plan(user, DAY, "10:00"))).containsExactlyElementsOf(withCore(
            CheckInItemId.MOTIVATION, CheckInItemId.HUNGER)).hasSize(7);
        assertThat(ids(planService.plan(user, DAY, "14:00"))).containsExactlyElementsOf(withCore(
            CheckInItemId.HUNGER, CheckInItemId.CRAVING, CheckInItemId.DIGESTION)).hasSize(8);
        assertThat(ids(planService.plan(user, DAY, "20:00"))).containsExactlyElementsOf(withCore(
            CheckInItemId.SORENESS, CheckInItemId.PAIN, CheckInItemId.CRAVING, CheckInItemId.DIGESTION,
            CheckInItemId.CONNECTION, CheckInItemId.DAY)).hasSize(11);
    }

    @Test
    void testPlan_shouldCarryPrototypeCopy_whenItemsRendered() {
        UUID user = databasePopulator.populateUser("plan@test.local");
        List<CheckInPlanItem> items = planService.plan(user, DAY, "06:30").getItems();

        CheckInPlanItem energy = items.getFirst();
        assertThat(energy.getLabel()).isEqualTo("Energia");
        assertThat(energy.getQuestion()).isEqualTo("Mennyi energia van benned most?");
        assertThat(energy.getLow()).isEqualTo("Üres");
        assertThat(energy.getHigh()).isEqualTo("Tele");
        assertThat(energy.getKind()).isEqualTo(CheckInItemKind.SCALE);

        CheckInPlanItem pain = items.stream().filter(i -> i.getId() == CheckInItemId.PAIN).findFirst().orElseThrow();
        assertThat(pain.getKind()).isEqualTo(CheckInItemKind.PAIN);
        assertThat(pain.getQuestion()).isEqualTo("Fáj valami?");
        assertThat(pain.getOptions()).extracting(CheckInPlanOption::getLabel)
            .contains("Fej", "Csukló, kéz", "Felső hát", "Boka, lábfej", "Egyéb").hasSize(12);

        CheckInPlanItem craving = planService.plan(user, DAY, "14:00").getItems().stream()
            .filter(i -> i.getId() == CheckInItemId.CRAVING).findFirst().orElseThrow();
        assertThat(craving.getKind()).isEqualTo(CheckInItemKind.CRAVING);
        assertThat(craving.getOptions()).extracting(CheckInPlanOption::getId)
            .containsExactly("EDES", "SOS", "ZSIROS", "BARMIT");
    }

    @Test
    void testPlan_shouldOfferValidAdaptiveItem_whenAnySlot() {
        UUID user = databasePopulator.populateUser("plan@test.local");
        for (int d = 0; d < 10; d++) {
            for (String slot : List.of("06:30", "10:00", "14:00", "20:00")) {
                CheckInPlanResponse plan = planService.plan(user, DAY.plusDays(d), slot);
                CheckInItemId adaptive = plan.getAdaptive().getId();
                assertThat(CORE).doesNotContain(adaptive);
                assertThat(ids(plan)).doesNotContain(adaptive);
                if (adaptive == CheckInItemId.RESTED) assertThat(slot).isEqualTo("06:30");
                if (adaptive == CheckInItemId.DAY) assertThat(slot).isEqualTo("20:00");
                assertThat(plan.getAdaptive().getWhy()).isNotBlank();
            }
        }
    }

    @Test
    void testPlan_shouldStayStable_whenReopenedAfterSavingToday() {
        UUID user = databasePopulator.populateUser("plan@test.local");
        CheckInPlanResponse first = planService.plan(user, DAY, "14:00");

        // Answers saved today (other slots) never reshuffle today's pick.
        checkInPopulator.createCheckIn(user, DAY, "06:30", e -> {
            e.setSoreness(4);
            e.setPain(false);
            e.setMotivation(7);
            e.setConnection(6);
        });

        assertThat(planService.plan(user, DAY, "14:00").getAdaptive()).isEqualTo(first.getAdaptive());
    }

    @Test
    void testPlan_shouldReturnStoredAdaptiveItem_whenSlotAlreadySaved() {
        UUID user = databasePopulator.populateUser("plan@test.local");
        checkInPopulator.createCheckIn(user, DAY, "06:30", e -> {
            e.setAdaptiveItem("connection");
            e.setAdaptiveReason("NEED");
        });

        var adaptive = planService.plan(user, DAY, "06:30").getAdaptive();
        assertThat(adaptive.getId()).isEqualTo(CheckInItemId.CONNECTION);
        assertThat(adaptive.getReason()).isEqualTo(AdaptiveReason.NEED);
        assertThat(adaptive.getWhy()).contains("kapcsolódás");
    }

    @Test
    void testPlan_shouldAskThinnestSeries_whenNeedDraw() {
        UUID user = databasePopulator.populateUser("plan@test.local");
        // 14:00 pool = soreness, pain, motivation, connection; motivation is never answered.
        for (int d = 1; d <= 3; d++) {
            checkInPopulator.createCheckIn(user, DAY.minusDays(d), "20:00", e -> {
                e.setSoreness(3);
                e.setPain(false);
                e.setConnection(7);
            });
        }
        int needDraws = 0;
        for (int d = 0; d < 11; d++) {
            var adaptive = planService.plan(user, DAY.plusDays(d), "14:00").getAdaptive();
            if (adaptive.getReason() == AdaptiveReason.NEED) {
                needDraws++;
                assertThat(adaptive.getId()).isEqualTo(CheckInItemId.MOTIVATION);
                assertThat(adaptive.getWhy()).contains("motiváció");
            }
        }
        assertThat(needDraws).isPositive();
    }

    @Test
    void testPlan_shouldThrow_whenSlotUnknown() {
        UUID user = databasePopulator.populateUser("plan@test.local");
        assertThatThrownBy(() -> planService.plan(user, DAY, "09:00"))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    private static List<CheckInItemId> ids(CheckInPlanResponse plan) {
        return plan.getItems().stream().map(CheckInPlanItem::getId).toList();
    }

    private static List<CheckInItemId> withCore(CheckInItemId... rest) {
        return java.util.stream.Stream.concat(CORE.stream(), java.util.Arrays.stream(rest)).toList();
    }
}
