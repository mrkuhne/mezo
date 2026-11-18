package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * The weekly pin (volume engine v2 S3, spec §6.4 "Load lines"): a weight or rep line he {@code kept} in the
 * run's weekly proposal for the current week holds that exercise at last week's load for the week — the
 * today view prescribes it hold-only. A line finds today's row by exercise id, else (a day edit re-mints
 * rows) by identity (catalog id / name) when the line sits on today's template day. Failure-isolated: any
 * error is logged and the day is served unpinned — the pin never breaks the today view.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class WeeklyPin {

    private final MesoWeekProposalRepository proposalRepository;
    private final ExerciseRepository exerciseRepository;

    /**
     * Today's pinned row ids. {@code run} is the active run after the weekly rollover; {@code day} is the
     * template day being served — the caller passes only a day of that run.
     */
    Set<UUID> pinnedRows(UUID createdBy, MesocycleEntity run, WorkoutSessionEntity day, List<ExerciseEntity> rows) {
        try {
            return resolve(createdBy, run, day, rows);
        } catch (RuntimeException e) {
            log.warn("Weekly pin lookup failed for run {}; serving the day unpinned", run.getId(), e);
            return Set.of();
        }
    }

    private Set<UUID> resolve(UUID createdBy, MesocycleEntity run, WorkoutSessionEntity day,
                              List<ExerciseEntity> rows) {
        List<WeekProposalLineJson> kept = proposalRepository
            .findWeekly(createdBy, run.getId(), run.getCurrentWeek())
            .filter(p -> !MesoWeekProposalEntity.STATUS_SUPERSEDED.equals(p.getStatus()))
            .map(MesoWeekProposalEntity::getLines).orElse(List.of()).stream()
            .filter(l -> LoadLinePreview.KIND_WEIGHT.equals(l.kind()) || LoadLinePreview.KIND_REPS.equals(l.kind()))
            .filter(l -> WeekProposalLineJson.DECISION_KEPT.equals(l.decision()))
            .toList();
        if (kept.isEmpty()) {
            return Set.of();
        }
        Set<UUID> todayIds = new HashSet<>();
        rows.forEach(r -> todayIds.add(r.getId()));
        Set<UUID> pinned = new HashSet<>();
        Set<UUID> byIdentity = new HashSet<>();
        int dayIndex = day.getOrderIndex() == null ? 0 : day.getOrderIndex();
        for (WeekProposalLineJson line : kept) {
            if (todayIds.contains(line.exerciseId())) {
                pinned.add(line.exerciseId());
            } else if (line.dayIndex() == dayIndex) {
                byIdentity.add(line.exerciseId());
            }
        }
        if (!byIdentity.isEmpty()) {
            Set<String> keys = new HashSet<>();
            exerciseRepository.findOwnedByIdIncludingDeleted(createdBy, byIdentity)
                .forEach(e -> keys.add(ExerciseHistoryResolver.identityKey(e)));
            rows.stream().filter(r -> keys.contains(ExerciseHistoryResolver.identityKey(r)))
                .forEach(r -> pinned.add(r.getId()));
        }
        return pinned;
    }
}
