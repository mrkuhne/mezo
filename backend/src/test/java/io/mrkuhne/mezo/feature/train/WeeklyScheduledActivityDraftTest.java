package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.service.ActivityEnergyModel;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService.DraftSlot;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Boop B6 Évad (mezo-r36n9.16): the draft weekly EAT is the scheduled EAT's model over a slot list. */
class WeeklyScheduledActivityDraftTest {

    private static final BigDecimal REST = new BigDecimal("80");
    private final UUID user = UUID.randomUUID();
    private final GymScheduleSlotRepository gymRepo = mock(GymScheduleSlotRepository.class);
    private final SportScheduleSlotRepository sportRepo = mock(SportScheduleSlotRepository.class);
    private WeeklyScheduledActivityService service;

    @BeforeEach
    void setUp() {
        TrainProperties props = new TrainProperties(new TrainProperties.Energy(Map.of(
            "gym", new TrainProperties.MetBand(3.5, 3.5, 5.0),
            "volleyball", new TrainProperties.MetBand(3.0, 4.0, 6.0),
            "other", new TrainProperties.MetBand(3.0, 4.0, 6.0))), 60, 45, 400);
        service = new WeeklyScheduledActivityService(gymRepo, sportRepo, mock(RunningBlockRepository.class), props,
            new ActivityEnergyModel(props));
        List<GymScheduleSlotEntity> gym = new ArrayList<>();
        for (int d : new int[] {0, 1, 3, 4}) {
            GymScheduleSlotEntity g = new GymScheduleSlotEntity();
            g.setDayOfWeek(d);
            g.setTime("17:30");
            gym.add(g);
        }
        List<SportScheduleSlotEntity> sport = new ArrayList<>();
        for (int d : new int[] {1, 3}) {
            SportScheduleSlotEntity s = new SportScheduleSlotEntity();
            s.setDayOfWeek(d);
            s.setTime("19:00");
            s.setDurationMin(90);
            s.setSport("volleyball");
            sport.add(s);
        }
        when(gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(any())).thenReturn(gym);
        when(sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(any())).thenReturn(sport);
    }

    @Test
    void draftEatEqualsScheduledEatForSameSlots() {
        List<DraftSlot> same = List.of(new DraftSlot("gym", 0), new DraftSlot("gym", 0), new DraftSlot("gym", 0),
            new DraftSlot("gym", 0), new DraftSlot("volleyball", 90), new DraftSlot("volleyball", 90));

        assertThat(service.draftWeeklyEatKcalPerDay(same, REST))
            .isEqualByComparingTo(service.scheduledWeeklyEatKcalPerDay(user, REST));
    }

    @Test
    void fifthGymSlotRaisesEat() {
        List<DraftSlot> four = List.of(new DraftSlot("gym", 0), new DraftSlot("gym", 0), new DraftSlot("gym", 0),
            new DraftSlot("gym", 0), new DraftSlot("volleyball", 90), new DraftSlot("volleyball", 90));
        List<DraftSlot> five = new ArrayList<>(four);
        five.add(new DraftSlot("gym", 0));

        BigDecimal oneGym = service.blockKcal("gym", 60, REST);
        BigDecimal diff = service.draftWeeklyEatKcalPerDay(five, REST).subtract(service.draftWeeklyEatKcalPerDay(four, REST));
        assertThat(diff).isCloseTo(oneGym.divide(BigDecimal.valueOf(7), 2, RoundingMode.HALF_UP),
            org.assertj.core.data.Offset.offset(new BigDecimal("0.01")));
        assertThat(diff.signum()).isPositive();
    }
}
