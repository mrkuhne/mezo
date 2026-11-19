package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzCategoryRequest;
import io.mrkuhne.mezo.api.dto.PenzCategoryResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzCategoryRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Categories (Boop Pénz L4, mezo-r36n9.102). The 15 Hungarian defaults (12 expense, 3 income) are seeded on
 * the owner's first access — once ever: a re-seed happens only when the owner never had a category row at all
 * (soft-deleted rows count), and a concurrent first access is a no-op per name (native ON CONFLICT).
 */
@Service
@RequiredArgsConstructor
public class PenzCategoryService {

    /** name, kind, icon — in display order. */
    static final List<String[]> DEFAULTS = List.of(
        new String[] {"Élelmiszer", "expense", "basket"},
        new String[] {"Étterem", "expense", "fork"},
        new String[] {"Közlekedés", "expense", "tram"},
        new String[] {"Lakhatás", "expense", "home"},
        new String[] {"Rezsi", "expense", "bolt"},
        new String[] {"Előfizetések", "expense", "repeat"},
        new String[] {"Egészség", "expense", "heart"},
        new String[] {"Vásárlás", "expense", "bag"},
        new String[] {"Szórakozás", "expense", "ticket"},
        new String[] {"Utazás", "expense", "plane"},
        new String[] {"Ajándék", "expense", "gift"},
        new String[] {"Egyéb", "expense", "dots"},
        new String[] {"Fizetés", "income", "wallet"},
        new String[] {"Bónusz", "income", "star"},
        new String[] {"Egyéb bevétel", "income", "plus"});

    private final PenzCategoryRepository repository;
    private final PenzMapper mapper;

    @Transactional
    public List<PenzCategoryResponse> list(UUID owner) {
        seedDefaultsOnce(owner);
        return repository.findByCreatedByAndDeletedFalseOrderByKindAscPositionAscNameAsc(owner).stream()
            .map(mapper::toResponse).toList();
    }

    @Transactional
    public PenzCategoryResponse create(UUID owner, PenzCategoryRequest req) {
        seedDefaultsOnce(owner);
        String name = req.getName().strip();
        requireNameFree(owner, req.getKind(), name, null);
        PenzCategoryEntity row = new PenzCategoryEntity();
        row.setCreatedBy(owner);
        row.setName(name);
        row.setKind(req.getKind());
        row.setIcon(blankToNull(req.getIcon()));
        row.setMonthlyBudgetMinor(req.getMonthlyBudgetHufMinor());
        row.setPosition(req.getPosition() == null ? DEFAULTS.size() : req.getPosition());
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzCategoryResponse update(UUID owner, UUID id, PenzCategoryRequest req) {
        PenzCategoryEntity row = require(owner, id);
        String name = req.getName().strip();
        requireNameFree(owner, req.getKind(), name, id);
        row.setName(name);
        row.setKind(req.getKind());
        row.setIcon(blankToNull(req.getIcon()));
        row.setMonthlyBudgetMinor(req.getMonthlyBudgetHufMinor());
        if (req.getPosition() != null) {
            row.setPosition(req.getPosition());
        }
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    /** The owner's live category, else 404 {@code PENZ_CATEGORY_NOT_FOUND}. */
    @Transactional(readOnly = true)
    public PenzCategoryEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_CATEGORY_NOT_FOUND"));
    }

    /** Seeds the 15 defaults when the owner never had a category; true when it seeded. */
    @Transactional
    public boolean seedDefaultsOnce(UUID owner) {
        if (repository.countEverOwned(owner) > 0) {
            return false;
        }
        for (int i = 0; i < DEFAULTS.size(); i++) {
            String[] d = DEFAULTS.get(i);
            repository.insertDefault(owner, d[0], d[1], d[2], i);
        }
        return true;
    }

    private void requireNameFree(UUID owner, String kind, String name, UUID self) {
        repository.findFirstByCreatedByAndKindAndNameIgnoreCaseAndDeletedFalse(owner, kind, name)
            .filter(existing -> !existing.getId().equals(self))
            .ifPresent(existing -> {
                throw PenzErrors.conflict("PENZ_CATEGORY_NAME_TAKEN");
            });
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
