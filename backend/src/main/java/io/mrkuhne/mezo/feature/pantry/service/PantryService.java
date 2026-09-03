package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.config.PantryImportProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.mapper.PantryMapper;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryImportRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PantryService {

    private final PantryItemRepository repository;
    private final PantryCatalogRepository catalogRepository;
    private final PantryImportRepository importRepository;
    private final PantryCatalogService catalogService;
    private final PantrySuggestionService suggestionService;
    private final PantryImportProperties importProperties;
    private final PantryMapper mapper;
    private final AppUserRepository appUserRepository;

    /**
     * The caller's shelf joined to the shared definitions (S4, mezo-qw37.4), projected by kind:
     * food -&gt; ingredients; supplement/stim/med -&gt; stash. {@code sharedFrom} names the author of a
     * definition somebody else created; {@code catalogEditable} is the author-or-OWNER gate the edit
     * sheet uses to lock the definition fields. Since P6 (mezo-bka) the response also carries the
     * recent import feed + the deterministic swap suggestions.
     */
    @Transactional(readOnly = true)
    public PantryResponse getPantry(AppUserEntity user) {
        List<PantryItemEntity> items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(user.getId());
        Map<UUID, String> names =
            catalogService.authorNames(items.stream().map(PantryItemEntity::getCatalog).toList());
        return PantryResponse.builder()
            .ingredients(items.stream().filter(e -> "food".equals(e.getCatalog().getKind()))
                .map(e -> mapper.toIngredientResponse(e,
                    catalogService.sharedFromName(user.getId(), e.getCatalog(), names),
                    catalogService.editable(user, e.getCatalog()))).toList())
            .stash(items.stream().filter(e -> !"food".equals(e.getCatalog().getKind()))
                .map(e -> mapper.toSupplementResponse(e,
                    catalogService.sharedFromName(user.getId(), e.getCatalog(), names),
                    catalogService.editable(user, e.getCatalog()))).toList())
            .imports(importRepository
                .findByCreatedByAndDeletedFalseOrderByImportedAtDesc(user.getId(), Limit.of(importProperties.feedSize()))
                .stream().map(mapper::toImportEntry).toList())
            .suggestions(suggestionService.suggest(items))
            .build();
    }

    /**
     * Id-only overload for the non-HTTP callers that never hold the {@link AppUserEntity} (companion
     * tools, cron): the edit gate needs the ROLE, so the account is loaded here instead.
     */
    @Transactional(readOnly = true)
    public PantryResponse getPantry(UUID userId) {
        return getPantry(appUserRepository.findById(userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND)));
    }

    /**
     * With {@code catalogId}: bind to that definition (idempotent) and apply the state fields.
     * Without: find-or-create the definition by natural key — a hit binds to the existing shared
     * row (no 409, spec §11), so the caller's OWN definition values only ever fill a NEW row.
     */
    @Transactional
    public PantryItemResponse createItem(UUID userId, PantryItemRequest req) {
        if (req.getCatalogId() != null) {
            PantryItemEntity bound = catalogService.ensureItem(userId, req.getCatalogId());
            mapper.applyUserFieldsPartial(bound, req);
            return mapper.toItemResponse(bound);
        }
        validatePerKind(req);
        PantryCatalogEntity candidate = new PantryCatalogEntity();
        mapper.applyDefinition(candidate, req);
        PantryCatalogEntity catalog = catalogService.findOrCreate(userId, candidate);
        PantryItemEntity item = catalogService.ensureItem(userId, catalog.getId());
        mapper.applyUserFields(item, req);
        return mapper.toItemResponse(item);
    }

    /** The from-catalog endpoint — service-level twin of the AI/workshop auto-add. Idempotent. */
    @Transactional
    public PantryItemResponse addFromCatalog(UUID userId, UUID catalogId) {
        return mapper.toItemResponse(catalogService.ensureItem(userId, catalogId));
    }

    /**
     * State fields always (they are the caller's own shelf row); definition fields only when they
     * actually differ AND the caller may edit the shared row (author or OWNER) — else 403 and
     * NOTHING is written. The gate deliberately runs before {@code applyDefinitionPartial}: the
     * catalog entity is managed, so a half-applied refused edit would still be flushed on commit.
     * A rename onto another entry's natural key is a 409 rather than a unique-index 500.
     */
    @Transactional
    public PantryItemResponse updateItem(AppUserEntity user, UUID id, PantryItemRequest req) {
        validatePerKind(req);
        PantryItemEntity e = requireOwned(user.getId(), id);
        PantryCatalogEntity c = e.getCatalog();
        if (mapper.definitionDiffers(c, req)) {
            catalogService.requireEditable(user, c);
            String newName = req.getName() == null ? c.getName() : req.getName().strip();
            String newBrand = req.getBrand() == null ? c.getBrand() : req.getBrand().strip();
            catalogRepository.findByNaturalKey(newName, newBrand)
                .filter(other -> !other.getId().equals(c.getId()))
                .ifPresent(other -> {
                    throw new SystemRuntimeErrorException(
                        SystemMessage.error("PANTRY_CATALOG_NAME_TAKEN").build(), HttpStatus.CONFLICT);
                });
            mapper.applyDefinitionPartial(c, req); // dirty-checked, flushed on commit
        }
        mapper.applyUserFieldsPartial(e, req);
        return mapper.toItemResponse(e);
    }

    /**
     * Soft-deletes the SHELF row only ({@code @SQLDelete} on {@code pantry_item}); the shared
     * definition — and every other user's row for it — survives. Never delete the catalog row:
     * it carries no {@code @SQLDelete}, so that would be a hard delete against an
     * {@code ON DELETE RESTRICT} FK.
     */
    @Transactional
    public void deleteItem(UUID userId, UUID id) {
        repository.delete(requireOwned(userId, id));
    }

    /** Per-kind required fields live here (not DB CHECKs) so the single table stays flexible. */
    private void validatePerKind(PantryItemRequest req) {
        String kind = req.getKind() == null ? null : req.getKind().getValue();
        if ("food".equals(kind)) {
            requireField(req.getUnit(), "unit");
            requireField(req.getKcal(), "kcal");
        } else { // supplement | stim | med
            // A supplement is either dose/protocol-based (pill: dose) OR nutrition/gram-based
            // (protein powder: per/unit, no discrete dose — mezo-1za9). Require at least one
            // quantity basis, not `dose` specifically, else a gram-based supplement can't be
            // saved and its ADAG edits silently revert (mezo-2567).
            boolean hasDose = req.getDose() != null && !req.getDose().isBlank();
            if (!hasDose && req.getPer() == null) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "dose").build(), HttpStatus.BAD_REQUEST);
            }
        }
    }

    private void requireField(Object value, String field) {
        boolean missing = value == null || (value instanceof String s && s.isBlank());
        if (missing) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", field).build(), HttpStatus.BAD_REQUEST);
        }
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private PantryItemEntity requireOwned(UUID userId, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
