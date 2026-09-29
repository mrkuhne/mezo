package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.RecoveryCheckInRequest;
import io.mrkuhne.mezo.api.dto.RecoveryComeback;
import io.mrkuhne.mezo.api.dto.RecoveryEstimate;
import io.mrkuhne.mezo.api.dto.RecoveryPeriod;
import io.mrkuhne.mezo.api.dto.RecoveryReturn;
import io.mrkuhne.mezo.api.dto.RecoveryReturnRule;
import io.mrkuhne.mezo.api.dto.RecoveryState;
import io.mrkuhne.mezo.api.dto.RecoveryUpsertRequest;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryDayReleaseEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RecoveryDayReleaseRepository;
import io.mrkuhne.mezo.feature.train.repository.RecoveryPeriodRepository;
import io.mrkuhne.mezo.feature.train.service.RecoveryReturnPolicy.Decision;
import io.mrkuhne.mezo.feature.train.service.RecoveryReturnPolicy.Rule;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every write of kímélő mód (Kihagyás S2, mezo-q4xt2.2, spec 2026-09-28 §9.1) plus the
 * {@link RecoveryState} read model: opening/updating a period, the daily check-in, the return rule
 * applied at "Jobban" (a whole-week shift of the active meso, and for a long absence one week back
 * with lower weekly sets), its exact undo ("Mégsem vagyok jól" / "Tévedés volt"), released days and
 * waiving the comeback ramp. Every write takes {@link PlannedSkipLock} first, so two quick taps
 * resolve to one row.
 */
@Service
@RequiredArgsConstructor
public class RecoveryReturnService {

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");
    private static final String ACTIVE = "active";

    private final RecoveryPeriodRepository periods;
    private final RecoveryDayReleaseRepository releases;
    private final RecoveryPeriodService periodService;
    private final MesocycleRepository mesos;
    private final MuscleGroupVolumeLogRepository volumeLogs;
    private final VolumeProperties volumeProps;
    private final PlannedSkipLock lock;

    // ==== reads ====

    /** The open period (or the one ended today), protected dates [today−7, today+13], the ramp. */
    @Transactional(readOnly = true)
    public RecoveryState state(UUID user) {
        return buildState(user, today());
    }

    // ==== writes ====

    @Transactional
    public RecoveryState upsert(UUID user, RecoveryUpsertRequest req) {
        LocalDate today = today();
        Reason category = Reason.valueOf(req.getCategory().getValue());
        if (!PlannedSkipPolicy.isSerious(category)) {
            throw bad("TRAIN_RECOVERY_CATEGORY_INVALID");
        }
        Estimate estimate = Estimate.valueOf(req.getEstimate().getValue());
        LocalDate start = req.getStartDate() == null ? today : req.getStartDate();
        if (start.isBefore(today.minusDays(7)) || start.isAfter(today)) {
            throw bad("TRAIN_RECOVERY_START_OUT_OF_WINDOW");
        }
        lock.lock(user);
        RecoveryPeriodEntity p = periods.findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse(user)
            .orElseGet(() -> {
                RecoveryPeriodEntity e = new RecoveryPeriodEntity();
                e.setCreatedBy(user);
                e.setStartDate(start);
                return e;
            });
        p.setCategory(category);
        p.setEstimate(estimate);
        p.setExpectedEnd(RecoveryReturnPolicy.expectedEnd(p.getStartDate(), estimate));
        p.setUpdatedAt(Instant.now());
        periods.saveAndFlush(p);
        return buildState(user, today);
    }

    @Transactional
    public RecoveryState checkIn(UUID user, RecoveryCheckInRequest.AnswerEnum answer) {
        LocalDate today = today();
        lock.lock(user);
        RecoveryPeriodEntity p = periods.findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse(user)
            .orElseThrow(RecoveryReturnService::notFound);
        if (answer == RecoveryCheckInRequest.AnswerEnum.BETTER) {
            if (!today.isAfter(p.getStartDate())) {
                throw bad("TRAIN_RECOVERY_TOO_EARLY");
            }
            p.setEndedOn(today);
            apply(p, today);
        }
        p.setLastCheckDate(today);
        p.setUpdatedAt(Instant.now());
        periods.saveAndFlush(p);
        return buildState(user, today);
    }

