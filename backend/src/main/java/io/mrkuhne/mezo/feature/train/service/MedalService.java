package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.Medal;
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
 * The owner's medal history, DERIVED by replaying the logged set stream through
 * {@link MedalEvaluator} (spec 2026-07-30-medal-collection-design.md §6–7). Nothing is stored and
 * there is no medal table: every read re-runs the rules over the sets, so the cabinet backfills the
 * whole history for free and can never desync from the data it describes — editing or deleting a
 * past set silently corrects every medal that set implied.
 *
 * <p>Identity resolution mirrors {@link ExerciseRecordService}: {@code catalog_id} when the exercise
 * is catalog-linked, else the name, resolved over ALL exercise rows INCLUDING soft-deleted ones (a
 * day edit replaces template rows while their sets stay live — history must survive it). Eligible
 * sets are working, non-skipped and carry reps; instance status is deliberately NOT filtered, so
 * medals also fire inside a workout that is still active.
 *
 * <p>Cost: one set-history read plus an in-memory replay per call, the same shape
 * {@link ExerciseRecordService} already runs on every records read. Within an identity the replay
 * is quadratic in its set count, because {@link MedalEvaluator#forSet} is handed the full prior
 * list; single-user volumes keep that far below anything noticeable, and prior pruning (per
 * distinct weight, keep only the max-reps set — provably lossless for all three weight rules) is
 * the escape hatch if a decade of history ever makes it matter.
 */
@Service
@RequiredArgsConstructor
public class MedalService {

    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;

    /**
     * Every medal the owner has ever earned, newest first. Same-day medals are grouped by exercise
     * and then by type so two GETs cannot shuffle the cabinet: the underlying set query has no
     * ORDER BY, so without explicit keys the presentation order would be whatever Postgres
     * happened to return. What remains tied (one exercise out-doing itself twice in a day) falls
     * back to the replay's own chronological order, which {@link #replay} makes deterministic.
     */
    public List<Medal> list(UUID createdBy) {
        return replay(createdBy).stream()
            .sorted(Comparator.comparing((Earned e) -> e.medal().getDate()).reversed()
                .thenComparing((Earned e) -> e.medal().getExerciseName())
                .thenComparing((Earned e) -> e.medal().getType()))
            .map(Earned::medal)
            .toList();
    }

    /**
     * The medals one just-logged set earned. {@code SESSION_VOLUME} is session-scoped and never
     * shows on a set row (spec §6), so it is absent here — {@link #forSession} carries it.
     */
    public List<Medal> forSet(UUID createdBy, UUID setId) {
        return replay(createdBy).stream()
            .filter(e -> setId.equals(e.setId()))
            .map(Earned::medal)
            .toList();
    }

    /** Every medal earned inside one workout instance, {@code SESSION_VOLUME} included. */
    public List<Medal> forSession(UUID createdBy, UUID workoutSessionId) {
        return replay(createdBy).stream()
            .filter(e -> workoutSessionId.equals(e.medal().getWorkoutSessionId()))
            .map(Earned::medal)
            .toList();
    }

    /** One earned medal and the set that earned it; {@code setId} is null for SESSION_VOLUME. */
    private record Earned(UUID setId, Medal medal) {}

    /** The best reps ever done at one weight, plus the date that record has stood since. */
    private record RepsAtWeight(int reps, LocalDate since) {}

    private List<Earned> replay(UUID createdBy) {
        List<ExerciseSetEntity> sets = exerciseSetRepository
            .findByCreatedByAndRepsNotNullAndKind(createdBy, "working").stream()
            .filter(s -> !s.isSkipped())
            .toList();
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

        List<Earned> earned = new ArrayList<>();
        for (Map.Entry<String, List<ExerciseSetEntity>> entry : setsByIdentity.entrySet()) {
            ExerciseIdentityRow display = displayByIdentity.get(entry.getKey());
            ExerciseCatalogEntity cat =
                display.getCatalogId() != null ? catalog.get(display.getCatalogId()) : null;
            List<ExerciseSetEntity> ordered = entry.getValue().stream()
                .sorted(replayOrder()).toList();
            replaySets(ordered, display, cat, earned);
            replaySessions(ordered, display, cat, earned);
        }
        return earned;
    }

    /**
     * Walks one identity's sets oldest-first, judging each against everything logged before it —
     * so the first set establishes the baseline silently and only a strict improvement medals.
     */
    private void replaySets(List<ExerciseSetEntity> ordered, ExerciseIdentityRow display,
        ExerciseCatalogEntity cat, List<Earned> out) {
        List<MedalEvaluator.Prior> priors = new ArrayList<>();
        RunningBest bestWeight = new RunningBest();
        RunningBest bestE1rm = new RunningBest();
        Map<BigDecimal, RepsAtWeight> bestRepsByWeight = new HashMap<>();

        for (ExerciseSetEntity set : ordered) {
            LocalDate date = setDate(set);
            List<MedalEvaluator.Award> awards = MedalEvaluator.forSet(
                new MedalEvaluator.Candidate(set.getWeightKg(), set.getReps(),
                    set.getTargetWeightKg(), set.getTargetReps()),
                priors);
            for (MedalEvaluator.Award award : awards) {
                // the record about to fall has stood since the day it was set, NOT since the last
                // time it was matched — that date is the cabinet's "eddigi legjobbad … óta állt"
                LocalDate previousDate = switch (award.kind()) {
                    case WEIGHT -> bestWeight.since();
                    case E1RM -> bestE1rm.since();
                    case REPS_AT_WEIGHT -> bestRepsByWeight.get(weightKey(set.getWeightKg())).since();
                    case TARGET_HIT, SESSION_VOLUME -> null;
                };
                out.add(new Earned(set.getId(), toMedal(award, display, cat, set, date, previousDate)));
            }

            priors.add(new MedalEvaluator.Prior(set.getWeightKg(), set.getReps()));
            if (set.getWeightKg() != null) {
                bestWeight.offer(set.getWeightKg(), date);
                bestE1rm.offer(MedalEvaluator.epley(set.getWeightKg(), set.getReps()), date);
                bestRepsByWeight.merge(weightKey(set.getWeightKg()),
                    new RepsAtWeight(set.getReps(), date),
                    (held, fresh) -> fresh.reps() > held.reps() ? fresh : held);
            }
        }
    }

    /**
     * The session-scoped pass: Σ(weight × reps) of THIS identity within one workout instance,
     * against the same identity's best prior session.
     */
    private void replaySessions(List<ExerciseSetEntity> ordered, ExerciseIdentityRow display,
        ExerciseCatalogEntity cat, List<Earned> out) {
        // session = workout instance; legacy sets without an instance group by exercise row
        Map<UUID, List<ExerciseSetEntity>> bySession = ordered.stream().collect(Collectors.groupingBy(
            s -> s.getWorkoutSessionId() != null ? s.getWorkoutSessionId() : s.getExerciseId(),
            LinkedHashMap::new, Collectors.toList()));

        RunningBest bestVolume = new RunningBest();
        List<List<ExerciseSetEntity>> sessions = bySession.entrySet().stream()
            .sorted(Comparator.comparing(
                    (Map.Entry<UUID, List<ExerciseSetEntity>> e) -> sessionInstant(e.getValue()))
                .thenComparing((Map.Entry<UUID, List<ExerciseSetEntity>> e) -> e.getKey().toString()))
            .map(Map.Entry::getValue)
            .toList();
        for (List<ExerciseSetEntity> session : sessions) {
            BigDecimal volume = sessionVolume(session);
            if (volume.signum() <= 0) {
                continue; // bodyweight-only session — carries no comparable volume, sets no baseline
            }
            LocalDate date = sessionInstant(session).atZone(ZoneId.systemDefault()).toLocalDate();
            MedalEvaluator.Award award = MedalEvaluator.sessionVolume(volume, bestVolume.value());
            if (award != null) {
                // the top set names the lift the row shows; the medal itself belongs to the session
                out.add(new Earned(null,
                    toMedal(award, display, cat, topSet(session), date, bestVolume.since())));
            }
            bestVolume.offer(volume, date);
        }
    }

    private Medal toMedal(MedalEvaluator.Award award, ExerciseIdentityRow display,
        ExerciseCatalogEntity cat, ExerciseSetEntity set, LocalDate date, LocalDate previousDate) {
        boolean repsValued = award.kind() == MedalEvaluator.MedalKind.REPS_AT_WEIGHT
            || award.kind() == MedalEvaluator.MedalKind.TARGET_HIT;
        return Medal.builder()
            .type(Medal.TypeEnum.fromValue(award.kind().name()))
            .tier(award.kind() == MedalEvaluator.MedalKind.TARGET_HIT
                ? Medal.TierEnum.TARGET : Medal.TierEnum.RECORD)
            .exerciseName(cat != null ? cat.getName() : display.getName())
            .catalogId(display.getCatalogId())
            .muscle(cat != null ? cat.getMuscle() : display.getMuscle())
            .date(date)
            .workoutSessionId(set.getWorkoutSessionId())
            .setIndex(set.getSetIndex())
            .value(award.value())
            .unit(repsValued ? Medal.UnitEnum.REPS : Medal.UnitEnum.KG)
            // weightKg/reps always describe the ACHIEVING set; value is the type's headline number
            .weightKg(set.getWeightKg())
            .reps(set.getReps())
            .previousValue(award.previousValue())
            .previousDate(previousDate)
            .build();
    }

    /**
     * The order the replay reads one identity's sets in, and it MUST be total. A medal is only
     * awarded against what came strictly before, so the order decides the outcome, not just the
     * presentation: two sets tied on their instant at 100×8 and 102.5×8 yield a WEIGHT medal in one
     * order and none in the other. Ties are unreachable for API-logged sets (each {@code logSet}
     * stamps its own {@code Instant.now()}) but TOTAL for rows inserted as one batch with
     * {@code done_at} null — Postgres {@code now()} is transaction-scoped, which is what a
     * demofixtures seed or a future import produces — and the set query carries no ORDER BY, so
     * without this the sequence would be whatever the scan returned. {@code setIndex} breaks the
     * tie the way a human reads the session; the id is the final total key.
     */
    private Comparator<ExerciseSetEntity> replayOrder() {
        return Comparator.comparing((ExerciseSetEntity s) -> setInstant(s))
            .thenComparing(ExerciseSetEntity::getSetIndex)
            .thenComparing((ExerciseSetEntity s) -> s.getId().toString());
    }

    /** Scale-insensitive weight key: 100.00 and 100.0 are the same weight to a rep record. */
    private BigDecimal weightKey(BigDecimal weightKg) {
        return weightKg.stripTrailingZeros();
    }

    private Instant setInstant(ExerciseSetEntity s) {
        return s.getDoneAt() != null ? s.getDoneAt() : s.getCreatedAt();
    }

    private LocalDate setDate(ExerciseSetEntity s) {
        return setInstant(s).atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private Instant sessionInstant(List<ExerciseSetEntity> session) {
        return session.stream().map(this::setInstant).max(Comparator.naturalOrder()).orElseThrow();
    }

    private BigDecimal sessionVolume(List<ExerciseSetEntity> session) {
        return session.stream().filter(s -> s.getWeightKg() != null)
            .map(s -> s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps())))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(0, RoundingMode.HALF_UP);
    }

    /** Top set of a session: max weight then reps; bodyweight-only groups fall back to max reps. */
    private ExerciseSetEntity topSet(List<ExerciseSetEntity> session) {
        return session.stream().max(Comparator
            .comparing((ExerciseSetEntity s) ->
                s.getWeightKg() != null ? s.getWeightKg() : BigDecimal.valueOf(-1))
            .thenComparing(ExerciseSetEntity::getReps)
            .thenComparing(this::setInstant)).orElseThrow();
    }

    /**
     * A running record value plus the date it was FIRST reached — the date it "has stood since",
     * which is exactly what a medal's {@code previousDate} must report. Raised on a strict
     * improvement only, so later ties never re-date a standing record.
     */
    private static final class RunningBest {

        private BigDecimal value;
        private LocalDate since;

        BigDecimal value() {
            return value;
        }

        LocalDate since() {
            return since;
        }

        void offer(BigDecimal candidate, LocalDate date) {
            if (candidate != null && (value == null || candidate.compareTo(value) > 0)) {
                value = candidate;
                since = date;
            }
        }
    }
}
