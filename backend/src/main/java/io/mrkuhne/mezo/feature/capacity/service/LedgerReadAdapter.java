package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.boop.port.BoopDayAdjustmentPort;
import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.LightenSession;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveMealEnergy;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftBedtime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftSessionTime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShortenSession;
import io.mrkuhne.mezo.feature.meal.port.MealDayAdjustmentPort;
import io.mrkuhne.mezo.feature.season.port.SeasonAdjustmentPort;
import io.mrkuhne.mezo.feature.train.port.TrainDayAdjustmentPort;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * The readers' view of the day-adjustment ledger (Boop B7 K3, mezo-r36n9.17): one adapter for the consumer-owned
 * ports of train, meal, season and boop (ADR 0012 — the providing feature implements the consumer's port, so none of
 * them imports capacity).
 *
 * <p><b>Repository only, on purpose.</b> {@link DayAdjustmentService} depends on train's services (through
 * {@code CapacityTrainPort}); {@code WorkoutService} now depends on this adapter, so reaching for that service here
 * would close a circular bean graph. Every read is a plain query plus pure mapping.
 *
 * <p><b>Which rows count.</b> {@code active} rows, plus {@code done} moves (a move whose session was carried out on
 * its new day — the session still belongs to that day, or past weeks would count it missed). {@code undone},
 * {@code expired} and {@code waiting} rows are invisible to every reader; calendar to-dos never touch a reader.
 */
@Slf4j
@Component
public class LedgerReadAdapter
        implements TrainDayAdjustmentPort, MealDayAdjustmentPort, SeasonAdjustmentPort, BoopDayAdjustmentPort {

    /** A move stays inside one Mon–Sun week, so its two days are at most this far apart. */
    private static final int MOVE_REACH_DAYS = 6;
    private static final List<String> READ_STATES =
        List.of(AdjustmentState.ACTIVE.wire(), AdjustmentState.DONE.wire());

    private final DayAdjustmentRepository repository;

    public LedgerReadAdapter(DayAdjustmentRepository repository) {
        this.repository = repository;
    }

    // ── train ─────────────────────────────────────────────────────────────────

    @Override
    public Optional<EffectiveSession> effectiveSession(UUID owner, LocalDate date) {
        return Optional.ofNullable(effectiveSessions(owner, date, date).get(date));
    }

    @Override
    public Map<LocalDate, EffectiveSession> effectiveSessions(UUID owner, LocalDate from, LocalDate to) {
        Map<LocalDate, Builder> days = new HashMap<>();
        for (AdjustmentPayload p : payloads(owner, from.minusDays(MOVE_REACH_DAYS), to.plusDays(MOVE_REACH_DAYS))) {
            switch (p) {
                case MoveSessionDay m -> {
                    Builder target = days.computeIfAbsent(m.toDate(), d -> new Builder());
                    target.movedInTemplateId = m.templateSessionId();
                    target.movedInFrom = m.fromDate();
                    days.computeIfAbsent(m.fromDate(), d -> new Builder()).movedAwayTo = m.toDate();
                }
                case ShiftSessionTime s -> days.computeIfAbsent(s.date(), d -> new Builder()).time = s.time();
                case ShortenSession s -> days.computeIfAbsent(s.date(), d -> new Builder()).minutes = s.minutes();
                case LightenSession l -> days.computeIfAbsent(l.date(), d -> new Builder()).setsFactor = l.setsFactor();
                // SWAP_SESSION_KIND is deliberately unread: no reader shows a walk / mobility session instead of the gym,
                // and the proposal generator does not produce it.
                default -> { } // other kinds are not about the gym session's shape
            }
        }
        Map<LocalDate, EffectiveSession> out = new LinkedHashMap<>();
        days.forEach((date, b) -> {
            if (!date.isBefore(from) && !date.isAfter(to)) {
                out.put(date, new EffectiveSession(b.movedInTemplateId, b.movedInFrom, b.movedAwayTo, b.time,
                    b.minutes, b.setsFactor));
            }
        });
        return out;
    }

    private static final class Builder {
        private UUID movedInTemplateId;
        private LocalDate movedInFrom;
        private LocalDate movedAwayTo;
        private LocalTime time;
        private Integer minutes;
        private Double setsFactor;
    }

    // ── meal ──────────────────────────────────────────────────────────────────

    @Override
    public Map<String, Integer> slotSplit(UUID owner, LocalDate date) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (AdjustmentPayload p : payloads(owner, date, date)) {
            if (p instanceof MoveMealEnergy m) {
                m.slotKcal().forEach((slot, kcal) -> out.merge(slot, kcal, Integer::sum));
            }
        }
        out.values().removeIf(v -> v == 0);
        return out;
    }

    // ── season ────────────────────────────────────────────────────────────────

    @Override
    public List<Move> movedSessions(UUID owner, LocalDate from, LocalDate to) {
        List<Move> out = new ArrayList<>();
        for (AdjustmentPayload p : payloads(owner, from.minusDays(MOVE_REACH_DAYS), to)) {
            if (p instanceof MoveSessionDay m && (inside(m.fromDate(), from, to) || inside(m.toDate(), from, to))) {
                out.add(new Move(m.fromDate(), m.toDate()));
            }
        }
        return out;
    }

    // ── boop + meal (the day plan's bedtime gate) ─────────────────────────────

    @Override
    public Optional<LocalTime> bedtime(UUID owner, LocalDate night) {
        LocalTime bedtime = null;
        for (AdjustmentPayload p : payloads(owner, night, night)) {
            if (p instanceof ShiftBedtime b) {
                bedtime = b.bedtime(); // the latest accepted one wins
            }
        }
        return Optional.ofNullable(bedtime);
    }

    // ── shared ────────────────────────────────────────────────────────────────

    /** The typed rows in effect filed in {@code from..to}, oldest first; a malformed row is skipped, never fatal. */
    private List<AdjustmentPayload> payloads(UUID owner, LocalDate from, LocalDate to) {
        List<AdjustmentPayload> out = new ArrayList<>();
        for (DayAdjustmentEntity row : repository
                .findByCreatedByAndStateInAndDateBetweenAndDeletedFalseOrderByDateAscCreatedAtAsc(
                    owner, READ_STATES, from, to)) {
            try {
                out.add(AdjustmentPayload.parse(row.getKind(), row.getPayload()));
            } catch (SystemRuntimeErrorException e) {
                log.warn("Day adjustment {} ({}) is malformed and is ignored by the readers", row.getId(), row.getKind());
            }
        }
        return out;
    }

    private static boolean inside(LocalDate d, LocalDate from, LocalDate to) {
        return !d.isBefore(from) && !d.isAfter(to);
    }
}
