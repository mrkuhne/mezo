package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.pantry.config.PantryImportProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.mapper.PantryMapper;
import io.mrkuhne.mezo.feature.pantry.repository.PantryImportRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
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
    private final PantryImportRepository importRepository;
    private final PantrySuggestionService suggestionService;
    private final PantryImportProperties importProperties;
    private final PantryMapper mapper;

    /**
     * All owned items, projected by kind: food -> ingredients; supplement/stim/med -> stash.
     * Since P6 (mezo-bka) the response also carries the recent import feed + the deterministic
     * swap suggestions — both computed here regardless of the import switch (the toggle only
     * gates the OFF lookup/import endpoints; existing feed rows stay honest data).
     */
    public PantryResponse getPantry(UUID userId) {
        List<PantryItemEntity> items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId);
        return PantryResponse.builder()
            .ingredients(items.stream().filter(e -> "food".equals(e.getKind()))
                .map(mapper::toIngredientResponse).toList())
            .stash(items.stream().filter(e -> !"food".equals(e.getKind()))
                .map(mapper::toSupplementResponse).toList())
            .imports(importRepository
                .findByCreatedByAndDeletedFalseOrderByImportedAtDesc(userId, Limit.of(importProperties.feedSize()))
                .stream().map(mapper::toImportEntry).toList())
            .suggestions(suggestionService.suggest(items))
            .build();
    }

    @Transactional
    public PantryItemResponse createItem(UUID userId, PantryItemRequest req) {
        validatePerKind(req);
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        mapper.applyRequest(e, req);
        if (e.getSource() == null) e.setSource("manual");
        return mapper.toItemResponse(repository.save(e));
    }

    @Transactional
    public PantryItemResponse updateItem(UUID userId, UUID id, PantryItemRequest req) {
        validatePerKind(req);
        PantryItemEntity e = requireOwned(userId, id);
        mapper.applyRequestPartial(e, req); // partial merge: null = leave unchanged (no data-loss); dirty-checked, flush on tx commit
        return mapper.toItemResponse(e);
    }

    @Transactional
    public void deleteItem(UUID userId, UUID id) {
        repository.delete(requireOwned(userId, id)); // @SQLDelete soft-deletes
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
