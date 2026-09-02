package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TimingProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutTimingProfileEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutTimingProfileRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Learns a per-user workout-timing profile from finished sessions (spec 2026-09-02, slice 2):
 * folds each session's {@link TimingObservationExtractor} intervals into an {@link
 * EwmaEstimator} per component. Called ONLY from {@link TimingProfileListener}, never directly
 * from {@code WorkoutService.finishWorkout} — the listener consumes {@link WorkoutFinishedEvent}
 * AFTER_COMMIT, well after finishWorkout's own transaction is gone.
 *
 * <p>{@code learnFrom} is plain method-level {@code @Transactional} (default REQUIRED). Because
 * the listener runs on a detached {@code @Async} thread with no ambient transaction, REQUIRED
 * opens a genuinely NEW transaction here — there is nothing to join. This is deliberate: an
 * earlier version had {@code learnFrom} join {@code finishWorkout}'s own transaction directly,
 * guarded by a try/catch in the caller, and that was proven unsafe — Spring marks a
 * PARTICIPATING transaction rollback-only the instant any exception escapes a joined
 * {@code @Transactional} callee, regardless of whether the callee touched the database, so the
 * try/catch could not stop a profile-learning bug from taking the user's completed workout down
 * with it. See {@link TimingProfileListener}'s javadoc for the AFTER_COMMIT + {@code @Async}
 * design that replaced it.
 */
@Service
@RequiredArgsConstructor
public class TimingProfileService {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final WorkoutTimingProfileRepository repository;
    private final TimingProperties properties;

    /**
     * Folds one finished session's intervals into the user's profile.
     *
     * <p>Karn's rule, applied literally: a session that was auto-closed (finishedAt IS NULL while
     * status is 'completed') or whose clipped-interval share exceeds maxClippedRatio has ambiguous
     * provenance and is skipped ENTIRELY rather than partially trusted.
     */
    @Transactional
    public void learnFrom(UUID createdBy, UUID workoutSessionId) {
        WorkoutSessionEntity session = workoutSessionRepository.findById(workoutSessionId)
            .filter(s -> createdBy.equals(s.getCreatedBy()))
            .orElse(null);
        if (session == null || session.getFinishedAt() == null) {
            return;
        }
        List<TimingObservationExtractor.SetStamp> stamps = stampsFor(createdBy, session);
        var result = TimingObservationExtractor.extract(
            session.getStartedAt(), stamps,
            properties.gapCapSeconds(), properties.leadInCapSeconds());
        if (result.observations().isEmpty() || result.tooNoisy(properties.maxClippedRatio())) {
            return;
        }
        for (TimingObservation observation : result.observations()) {
            apply(createdBy, observation);
        }
    }

