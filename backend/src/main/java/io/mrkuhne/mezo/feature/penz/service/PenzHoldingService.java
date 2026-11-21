package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzHoldingRequest;
import io.mrkuhne.mezo.api.dto.PenzHoldingResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzPortfolioMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzHoldingEventRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzHoldingRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzInvestTxnRepository;
import io.mrkuhne.mezo.feature.penz.service.QuoteClient.QuoteResult;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/**
 * Holdings — one product in one sleeve (Boop Pénz L6, mezo-r36n9.104).
 *
 * <ul>
 *   <li>A phone write carrying a {@code clientRef} is idempotent (native {@code ON CONFLICT DO NOTHING} + read-back,
 *       the savings-goal pattern).</li>
 *   <li>A symbol is checked against the quote source once — on create, and on update when it changed: unknown →
 *       400 {@code PENZ_SYMBOL_UNKNOWN}; source unreachable → the holding is accepted, unpriced. The check is an
 *       HTTP call, so create / update run it BEFORE their write transaction (a {@link TransactionTemplate}).</li>
 *   <li>The currency cannot change once the holding has a transaction (400 {@code PENZ_CURRENCY_MISMATCH}): its
 *       amounts and lots are in that currency.</li>
 *   <li>Delete soft-deletes the holding with its transactions and events (their linked money rows released).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class PenzHoldingService {

    private final PenzHoldingRepository repository;
    private final PenzInvestTxnRepository txns;
    private final PenzInvestLinkService links;
    private final PenzHoldingEventRepository events;
    private final PenzQuoteService quotes;
    private final PenzPortfolioMapper mapper;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate tx;

    /** Archived included, by sleeve (short, mid, long) then position then creation. */
    public List<PenzHoldingResponse> list(UUID owner) {
        return repository.findByCreatedByAndDeletedFalseOrderByPositionAscCreatedAtAsc(owner).stream()
            .sorted(Comparator.comparing((PenzHoldingEntity h) -> Sleeve.of(h.getSleeve())))
            .map(mapper::toResponse).toList();
    }

    public PenzHoldingResponse create(UUID owner, PenzHoldingRequest req) {
        if (req.getClientRef() != null) {
            Optional<PenzHoldingEntity> replay = repository.findByCreatedByAndClientRefAndDeletedFalse(owner,
                req.getClientRef());
            if (replay.isPresent()) {
                return mapper.toResponse(replay.get());
            }
        }
        PenzHoldingEntity draft = new PenzHoldingEntity();
        apply(draft, req);
        checkSymbol(draft.getSymbol());
        return tx.execute(status -> {
            draft.setCreatedBy(owner);
            draft.setArchived(Boolean.TRUE.equals(req.getArchived()));
            draft.setPosition(req.getPosition() == null ? repository.nextPosition(owner) : req.getPosition());
            draft.setClientRef(req.getClientRef());
            if (draft.getClientRef() == null) {
                return mapper.toResponse(repository.saveAndFlush(draft));
            }
            repository.insertIfAbsent(owner, draft.getName(), draft.getAssetType(), draft.getSymbol(),
                draft.getPlatform(), draft.getPlatformName(), draft.getSleeve(), draft.getCurrency(),
                draft.getBondRatePct(), objectMapper.writeValueAsString(draft.getNewsTerms()), draft.getNote(),
                draft.getPosition(), draft.isArchived(), draft.getClientRef());
            return mapper.toResponse(repository.findByCreatedByAndClientRefAndDeletedFalse(owner,
                draft.getClientRef()).orElseThrow()); // just inserted, or the concurrent winner
        });
    }

    public PenzHoldingResponse update(UUID owner, UUID id, PenzHoldingRequest req) {
        PenzHoldingEntity before = require(owner, id);
        PenzHoldingEntity draft = new PenzHoldingEntity();
        apply(draft, req);
        if (draft.getSymbol() != null && !draft.getSymbol().equals(before.getSymbol())) {
            checkSymbol(draft.getSymbol());
        }
        return tx.execute(status -> {
            PenzHoldingEntity row = require(owner, id);
            if (!row.getCurrency().equals(draft.getCurrency())
                    && txns.existsByCreatedByAndHoldingIdAndDeletedFalse(owner, id)) {
                throw PenzErrors.badRequest("PENZ_CURRENCY_MISMATCH");
            }
            apply(row, req);
            if (req.getPosition() != null) {
                row.setPosition(req.getPosition());
            }
            if (req.getArchived() != null) {
                row.setArchived(req.getArchived());
            }
            row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            return mapper.toResponse(repository.saveAndFlush(row));
        });
    }

    /**
     * Soft-deletes the holding, its transactions and its events; the transactions' linked money rows are released
     * first, as deleting each transaction would (mezo-r36n9.119).
     */
    @Transactional
    public void delete(UUID owner, UUID id) {
        PenzHoldingEntity row = require(owner, id);
        repository.delete(row);
        repository.flush();
        txns.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(owner, id)
            .forEach(t -> links.release(owner, t));
        txns.softDeleteByHolding(owner, id);
        events.softDeleteByHolding(owner, id);
    }

    /** The owner's live holding (archived included), else 404 {@code PENZ_HOLDING_NOT_FOUND}. */
    public PenzHoldingEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_HOLDING_NOT_FOUND"));
    }

    private void checkSymbol(String symbol) {
        if (symbol != null && quotes.check(symbol) instanceof QuoteResult.Unknown) {
            throw PenzErrors.badRequest("PENZ_SYMBOL_UNKNOWN");
        }
    }

    private static void apply(PenzHoldingEntity row, PenzHoldingRequest req) {
        String name = req.getName().strip();
        if (name.isEmpty()) {
            throw PenzErrors.field("name");
        }
        row.setName(name);
        row.setAssetType(req.getAssetType());
        row.setSymbol(req.getSymbol() == null || req.getSymbol().isBlank() ? null
            : req.getSymbol().strip().toUpperCase(Locale.ROOT));
        row.setPlatform(req.getPlatform());
        row.setPlatformName(blankToNull(req.getPlatformName()));
        row.setSleeve(req.getSleeve());
        row.setCurrency(req.getCurrency());
        row.setBondRatePct(req.getBondRatePct() == null ? null
            : req.getBondRatePct().setScale(4, RoundingMode.HALF_UP));
        row.setNewsTerms(req.getNewsTerms() == null ? new ArrayList<>()
            : new ArrayList<>(req.getNewsTerms().stream().filter(t -> t != null && !t.isBlank())
                .map(String::strip).distinct().toList()));
        row.setNote(blankToNull(req.getNote()));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
