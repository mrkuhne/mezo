package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.feature.train.entity.json.MesoDayJson;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Save-time validation of the owner's technique picks and challenge flags (mezo-r36n9.80): every
 * exercise must pass {@link TechniqueRules} against its catalog attributes (read once per save,
 * independent of the training style), and a training day carries at most one challenge. Shared by
 * the template save, the run day edit and the custom-workout save, so they cannot drift apart.
 */
@Component
@RequiredArgsConstructor
public class TechniqueGuard {

    public static final String TWO_CHALLENGES = "TRAIN_TECHNIQUE_TWO_CHALLENGES";

    private final CatalogAttributes catalogAttributes;

    /** Template document: each day separately; throws 400 on the first violation. */
    public void validateDays(List<MesoDayJson> days) {
        validate(days.stream().map(MesoDayJson::exercises).toList());
    }

    /** Run rows of ONE day (or a custom workout); throws 400 on the first violation. */
    public void validateRows(List<ExerciseEntity> rows) {
        validate(List.of(rows.stream().map(r -> new GymExerciseJson(r.getId(), r.getName(), r.getMuscle(), null,
            null, null, null, null, null, r.getType(), null, r.getCatalogId(), r.isCountsTowardVolume(), null, null,
            null, null, null, null).withTechnique(r.getTechnique(), r.getTechniqueSource(), r.isChallenge())).toList()));
    }

    private void validate(List<List<GymExerciseJson>> days) {
        if (days.stream().flatMap(List::stream).noneMatch(TechniqueGuard::carriesAny)) {
            return; // nothing flagged anywhere: no catalog read at all
        }
        CatalogAttributes.AttrsLookup attrs = catalogAttributes.loadAttrs(days.stream().flatMap(List::stream)
            .filter(TechniqueGuard::carriesAny).map(GymExerciseJson::catalogId).toList());
        for (List<GymExerciseJson> day : days) {
            int challenges = 0;
            for (GymExerciseJson e : day) {
                boolean challenge = Boolean.TRUE.equals(e.challenge());
                Optional<String> error = TechniqueRules.check(Technique.fromWire(e.technique()), challenge,
                    attrs.of(e.catalogId()));
                if (error.isPresent()) {
                    throw fail(error.get(), e.name());
                }
                if (challenge && ++challenges > 1) {
                    throw fail(TWO_CHALLENGES, e.name());
                }
            }
        }
    }

    private static boolean carriesAny(GymExerciseJson e) {
        Technique t = Technique.fromWire(e.technique());
        return (t != null && t != Technique.NONE) || Boolean.TRUE.equals(e.challenge());
    }

    static SystemRuntimeErrorException fail(String code, String exerciseName) {
        return new SystemRuntimeErrorException(
            SystemMessage.error(code).params(List.of(exerciseName)).build(), HttpStatus.BAD_REQUEST);
    }
}