    /** "Mégsem vagyok jól" — only for the period ended today, and only while no other is open. */
    @Transactional
    public RecoveryState undoBetter(UUID user) {
        LocalDate today = today();
        lock.lock(user);
        if (periods.findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse(user).isPresent()) {
            throw undoExpired();
        }
        RecoveryPeriodEntity p = endedToday(user, today).orElseThrow(RecoveryReturnService::undoExpired);
        revert(p);
        p.setEndedOn(null);
        p.setUpdatedAt(Instant.now());
        periods.saveAndFlush(p);
        return buildState(user, today);
    }

    /** "Tévedés volt" — soft-delete the open (or today-ended) period, reverting any shift. */
    @Transactional
    public void discard(UUID user) {
        LocalDate today = today();
        lock.lock(user);
        RecoveryPeriodEntity p = periods.findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse(user)
            .or(() -> endedToday(user, today))
            .orElseThrow(RecoveryReturnService::notFound);
        revert(p);
        periods.saveAndFlush(p);
        periods.delete(p);
        periods.flush();
    }

    /** "Ma mégis edzek" — the date trains normally ({@code lighten} = lighter than planned). */
    @Transactional
    public RecoveryState release(UUID user, LocalDate date, boolean lighten) {
        LocalDate today = today();
        lock.lock(user);
        RecoveryPeriodEntity p = protectingOpen(user, date, today);
        RecoveryDayReleaseEntity r = releases.findByCreatedByAndPeriodIdAndDateAndDeletedFalse(user, p.getId(), date)
            .orElseGet(() -> {
                RecoveryDayReleaseEntity e = new RecoveryDayReleaseEntity();
                e.setCreatedBy(user);
                e.setPeriodId(p.getId());
                e.setDate(date);
                return e;
            });
        r.setLighten(lighten);
        r.setUpdatedAt(Instant.now());
        releases.saveAndFlush(r);
        return buildState(user, today);
    }

    @Transactional
    public RecoveryState unrelease(UUID user, LocalDate date) {
        LocalDate today = today();
        lock.lock(user);
        RecoveryPeriodEntity p = protectingOpen(user, date, today);
        releases.findByCreatedByAndPeriodIdAndDateAndDeletedFalse(user, p.getId(), date).ifPresent(r -> {
            releases.delete(r);
            releases.flush();
        });
        return buildState(user, today);
    }

    /** "Kikapcsolom a könnyítést" — switch off the ramp of the latest ended period. */
    @Transactional
    public RecoveryState waiveComeback(UUID user) {
        LocalDate today = today();
        lock.lock(user);
        RecoveryPeriodEntity p = periods
            .findFirstByCreatedByAndEndedOnIsNotNullAndDeletedFalseOrderByEndedOnDescStartDateDesc(user)
            .orElseThrow(RecoveryReturnService::notFound);
        p.setComebackWaived(true);
        p.setUpdatedAt(Instant.now());
        periods.saveAndFlush(p);
        return buildState(user, today);
    }

    // ==== the return rule ====

