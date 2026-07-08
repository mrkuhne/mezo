package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code challenge} rows (proactive P2, bd mezo-hbwi). */
@TestComponent
@RequiredArgsConstructor
public class ChallengePopulator {

    private final ChallengeRepository challengeRepository;

    /** A proposed-by-default challenge; type/status supplied, targets/confidence/outcome null, empty refs. */
    public ChallengeEntity challenge(UUID createdBy, UUID templateSessionId, LocalDate workoutDate,
                                     UUID exerciseId, String type, String status) {
        ChallengeEntity entity = new ChallengeEntity();
        entity.setCreatedBy(createdBy);
        entity.setTemplateSessionId(templateSessionId);
        entity.setWorkoutDate(workoutDate);
        entity.setExerciseId(exerciseId);
        entity.setExerciseName("Chest Supported Row");
        entity.setType(type);
        entity.setStatus(status);
        entity.setTitle("Teszt kihívás");
        entity.setWhy("Teszt indoklás.");
        entity.setGlory("Teszt dicsőség.");
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return challengeRepository.saveAndFlush(entity);
    }

    /** A PR challenge with concrete weight/rep targets (outcome-evaluation tests). */
    public ChallengeEntity challengePr(UUID createdBy, UUID templateSessionId, LocalDate workoutDate,
                                       UUID exerciseId, String status, String targetWeightKg, int targetReps) {
        ChallengeEntity entity = challenge(createdBy, templateSessionId, workoutDate, exerciseId,
            ChallengeEntity.TYPE_PR, status);
        entity.setTargetWeightKg(new BigDecimal(targetWeightKg));
        entity.setTargetReps(targetReps);
        return challengeRepository.saveAndFlush(entity);
    }
}
