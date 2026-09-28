package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.api.dto.PlannedSkipResponse;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.SportSlotSkipEntity;
import io.mrkuhne.mezo.feature.train.repository.PlannedSkipRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy.Row;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy.Source;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy.Verdict;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Central read/write for planned skips (Kihagyás S1, mezo-q4xt2.1, spec 2026-09-28 §8) — the ONE
 * place that unions {@code planned_skip} (USER) with {@code sport_slot_skip} (ADVICE) and hands
 * the union to {@link PlannedSkipPolicy} for the read-time verdict. Every other train read that
 * needs to know "is this skipped / excused" goes through {@link #excusedDates}, {@link
 * #skippedDates}, {@link #isGymSkipped} or {@link #bridgedWeeks} rather than re-deriving the
 * union itself.
 */
@Service
@RequiredArgsConstructor
public class PlannedSkipService {

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");

    private final PlannedSkipRepository repository;
    private final SportSlotSkipService sportSlotSkipService;
    private final PlannedSkipLock lock;

    @Transactional
    public PlannedSkipResponse upsert(UUID user, PlannedSkipRequest req) {
        LocalDate today = LocalDate.now(TZ);
        LocalDate date = req.getDate();
        LocalDate sunday = today.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        if (date.isBefore(today.minusDays(7)) || date.isAfter(sunday)) {
            throw bad("TRAIN_SKIP_DATE_OUT_OF_WINDOW");
        }
        Kind kind = Kind.valueOf(req.getKind().getValue());
        validateTarget(kind, date, req);
        lock.lock(user);
        PlannedSkipEntity row = repository.findByCreatedByAndDateBetweenAndDeletedFalse(user, date, date).stream()
            .filter(e -> e.getKind() == kind
                && Objects.equals(e.getDayOfWeek(), req.getDayOfWeek())
                && Objects.equals(e.getTime(), req.getTime())
                && Objects.equals(e.getSessionKey(), req.getSessionKey()))
            .findFirst()
            .orElseGet(() -> {
                PlannedSkipEntity e = new PlannedSkipEntity();
                e.setCreatedBy(user);
                e.setDate(date);
                e.setKind(kind);
                e.setDayOfWeek(req.getDayOfWeek());
                e.setTime(req.getTime());
                e.setSessionKey(req.getSessionKey());
                return e;
            });
        Reason reason = Reason.valueOf(req.getReasonCategory().getValue());
        row.setReasonCategory(reason);
        String text = req.getReasonText() == null ? null : req.getReasonText().trim();
        row.setReasonText(reason == Reason.OTHER && text != null && !text.isEmpty() ? text : null);
        row.setUpdatedAt(Instant.now());
        PlannedSkipEntity saved = repository.saveAndFlush(row);
        return verdictsBetween(user, date, date).stream()
            .filter(v -> v.row().id().equals(saved.getId()))
            .findFirst()
            .map(PlannedSkipService::toResponse)
            .orElseThrow();
    }

    @Transactional
    public void undo(UUID user, UUID id) {
        lock.lock(user);
        boolean removed = repository.findByIdAndCreatedByAndDeletedFalse(id, user)
            .map(e -> {
                repository.delete(e);
                repository.flush();
                return true;
            })
            .orElse(false);
        if (!removed && !sportSlotSkipService.deleteOwned(user, id)) {
            throw new SystemRuntimeErrorException(SystemMessage.error("TRAIN_SKIP_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
    }

    @Transactional(readOnly = true)
    public List<PlannedSkipResponse> list(UUID user, LocalDate from, LocalDate to) {
        return verdictsBetween(user, from, to).stream().map(PlannedSkipService::toResponse).toList();
    }

    /** Every skip in [from, to] with its read-time verdict — union of both tables, judged over
     *  the whole ISO weeks spanning [from, to] (free-pass correctness needs a whole week), then
     *  filtered back down to [from, to] and sorted date then createdAt. */
    @Transactional(readOnly = true)
    public List<Verdict> verdictsBetween(UUID user, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new SystemRuntimeErrorException(SystemMessage.error("TRAIN_INVALID_DATE_RANGE").build());
        }
        LocalDate weekFrom = from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekTo = to.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));

        List<Row> rows = new ArrayList<>();
        for (PlannedSkipEntity e : repository.findByCreatedByAndDateBetweenAndDeletedFalse(user, weekFrom, weekTo)) {
            rows.add(new Row(e.getId(), e.getDate(), e.getKind(), e.getDayOfWeek(), e.getTime(), e.getSessionKey(),
                e.getReasonCategory(), e.getReasonText(), Source.USER, e.getCreatedAt()));
        }
        for (SportSlotSkipEntity e : sportSlotSkipService.rowsBetween(user, weekFrom, weekTo)) {
            rows.add(new Row(e.getId(), e.getDate(), Kind.SPORT, e.getDayOfWeek(), e.getTime(), null,
                Reason.NONE, null, Source.ADVICE, e.getCreatedAt()));
        }

        return PlannedSkipPolicy.judge(rows).stream()
            .filter(v -> !v.row().date().isBefore(from) && !v.row().date().isAfter(to))
            .sorted(Comparator.comparing((Verdict v) -> v.row().date()).thenComparing(v -> v.row().createdAt()))
            .toList();
    }

    /** Dates in [from, to] where a skip of this kind was excused (does not count as missed). */
    @Transactional(readOnly = true)
    public Set<LocalDate> excusedDates(UUID user, Kind kind, LocalDate from, LocalDate to) {
        Set<LocalDate> dates = new HashSet<>();
        for (Verdict v : verdictsBetween(user, from, to)) {
            if (v.row().kind() == kind && v.excused()) {
                dates.add(v.row().date());
            }
        }
        return dates;
    }

    /** Dates in [from, to] with ANY verdict (excused or not) for this kind. */
    @Transactional(readOnly = true)
    public Set<LocalDate> skippedDates(UUID user, Kind kind, LocalDate from, LocalDate to) {
        Set<LocalDate> dates = new HashSet<>();
        for (Verdict v : verdictsBetween(user, from, to)) {
            if (v.row().kind() == kind) {
                dates.add(v.row().date());
            }
        }
        return dates;
    }

    @Transactional(readOnly = true)
    public boolean isGymSkipped(UUID user, LocalDate date) {
        return !skippedDates(user, Kind.GYM, date, date).isEmpty();
    }

    /** ISO week keys (see {@link PlannedSkipPolicy#isoWeekKey}) that hold at least one excused
     *  skip — the "kímélő mód" bridge weeks (later slices). */
    @Transactional(readOnly = true)
    public Set<Long> bridgedWeeks(UUID user, LocalDate from, LocalDate to) {
        Set<Long> weeks = new HashSet<>();
        for (Verdict v : verdictsBetween(user, from, to)) {
            if (v.excused()) {
                weeks.add(PlannedSkipPolicy.isoWeekKey(v.row().date()));
            }
        }
        return weeks;
    }

    private void validateTarget(Kind kind, LocalDate date, PlannedSkipRequest req) {
        boolean valid = switch (kind) {
            case GYM -> req.getDayOfWeek() == null && req.getTime() == null && req.getSessionKey() == null;
            case SPORT -> req.getDayOfWeek() != null && req.getTime() != null && req.getSessionKey() == null
                && req.getDayOfWeek() == date.getDayOfWeek().getValue() - 1;
            case RUN -> req.getSessionKey() != null && !req.getSessionKey().isBlank()
                && req.getDayOfWeek() == null && req.getTime() == null;
        };
        if (!valid) {
            throw bad("TRAIN_SKIP_TARGET_INVALID");
        }
    }

    private static SystemRuntimeErrorException bad(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build());
    }

    private static PlannedSkipResponse toResponse(Verdict v) {
        Row r = v.row();
        return new PlannedSkipResponse()
            .id(r.id())
            .date(r.date())
            .kind(io.mrkuhne.mezo.api.dto.PlannedSkipKind.valueOf(r.kind().name()))
            .dayOfWeek(r.dayOfWeek())
            .time(r.time())
            .sessionKey(r.sessionKey())
            .reasonCategory(io.mrkuhne.mezo.api.dto.PlannedSkipReason.valueOf(r.reason().name()))
            .reasonText(r.reasonText())
            .source(PlannedSkipResponse.SourceEnum.valueOf(r.source().name()))
            .serious(v.serious())
            .freePass(v.freePass())
            .excused(v.excused());
    }
}