    /**
     * Apply the return rule at "Jobban": nothing for CONTINUE or without an active meso; otherwise
     * snapshot the meso, move its dates by whole weeks so today falls in the target week, set
     * {@code currentWeek} to it, and for STEP_BACK lower every muscle's weekly sets by one step
     * (never below MEV) and mark the target week's rollover as already run.
     */
    void apply(RecoveryPeriodEntity p, LocalDate today) {
        Decision d = RecoveryReturnPolicy.decide(p.getStartDate(), p.getEndedOn());
        if (d.rule() == Rule.CONTINUE) {
            return;
        }
        Optional<MesocycleEntity> active = activeMeso(p.getCreatedBy());
        if (active.isEmpty()) {
            return;
        }
        MesocycleEntity meso = active.get();
        int weekAtStart = MesoWeeks.weekOf(meso.getStartDate(), p.getStartDate(), meso.getWeeks());
        int target = RecoveryReturnPolicy.targetWeek(d.rule(), weekAtStart);
        int shift = RecoveryReturnPolicy.shiftDays(meso.getStartDate(), today, target);
        VolumeRecomputeJson recompute = meso.getVolumeRecompute();

        p.setPrevStart(meso.getStartDate());
        p.setPrevEnd(meso.getEndDate());
        p.setPrevCurrentWeek(meso.getCurrentWeek());
        p.setPrevLastRun(recompute == null ? null : recompute.lastRun());
        p.setPrevSets(null);

        meso.setStartDate(meso.getStartDate().plusDays(shift));
        if (meso.getEndDate() != null) {
            meso.setEndDate(meso.getEndDate().plusDays(shift));
        }
        meso.setCurrentWeek(target);

        if (d.rule() == Rule.STEP_BACK) {
            Map<String, Integer> prevSets = new HashMap<>();
            List<MuscleGroupVolumeLogEntity> logs =
                volumeLogs.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(p.getCreatedBy(), List.of(meso.getId()));
            for (MuscleGroupVolumeLogEntity log : logs) {
                if (log.getCurrentSets() == null) {
                    continue;
                }
                prevSets.put(log.getMuscle(), log.getCurrentSets());
                int floor = log.getMev() == null ? 0 : log.getMev();
                log.setCurrentSets(Math.max(floor, log.getCurrentSets() - volumeProps.step()));
            }
            volumeLogs.saveAll(logs);
            p.setPrevSets(prevSets);
            meso.setVolumeRecompute(recompute == null
                ? new VolumeRecomputeJson("W" + target, null, null, List.of())
                : new VolumeRecomputeJson("W" + target, recompute.nextRun(), recompute.trigger(), recompute.changes()));
        }
        mesos.saveAndFlush(meso);
        p.setShiftMesoId(meso.getId());
        p.setShiftDays(shift);
    }

    /** Restore the meso snapshot taken by {@link #apply} (if that meso still exists), then clear it. */
    void revert(RecoveryPeriodEntity p) {
        if (p.getShiftMesoId() != null) {
            mesos.findByIdAndCreatedByAndDeletedFalse(p.getShiftMesoId(), p.getCreatedBy()).ifPresent(meso -> {
                meso.setStartDate(p.getPrevStart());
                meso.setEndDate(p.getPrevEnd());
                meso.setCurrentWeek(p.getPrevCurrentWeek());
                VolumeRecomputeJson recompute = meso.getVolumeRecompute();
                if (recompute != null) {
                    meso.setVolumeRecompute(new VolumeRecomputeJson(
                        p.getPrevLastRun(), recompute.nextRun(), recompute.trigger(), recompute.changes()));
                }
                if (p.getPrevSets() != null) {
                    List<MuscleGroupVolumeLogEntity> logs = volumeLogs
                        .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(p.getCreatedBy(), List.of(meso.getId()));
                    for (MuscleGroupVolumeLogEntity log : logs) {
                        Integer prev = p.getPrevSets().get(log.getMuscle());
                        if (prev != null) {
                            log.setCurrentSets(prev);
                        }
                    }
                    volumeLogs.saveAll(logs);
                }
                mesos.saveAndFlush(meso);
            });
        }
        p.setShiftMesoId(null);
        p.setShiftDays(0);
        p.setPrevStart(null);
        p.setPrevEnd(null);
        p.setPrevCurrentWeek(null);
        p.setPrevLastRun(null);
        p.setPrevSets(null);
    }

    // ==== helpers ====

    private Optional<MesocycleEntity> activeMeso(UUID user) {
        return mesos.findByCreatedByAndStatusAndDeletedFalse(user, ACTIVE).stream()
            .max(Comparator.comparing(MesocycleEntity::getStartDate));
    }

    private Optional<RecoveryPeriodEntity> endedToday(UUID user, LocalDate today) {
        return periods.findFirstByCreatedByAndEndedOnIsNotNullAndDeletedFalseOrderByEndedOnDescStartDateDesc(user)
            .filter(p -> today.equals(p.getEndedOn()));
    }

