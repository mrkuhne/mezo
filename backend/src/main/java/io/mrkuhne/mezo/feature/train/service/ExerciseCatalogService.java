package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read + write side of the shared exercise catalog (multi-user since S5, mezo-qw37.5).
 *
 * <p>Everyone lists everything. Writes follow one matrix: a MASTER row (created_by null) is
 * loader-owned content — its name/muscle/type/stim/fatigue are read-only for everyone
 * (409 CATALOG_MASTER_READONLY, because {@code ExerciseCatalogLoader} re-upserts them at every
 * startup) while its media (video, stills) is OWNER-only; a USER-authored row may be edited,
 * deleted and re-mediated by its author or the OWNER. Anything else is 403
 * EXERCISE_CATALOG_NOT_EDITABLE (the catalog is public, so a foreign row is not a 404 here).
 * Each returned item carries the viewer's permissions ({@code editable}, {@code mediaEditable})
 * and the authorship ({@code authoredByMe}, {@code authorName}); the FE derives nothing about
 * roles itself. Sorted muscle-then-name so the picker renders grouped.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExerciseCatalogService {

    private final ExerciseCatalogRepository repository;
    private final AppUserRepository appUserRepository;
    private final TrainMapper mapper;

    /** Slug collisions under contention: re-probe and re-insert this many times before giving up. */
    static final int MAX_SLUG_ATTEMPTS = 3;

    public List<ExerciseCatalogItem> list(AppUserEntity viewer) {
        List<ExerciseCatalogEntity> rows = repository.findAllByOrderByMuscleAscNameAsc();
        Map<UUID, String> names = authorNames(rows);
        return rows.stream().map(e -> toItem(e, viewer, names)).toList();
    }

    /**
     * Check-then-insert-then-retry. The pre-probe ({@link #uniqueSlug}) makes the common case
     * deterministic ("Box Jump" → box-jump-2 past the master slug); the retry covers the race where
     * two requests probe the same free slug and the second INSERT trips uq_exercise_catalog_slug.
     * Deliberately NOT @Transactional: a unique-violation on flush marks the surrounding transaction
     * rollback-only, so the retry has to happen outside one — saveAndFlush commits per attempt.
     */
    public ExerciseCatalogItem create(AppUserEntity author, CatalogExerciseCreateRequest req) {
        String base = slugBase(req.getName());
        DataIntegrityViolationException last = null;
        for (int attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
            ExerciseCatalogEntity e = new ExerciseCatalogEntity(); // a fresh instance per attempt
            e.setCreatedBy(author.getId());
            e.setSlug(uniqueSlug(base));
            apply(e, req);
            try {
                return toItem(repository.saveAndFlush(e), author, Map.of(author.getId(), author.getName()));
            } catch (DataIntegrityViolationException ex) {
                last = ex;
                log.info("Catalog slug collision on '{}' (attempt {}/{}), re-probing", e.getSlug(), attempt, MAX_SLUG_ATTEMPTS);
            }
        }
        throw last;
    }

    @Transactional
    public ExerciseCatalogItem update(AppUserEntity actor, UUID id, CatalogExerciseCreateRequest req) {
        ExerciseCatalogEntity e = contentEditableOrThrow(actor, id);
        apply(e, req);
        // UPDATE sets the media fields unconditionally so clearing one (null) actually removes it.
        // CREATE keeps apply()'s set-only-when-present semantics (a fresh row defaults to null).
        e.setVideoUrl(req.getVideoUrl());
        e.setImageStartUrl(req.getImageStartUrl());
        e.setImageEndUrl(req.getImageEndUrl());
        return toItem(repository.save(e), actor, authorNames(List.of(e)));
    }

    @Transactional
    public void delete(AppUserEntity actor, UUID id) {
        repository.delete(contentEditableOrThrow(actor, id)); // @SQLDelete soft-deletes
    }

    @Transactional
    public ExerciseCatalogItem setVideo(AppUserEntity actor, UUID id, String videoUrl) {
        ExerciseCatalogEntity e = mediaEditableOrThrow(actor, id);
        e.setVideoUrl(videoUrl);
        return toItem(repository.save(e), actor, authorNames(List.of(e)));
    }

    /** Both frames are written unconditionally, so a null clears that frame. */
    @Transactional
    public ExerciseCatalogItem setImages(AppUserEntity actor, UUID id, String startUrl, String endUrl) {
        ExerciseCatalogEntity e = mediaEditableOrThrow(actor, id);
        e.setImageStartUrl(startUrl);
        e.setImageEndUrl(endUrl);
        return toItem(repository.save(e), actor, authorNames(List.of(e)));
    }

    // ---- the permission matrix ----

    /** PUT/DELETE: never on a master row (409); author or OWNER on a user row (else 403). */
    private ExerciseCatalogEntity contentEditableOrThrow(AppUserEntity actor, UUID id) {
        ExerciseCatalogEntity e = repository.findById(id).orElseThrow(OwnershipGuard::notFound);
        if (e.getCreatedBy() == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("CATALOG_MASTER_READONLY").build(), HttpStatus.CONFLICT);
        }
        requireAuthorOrOwner(actor, e);
        return e;
    }

    /** video/images: OWNER only on a master row; author or OWNER on a user row (else 403). */
    private ExerciseCatalogEntity mediaEditableOrThrow(AppUserEntity actor, UUID id) {
        ExerciseCatalogEntity e = repository.findById(id).orElseThrow(OwnershipGuard::notFound);
        if (e.getCreatedBy() == null) {
            if (!actor.isOwner()) {
                throw notEditable();
            }
            return e;
        }
        requireAuthorOrOwner(actor, e);
        return e;
    }

    private static void requireAuthorOrOwner(AppUserEntity actor, ExerciseCatalogEntity e) {
        if (!actor.isOwner() && !actor.getId().equals(e.getCreatedBy())) {
            throw notEditable();
        }
    }

    private static SystemRuntimeErrorException notEditable() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("EXERCISE_CATALOG_NOT_EDITABLE").build(), HttpStatus.FORBIDDEN);
    }

    // ---- mapping ----

    private void apply(ExerciseCatalogEntity e, CatalogExerciseCreateRequest req) {
        e.setName(req.getName());
        e.setMuscle(req.getMuscle().getValue());
        e.setType(req.getType().getValue());
        e.setStim(req.getStim());
        e.setFatigue(req.getFatigue());
        if (req.getVideoUrl() != null) {
            e.setVideoUrl(req.getVideoUrl());
        }
        if (req.getImageStartUrl() != null) {
            e.setImageStartUrl(req.getImageStartUrl());
        }
        if (req.getImageEndUrl() != null) {
            e.setImageEndUrl(req.getImageEndUrl());
        }
    }

    /** One batched app_user read per list call — never a lookup per row. */
    private Map<UUID, String> authorNames(Collection<ExerciseCatalogEntity> rows) {
        Set<UUID> ids = rows.stream().map(ExerciseCatalogEntity::getCreatedBy)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return appUserRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(AppUserEntity::getId, AppUserEntity::getName));
    }

    private ExerciseCatalogItem toItem(ExerciseCatalogEntity e, AppUserEntity viewer, Map<UUID, String> names) {
        boolean master = e.getCreatedBy() == null;
        boolean mine = !master && e.getCreatedBy().equals(viewer.getId());
        ExerciseCatalogItem dto = mapper.toCatalogItem(e);
        dto.setAuthoredByMe(mine);
        dto.setAuthorName(master ? null : names.get(e.getCreatedBy()));
        dto.setEditable(!master && (mine || viewer.isOwner()));
        dto.setMediaEditable(master ? viewer.isOwner() : (mine || viewer.isOwner()));
        return dto;
    }

    private static String slugBase(String name) {
        String base = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return base.isBlank() ? "exercise" : base;
    }

    /** First free candidate: base, base-2, base-3 … against the physical table (soft-deleted rows included). */
    private String uniqueSlug(String base) {
        String candidate = base;
        int n = 1;
        while (repository.countAllBySlugIncludingDeleted(candidate) > 0) {
            n++;
            candidate = base + "-" + n;
        }
        return candidate;
    }
}
