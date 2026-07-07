package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.E1rmRecord;
import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.api.dto.RecordSetRef;
import io.mrkuhne.mezo.api.dto.SessionVolumeRecord;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository.ExerciseIdentityRow;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * On-the-fly per-exercise record aggregation (spec 2026-06-12-exercise-records-design.md).
 * Identity = {@code exercise.catalog_id} when present, else the exercise name — resolved over
 * ALL exercise rows including soft-deleted templates (day edits must not erase history). A set
 * counts when {@code reps} is logged; weight-based records additionally need {@code weight_kg}.
 * Single-user data volume keeps this in-memory aggregation trivially fast; records can never
 * drift from the underlying sets (no materialized table — YAGNI until a PR feed exists).
 */
@Service
@RequiredArgsConstructor
public class ExerciseRecordService {

    private static final BigDecimal THIRTY = new BigDecimal("30");

    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;

    public List<ExerciseRecordResponse> list(UUID createdBy) {
        List<ExerciseSetEntity> sets = exerciseSetRepository
            .findByCreatedByAndRepsNotNullAndKind(createdBy, "working");
        if (sets.isEmpty()) {
            return List.of();
        }
        Map<UUID, ExerciseIdentityRow> exercises =
            exerciseRepository.findIdentityRowsIncludingDeleted(createdBy).stream()
                .collect(Collectors.toMap(ExerciseIdentityRow::getId, r -> r));

        Map<String, List<ExerciseSetEntity>> setsByIdentity = new LinkedHashMap<>();
        Map<String, ExerciseIdentityRow> displayByIdentity = new HashMap<>();
        for (ExerciseSetEntity set : sets) {
            ExerciseIdentityRow row = exercises.get(set.getExerciseId());
            if (row == null) {
                continue;
            }
            String key = row.getCatalogId() != null ? "c:" + row.getCatalogId() : "n:" + row.getName();
            setsByIdentity.computeIfAbsent(key, k -> new ArrayList<>()).add(set);
            // display fields come from the most recent occurrence of the exercise
            displayByIdentity.merge(key, row,
                (a, b) -> a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b);
        }

        List<UUID> linkedIds = displayByIdentity.values().stream()
            .map(ExerciseIdentityRow::getCatalogId).filter(Objects::nonNull).toList();
        Map<UUID, ExerciseCatalogEntity> catalog = exerciseCatalogRepository.findAllById(linkedIds)
            .stream().collect(Collectors.toMap(ExerciseCatalogEntity::getId, c -> c));

        return setsByIdentity.entrySet().stream()
            .map(e -> toRecord(displayByIdentity.get(e.getKey()), catalog, e.getValue()))
            .sorted(Comparator.comparing(ExerciseRecordResponse::getSessionCount).reversed()
                .thenComparing(ExerciseRecordResponse::getName))
            .toList();
    }

