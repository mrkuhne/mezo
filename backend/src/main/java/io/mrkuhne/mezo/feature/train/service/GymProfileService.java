package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.GymProfile;
import io.mrkuhne.mezo.feature.train.ExerciseCatalogLoader;
import io.mrkuhne.mezo.feature.train.entity.GymProfileEntity;
import io.mrkuhne.mezo.feature.train.repository.GymProfileRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The per-user gym profile ("Mi van a termemben", mezo-r36n9.66, spec §6.2). */
@Service
@RequiredArgsConstructor
public class GymProfileService {

    /** The nine owner-facing kit kinds; {@code bodyweight} is always available and never switchable. */
    static final Set<String> OFF_KINDS = offKinds();

    private final GymProfileRepository repository;

    private static Set<String> offKinds() {
        Set<String> kinds = new HashSet<>(ExerciseCatalogLoader.GEAR);
        kinds.remove("bodyweight");
        return Set.copyOf(kinds);
    }

    /** The saved profile, or both lists empty when none — never 404. */
    @Transactional(readOnly = true)
    public GymProfile get(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(GymProfileService::toDto)
            .orElseGet(() -> new GymProfile().offKinds(List.of()).missingExerciseIds(List.of()));
    }

    @Transactional
    public GymProfile put(UUID userId, GymProfile profile) {
        List<String> kinds = profile.getOffKinds() == null ? List.of() : profile.getOffKinds();
        if (!OFF_KINDS.containsAll(kinds)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("TRAIN_GYM_KIND_INVALID", "offKinds").build(), HttpStatus.BAD_REQUEST);
        }
        GymProfileEntity row = repository.findByCreatedByAndDeletedFalse(userId).orElseGet(() -> {
            GymProfileEntity e = new GymProfileEntity();
            e.setCreatedBy(userId); // server-side from principal, never from client
            return e;
        });
        row.setOffKinds(new ArrayList<>(new java.util.LinkedHashSet<>(kinds)));
        List<UUID> missing = profile.getMissingExerciseIds() == null ? List.of() : profile.getMissingExerciseIds();
        row.setMissingExerciseIds(new ArrayList<>(new java.util.LinkedHashSet<>(missing)));
        return toDto(repository.save(row));
    }

    /** For the ranker: what this user's gym can host. */
    @Transactional(readOnly = true)
    public GymAvailability availability(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(e -> new GymAvailability(Set.copyOf(e.getOffKinds()), Set.copyOf(e.getMissingExerciseIds())))
            .orElseGet(GymAvailability::everything);
    }

    private static GymProfile toDto(GymProfileEntity e) {
        return new GymProfile()
            .offKinds(List.copyOf(e.getOffKinds()))
            .missingExerciseIds(List.copyOf(e.getMissingExerciseIds()));
    }
}
