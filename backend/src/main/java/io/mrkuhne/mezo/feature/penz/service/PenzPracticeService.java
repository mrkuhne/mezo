package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzPaperTrade;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeCloseRequest;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeLastCloseRequest;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeOpenRequest;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeRequest;
import io.mrkuhne.mezo.api.dto.PenzPracticeOverview;
import io.mrkuhne.mezo.feature.penz.entity.PenzPaperTradeEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzPracticeMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzPaperTradeRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import io.mrkuhne.mezo.feature.penz.service.money.FxConversion;
import io.mrkuhne.mezo.feature.penz.service.practice.PaperTradeMath;
import io.mrkuhne.mezo.feature.penz.service.practice.PaperTradeMath.Direction;
import io.mrkuhne.mezo.feature.penz.service.practice.PracticeCap;
import io.mrkuhne.mezo.feature.penz.service.practice.PracticeCopy;
import io.mrkuhne.mezo.feature.penz.service.practice.PracticeTag;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.ReviewTrade;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.Week;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gyakorlás — paper trading as learning (Boop Pénz L7, mezo-r36n9.105, build notes calls 2–9).
 *
 * <ul>
 *   <li>The plan is the row: created {@code planned}, {@code open}ed at a typed entry, {@code closed} with the journal
 *       line (≥ 1 of the eight tags, mistake flag, one line); a plan may be cancelled. Any other transition is 409
 *       {@code PENZ_PAPER_TRADE_STATE}, so "no plan, no trade" is structural.</li>
 *   <li>The stop must sit on the losing side of the (planned) entry: 400 {@code PENZ_PAPER_TRADE_INVALID_STOP}.</li>
 *   <li>HUF twins through THE L4 booking policy ({@link PenzFxService#book}) at the trade's own dates: cost and
 *       risk at the entry date, P/L at the exit date, the unrealized P/L at the typed last close's date; the plan
 *       figures at today's rate until opened. Stored once, never re-derived.</li>
 *   <li>The cap ({@link PracticeCap}) is the settings' {@code practice_monthly_minor} — the allowance's Gyakorlás line;
 *       opening above what is left is 422 {@code PENZ_PRACTICE_CAP_EXCEEDED}. Nothing reads another sleeve, the
 *       allowance or a holding.</li>
 *   <li>No market data: every price is typed by the owner. Every row is {@code paper = true}.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class PenzPracticeService {

    private static final int QUANTITY_SCALE = 8;
    private static final String NOT_FOUND = "PENZ_PAPER_TRADE_NOT_FOUND";
    private static final String STATE = "PENZ_PAPER_TRADE_STATE";

    private final PenzPaperTradeRepository repository;
    private final PenzFxService fx;
    private final PenzSettingsService settings;
    private final PenzPracticeMapper mapper;

    /** The Gyakorlás tab on {@code date} (null = the owner's today). */
    public PenzPracticeOverview overview(UUID owner, LocalDate date) {
        LocalDate asOf = date == null ? settings.today(owner) : date;
        List<PenzPaperTradeEntity> all = all(owner);
        List<PenzPaperTradeEntity> closed = all.stream().filter(PenzPracticeService::isClosed).toList();
        YearMonth month = YearMonth.from(asOf);
        List<ReviewTrade> reviewed = closed.stream().map(PenzPracticeService::review).toList();
        int tagged = (int) closed.stream().filter(t -> t.getTags() != null && !t.getTags().isEmpty()).count();

        Week week = WeeklyReview.review(reviewed, asOf);
        List<PenzPaperTradeEntity> weekTrades = closed.stream()
            .filter(t -> !t.getExitDate().isBefore(week.weekStart()) && !t.getExitDate().isAfter(week.weekEnd()))
            .sorted(Comparator.comparing(PenzPaperTradeEntity::getExitDate)
                .thenComparing(PenzPaperTradeEntity::getCreatedAt).reversed())
            .toList();

        return new PenzPracticeOverview()
            .paper(true)
            .month(month.toString())
            .cap(mapper.cap(cap(owner, all, month, null)))
            .monthPnlHufMinor(monthPnl(closed, month))
            .avgR(WeeklyReview.avgR(reviewed))
            .closedCount(closed.size())
            .taggedCount(tagged)
            .noiseLine(PracticeCopy.noiseLine(tagged))
            .tags(mapper.tags())
            .week(mapper.week(week, PracticeCopy.week(week), weekTrades))
            .open(all.stream().filter(t -> PenzPaperTradeEntity.OPEN.equals(t.getStatus()))
                .sorted(Comparator.comparing(PenzPaperTradeEntity::getEntryDate)
                    .thenComparing(PenzPaperTradeEntity::getCreatedAt).reversed())
                .map(mapper::trade).toList())
            .planned(all.stream().filter(t -> PenzPaperTradeEntity.PLANNED.equals(t.getStatus()))
                .sorted(Comparator.comparing(PenzPaperTradeEntity::getCreatedAt).reversed())
                .map(mapper::trade).toList());
    }

    /** Σ P/L (HUF) of the paper trades closed in {@code month} — the Pénzem practice row. */
    public long monthPnlHufMinor(UUID owner, YearMonth month) {
        return monthPnl(all(owner).stream().filter(PenzPracticeService::isClosed).toList(), month);
    }

    /** The full journal, newest first, optionally within [from, to] by the trade's date (exit, entry, creation). */
    public List<PenzPaperTrade> list(UUID owner, LocalDate from, LocalDate to) {
        ZoneId zone = settings.zone(owner);
        return all(owner).stream()
            .filter(t -> from == null || !journalDate(t, zone).isBefore(from))
            .filter(t -> to == null || !journalDate(t, zone).isAfter(to))
            .sorted(Comparator.comparing((PenzPaperTradeEntity t) -> journalDate(t, zone))
                .thenComparing(PenzPaperTradeEntity::getCreatedAt).reversed())
            .map(mapper::trade).toList();
    }

    @Transactional
    public PenzPaperTrade create(UUID owner, PenzPaperTradeRequest req) {
        if (req.getClientRef() != null) {
            Optional<PenzPaperTradeEntity> replay = repository.findByCreatedByAndClientRefAndDeletedFalse(owner,
                req.getClientRef());
            if (replay.isPresent()) {
                return mapper.trade(replay.get());
            }
        }
        LocalDate today = settings.today(owner);
        PenzPaperTradeEntity row = new PenzPaperTradeEntity();
        row.setCreatedBy(owner);
        applyPlan(row, req, today);
        row.setClientRef(req.getClientRef());
        if (row.getClientRef() == null) {
            row = repository.saveAndFlush(row);
        } else {
            int inserted = repository.insertIfAbsent(owner, row.getInstrument(), row.getDirection(), row.getWhy(),
                row.getCurrency(), row.getQuantity(), row.getPlannedEntryMinor(), row.getStopMinor(),
                row.getTargetMinor(), row.getFxRate(), row.getFxRateDate(), row.getClientRef());
            row = repository.findByCreatedByAndClientRefAndDeletedFalse(owner, row.getClientRef()).orElseThrow();
            if (inserted == 0) {
                return mapper.trade(row); // a concurrent replay won — answer with its row
            }
        }
        if (req.getEntryMinor() != null) {
            openRow(owner, row, req.getEntryMinor(), req.getEntryDate() == null ? today : req.getEntryDate(), today);
        }
        return mapper.trade(row);
    }

    /** Edit a plan (planned only); with {@code entryMinor} it is opened too. */
    @Transactional
    public PenzPaperTrade update(UUID owner, UUID id, PenzPaperTradeRequest req) {
        PenzPaperTradeEntity row = require(owner, id);
        requireStatus(row, PenzPaperTradeEntity.PLANNED);
        LocalDate today = settings.today(owner);
        applyPlan(row, req, today);
        touch(row);
        row = repository.saveAndFlush(row);
        if (req.getEntryMinor() != null) {
            openRow(owner, row, req.getEntryMinor(), req.getEntryDate() == null ? today : req.getEntryDate(), today);
        }
        return mapper.trade(row);
    }

    @Transactional
    public PenzPaperTrade open(UUID owner, UUID id, PenzPaperTradeOpenRequest req) {
        PenzPaperTradeEntity row = require(owner, id);
        requireStatus(row, PenzPaperTradeEntity.PLANNED);
        openRow(owner, row, req.getEntryMinor(), req.getEntryDate(), settings.today(owner));
        return mapper.trade(row);
    }

    @Transactional
    public PenzPaperTrade close(UUID owner, UUID id, PenzPaperTradeCloseRequest req) {
        PenzPaperTradeEntity row = require(owner, id);
        requireStatus(row, PenzPaperTradeEntity.OPEN);
        List<String> tags = knownTags(req.getTags());
        LocalDate today = settings.today(owner);
        if (req.getExitDate().isBefore(row.getEntryDate()) || req.getExitDate().isAfter(today)) {
            throw PenzErrors.field("exitDate");
        }
        Direction d = Direction.of(row.getDirection());
        long pnlMinor = PaperTradeMath.pnlMinor(d, row.getEntryMinor(), req.getExitMinor(), row.getQuantity());
        Booking booking = fx.book(row.getCurrency(), pnlMinor, req.getExitDate(), today);
        row.setStatus(PenzPaperTradeEntity.CLOSED);
        row.setExitMinor(req.getExitMinor());
        row.setExitDate(req.getExitDate());
        row.setExitFxRate(booking.rate());
        row.setExitFxRateDate(booking.rateDate());
        row.setPnlMinor(pnlMinor);
        row.setPnlHufMinor(booking.hufMinor());
        row.setRMultiple(PaperTradeMath.rMultiple(d, row.getEntryMinor(), row.getStopMinor(), req.getExitMinor()));
        row.setTags(new ArrayList<>(tags));
        row.setMistake(Boolean.TRUE.equals(req.getMistake()));
        row.setLine(blankToNull(req.getLine()));
        touch(row);
        return mapper.trade(repository.saveAndFlush(row));
    }

    /** The last close he typed for an open trade — values it (no market data is fetched). */
    @Transactional
    public PenzPaperTrade lastClose(UUID owner, UUID id, PenzPaperTradeLastCloseRequest req) {
        PenzPaperTradeEntity row = require(owner, id);
        requireStatus(row, PenzPaperTradeEntity.OPEN);
        LocalDate today = settings.today(owner);
        if (req.getDate().isBefore(row.getEntryDate()) || req.getDate().isAfter(today)) {
            throw PenzErrors.field("date");
        }
        long unrealized = PaperTradeMath.pnlMinor(Direction.of(row.getDirection()), row.getEntryMinor(),
            req.getCloseMinor(), row.getQuantity());
        Booking booking = fx.book(row.getCurrency(), unrealized, req.getDate(), today);
        row.setLastCloseMinor(req.getCloseMinor());
        row.setLastCloseDate(req.getDate());
        row.setLastCloseFxRate(booking.rate());
        row.setLastCloseFxRateDate(booking.rateDate());
        row.setUnrealizedHufMinor(booking.hufMinor());
        touch(row);
        return mapper.trade(repository.saveAndFlush(row));
    }

    @Transactional
    public PenzPaperTrade cancel(UUID owner, UUID id) {
        PenzPaperTradeEntity row = require(owner, id);
        requireStatus(row, PenzPaperTradeEntity.PLANNED);
        row.setStatus(PenzPaperTradeEntity.CANCELLED);
        touch(row);
        return mapper.trade(repository.saveAndFlush(row));
    }

    @Transactional
    public void delete(UUID owner, UUID id) {
        repository.delete(require(owner, id));
        repository.flush();
    }

    // ---- internals ----

    /** The plan fields of a create / edit, validated; the plan figures valued at today's rate. */
    private void applyPlan(PenzPaperTradeEntity row, PenzPaperTradeRequest req, LocalDate today) {
        Direction d = Direction.of(req.getDirection());
        if (req.getPlannedEntryMinor() != null && !PaperTradeMath.validStop(d, req.getPlannedEntryMinor(),
            req.getStopMinor())) {
            throw PenzErrors.badRequest("PENZ_PAPER_TRADE_INVALID_STOP");
        }
        BigDecimal quantity = req.getQuantity().setScale(QUANTITY_SCALE, RoundingMode.HALF_UP);
        if (quantity.signum() <= 0) {
            throw PenzErrors.field("quantity");
        }
        Booking plan = fx.book(req.getCurrency(), req.getStopMinor(), today, today);
        row.setInstrument(req.getInstrument().strip());
        row.setDirection(d.wire());
        row.setWhy(req.getWhy().strip());
        row.setCurrency(req.getCurrency());
        row.setQuantity(quantity);
        row.setPlannedEntryMinor(req.getPlannedEntryMinor());
        row.setStopMinor(req.getStopMinor());
        row.setTargetMinor(req.getTargetMinor());
        row.setFxRate(plan.rate());
        row.setFxRateDate(plan.rateDate());
        if (row.getInstrument().isEmpty()) {
            throw PenzErrors.field("instrument");
        }
        if (row.getWhy().isEmpty()) {
            throw PenzErrors.field("why");
        }
    }

    /** planned → open: the stop check, the booking at the entry date, then the cap. */
    private void openRow(UUID owner, PenzPaperTradeEntity row, long entryMinor, LocalDate entryDate,
                         LocalDate today) {
        if (entryDate.isAfter(today)) {
            throw PenzErrors.field("entryDate");
        }
        Direction d = Direction.of(row.getDirection());
        if (!PaperTradeMath.validStop(d, entryMinor, row.getStopMinor())) {
            throw PenzErrors.badRequest("PENZ_PAPER_TRADE_INVALID_STOP");
        }
        long costMinor = PaperTradeMath.costMinor(entryMinor, row.getQuantity());
        long riskMinor = PaperTradeMath.riskMinor(entryMinor, row.getStopMinor(), row.getQuantity());
        Booking booking = fx.book(row.getCurrency(), costMinor, entryDate, today);
        PracticeCap cap = cap(owner, all(owner), YearMonth.from(entryDate), row.getId());
        if (!cap.allows(booking.hufMinor())) {
            throw PenzErrors.unprocessable("PENZ_PRACTICE_CAP_EXCEEDED");
        }
        row.setStatus(PenzPaperTradeEntity.OPEN);
        row.setEntryMinor(entryMinor);
        row.setEntryDate(entryDate);
        row.setCostHufMinor(booking.hufMinor());
        row.setRiskMinor(riskMinor);
        row.setRiskHufMinor(booking.rate() == null ? riskMinor : FxConversion.toHufMinor(riskMinor, booking.rate()));
        row.setFxRate(booking.rate());
        row.setFxRateDate(booking.rateDate());
        touch(row);
        repository.saveAndFlush(row);
    }

    /** The month's cap from the settings' practice amount; {@code except} = the row being opened. */
    private PracticeCap cap(UUID owner, List<PenzPaperTradeEntity> all, YearMonth month, UUID except) {
        List<Long> openCosts = all.stream()
            .filter(t -> PenzPaperTradeEntity.OPEN.equals(t.getStatus()) && !t.getId().equals(except))
            .map(PenzPaperTradeEntity::getCostHufMinor).toList();
        List<Long> closedPnl = all.stream().filter(PenzPracticeService::isClosed)
            .filter(t -> YearMonth.from(t.getExitDate()).equals(month))
            .map(PenzPaperTradeEntity::getPnlHufMinor).toList();
        return PracticeCap.of(settings.ensure(owner).getPracticeMonthlyMinor(), openCosts, closedPnl);
    }

    private static long monthPnl(List<PenzPaperTradeEntity> closed, YearMonth month) {
        return closed.stream().filter(t -> YearMonth.from(t.getExitDate()).equals(month))
            .mapToLong(PenzPaperTradeEntity::getPnlHufMinor).sum();
    }

    private static List<String> knownTags(List<String> keys) {
        Set<String> out = new LinkedHashSet<>();
        for (String key : keys == null ? List.<String>of() : keys) {
            out.add(PracticeTag.of(key).orElseThrow(() -> PenzErrors.badRequest("PENZ_PRACTICE_TAG_UNKNOWN")).key());
        }
        if (out.isEmpty()) {
            throw PenzErrors.badRequest("PENZ_PRACTICE_TAG_UNKNOWN");
        }
        return List.copyOf(out);
    }

    private static ReviewTrade review(PenzPaperTradeEntity t) {
        List<PracticeTag> tags = (t.getTags() == null ? List.<String>of() : t.getTags()).stream()
            .map(PracticeTag::of).flatMap(Optional::stream).toList();
        return new ReviewTrade(tags, t.isMistake(), t.getPnlHufMinor(), t.getRMultiple(), t.getExitDate(),
            PaperTradeMath.stopRespected(Direction.of(t.getDirection()), t.getStopMinor(), t.getExitMinor()));
    }

    private static boolean isClosed(PenzPaperTradeEntity t) {
        return PenzPaperTradeEntity.CLOSED.equals(t.getStatus());
    }

    private static LocalDate journalDate(PenzPaperTradeEntity t, ZoneId zone) {
        if (t.getExitDate() != null) {
            return t.getExitDate();
        }
        if (t.getEntryDate() != null) {
            return t.getEntryDate();
        }
        return t.getCreatedAt().atZone(zone).toLocalDate();
    }

    private List<PenzPaperTradeEntity> all(UUID owner) {
        return repository.findByCreatedByAndPaperTrueAndDeletedFalseOrderByCreatedAtAsc(owner);
    }

    private PenzPaperTradeEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound(NOT_FOUND));
    }

    private static void requireStatus(PenzPaperTradeEntity row, String status) {
        if (!status.equals(row.getStatus())) {
            throw PenzErrors.conflict(STATE);
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    private static void touch(PenzPaperTradeEntity row) {
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
    }
}
