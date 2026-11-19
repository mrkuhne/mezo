package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzRecurringRuleRequest;
import io.mrkuhne.mezo.api.dto.PenzRecurringRuleResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzRecurringRuleEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzRecurringRuleRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Recurring income and fixed costs (Boop Pénz L4, mezo-r36n9.102; the old app's RecurringRule). The HUF twin
 * is booked through the one FX policy at {@code min(startDate, today)} and stored; it is re-booked only when the
 * amount, currency or start date changes. Materializing rules into transactions is not part of this slice.
 */
@Service
@RequiredArgsConstructor
public class PenzRecurringRuleService {

    private final PenzRecurringRuleRepository repository;
    private final PenzAccountService accounts;
    private final PenzCategoryService categories;
    private final PenzSettingsService settings;
    private final PenzFxService fx;
    private final PenzMapper mapper;

    @Transactional(readOnly = true)
    public List<PenzRecurringRuleResponse> list(UUID owner) {
        return repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public PenzRecurringRuleResponse create(UUID owner, PenzRecurringRuleRequest req) {
        PenzRecurringRuleEntity row = new PenzRecurringRuleEntity();
        row.setCreatedBy(owner);
        apply(owner, row, req, true);
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzRecurringRuleResponse update(UUID owner, UUID id, PenzRecurringRuleRequest req) {
        PenzRecurringRuleEntity row = require(owner, id);
        boolean rebook = row.getAmountMinor() != req.getAmountMinor() || !row.getCurrency().equals(req.getCurrency())
            || !row.getStartDate().equals(req.getStartDate());
        apply(owner, row, req, rebook);
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    @Transactional
    public void delete(UUID owner, UUID id) {
        repository.delete(require(owner, id));
        repository.flush();
    }

    /** The owner's live rule, else 404 {@code PENZ_RECURRING_RULE_NOT_FOUND}. */
    @Transactional(readOnly = true)
    public PenzRecurringRuleEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_RECURRING_RULE_NOT_FOUND"));
    }

    private void apply(UUID owner, PenzRecurringRuleEntity row, PenzRecurringRuleRequest req, boolean rebook) {
        if (req.getEndDate() != null && req.getEndDate().isBefore(req.getStartDate())) {
            throw PenzErrors.field("endDate");
        }
        accounts.require(owner, req.getAccountId());
        if (req.getCategoryId() != null) {
            categories.require(owner, req.getCategoryId());
        }
        if (rebook) {
            LocalDate today = settings.today(owner);
            Booking booking = fx.book(req.getCurrency(), req.getAmountMinor(), req.getStartDate(), today);
            row.setAmountHufMinor(booking.hufMinor());
            row.setFxRate(booking.rate());
            row.setFxRateDate(booking.rateDate());
        }
        row.setName(req.getName().strip());
        row.setKind(req.getKind());
        row.setAmountMinor(req.getAmountMinor());
        row.setCurrency(req.getCurrency());
        row.setCategoryId(req.getCategoryId());
        row.setAccountId(req.getAccountId());
        row.setFrequency(req.getFrequency());
        row.setStartDate(req.getStartDate());
        row.setEndDate(req.getEndDate());
        row.setActive(req.getActive() == null || req.getActive());
    }
}
