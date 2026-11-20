package io.mrkuhne.mezo.feature.season.port;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** What the season needs from training (consumer-owned port): the weekly slots, their energy, the block. */
public interface SeasonTrainPort {

    /** The current weekly rhythm in the draft's shape. {@code gymTime} = the first gym slot's time, or null. */
    record Schedule(List<Integer> gymDays, String gymTime, List<SeasonDraftJson.SportSlot> sport) {
    }

    record Block(UUID id, String title, String status, LocalDate startDate, LocalDate endDate, int weeks,
                 List<String> phaseCurve) {
    }

    Schedule currentSchedule(UUID owner);

    /** The draft's gym + sport weekly EAT (kcal/day) at the given rest energy — pure. */
    BigDecimal draftEat(SeasonDraftJson draft, BigDecimal restKcalPerHour);

    /** Net kcal one planned training day credits under the draft (a gym session; sport when no gym day). */
    int trainDayMovementKcal(SeasonDraftJson draft, BigDecimal restKcalPerHour);

    /** Replaces both weekly schedules with the draft's (each replace recomputes the active goal). */
    void replaceSlots(UUID owner, SeasonDraftJson draft);

    Optional<Block> activeMesocycle(UUID owner);

    Optional<Block> mesocycle(UUID owner, UUID mesocycleId);

    /** Starts an active block from a template on {@code startDate}; returns the new mesocycle id. */
    UUID startFromTemplate(UUID owner, UUID templateId, LocalDate startDate);

    /** The template a mesocycle can be re-run from (materialised for a legacy run). */
    UUID templateOf(UUID owner, UUID mesocycleId);
}
