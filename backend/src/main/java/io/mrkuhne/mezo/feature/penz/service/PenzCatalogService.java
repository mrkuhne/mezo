package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzProduct;
import io.mrkuhne.mezo.api.dto.PenzProductRequest;
import io.mrkuhne.mezo.feature.penz.entity.PenzProductEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzProposalMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzProductRepository;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.proposal.CatalogProduct;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The curated product list (Boop Pénz L7, mezo-r36n9.105, build notes call 10; spec §10.2.1).
 *
 * <ul>
 *   <li><b>Seeded once per owner and seed key</b> from {@link PenzCatalogSeed#SEEDS} on every read (native insert,
 *       ON CONFLICT do nothing — a deleted or declined seed never comes back; a seed added to the code later appears
 *       as a new suggestion).</li>
 *   <li>Every seed row is {@code suggested} / {@code research}; he approves or declines with one tap (both
 *       idempotent; an approved product may be declined later and the other way round).</li>
 *   <li>He may add one himself → {@code approved} / {@code owner}, {@code reviewedAt} = his today; an edit of the text
 *       or fees sets {@code reviewedAt} = his today and keeps the status.</li>
 *   <li>The model never adds a product: nothing but these endpoints writes this table.</li>
 * </ul>
 * List order: approved, suggested, declined; by name within each.
 */
@Service
@RequiredArgsConstructor
public class PenzCatalogService {

    private static final Map<String, Integer> STATUS_ORDER = Map.of(
        PenzProductEntity.STATUS_APPROVED, 0, PenzProductEntity.STATUS_SUGGESTED, 1,
        PenzProductEntity.STATUS_DECLINED, 2);

    private final PenzProductRepository repository;
    private final PenzSettingsService settings;
    private final PenzProposalMapper mapper;

    @Transactional
    public List<PenzProduct> list(UUID owner) {
        seed(owner, PenzCatalogSeed.SEEDS);
        return rows(owner).stream()
            .sorted(Comparator.comparing((PenzProductEntity p) -> STATUS_ORDER.getOrDefault(p.getStatus(), 9))
                .thenComparing(PenzProductEntity::getName))
            .map(mapper::product).toList();
    }

    @Transactional
    public PenzProduct create(UUID owner, PenzProductRequest req) {
        seed(owner, PenzCatalogSeed.SEEDS);
        PenzProductEntity row = new PenzProductEntity();
        row.setCreatedBy(owner);
        apply(row, req);
        row.setReviewedAt(settings.today(owner));
        row.setStatus(PenzProductEntity.STATUS_APPROVED);
        row.setSuggestedBy(PenzProductEntity.BY_OWNER);
        row.setApprovedAt(now());
        return mapper.product(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzProduct update(UUID owner, UUID id, PenzProductRequest req) {
        PenzProductEntity row = require(owner, id);
        apply(row, req);
        row.setReviewedAt(settings.today(owner));
        row.setUpdatedAt(now());
        return mapper.product(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzProduct approve(UUID owner, UUID id) {
        PenzProductEntity row = require(owner, id);
        if (!PenzProductEntity.STATUS_APPROVED.equals(row.getStatus())) {
            row.setStatus(PenzProductEntity.STATUS_APPROVED);
            row.setApprovedAt(now());
            row.setUpdatedAt(now());
        }
        return mapper.product(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzProduct decline(UUID owner, UUID id) {
        PenzProductEntity row = require(owner, id);
        if (!PenzProductEntity.STATUS_DECLINED.equals(row.getStatus())) {
            row.setStatus(PenzProductEntity.STATUS_DECLINED);
            row.setApprovedAt(null);
            row.setUpdatedAt(now());
        }
        return mapper.product(repository.saveAndFlush(row));
    }

    /** Every live product of his, any status, as the pure proposal code reads it (seeded first). */
    @Transactional
    public List<CatalogProduct> products(UUID owner) {
        seed(owner, PenzCatalogSeed.SEEDS);
        return rows(owner).stream().map(PenzCatalogService::toCatalog).toList();
    }

    /** His live product, else 404 {@code PENZ_PRODUCT_NOT_FOUND}. */
    @Transactional(readOnly = true)
    public PenzProductEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound(PenzErrors.PRODUCT_NOT_FOUND));
    }

    /** Inserts each seed this owner never had (see the class doc); returns how many were new. */
    @Transactional
    public int seed(UUID owner, List<PenzCatalogSeed.Seed> seeds) {
        int inserted = 0;
        for (PenzCatalogSeed.Seed s : seeds) {
            inserted += repository.insertSeed(owner, s.key(), s.name(), s.kind(), s.currency(),
                sleevesJson(s.sleeves()), s.whatItIs(), s.terPct(), s.entryFeePct(), s.feeNote(), s.distribution(),
                s.isin(), s.symbol(), s.sourceName(), s.sourceUrl(), s.reviewedAt());
        }
        return inserted;
    }

    public static CatalogProduct toCatalog(PenzProductEntity e) {
        return new CatalogProduct(e.getId(), e.getName(), e.getWhatItIs(), e.getKind(), e.getCurrency(),
            e.getSleeves(), e.getTerPct(), e.getEntryFeePct(), e.getFeeNote(), e.getDistribution(),
            e.getReviewedAt(), e.getStatus(), e.getIsin(), e.getSymbol());
    }

    private List<PenzProductEntity> rows(UUID owner) {
        return repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
    }

    private static void apply(PenzProductEntity row, PenzProductRequest req) {
        row.setName(req.getName().strip());
        row.setKind(req.getKind());
        row.setCurrency(req.getCurrency());
        row.setSleeves(new ArrayList<>(orderedSleeves(req.getSleeves())));
        row.setWhatItIs(req.getWhatItIs().strip());
        row.setTerPct(req.getTerPct());
        row.setEntryFeePct(req.getEntryFeePct());
        row.setDistribution(req.getDistribution());
        row.setIsin(blankToNull(req.getIsin()));
        row.setSymbol(blankToNull(req.getSymbol()));
        row.setSourceName(blankToNull(req.getSourceName()));
        row.setSourceUrl(blankToNull(req.getSourceUrl()));
        if (row.getName().isEmpty()) {
            throw PenzErrors.field("name");
        }
        if (row.getWhatItIs().isEmpty()) {
            throw PenzErrors.field("whatItIs");
        }
    }

    /** Deduplicated, in horizon order. */
    static List<String> orderedSleeves(List<String> sleeves) {
        return sleeves.stream().map(Sleeve::of).distinct().sorted().map(Sleeve::wire).toList();
    }

    private static String sleevesJson(List<String> sleeves) {
        return orderedSleeves(sleeves).stream().map(s -> "\"" + s + "\"").collect(Collectors.joining(",", "[", "]"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
