package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read + write side of the exercise catalog. Master rows (created_by null) are content shared by
 * every user (read-only — edits/deletes 409); user-authored rows (created_by set) are per-user
 * writable and soft-deletable. {@code editable} on each item reflects "created by the current user";
 * the demo {@code videoUrl} can be attached to ANY row (master or user). Sorted muscle-then-name so
 * the picker renders grouped.
 */
@Service
@RequiredArgsConstructor
public class ExerciseCatalogService {

    private final ExerciseCatalogRepository repository;
    private final TrainMapper mapper;

    public List<ExerciseCatalogItem> list(UUID currentUser) {
        return repository.findAllByOrderByMuscleAscNameAsc().stream()
            .map(e -> withEditable(e, currentUser)).toList();
    }

    @Transactional
    public ExerciseCatalogItem create(UUID createdBy, CatalogExerciseCreateRequest req) {
        ExerciseCatalogEntity e = new ExerciseCatalogEntity();
        e.setCreatedBy(createdBy);
        e.setSlug(uniqueSlug(req.getName()));
        apply(e, req);
        return withEditable(repository.save(e), createdBy);
    }

    @Transactional
    public ExerciseCatalogItem update(UUID currentUser, UUID id, CatalogExerciseCreateRequest req) {
        ExerciseCatalogEntity e = ownedOrThrow(currentUser, id);
        apply(e, req);
        return withEditable(repository.save(e), currentUser);
    }

    @Transactional
    public void delete(UUID currentUser, UUID id) {
        repository.delete(ownedOrThrow(currentUser, id)); // @SQLDelete soft-deletes
    }

    @Transactional
    public ExerciseCatalogItem setVideo(UUID currentUser, UUID id, String videoUrl) {
        ExerciseCatalogEntity e = repository.findById(id).orElseThrow(OwnershipGuard::notFound);
        e.setVideoUrl(videoUrl);
        return withEditable(repository.save(e), currentUser);
    }

    private ExerciseCatalogEntity ownedOrThrow(UUID currentUser, UUID id) {
        ExerciseCatalogEntity e = repository.findById(id).orElseThrow(OwnershipGuard::notFound);
        if (e.getCreatedBy() == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("CATALOG_MASTER_READONLY").build(), HttpStatus.CONFLICT);
        }
        if (!currentUser.equals(e.getCreatedBy())) {
            throw OwnershipGuard.notFound();
        }
        return e;
    }

    private void apply(ExerciseCatalogEntity e, CatalogExerciseCreateRequest req) {
        e.setName(req.getName());
        e.setMuscle(req.getMuscle().getValue());
        e.setType(req.getType().getValue());
        e.setStim(req.getStim());
        e.setFatigue(req.getFatigue());
        if (req.getVideoUrl() != null) {
            e.setVideoUrl(req.getVideoUrl());
        }
    }

    private ExerciseCatalogItem withEditable(ExerciseCatalogEntity e, UUID currentUser) {
        ExerciseCatalogItem dto = mapper.toCatalogItem(e);
        dto.setEditable(e.getCreatedBy() != null && e.getCreatedBy().equals(currentUser));
        return dto;
    }

    private String uniqueSlug(String name) {
        String base = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.isBlank()) {
            base = "exercise";
        }
        long n = repository.countBySlugStartingWith(base);
        return n == 0 ? base : base + "-" + (n + 1);
    }
}
