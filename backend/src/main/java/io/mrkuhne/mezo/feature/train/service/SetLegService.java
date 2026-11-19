package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.SetLegInput;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetLegEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetLegRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Legs of a logged technique set (mezo-r36n9.80): validation against the set's technique, replace
 * (delete + insert, {@code legIndex} 0..n-1) and the one batched read every reader uses. A leg has no
 * owner or soft-delete of its own — callers pass only ids of LIVE parent sets.
 */
@Service
@RequiredArgsConstructor
public class SetLegService {

    public static final int MAX_LEGS = 6;

    private final ExerciseSetLegRepository legRepository;

    /**
     * Legs only with a technique, only kinds that technique allows (plus one trailing {@code partials} leg — the day
     * challenge's half reps after a drop / myo technique, mezo-r36n9.98), at most {@value #MAX_LEGS}; throws 400.
     */
    public void validate(String technique, List<SetLegInput> legs) {
        if (legs == null || legs.isEmpty()) {
            return;
        }
        Technique t = Technique.fromWire(technique);
        if (t == Technique.NONE) {
            throw bad("TRAIN_SET_LEGS_NEED_TECHNIQUE");
        }
        if (legs.size() > MAX_LEGS) {
            throw bad("TRAIN_SET_LEGS_TOO_MANY");
        }
        if (!TechniqueRules.legsFit(t, legs.stream().map(SetLegInput::getKind).toList())) {
            throw bad("TRAIN_SET_LEG_KIND_MISMATCH");
        }
        for (SetLegInput leg : legs) {
            if ((leg.getReps() != null && leg.getReps() < 0)
                || (leg.getWeightKg() != null && leg.getWeightKg().signum() < 0)
                || (leg.getRestSec() != null && (leg.getRestSec() < 0 || leg.getRestSec() > 600))) {
                throw bad("TRAIN_SET_LEG_VALUE_INVALID");
            }
        }
    }

    /** Replace a set's legs with these (already validated); an empty list just clears them. */
    public void replace(UUID setId, List<SetLegInput> legs) {
        legRepository.deleteByExerciseSetId(setId);
        if (legs == null || legs.isEmpty()) {
            return;
        }
        for (int i = 0; i < legs.size(); i++) {
            SetLegInput in = legs.get(i);
            ExerciseSetLegEntity e = new ExerciseSetLegEntity();
            e.setExerciseSetId(setId);
            e.setLegIndex(i);
            e.setKind(in.getKind().getValue());
            e.setWeightKg(in.getWeightKg());
            e.setReps(in.getReps());
            e.setRestSec(in.getRestSec());
            legRepository.save(e);
        }
        legRepository.flush();
    }

    /** One query: legs per set id, leg order kept; sets without legs are absent. Pass live parents only. */
    public Map<UUID, List<ExerciseSetLegEntity>> legsBySetIds(Collection<UUID> setIds) {
        Map<UUID, List<ExerciseSetLegEntity>> out = new LinkedHashMap<>();
        for (ExerciseSetLegEntity l : legRepository.findByExerciseSetIdIn(setIds)) {
            out.computeIfAbsent(l.getExerciseSetId(), k -> new ArrayList<>()).add(l);
        }
        return out;
    }

    private static SystemRuntimeErrorException bad(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.BAD_REQUEST);
    }
}
