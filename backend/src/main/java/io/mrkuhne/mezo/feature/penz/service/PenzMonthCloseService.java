package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzMonthCloseResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzMonthCloseEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzAccountRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzMonthCloseRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import java.time.Instant;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
 * account into the savings-target account (409 {@code PENZ_NO_SAVINGS_TARGET_ACCOUNT} when either is missing).
 *
 * <p><b>Phase 3:</b> the remaining figure comes from the allowance engine, which lands in a later phase of L4;
 * until then {@link #remainingFor} answers 501 {@code PENZ_NOT_IMPLEMENTED} and {@link #close} with it. The
 * close mechanics themselves ({@link #closeWith}) are built and tested now.
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
        Set<String> closed = repository.findByCreatedByAndDeletedFalseOrderByMonthDesc(owner).stream()
            .map(PenzMonthCloseEntity::getMonth).collect(Collectors.toSet());
        List<PenzMonthCloseResponse> out = new ArrayList<>();
        for (YearMonth m = YearMonth.parse(withData.getFirst()); m.isBefore(current); m = m.plusMonths(1)) {
            if (!closed.contains(m.toString())) {
                out.add(mapper.openMonth(m.toString()));
            }
        }
        return out;
    }

    @Transactional
    public PenzMonthCloseResponse close(UUID owner, String month, String leftoverAction) {
        YearMonth m = requireClosable(owner, month);
        return closeWith(owner, m, leftoverAction, remainingFor(owner, m));
    }

    /**
     * PHASE 3 — the month's final remaining figure (HUF minor units) from the allowance engine. Not built yet:
     * the engine lands in a later phase of L4 and this method is where it plugs in.
     */
    long remainingFor(UUID owner, YearMonth month) {
        throw PenzErrors.notImplemented();
    }

    /** Stores the close of {@code month} with an already-computed remaining figure (see the class doc). */
    @Transactional
    PenzMonthCloseResponse closeWith(UUID owner, YearMonth month, String requestedAction, long remainingHufMinor) {
        requireClosable(owner, month.toString());
        long leftover = Math.max(0, remainingHufMinor);
        long deficit = Math.max(0, -remainingHufMinor);
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
        return m;
    }
}
