package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.config.PantryImportProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.event.PantryFactsChangedEvent;
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
import org.springframework.context.ApplicationEventPublisher;
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
    private final ApplicationEventPublisher events;
    private final PantryFoodScoreService foodScoreService;

    private static final String SOURCE_AI_ESTIMATE = "ai_estimate";

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
        // Each food's own score (mezo-r36n9.63), computed fresh from the definition — one pass for the shelf.
        List<PantryItemEntity> foods = items.stream().filter(e -> "food".equals(e.getCatalog().getKind())).toList();
        List<java.math.BigDecimal> scores =
            foodScoreService.scores(foods.stream().map(PantryItemEntity::getCatalog).toList());
        List<io.mrkuhne.mezo.api.dto.IngredientResponse> ingredients = new java.util.ArrayList<>(foods.size());
        for (int i = 0; i < foods.size(); i++) {
            PantryItemEntity e = foods.get(i);
            var row = mapper.toIngredientResponse(e,
                catalogService.sharedFromName(user.getId(), e.getCatalog(), names),
                catalogService.editable(user, e.getCatalog()));
            row.setScore(scores.get(i));
            ingredients.add(row);
        }
        return PantryResponse.builder()
            .ingredients(ingredients)
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
     * row (no 409, spec §11); the caller's own definition values fill a brand-new row outright, or
     * fill-only backfill NULL fields on an existing row IF the caller happens to already be that
     * row's author (see {@code PantryCatalogService#mergeIfAuthor}) — never a bystander's or the
     * loader master's already-curated content.
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

    /**
     * The from-catalog endpoint — service-level twin of the AI/workshop auto-add. Idempotent.
     *
     * <p>This is the ONLY caller that hands {@link PantryCatalogService#ensureItem} an ARBITRARY,
     * client-supplied {@code catalogId} the caller merely guessed or was handed — every other path
     * to {@code ensureItem} resolves the id itself via {@code findOrCreate}'s natural-key lookup.
     * So the {@code draft}-visibility gate (mezo-qooi) lives here, not in {@code ensureItem}: a
     * {@code draft} row is unreviewed and lives only on its own author's shelf. A non-author must
     * be refused with the SAME {@code RESOURCE_NOT_FOUND} as an unknown {@code catalogId}, never a
     * more specific error that would confirm the row's existence to a bystander.
     */
    @Transactional
    public PantryItemResponse addFromCatalog(UUID userId, UUID catalogId) {
        PantryCatalogEntity catalog = catalogRepository.findById(catalogId)
            .filter(c -> !c.isDeleted())
            .filter(c -> !PantryCatalogEntity.STATUS_DRAFT.equals(c.getStatus()) || userId.equals(c.getCreatedBy()))
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        return mapper.toItemResponse(catalogService.ensureItem(userId, catalog.getId()));
    }

    /**
     * State fields always (they are the caller's own shelf row); definition fields only when they
     * actually differ AND the caller may edit the shared row (author or OWNER) — else 403 and
     * NOTHING is written. The gate deliberately runs before {@code applyDefinitionPartial}: the
     * catalog entity is managed, so a half-applied refused edit would still be flushed on commit.
     * A rename onto another entry's natural key is a 409 rather than a unique-index 500.
     *
     * <p>Per-kind validation runs INSIDE the definition branch and against the MERGED definition
     * (see {@link #validateEffectivePerKind}): a PATCH that touches no definition field is a
     * state-only edit of the caller's own row and has no definition to validate. Validating the
     * bare request here forced every state-only PATCH to echo the whole definition back
     * ("food needs unit + kcal"), and that echo is exactly what turned a price edit into a 403 /
     * a silent shared-row overwrite (mezo-qw37.4 final review, I-1).
     */
    @Transactional
    public PantryItemResponse updateItem(AppUserEntity user, UUID id, PantryItemRequest req) {
        PantryItemEntity e = requireOwned(user.getId(), id);
        PantryCatalogEntity c = e.getCatalog();
        if (mapper.definitionDiffers(c, req)) {
            validateEffectivePerKind(req, e);
            catalogService.requireEditable(user, c);
            String newName = req.getName() == null ? c.getName() : req.getName().strip();
            String newBrand = req.getBrand() == null ? c.getBrand() : req.getBrand().strip();
            catalogRepository.findByNaturalKey(newName, newBrand)
                .filter(other -> !other.getId().equals(c.getId()))
                .ifPresent(other -> {
                    throw new SystemRuntimeErrorException(
                        SystemMessage.error("PANTRY_CATALOG_NAME_TAKEN").build(), HttpStatus.CONFLICT);
                });
            requireBarcodeFree(c, req);
            boolean wasEstimate = SOURCE_AI_ESTIMATE.equals(c.getSource());
            List<Object> factsBefore = facts(c);
            mapper.applyDefinitionPartial(c, req); // dirty-checked, flushed on commit
            // The facts of an AI estimate were just replaced by a human (mezo-r36n9.63): typed in, or
            // read off a barcode / a label by one of the readers. The reader names its own source; a
            // request that names none — or merely echoes the old value back — is the owner typing, so
            // the row stops claiming to be an estimate.
            if (wasEstimate && SOURCE_AI_ESTIMATE.equals(c.getSource())) {
                c.setSource("manual");
            }
            // A draft is an UNREVIEWED import candidate; the author actually editing its facts is
            // the confirmation gesture the manual-review badge asks for, so it promotes the row
            // (mezo-qooi). Deliberately author-only: passing requireEditable as a bystander OWNER
            // is not a review of somebody else's scraped data.
            if (PantryCatalogEntity.STATUS_DRAFT.equals(c.getStatus())
                && user.getId().equals(c.getCreatedBy())) {
                c.setStatus(PantryCatalogEntity.STATUS_VERIFIED);
            }
            if (!factsBefore.equals(facts(c))) {
                // The editor's own recipes froze these numbers per line; they follow after commit.
                events.publishEvent(new PantryFactsChangedEvent(c.getId(), user.getId()));
            }
        }
        mapper.applyUserFieldsPartial(e, req);
        return mapper.toItemResponse(e);
    }

    /** The numbers a recipe line snapshots, scale-normalised so 100 and 100.0 compare equal. */
    private static List<Object> facts(PantryCatalogEntity c) {
        return java.util.Arrays.asList(
            norm(c.getServingAmount()), c.getServingUnit(), norm(c.getKcal()), norm(c.getProteinG()),
            norm(c.getCarbsG()), norm(c.getFatG()), norm(c.getFiberG()), norm(c.getSugarG()),
            norm(c.getSaltG()), norm(c.getSaturatedFatG()));
    }

    private static java.math.BigDecimal norm(java.math.BigDecimal v) {
        return v == null ? null : v.stripTrailingZeros();
    }

    /**
     * A product barcode is unique per author among live definitions
     * ({@code uq_pantry_catalog_owner_barcode}); taking one that another of the author's foods carries
     * is a 409 rather than a unique-index 500.
     */
    private void requireBarcodeFree(PantryCatalogEntity c, PantryItemRequest req) {
        String barcode = req.getBarcode() == null || req.getBarcode().isBlank() ? null : req.getBarcode().strip();
        if (barcode == null || barcode.equals(c.getBarcode()) || c.getCreatedBy() == null) {
            return;
        }
        catalogRepository.findByCreatedByAndBarcodeAndDeletedFalse(c.getCreatedBy(), barcode)
            .filter(other -> !other.getId().equals(c.getId()))
            .ifPresent(other -> {
                throw new SystemRuntimeErrorException(
                    SystemMessage.error("PANTRY_CATALOG_BARCODE_TAKEN").build(), HttpStatus.CONFLICT);
            });
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

    /**
     * Update-side twin of {@link #validatePerKind}: the same rules, applied to the definition that
     * WOULD result from the PATCH merge (request field, else the stored one) rather than to the
     * bare request. A PATCH may legitimately omit a field the stored row already carries — demanding
     * it back is what made the FE echo the whole definition on every edit. Nothing is weakened: a
     * real definition edit still cannot leave a food without unit/kcal or a supplement without any
     * quantity basis, because the merged value is what gets persisted.
     */
    private void validateEffectivePerKind(PantryItemRequest req, PantryItemEntity item) {
        PantryCatalogEntity c = item.getCatalog();
        String kind = req.getKind() == null ? c.getKind() : req.getKind().getValue();
        if ("food".equals(kind)) {
            requireField(req.getUnit() == null ? c.getServingUnit() : req.getUnit(), "unit");
            requireField(req.getKcal() == null ? c.getKcal() : req.getKcal(), "kcal");
        } else { // supplement | stim | med — see validatePerKind for why it is dose OR per
            String dose = req.getDose() == null ? item.getDose() : req.getDose();
            boolean hasDose = dose != null && !dose.isBlank();
            if (!hasDose && (req.getPer() == null ? c.getServingAmount() : req.getPer()) == null) {
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
