package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.YearPlanProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearBlockEntity;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Links a freshly started mesocycle to a block of the active Éves terv (mezo-r36n9.113, spec §7a). The explicit
 * {@code yearBlockId} wins when it names a {@code planned}, unlinked block of the active plan; otherwise (or when it
 * is invalid — it never fails a start, controller call 6) the nearest such block whose layout start lies within
 * ±{@code linkWindowDays} of the run's start is taken, a tie going to the lower ordinal; none → no link (the plan then
 * reports the run as {@code unlinkedRunning}). Only the active plan is considered.
 */
@Service
@RequiredArgsConstructor
public class YearPlanLinker {

    private final YearPlanService yearPlans;
    private final YearPlanProperties properties;

    /** Joins the stamp transaction; a no-op without an active plan or when the run is already linked. */
    @Transactional
    public void linkStarted(UUID owner, MesocycleEntity m, UUID yearBlockId) {
        Optional<YearPlanService.Active> found = yearPlans.reconciledActive(owner);
        if (found.isEmpty()) return;
        YearPlanService.Active active = found.get();
        if (active.blocks().stream().anyMatch(b -> m.getId().equals(b.getMesocycleId()))) return;

        List<TrainingYearBlockEntity> free = active.blocks().stream()
            .filter(b -> b.is(YearGenerator.PLANNED) && b.getMesocycleId() == null)
            .toList();
        Optional<TrainingYearBlockEntity> target = free.stream()
            .filter(b -> b.getId().equals(yearBlockId))
            .findFirst()
            .or(() -> nearest(free, yearPlans.startsNow(owner, active), m.getStartDate()));
        target.ifPresent(b -> yearPlans.link(owner, active, b, m.getId()));
    }

    private Optional<TrainingYearBlockEntity> nearest(List<TrainingYearBlockEntity> free, Map<UUID, LocalDate> starts,
                                                      LocalDate runStart) {
        if (runStart == null) return Optional.empty();
        return free.stream()
            .filter(b -> distance(starts.get(b.getId()), runStart) <= properties.linkWindowDays())
            .min(Comparator.<TrainingYearBlockEntity>comparingLong(b -> distance(starts.get(b.getId()), runStart))
                .thenComparingInt(TrainingYearBlockEntity::getOrdinal));
    }

    private static long distance(LocalDate blockStart, LocalDate runStart) {
        return blockStart == null ? Long.MAX_VALUE : Math.abs(ChronoUnit.DAYS.between(blockStart, runStart));
    }
}
