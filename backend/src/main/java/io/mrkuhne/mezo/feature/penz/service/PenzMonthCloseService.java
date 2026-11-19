package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzMonthCloseResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzMonthCloseEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzAccountRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzMonthCloseRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import io.mrkuhne.mezo.feature.penz.service.engine.CloseOutcome;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthCloseInput;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthCloseRules;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthlyAllowance;
import java.time.Instant;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The month close (Boop Pénz L4, mezo-r36n9.102; the old app's {@code monthClose.ts} + {@code closeRecord}).
 *
 * <p>Open months = every month from the owner's earliest transaction up to (not including) the current one that
 * has no close. Closing stores the final remaining figure (HUF minor units) and splits it into leftover and
 * deficit: a deficit, or nothing left, always closes as {@code none}; a leftover closes as {@code kept} or
 * {@code transferred} — the latter writes a HUF transfer pair dated the month's last day from the default
 * account into the savings-target account (409 {@code PENZ_NO_SAVINGS_TARGET_ACCOUNT} when either is missing,
 * 409 {@code PENZ_CURRENCY_MISMATCH} when either is not a HUF account).
 * Months close oldest first: an earlier open month is 409 {@code PENZ_EARLIER_MONTH_OPEN}.
 *
 * <p>The remaining figure is the allowance engine's {@code remaining} of the month ({@link #remainingFor}), with
 * the previous deficit taken only from a CLOSED previous month (old {@code summarizeClose}). Open months carry the
 * figures a close would store right now ({@code finalRemaining}, {@code deficit} per
 * {@link MonthCloseRules#closeOutcome}); the close persists them, so the next month's {@code previousDeficit}
 * line reads the stored {@code deficit_minor}.
 */
@Service
@RequiredArgsConstructor
public class PenzMonthCloseService {

    static final String ACTION_TRANSFERRED = PenzMonthCloseEntity.LEFTOVER_TRANSFERRED;
    static final String ACTION_KEPT = "kept";
    static final String ACTION_NONE = "none";

    private final PenzMonthCloseRepository repository;
    private final PenzTransactionRepository transactions;
    private final PenzAccountRepository accounts;
    private final PenzTransactionService transactionService;
    private final PenzSettingsService settings;
    private final PenzAllowanceService allowance;
    private final PenzMapper mapper;

    @Transactional(readOnly = true)
    public List<PenzMonthCloseResponse> listClosed(UUID owner) {
        return repository.findByCreatedByAndDeletedFalseOrderByMonthDesc(owner).stream()
            .map(mapper::toResponse).toList();
    }

    /** Past months with no close, oldest first, from the earliest transaction month (the old monthsToClose). */
    @Transactional
    public List<PenzMonthCloseResponse> listOpen(UUID owner) {
        YearMonth current = YearMonth.from(settings.today(owner));
        List<String> withData = transactions.findMonthsWithTransactionsBefore(owner, current.atDay(1));
        if (withData.isEmpty()) {
            return List.of();
        }
        List<MonthCloseInput> closed = repository.findByCreatedByAndDeletedFalseOrderByMonthDesc(owner).stream()
            .map(c -> new MonthCloseInput(YearMonth.parse(c.getMonth()), c.getDeficitMinor())).toList();
        List<YearMonth> open = MonthCloseRules.monthsToClose(current.atDay(1), YearMonth.parse(withData.getFirst()),
            closed);
        List<MonthlyAllowance> figures = allowance.monthlies(owner, open);
        List<PenzMonthCloseResponse> out = new ArrayList<>();
        for (MonthlyAllowance a : figures) {
            out.add(mapper.openMonth(a.month(), MonthCloseRules.closeOutcome(a), a.remainingMinor()));
        }
        return out;
    }

    @Transactional
    public PenzMonthCloseResponse close(UUID owner, String month, String leftoverAction) {
        YearMonth m = requireClosable(owner, month);
        return closeWith(owner, m, leftoverAction, remainingFor(owner, m));
    }

    /** The month's final remaining figure (HUF minor units): the allowance engine's {@code remaining}. */
    long remainingFor(UUID owner, YearMonth month) {
        return allowance.monthly(owner, month).remainingMinor();
    }

    /** Stores the close of {@code month} with an already-computed remaining figure (see the class doc). */
    @Transactional
    PenzMonthCloseResponse closeWith(UUID owner, YearMonth month, String requestedAction, long remainingHufMinor) {
        requireClosable(owner, month.toString());
        CloseOutcome outcome = MonthCloseRules.closeOutcome(remainingHufMinor);
        long leftover = outcome.leftoverMinor();
        long deficit = outcome.deficitMinor();
        String action = deficit > 0 || leftover == 0 ? ACTION_NONE
            : ACTION_TRANSFERRED.equals(requestedAction) ? ACTION_TRANSFERRED : ACTION_KEPT;
        UUID pairId = null;
        if (ACTION_TRANSFERRED.equals(action)) {
            PenzAccountEntity target = accounts
                .findFirstByCreatedByAndSavingsTargetTrueAndArchivedFalseAndDeletedFalse(owner)
                .orElseThrow(() -> PenzErrors.conflict("PENZ_NO_SAVINGS_TARGET_ACCOUNT"));
            PenzAccountEntity source = accounts.findByCreatedByAndArchivedFalseAndDeletedFalseOrderByNameAsc(owner)
                .stream().filter(PenzAccountEntity::isDefaultAccount).findFirst()
                .filter(a -> !a.getId().equals(target.getId()))
                .orElseThrow(() -> PenzErrors.conflict("PENZ_NO_SAVINGS_TARGET_ACCOUNT"));
            if (!PenzFxService.HUF.equals(source.getCurrency()) || !PenzFxService.HUF.equals(target.getCurrency())) {
                throw PenzErrors.conflict("PENZ_CURRENCY_MISMATCH"); // the leftover is forints: HUF accounts only
            }
            pairId = transactionService.writeTransfer(owner, source.getId(), target.getId(), leftover,
                PenzFxService.HUF, new Booking(leftover, null, null), month.atEndOfMonth(),
                "Hónapzárás " + month, null);
        }
        PenzMonthCloseEntity row = new PenzMonthCloseEntity();
        row.setCreatedBy(owner);
        row.setMonth(month.toString());
        row.setFinalRemainingMinor(remainingHufMinor);
        row.setDeficitMinor(deficit);
        row.setLeftoverAction(action);
        row.setTransferPairId(pairId);
        row.setClosedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    private YearMonth requireClosable(UUID owner, String month) {
        YearMonth m = PenzMonths.requireMonth(month);
        if (!m.isBefore(YearMonth.from(settings.today(owner)))) {
            throw PenzErrors.badRequest("PENZ_MONTH_NOT_OVER");
        }
        if (repository.findByCreatedByAndMonthAndDeletedFalse(owner, m.toString()).isPresent()) {
            throw PenzErrors.conflict("PENZ_MONTH_ALREADY_CLOSED");
        }
        if (!earlierOpen(owner, m).isEmpty()) {
            throw PenzErrors.conflict("PENZ_EARLIER_MONTH_OPEN");
        }
        return m;
    }

    /**
     * Months before {@code month} (from the earliest transaction month) that have no close. Months close oldest
     * first: a month's previousDeficit line reads the previous month's STORED close, so closing a month while an
     * earlier one is open would freeze it without the earlier deficit.
     */
    private List<YearMonth> earlierOpen(UUID owner, YearMonth month) {
        List<String> withData = transactions.findMonthsWithTransactionsBefore(owner, month.atDay(1));
        if (withData.isEmpty()) {
            return List.of();
        }
        List<MonthCloseInput> closed = repository.findByCreatedByAndDeletedFalseOrderByMonthDesc(owner).stream()
            .map(c -> new MonthCloseInput(YearMonth.parse(c.getMonth()), c.getDeficitMinor())).toList();
        return MonthCloseRules.monthsToClose(month.atDay(1), YearMonth.parse(withData.getFirst()), closed);
    }
}
