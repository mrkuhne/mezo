package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzHoldingEventRequest;
import io.mrkuhne.mezo.api.dto.PenzHoldingEventResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEventEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzQuoteEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzPortfolioMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzHoldingEventRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzHoldingRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The forward timeline (Boop Pénz L6 build notes call 6): owner-entered maturities, coupons, dividends, earnings.
 * An expected amount is in the holding's currency; its {@code amountHufMinor} is valued at the latest cached FX
 * quote ({@code CURHUF=X}, the valuation policy — not booked, not stored); null without a cached rate.
 * Idempotent on {@code clientRef}.
 */
@Service
@RequiredArgsConstructor
public class PenzHoldingEventService {

    private final PenzHoldingEventRepository repository;
    private final PenzHoldingRepository holdingRows;
    private final PenzHoldingService holdings;
    private final PenzQuoteService quotes;
    private final PenzSettingsService settings;
    private final PenzPortfolioMapper mapper;

    /** Events from {@code from} (null = the owner's today), soonest first. */
    public List<PenzHoldingEventResponse> list(UUID owner, LocalDate from) {
        LocalDate start = from == null ? settings.today(owner) : from;
        return respond(owner,
            repository.findByCreatedByAndDateGreaterThanEqualAndDeletedFalseOrderByDateAscCreatedAtAsc(owner, start));
    }

    /** Events dated {@code from}…{@code to} inclusive, soonest first (the portfolio's 12-month window). */
    public List<PenzHoldingEventResponse> between(UUID owner, LocalDate from, LocalDate to) {
        return respond(owner,
            repository.findByCreatedByAndDateBetweenAndDeletedFalseOrderByDateAscCreatedAtAsc(owner, from, to));
    }

    @Transactional
    public PenzHoldingEventResponse create(UUID owner, PenzHoldingEventRequest req) {
        if (req.getClientRef() != null) {
            Optional<PenzHoldingEventEntity> replay = repository.findByCreatedByAndClientRefAndDeletedFalse(owner,
                req.getClientRef());
            if (replay.isPresent()) {
                return respond(owner, List.of(replay.get())).getFirst();
            }
        }
        PenzHoldingEntity holding = holdings.require(owner, req.getHoldingId());
        PenzHoldingEventEntity row = new PenzHoldingEventEntity();
        row.setCreatedBy(owner);
        row.setHoldingId(holding.getId());
        row.setKind(req.getKind());
        row.setDate(req.getDate());
        row.setAmountMinor(req.getAmountMinor());
        row.setCurrency(req.getAmountMinor() == null ? null : holding.getCurrency());
        row.setNote(req.getNote() == null || req.getNote().isBlank() ? null : req.getNote().strip());
        row.setClientRef(req.getClientRef());
        if (row.getClientRef() == null) {
            return respond(owner, List.of(repository.saveAndFlush(row))).getFirst();
        }
        repository.insertIfAbsent(owner, row.getHoldingId(), row.getKind(), row.getDate(), row.getAmountMinor(),
            row.getCurrency(), row.getNote(), row.getClientRef());
        return respond(owner, List.of(repository.findByCreatedByAndClientRefAndDeletedFalse(owner,
            row.getClientRef()).orElseThrow())).getFirst(); // just inserted, or the concurrent winner
    }

    /** Soft delete. */
    @Transactional
    public void delete(UUID owner, UUID id) {
        PenzHoldingEventEntity row = repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_HOLDING_EVENT_NOT_FOUND"));
        repository.delete(row);
        repository.flush();
    }

    private List<PenzHoldingEventResponse> respond(UUID owner, List<PenzHoldingEventEntity> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, PenzHoldingEntity> byId = holdingRows.findByCreatedByAndDeletedFalseOrderByPositionAscCreatedAtAsc(
            owner).stream().collect(Collectors.toMap(PenzHoldingEntity::getId, Function.identity()));
        Set<String> pairs = rows.stream().filter(e -> e.getCurrency() != null && !"HUF".equals(e.getCurrency()))
            .map(e -> PenzQuoteService.fxSymbol(e.getCurrency())).collect(Collectors.toSet());
        Map<String, PenzQuoteEntity> rates = quotes.cached(pairs);
        return rows.stream().filter(e -> byId.containsKey(e.getHoldingId()))
            .map(e -> mapper.event(e, byId.get(e.getHoldingId()), hufValue(e, rates))).toList();
    }

    /** The expected amount at the latest cached rate, HALF_UP; null without an amount or a rate. */
    private static Long hufValue(PenzHoldingEventEntity e, Map<String, PenzQuoteEntity> rates) {
        if (e.getAmountMinor() == null) {
            return null;
        }
        if ("HUF".equals(e.getCurrency())) {
            return e.getAmountMinor();
        }
        PenzQuoteEntity rate = rates.get(PenzQuoteService.fxSymbol(e.getCurrency()));
        return rate == null ? null : BigDecimal.valueOf(e.getAmountMinor()).multiply(rate.getPrice())
            .setScale(0, RoundingMode.HALF_UP).longValueExact();
    }
}
