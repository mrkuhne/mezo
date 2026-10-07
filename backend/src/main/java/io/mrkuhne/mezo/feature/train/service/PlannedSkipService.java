package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PlannedSkipKind;
import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.api.dto.PlannedSkipResponse;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSlotSkipEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.PlannedSkipRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
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
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
    // Kihagyás S2 (mezo-q4xt2.2): protected kímélő-mód dates overlay the union as virtual RECOVERY
    // verdicts. RecoveryPeriodService depends only on its repositories — no cycle.
    private final RecoveryPeriodService recoveryPeriodService;
    // Planned-gym-weekday lookup for the virtual RECOVERY GYM rows (see plannedGymWeekdays).
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;

    @Transactional
    public PlannedSkipResponse upsert(UUID user, PlannedSkipRequest req) {
        LocalDate today = LocalDate.now(TZ);
        LocalDate date = req.getDate();
        LocalDate sunday = today.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        Kind kind = Kind.valueOf(req.getKind().getValue());
        // A meal slot can only be skipped once it has begun: the window ends today, not on Sunday.
        LocalDate last = kind == Kind.MEAL ? today : sunday;
        if (date.isBefore(today.minusDays(7)) || date.isAfter(last)) {
            throw bad("TRAIN_SKIP_DATE_OUT_OF_WINDOW");
        }
        validateTarget(kind, date, req);
        Reason reason = Reason.valueOf(req.getReasonCategory().getValue());
        validateReason(kind, reason);
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
        row.setReasonCategory(reason);
        row.setPlannedKcal(kind == Kind.MEAL ? req.getPlannedKcal() : null);
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
        var found = repository.findByIdAndCreatedByAndDeletedFalse(id, user);
        boolean removed = found
            .map(e -> {
                repository.delete(e);
                repository.flush();
                return true;
            })
            .orElse(false);
        if (removed) {
            // "Visszavonom" on a USER SPORT skip must really put the session back — also drop the
            // ADVICE sport_slot_skip twin for the same occurrence, if one exists (controller
            // ruling, Kihagyás S1, mezo-q4xt2.1).
            PlannedSkipEntity e = found.orElseThrow();
            if (e.getKind() == Kind.SPORT) {
                sportSlotSkipService.deleteMatchingAdviceTwin(user, e.getDayOfWeek(), e.getTime(), e.getDate());
            }
        } else if (!sportSlotSkipService.deleteOwned(user, id)) {
            throw new SystemRuntimeErrorException(SystemMessage.error("TRAIN_SKIP_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
    }

    /** The REST read. Virtual RECOVERY rows stay internal: the FE derives protection from
     *  {@code GET /recovery} and must never try to undo one through {@code DELETE /skips/{id}}. */
    @Transactional(readOnly = true)
    public List<PlannedSkipResponse> list(UUID user, LocalDate from, LocalDate to) {
        return verdictsBetween(user, from, to).stream()
            .filter(v -> v.row().source() != Source.RECOVERY)
            .map(PlannedSkipService::toResponse)
            .toList();
    }

    /** Every skip in [from, to] with its read-time verdict — union of both tables, judged over
     *  the whole ISO weeks spanning [from, to] (free-pass correctness needs a whole week), then
     *  filtered back down to [from, to] and sorted date then createdAt.
     *
     *  <p>Kihagyás S2 (mezo-q4xt2.2): every PLANNED GYM day a kímélő-mód period protects adds one
     *  virtual GYM row with {@link Source#RECOVERY} (excused, no pass, out of the race) — unless
     *  the date already has a USER GYM row, which carries the reason itself. A protected rest day
     *  gets no row, so it never bridges a week on its own (spec §9.2). SPORT and RUN protection is
     *  date-wide and rides {@link SportSlotSkipService.SportSkips} / {@link RunSkips}. */
    @Transactional(readOnly = true)
    public List<Verdict> verdictsBetween(UUID user, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new SystemRuntimeErrorException(SystemMessage.error("TRAIN_INVALID_DATE_RANGE").build());
        }
        LocalDate weekFrom = from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekTo = to.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));

        List<PlannedSkipEntity> userRows = repository.findByCreatedByAndDateBetweenAndDeletedFalse(user, weekFrom, weekTo);
        List<SportSlotSkipEntity> adviceRows = sportSlotSkipService.rowsBetween(user, weekFrom, weekTo);
        // A USER SPORT row with an ADVICE twin is the user's reason for the coach's skip — it stays
        // excused and out of the free-pass race (review I3); the USER row is the one returned
        // because it carries the reason.
        Set<SlotIdentity> adviceSlots = adviceRows.stream()
            .map(e -> new SlotIdentity(e.getDate(), e.getDayOfWeek(), e.getTime()))
            .collect(Collectors.toSet());
        Map<LocalDate, RecoveryPeriodEntity> protectedDays = recoveryPeriodService.protectedDays(user, weekFrom, weekTo);
        Set<Integer> plannedGymDows = protectedDays.isEmpty() ? Set.of() : plannedGymWeekdays(user);
        List<Row> rows = new ArrayList<>();
        for (PlannedSkipEntity e : userRows) {
            // A MEAL skip is neutral (Kihagyás S3): never backed by advice or recovery — the policy
            // already excuses it without a pass.
            boolean meal = e.getKind() == Kind.MEAL;
            boolean adviceBacked = e.getKind() == Kind.SPORT
                && adviceSlots.contains(new SlotIdentity(e.getDate(), e.getDayOfWeek(), e.getTime()));
            // A USER skip on a date the recovery period already protects (GYM: a protected planned
            // gym day; SPORT/RUN: any protected date) is excused by the protection — never a pass.
            boolean recoveryBacked = !meal && protectedDays.containsKey(e.getDate())
                && (e.getKind() != Kind.GYM || plannedGymDows.contains(e.getDate().getDayOfWeek().getValue() - 1));
            rows.add(new Row(e.getId(), e.getDate(), e.getKind(), e.getDayOfWeek(), e.getTime(), e.getSessionKey(),
                e.getReasonCategory(), e.getReasonText(), Source.USER, e.getCreatedAt(), adviceBacked, recoveryBacked,
                e.getPlannedKcal()));
        }

        // A USER SPORT skip is authoritative over an ADVICE twin on the same occurrence (same
        // date + dayOfWeek + time) — controller ruling, Kihagyás S1 (mezo-q4xt2.1). Drop the
        // ADVICE row before judging so only one row per occurrence ever reaches the policy.
        Set<SlotIdentity> userSportSlots = userRows.stream()
            .filter(e -> e.getKind() == Kind.SPORT)
            .map(e -> new SlotIdentity(e.getDate(), e.getDayOfWeek(), e.getTime()))
            .collect(Collectors.toSet());
        for (SportSlotSkipEntity e : adviceRows) {
            if (userSportSlots.contains(new SlotIdentity(e.getDate(), e.getDayOfWeek(), e.getTime()))) {
                continue;
            }
            rows.add(new Row(e.getId(), e.getDate(), Kind.SPORT, e.getDayOfWeek(), e.getTime(), null,
                Reason.NONE, null, Source.ADVICE, e.getCreatedAt()));
        }

        Set<LocalDate> userGymDates = userRows.stream()
            .filter(e -> e.getKind() == Kind.GYM)
            .map(PlannedSkipEntity::getDate)
            .collect(Collectors.toSet());
        protectedDays.forEach((date, period) -> {
            if (!userGymDates.contains(date) && plannedGymDows.contains(date.getDayOfWeek().getValue() - 1)) {
                rows.add(new Row(recoveryRowId(user, date), date, Kind.GYM, null, null, null,
                    period.getCategory(), null, Source.RECOVERY, period.getCreatedAt()));
            }
        });

        return PlannedSkipPolicy.judge(rows).stream()
            .filter(v -> !v.row().date().isBefore(from) && !v.row().date().isAfter(to))
            .sorted(Comparator.comparing((Verdict v) -> v.row().date())
                .thenComparing(v -> v.row().createdAt())
                .thenComparing(v -> v.row().id()))
            .toList();
    }

    /**
     * Weekdays (0=Hét..6=Vas) that carry a planned gym session — loaded once per {@link
     * #verdictsBetween} call, only when a protected date exists. A day is a planned gym day when
     * the active meso has a template day with that HU label (the {@code
     * WorkoutService#findPlannedTemplateForDate} rule the commitment, adherence and quest reads use)
     * OR a {@code gym_schedule_slot} sits on it (the rule the missed-workouts / momentum flags and
     * the workout windows use). Mirrored via repositories: injecting WorkoutService here would be a
     * cycle (it depends on this service).
     */
    private Set<Integer> plannedGymWeekdays(UUID user) {
        Set<Integer> dows = new HashSet<>();
        gymScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(user)
            .forEach(slot -> dows.add(slot.getDayOfWeek()));
        mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(user, "active").stream().findFirst()
            .ifPresent(meso -> workoutSessionRepository
                .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(user, List.of(meso.getId())).stream()
                .filter(s -> s.getTemplateSessionId() == null && s.getDayLabel() != null)
                .forEach(s -> {
                    int dow = WorkoutService.HU_DAY_LABELS.indexOf(s.getDayLabel());
                    if (dow >= 0) {
                        dows.add(dow);
                    }
                }));
        return dows;
    }

    /** Stable id of the virtual RECOVERY row for one protected date — deterministic so a verdict
     *  keeps its identity across reads. */
    private static UUID recoveryRowId(UUID user, LocalDate date) {
        return UUID.nameUUIDFromBytes(("recovery:" + user + ":" + date).getBytes());
    }

    /** Identity of one SPORT occurrence — date + weekday + clock time — used to drop an ADVICE
     *  row when a USER row covers the same slot (Kihagyás S1 controller ruling). */
    private record SlotIdentity(LocalDate date, Integer dayOfWeek, String time) {
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

    /** One skipped RUN occurrence — the date plus the prescribed session's {@code key}. */
    public record RunSkipKey(LocalDate date, String sessionKey) {
    }

    /** The skipped prescribed runs of a range: the exact RUN skips plus every protected
     *  (kímélő-mód) date, on which ANY prescribed run is skipped (Kihagyás S2, mezo-q4xt2.2). */
    public record RunSkips(Set<RunSkipKey> keys, Set<LocalDate> protectedDates) {

        public RunSkips {
            keys = Set.copyOf(keys);
            protectedDates = Set.copyOf(protectedDates);
        }

        /** Is the prescribed run {@code sessionKey} skipped on {@code date}? */
        public boolean contains(LocalDate date, String sessionKey) {
            return protectedDates.contains(date)
                || (sessionKey != null && keys.contains(new RunSkipKey(date, sessionKey)));
        }

        public boolean isEmpty() {
            return keys.isEmpty() && protectedDates.isEmpty();
        }
    }

    /** Every skipped prescribed run in [from, to] (any verdict) — the ONE central read the run
     *  planning surfaces (workout windows, the companion's day lines) filter through
     *  (Kihagyás S1, mezo-q4xt2.1 review I2; protected dates since S2). */
    @Transactional(readOnly = true)
    public RunSkips skippedRuns(UUID user, LocalDate from, LocalDate to) {
        return runSkipsOf(verdictsBetween(user, from, to), recoveryPeriodService.protectedDates(user, from, to));
    }

    /** {@link #skippedRuns} from an already-fetched verdict list plus the range's protected dates
     *  (callers that also need the gym dates read {@link #verdictsBetween} once and derive both). */
    public static RunSkips runSkipsOf(List<Verdict> verdicts, Set<LocalDate> protectedDates) {
        Set<RunSkipKey> keys = new HashSet<>();
        for (Verdict v : verdicts) {
            if (v.row().kind() == Kind.RUN && v.row().sessionKey() != null) {
                keys.add(new RunSkipKey(v.row().date(), v.row().sessionKey()));
            }
        }
        return new RunSkips(keys, protectedDates);
    }

    @Transactional(readOnly = true)
    public boolean isRunSkipped(UUID user, LocalDate date, String sessionKey) {
        // RunSkips.contains checks the protected date first, so a protected date answers true
        // even for a null key — consistent with the record.
        return skippedRuns(user, date, date).contains(date, sessionKey);
    }

    /** The MEAL skips of one day — built on {@link #verdictsBetween}, the one central skip read
     *  (Kihagyás S3, mezo-q4xt2.3). Never excludes a skip for being "missed": a meal skip is always
     *  excused. */
    @Transactional(readOnly = true)
    public List<Row> mealSkipsOn(UUID user, LocalDate date) {
        return mealSkipsBetween(user, date, date).getOrDefault(date, List.of());
    }

    /** The MEAL skips of [from, to] grouped by date (dates without a skip are absent). */
    @Transactional(readOnly = true)
    public Map<LocalDate, List<Row>> mealSkipsBetween(UUID user, LocalDate from, LocalDate to) {
        return verdictsBetween(user, from, to).stream()
            .map(Verdict::row)
            .filter(r -> r.kind() == Kind.MEAL)
            .collect(Collectors.groupingBy(Row::date, java.util.TreeMap::new, Collectors.toList()));
    }

    @Transactional(readOnly = true)
    public boolean isGymSkipped(UUID user, LocalDate date) {
        return !skippedDates(user, Kind.GYM, date, date).isEmpty();
    }

    /** ISO week keys (see {@link PlannedSkipPolicy#isoWeekKey}) that hold at least one excused
     *  training skip (MEAL skips never bridge) — including a kímélő-mód protected date (its virtual RECOVERY row, S2). */
    @Transactional(readOnly = true)
    public Set<Long> bridgedWeeks(UUID user, LocalDate from, LocalDate to) {
        Set<Long> weeks = new HashSet<>();
        for (Verdict v : verdictsBetween(user, from, to)) {
            // A skipped meal never bridges the training streak (Kihagyás S3).
            if (v.excused() && v.row().kind() != Kind.MEAL) {
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
            case MEAL -> req.getSessionKey() != null && req.getSessionKey().matches("(breakfast|lunch|dinner|snack)#[1-9]")
                && req.getDayOfWeek() == null && req.getTime() == null;
        };
        if (!valid) {
            throw bad("TRAIN_SKIP_TARGET_INVALID");
        }
    }

    /** NOT_HUNGRY belongs to MEAL only, and a meal skip takes only the meal-relevant reasons. */
    private static void validateReason(Kind kind, Reason reason) {
        boolean valid = kind == Kind.MEAL
            ? switch (reason) {
                case NOT_HUNGRY, NO_TIME, STOMACH, ILLNESS, TRAVEL, OTHER, NONE -> true;
                default -> false;
            }
            : reason != Reason.NOT_HUNGRY;
        if (!valid) {
            throw bad("TRAIN_SKIP_REASON_INVALID");
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
            .kind(PlannedSkipKind.valueOf(r.kind().name()))
            .dayOfWeek(r.dayOfWeek())
            .time(r.time())
            .sessionKey(r.sessionKey())
            .reasonCategory(PlannedSkipReason.valueOf(r.reason().name()))
            .reasonText(r.reasonText())
            .source(PlannedSkipResponse.SourceEnum.valueOf(r.source().name()))
            .serious(v.serious())
            .freePass(v.freePass())
            .excused(v.excused())
            .plannedKcal(r.plannedKcal());
    }
}