    private ExerciseRecordResponse toRecord(ExerciseIdentityRow display,
        Map<UUID, ExerciseCatalogEntity> catalog, List<ExerciseSetEntity> sets) {
        ExerciseCatalogEntity cat =
            display.getCatalogId() != null ? catalog.get(display.getCatalogId()) : null;
        List<ExerciseSetEntity> weighted =
            sets.stream().filter(s -> s.getWeightKg() != null).toList();

        ExerciseSetEntity bestSet = weighted.stream().max(
            Comparator.comparing(ExerciseSetEntity::getWeightKg)
                .thenComparing(ExerciseSetEntity::getReps)
                .thenComparing(this::setInstant)).orElse(null);
        ExerciseSetEntity bestE1rmSet = weighted.stream().max(
            Comparator.comparing(this::epley).thenComparing(this::setInstant)).orElse(null);

        // session = workout instance; legacy sets without instance group by exercise row
        Map<UUID, List<ExerciseSetEntity>> bySession = sets.stream().collect(Collectors.groupingBy(
            s -> s.getWorkoutSessionId() != null ? s.getWorkoutSessionId() : s.getExerciseId(),
            LinkedHashMap::new, Collectors.toList()));

        SessionVolumeRecord bestSessionVolume = bySession.values().stream()
            .map(g -> Map.entry(sessionVolume(g), sessionDate(g)))
            .filter(en -> en.getKey().signum() > 0)
            .max(Map.Entry.comparingByKey())
            .map(en -> SessionVolumeRecord.builder()
                .volumeKg(en.getKey().setScale(0, RoundingMode.HALF_UP))
                .date(en.getValue()).build())
            .orElse(null);

        Map<BigDecimal, ExerciseSetEntity> bestByWeight = new HashMap<>();
        for (ExerciseSetEntity s : weighted) {
            bestByWeight.merge(s.getWeightKg().stripTrailingZeros(), s,
                (a, b) -> b.getReps() > a.getReps()
                    || (b.getReps().equals(a.getReps()) && setInstant(b).isAfter(setInstant(a)))
                    ? b : a);
        }
        List<RecordSetRef> repRecords = bestByWeight.entrySet().stream()
            .sorted(Map.Entry.<BigDecimal, ExerciseSetEntity>comparingByKey().reversed())
            .limit(3).map(en -> toRef(en.getValue())).toList();

        List<RecordSetRef> recentTopSets = bySession.values().stream()
            .map(g -> Map.entry(sessionDate(g), topSet(g)))
            .sorted(Map.Entry.<LocalDate, ExerciseSetEntity>comparingByKey().reversed())
            .limit(5)
            .sorted(Map.Entry.comparingByKey())
            .map(en -> toRef(en.getValue()))
            .toList();

        BigDecimal totalVolume = weighted.stream()
            .map(s -> s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps())))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(0, RoundingMode.HALF_UP);

        return ExerciseRecordResponse.builder()
            .catalogId(display.getCatalogId())
            .name(cat != null ? cat.getName() : display.getName())
            .muscle(cat != null ? cat.getMuscle() : display.getMuscle())
            .type(ExerciseRecordResponse.TypeEnum.fromValue(
                cat != null ? cat.getType() : display.getType()))
            .bestSet(bestSet != null ? toRef(bestSet) : null)
            .bestE1rm(bestE1rmSet != null ? E1rmRecord.builder()
                .value(epley(bestE1rmSet).setScale(1, RoundingMode.HALF_UP))
                .set(toRef(bestE1rmSet)).build() : null)
            .bestSessionVolume(bestSessionVolume)
            .totalVolume(totalVolume)
            .totalSets(sets.size())
            .totalReps(sets.stream().mapToInt(ExerciseSetEntity::getReps).sum())
            .sessionCount(bySession.size())
            .repRecords(repRecords)
            .recentTopSets(recentTopSets)
            .build();
    }

    /** Epley estimated 1RM: weight × (1 + reps/30) = weight × (30 + reps) / 30. */
    private BigDecimal epley(ExerciseSetEntity s) {
        return s.getWeightKg().multiply(BigDecimal.valueOf(30L + s.getReps()))
            .divide(THIRTY, 4, RoundingMode.HALF_UP);
    }

    private Instant setInstant(ExerciseSetEntity s) {
        return s.getDoneAt() != null ? s.getDoneAt() : s.getCreatedAt();
    }

    private LocalDate setDate(ExerciseSetEntity s) {
        return setInstant(s).atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private LocalDate sessionDate(List<ExerciseSetEntity> group) {
        return group.stream().map(this::setInstant).max(Comparator.naturalOrder())
            .map(i -> i.atZone(ZoneId.systemDefault()).toLocalDate()).orElseThrow();
    }

    private BigDecimal sessionVolume(List<ExerciseSetEntity> group) {
        return group.stream().filter(s -> s.getWeightKg() != null)
            .map(s -> s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Top set of a session: max weight then reps; bodyweight-only groups fall back to max reps. */
    private ExerciseSetEntity topSet(List<ExerciseSetEntity> group) {
        return group.stream().max(Comparator
            .comparing((ExerciseSetEntity s) ->
                s.getWeightKg() != null ? s.getWeightKg() : BigDecimal.valueOf(-1))
            .thenComparing(ExerciseSetEntity::getReps)
            .thenComparing(this::setInstant)).orElseThrow();
    }

    private RecordSetRef toRef(ExerciseSetEntity s) {
        return RecordSetRef.builder()
            .weightKg(s.getWeightKg()).reps(s.getReps()).date(setDate(s)).build();
    }
}
