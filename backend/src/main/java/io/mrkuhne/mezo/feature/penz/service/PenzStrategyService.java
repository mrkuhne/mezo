package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzStrategy;
import io.mrkuhne.mezo.api.dto.PenzStrategyInput;
import io.mrkuhne.mezo.feature.penz.entity.PenzProposalEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzProposalMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzProposalRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthlyAllowance;
import io.mrkuhne.mezo.feature.penz.service.engine.TxnInput;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.proposal.MonthlyInvestable;
import io.mrkuhne.mezo.feature.penz.service.proposal.MonthlyInvestable.Inputs;
import io.mrkuhne.mezo.feature.penz.service.proposal.MonthlyInvestable.Kind;
import io.mrkuhne.mezo.feature.penz.service.proposal.MonthlyInvestable.Suggestion;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalFigures;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The monthly strategy figure (Boop Pénz L7, mezo-r36n9.105, build notes call 14) — maps his rows into the pure
 * {@link MonthlyInvestable} port and back. Computed on every read; nothing stores it, no job re-proposes it.
 *
 * <ul>
 *   <li>Averages and tracked months: every live transaction up to the asked date (the old {@code planning.ts}
 *       rules: the last three complete months, tracking from the first non-recurring transaction).</li>
 *   <li>Savings target, free money, invested, fixed costs, remaining: the allowance engine's month
 *       ({@link PenzAllowanceService#monthly}) — the same figures Költés shows.</li>
 *   <li>Emergency fund done: the short sleeve (1–3 év) holds at least {@code emergency_fund_months × fixedCosts}
 *       (the same target the proposal split uses); no fixed costs → not done.</li>
 *   <li>Last month's excess: last month's {@code invested} above the amount of last month's accepted monthly
 *       proposal (the old {@code invest_suggested_log}); none accepted → 0.</li>
 *   <li>No manual monthly figure exists in Mezo (the old setting is not carried over).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class PenzStrategyService {

    private static final LocalDate EPOCH = LocalDate.of(2000, 1, 1);

    private final PenzAllowanceService allowance;
    private final PenzTransactionRepository transactions;
    private final PenzSettingsService settings;
    private final PenzPortfolioService portfolio;
    private final PenzProposalRepository proposals;
    private final PenzProposalMapper mapper;

    /** One input line of the figure (HUF minor). */
    public record Input(String key, String label, long hufMinor) {
    }

    /** The figure, its inputs and how it came about. */
    public record Figure(long availableMinor, List<Input> inputs, String note, Suggestion suggestion) {
    }

    /** {@code GET /api/penz/strategy}: the figure for the month of {@code date} (null = his today). */
    public PenzStrategy strategy(UUID owner, LocalDate date) {
        LocalDate d = date == null ? settings.today(owner) : date;
        Figure f = figure(owner, d);
        List<PenzStrategyInput> inputs = new ArrayList<>();
        f.inputs().forEach(i -> inputs.add(new PenzStrategyInput().key(i.key()).label(i.label()).hufMinor(
            i.hufMinor())));
        PenzStrategy out = new PenzStrategy().availableHufMinor(f.availableMinor()).inputs(inputs).note(f.note());
        proposals.findFirstByCreatedByAndKindAndMonthAndStatusInAndDeletedFalseOrderByCreatedAtDesc(owner,
                PenzProposalEntity.KIND_MONTHLY, YearMonth.from(d).toString(),
                List.of(PenzProposalEntity.STATUS_PROPOSED, PenzProposalEntity.STATUS_ACCEPTED))
            .ifPresent(p -> out.current(mapper.proposal(p)));
        return out;
    }

    /** The figure for the month of {@code date}. */
    public Figure figure(UUID owner, LocalDate date) {
        YearMonth month = YearMonth.from(date);
        MonthlyAllowance m = allowance.monthly(owner, month);
        List<TxnInput> txns = transactions.findByCreatedByAndDateBetweenAndDeletedFalseOrderByDateDescCreatedAtDesc(
            owner, EPOCH, date).stream().map(PenzEngineInputs::txn).toList();
        int trackedMonths = MonthlyInvestable.completeMonthTotals(txns, date).size();
        long avgIncome = MonthlyInvestable.averageMonthlyIncome(txns, date, m);
        long avgExpenses = MonthlyInvestable.averageMonthlyExpenses(txns, date, m);
        long free = MonthlyInvestable.freeBeforeInvest(m.freeMinor(), m.investedMinor());
        long target = emergencyTarget(owner, m);
        long saved = shortSleeveValue(owner, date);
        boolean emergencyDone = target > 0 && saved >= target;
        long prevExcess = prevExcess(owner, month);

        Suggestion s = MonthlyInvestable.suggest(new Inputs(trackedMonths, avgIncome, avgExpenses,
            m.savingsTargetMinor(), free, emergencyDone, null, prevExcess));
        long available = s.kind() == Kind.AMOUNT ? s.amountMinor() : 0;
        long pullForward = MonthlyInvestable.pullForwardRoom(emergencyDone, available, m.investedMinor(),
            m.remainingMinor(), MonthlyInvestable.dailySpend(txns, date), MonthlyInvestable.daysLeftInMonth(date));

        List<Input> inputs = List.of(
            new Input("avgIncome", "Átlagos havi bevétel", avgIncome),
            new Input("avgExpenses", "Átlagos havi kiadás", avgExpenses),
            new Input("savingsTarget", "Havi megtakarítási cél", m.savingsTargetMinor()),
            new Input("freeBeforeInvest", "Ebben a hónapban szabad (befektetés előtt)", free),
            new Input("emergencyTarget", "A tartalék célja", target),
            new Input("emergencySaved", "A tartalékod most (1–3 év)", saved),
            new Input("prevExcess", "Múlt havi többletvétel", prevExcess),
            new Input("pullForward", "Ebben a hónapban előre hozható", pullForward));
        return new Figure(available, inputs, note(s, prevExcess, pullForward), s);
    }

    /** {@code emergency_fund_months × fixedCosts} of the month; 0 without fixed costs. */
    long emergencyTarget(UUID owner, MonthlyAllowance m) {
        long fixed = m.fixedCostsMinor();
        int months = settings.ensure(owner).getEmergencyFundMonths();
        return fixed <= 0 || months <= 0 ? 0 : Math.multiplyExact((long) months, fixed);
    }

    /** What his short sleeve (1–3 év) is worth on {@code date}, from the cached quotes. */
    public long shortSleeveValue(UUID owner, LocalDate date) {
        return portfolio.positions(owner, date).stream()
            .filter(p -> Sleeve.SHORT.wire().equals(p.sleeve()))
            .mapToLong(PenzPortfolioService.PenzPositionView::valueHufMinor).sum();
    }

    private long prevExcess(UUID owner, YearMonth month) {
        YearMonth prev = month.minusMonths(1);
        return proposals.findFirstByCreatedByAndKindAndMonthAndStatusInAndDeletedFalseOrderByCreatedAtDesc(owner,
                PenzProposalEntity.KIND_MONTHLY, prev.toString(), List.of(PenzProposalEntity.STATUS_ACCEPTED))
            .map(p -> Math.max(0, allowance.monthly(owner, prev).investedMinor() - p.getAmountHufMinor()))
            .orElse(0L);
    }

    static String note(Suggestion s, long prevExcess, long pullForward) {
        return switch (s.kind()) {
            case NO_DATA -> "Még nincs egy teljes, rögzített hónapod, ezért a havi összeget még nem tudom kiszámolni.";
            case NOTHING_SPARE -> "Ebben a hónapban a kiadások és a megtakarítási cél után nem marad befektethető "
                + "pénz.";
            case AMOUNT -> {
                StringBuilder sb = new StringBuilder("Az átlagos havi maradékod és az e havi szabad pénzed közül a "
                    + "kisebbiknek a " + MonthlyInvestable.sharePct(s.emergencyDone()) + "%-a, ");
                sb.append(s.emergencyDone() ? "mert a tartalékod már megvan" : "mert a tartalékod még nincs meg");
                sb.append(" — lefelé kerekítve 1 000 Ft-ra.");
                if (prevExcess > 0) {
                    sb.append(" Múlt hónapban ").append(ProposalFigures.huf(prevExcess))
                        .append("-tal többet tettél félre, ezért most kisebb.");
                }
                if (pullForward > 0) {
                    sb.append(" Ha szeretnéd, a következő hónapból ").append(ProposalFigures.huf(pullForward))
                        .append(" előre hozható.");
                }
                yield sb.toString();
            }
        };
    }
}