    /** The open period, if it protects {@code date} (start … today+13), else 400. */
    private RecoveryPeriodEntity protectingOpen(UUID user, LocalDate date, LocalDate today) {
        return periods.findFirstByCreatedByAndEndedOnIsNullAndDeletedFalse(user)
            .filter(p -> !date.isBefore(p.getStartDate()) && !date.isAfter(today.plusDays(13)))
            .orElseThrow(() -> bad("TRAIN_RECOVERY_DATE_NOT_PROTECTED"));
    }

    private RecoveryState buildState(UUID user, LocalDate today) {
        Optional<RecoveryPeriodEntity> open = periodService.open(user);
        Optional<RecoveryPeriodEntity> latestEnded = periodService.latestEnded(user);
        RecoveryPeriodEntity shown = open
            .or(() -> latestEnded.filter(p -> today.equals(p.getEndedOn())))
            .orElse(null);
        List<LocalDate> protectedDates = periodService.protectedDates(user, today.minusDays(7), today.plusDays(13))
            .stream().sorted().toList();
        return new RecoveryState()
            .period(shown == null ? null : toPeriod(shown, today))
            .protectedDates(protectedDates)
            .comeback(open.isPresent() ? null : latestEnded.map(p -> comeback(p, today)).orElse(null));
    }

    /** The ramp after the latest return — null once its sessions are done. {@code total} is 0 when waived. */
    private RecoveryComeback comeback(RecoveryPeriodEntity p, LocalDate today) {
        Decision d = RecoveryReturnPolicy.decide(p.getStartDate(), p.getEndedOn());
        int done = periodService.comebackSessionsDone(p, today);
        if (done >= d.rampSessions()) {
            return null;
        }
        return new RecoveryComeback()
            .total(p.isComebackWaived() ? 0 : d.rampSessions())
            .done(done)
            .waived(p.isComebackWaived());
    }

    private RecoveryPeriod toPeriod(RecoveryPeriodEntity p, LocalDate today) {
        List<RecoveryDayReleaseEntity> rows =
            releases.findByCreatedByAndPeriodIdInAndDeletedFalse(p.getCreatedBy(), List.of(p.getId()));
        RecoveryPeriod out = new RecoveryPeriod()
            .id(p.getId())
            .category(PlannedSkipReason.valueOf(p.getCategory().name()))
            .estimate(RecoveryEstimate.valueOf(p.getEstimate().name()))
            .startDate(p.getStartDate())
            .expectedEnd(p.getExpectedEnd())
            .endedOn(p.getEndedOn())
            .dayIndex((int) ChronoUnit.DAYS.between(p.getStartDate(), today) + 1)
            .estimateExpired(p.getExpectedEnd() != null && p.getExpectedEnd().isBefore(today))
            .checkedInToday(today.equals(p.getLastCheckDate()))
            .releasedDates(rows.stream().map(RecoveryDayReleaseEntity::getDate).sorted().toList())
            .releasedUnlightened(rows.stream().filter(r -> !r.isLighten())
                .map(RecoveryDayReleaseEntity::getDate).sorted().toList());
        if (p.getEndedOn() != null) {
            Decision d = RecoveryReturnPolicy.decide(p.getStartDate(), p.getEndedOn());
            LocalDate newEnd = p.getShiftMesoId() == null ? null
                : mesos.findByIdAndCreatedByAndDeletedFalse(p.getShiftMesoId(), p.getCreatedBy())
                    .map(MesocycleEntity::getEndDate).orElse(null);
            out._return(new RecoveryReturn()
                .rule(RecoveryReturnRule.valueOf(d.rule().name()))
                .daysOut(d.daysOut())
                .rampSessions(d.rampSessions())
                .shiftDays(p.getShiftDays())
                .newEndDate(newEnd));
        }
        return out;
    }

    private static LocalDate today() {
        return LocalDate.now(TZ);
    }

    private static SystemRuntimeErrorException bad(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build());
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(SystemMessage.error("TRAIN_RECOVERY_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }

    private static SystemRuntimeErrorException undoExpired() {
        return new SystemRuntimeErrorException(SystemMessage.error("TRAIN_RECOVERY_UNDO_EXPIRED").build(), HttpStatus.CONFLICT);
    }
}
