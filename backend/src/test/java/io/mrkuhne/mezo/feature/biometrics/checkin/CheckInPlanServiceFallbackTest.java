package io.mrkuhne.mezo.feature.biometrics.checkin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.AdaptiveReason;
import io.mrkuhne.mezo.api.dto.CheckInAdaptiveItem;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.CheckInPlanProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.AdaptiveItemChooser;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.AllNonCoreNeedSource;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInItem;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInNeedSource;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInNeedSource.Need;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInPlanService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Follow-up A: how the plan merges need sources — specific first, the fallback only when empty. */
class CheckInPlanServiceFallbackTest {

    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private static final LocalDate DAY = LocalDate.parse("2026-06-15");
    private static final String GENERIC = "Most azt figyeljük, hogyan alakul {item} — erről van a legkevesebb válaszod.";
    private static final String RANDOM = "Ma ez a véletlen kérdés — így marad kiegyensúlyozott, amit rólad tanulunk.";

    // random-share 0 → every pick is a need pick; 20:00 pool = motivation, hunger.
    private final CheckInPlanProperties properties = new CheckInPlanProperties(
        Map.of("20:00", new CheckInPlanProperties.Slot(List.of(CheckInItem.ENERGY, CheckInItem.MOOD,
            CheckInItem.STRESS, CheckInItem.BODY, CheckInItem.MENTAL, CheckInItem.SORENESS, CheckInItem.PAIN,
            CheckInItem.CRAVING, CheckInItem.DIGESTION, CheckInItem.CONNECTION, CheckInItem.DAY))),
        new CheckInPlanProperties.Adaptive(0.0, 14, Map.of(CheckInItem.RESTED, "06:30", CheckInItem.DAY, "20:00"),
            GENERIC, RANDOM));

    @Test
    void testPlan_shouldUseSpecificSourcesOnly_whenAnyWantsSomething() {
        CheckInNeedSource hunger = userId -> List.of(new Need(CheckInItem.HUNGER, "Most azt figyeljük: éhes vagy?"));
        CheckInAdaptiveItem adaptive = plan(List.of(hunger, new AllNonCoreNeedSource()));
        assertThat(adaptive.getId().getValue()).isEqualTo("hunger");
        assertThat(adaptive.getReason()).isEqualTo(AdaptiveReason.NEED);
        assertThat(adaptive.getWhy()).isEqualTo("Most azt figyeljük: éhes vagy?");
    }

    @Test
    void testPlan_shouldKeepFirstSourcesWhy_whenTwoSourcesWantSameItem() {
        CheckInNeedSource first = userId -> List.of(new Need(CheckInItem.HUNGER, "első"));
        CheckInNeedSource second = userId -> List.of(new Need(CheckInItem.HUNGER, "második"));
        assertThat(plan(List.of(first, second)).getWhy()).isEqualTo("első");
    }

    @Test
    void testPlan_shouldFallBackToAllNonCore_whenSpecificSourcesEmpty() {
        CheckInNeedSource empty = userId -> List.of();
        CheckInAdaptiveItem adaptive = plan(List.of(empty, new AllNonCoreNeedSource()));
        assertThat(adaptive.getReason()).isEqualTo(AdaptiveReason.NEED);
        assertThat(adaptive.getWhy()).startsWith("Most azt figyeljük, hogyan alakul").endsWith("legkevesebb válaszod.");
    }

    private CheckInAdaptiveItem plan(List<CheckInNeedSource> sources) {
        CheckInRepository repository = mock(CheckInRepository.class);
        when(repository.findByCreatedByAndDateAndSlotTime(any(), any(), any())).thenReturn(Optional.empty());
        when(repository.findByCreatedByAndDeletedFalseAndDateBetween(any(), any(), any())).thenReturn(List.of());
        return new CheckInPlanService(properties, new AdaptiveItemChooser(properties), repository, sources)
            .plan(USER, DAY, "20:00").getAdaptive();
    }
}