    /**
     * The session's non-skipped, done sets as {@link TimingObservationExtractor.SetStamp}s — the
     * extractor trusts clean input (sorts by doneAt, no null-tolerance), so filtering skip-marker
     * rows and null doneAt is THIS method's job, not the extractor's. Mirrors the predicate
     * {@code WorkoutService.finishWorkout} already applies for its own SessionTimingCalculator call.
     * Each set's exercise type is resolved with ONE batch lookup, not a query per set.
     */
    private List<TimingObservationExtractor.SetStamp> stampsFor(UUID createdBy, WorkoutSessionEntity session) {
        List<ExerciseSetEntity> sets = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, session.getId())
            .stream()
            .filter(s -> !s.isSkipped() && s.getDoneAt() != null)
            .toList();
        if (sets.isEmpty()) {
            return List.of();
        }
        List<UUID> exerciseIds = sets.stream().map(ExerciseSetEntity::getExerciseId).distinct().toList();
        Map<UUID, String> typeById = exerciseRepository.findAllById(exerciseIds).stream()
            .collect(Collectors.toMap(ExerciseEntity::getId, ExerciseEntity::getType));
        return sets.stream()
            .map(s -> new TimingObservationExtractor.SetStamp(
                s.getExerciseId(), typeById.get(s.getExerciseId()), s.getDoneAt()))
            .toList();
    }

    /** Loads or seeds the component's row, updates it via EwmaEstimator, and saves. */
    private void apply(UUID createdBy, TimingObservation observation) {
        WorkoutTimingProfileEntity row = repository
            .findByCreatedByAndComponent(createdBy, observation.component())
            .orElseGet(() -> {
                WorkoutTimingProfileEntity fresh = new WorkoutTimingProfileEntity();
                fresh.setCreatedBy(createdBy);
                fresh.setComponent(observation.component());
                EwmaEstimator.Estimate seed = EwmaEstimator.seed(seedFor(observation.component()));
                fresh.setValueNum(seed.value());
                fresh.setDeviationNum(seed.deviation());
                fresh.setSamples(seed.samples());
                return fresh;
            });
        EwmaEstimator.Estimate current =
            new EwmaEstimator.Estimate(row.getValueNum(), row.getDeviationNum(), row.getSamples());
        EwmaEstimator.Estimate updated = EwmaEstimator.update(
            current, observation.seconds(),
            properties.alpha(), properties.beta(), properties.outlierK(), properties.minSamples());
        row.setValueNum(updated.value());
        row.setDeviationNum(updated.deviation());
        row.setSamples(updated.samples());
        row.setUpdatedAt(Instant.now());
        // saveAndFlush, not save: surface constraint violations inside the listener's own
        // transaction, synchronously, right here — where TimingProfileListener's try/catch can
        // actually catch them — rather than at a deferred flush the caller never sees.
        repository.saveAndFlush(row);
    }

    private double seedFor(String component) {
        return switch (component) {
            case TimingObservationExtractor.SET_CYCLE_COMPOUND -> properties.seedSetCycleCompound();
            case TimingObservationExtractor.SET_CYCLE_ISOLATION -> properties.seedSetCycleIsolation();
            case TimingObservationExtractor.TRANSITION -> properties.seedTransition();
            case TimingObservationExtractor.LEAD_IN -> properties.seedLeadIn();
            default -> throw new SystemRuntimeErrorException(
                SystemMessage.error("TIMING_PROFILE_UNKNOWN_COMPONENT").params(List.of(component)).build(),
                HttpStatus.INTERNAL_SERVER_ERROR);
        };
    }

    /** The user's learned components, config seeds filling anything not yet learned. */
    @Transactional(readOnly = true)
    public Map<String, EwmaEstimator.Estimate> read(UUID createdBy) {
        Map<String, EwmaEstimator.Estimate> out = new LinkedHashMap<>(seeds());
        for (WorkoutTimingProfileEntity row : repository.findByCreatedBy(createdBy)) {
            out.put(row.getComponent(),
                new EwmaEstimator.Estimate(row.getValueNum(), row.getDeviationNum(), row.getSamples()));
        }
        return out;
    }

    // Explicit ordered puts, not Map.of(...): Map.of randomizes iteration order per JVM, and
    // read() wraps this in a LinkedHashMap to preserve insertion order — a future JSON endpoint
    // (Task 11) serializing this map needs a STABLE key order across runs, not just within one.
    private Map<String, EwmaEstimator.Estimate> seeds() {
        Map<String, EwmaEstimator.Estimate> seeds = new LinkedHashMap<>();
        seeds.put(TimingObservationExtractor.SET_CYCLE_COMPOUND, EwmaEstimator.seed(properties.seedSetCycleCompound()));
        seeds.put(TimingObservationExtractor.SET_CYCLE_ISOLATION, EwmaEstimator.seed(properties.seedSetCycleIsolation()));
        seeds.put(TimingObservationExtractor.TRANSITION, EwmaEstimator.seed(properties.seedTransition()));
        seeds.put(TimingObservationExtractor.LEAD_IN, EwmaEstimator.seed(properties.seedLeadIn()));
        return seeds;
    }
}
