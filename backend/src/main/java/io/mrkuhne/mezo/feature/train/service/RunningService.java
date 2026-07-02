package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.RunSessionLogRequest;
import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockUpsertRequest;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.feature.progression.run.RunSignal;
import io.mrkuhne.mezo.feature.train.signal.RunSignalCalculator;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.mapper.RunningMapper;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Futás (interval-running) slice service, mirroring {@link TrainService}. Blocks ("Terv") carry a
 * typed-jsonb week→session→segment {@code structure}; lifecycle status planned|active|archived with
 * the single-active invariant enforced on activate. All finders are scoped by {@code createdBy} and
 * ownership is stamped from the principal. Per house rule (spring_patterns.md) only the write
 * methods carry method-level {@code @Transactional}.
 */
@Service
@RequiredArgsConstructor
public class RunningService {

    private final RunningBlockRepository blockRepository;
    private final RunSessionLogRepository logRepository;
    private final RunningMapper mapper;
    // Progression collaborators (T4): logging a run awards XP behind the feature switch — the same
    // house pattern as the gym path (WorkoutService). The gate bean exists ONLY when
    // mezo.feature.progression.enabled=true, so an absent provider ⇔ switch off.
    private final RunSignalCalculator runSignalCalculator;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;

    public List<RunningBlockResponse> listBlocks(UUID userId) {
        return blockRepository.findByCreatedByAndDeletedFalseOrderByStartDateAsc(userId)
            .stream().map(this::toResponse).toList();
    }

    @Transactional
    public RunningBlockResponse createBlock(UUID userId, RunningBlockUpsertRequest req) {
        RunningBlockEntity e = new RunningBlockEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setStatus("planned");
        applyUpsert(e, req);
        return toResponse(blockRepository.save(e));
    }

    @Transactional
    public RunningBlockResponse updateBlock(UUID userId, UUID id, RunningBlockUpsertRequest req) {
        RunningBlockEntity e = requireOwned(userId, id);
        applyUpsert(e, req);
        return toResponse(blockRepository.save(e));
    }

    @Transactional
    public RunningBlockResponse activateBlock(UUID userId, UUID id) {
        RunningBlockEntity target = requireOwned(userId, id);
        // Single-active invariant (spec rule): activating archives every other active block.
        for (RunningBlockEntity other : blockRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")) {
            if (!other.getId().equals(id)) {
                other.setStatus("archived"); // dirty-checking flushes — no explicit save
            }
        }
        if (!"active".equals(target.getStatus())) {
            target.setStatus("active");
        }
        return toResponse(target);
    }

    @Transactional
    public RunningBlockResponse closeBlock(UUID userId, UUID id) {
        RunningBlockEntity e = requireOwned(userId, id);
        if (!"archived".equals(e.getStatus())) {
            e.setStatus("archived");
        }
        return toResponse(e);
    }

    @Transactional
    public void deleteBlock(UUID userId, UUID id) {
        blockRepository.delete(requireOwned(userId, id)); // @SQLDelete soft-deletes
    }

    public List<RunSessionLogResponse> listSessions(UUID userId) {
        return logRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(userId)
            .stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public RunSessionLogResponse logSession(UUID userId, RunSessionLogRequest req) {
        requireOwned(userId, req.getBlockId()); // ownership of referenced block
        RunSessionLogEntity e = new RunSessionLogEntity();
        e.setCreatedBy(userId);
        e.setBlockId(req.getBlockId());
        e.setWeekNumber(req.getWeekNumber());
        e.setSessionKey(req.getSessionKey());
        e.setDate(req.getDate());
        e.setCompletedRounds(req.getCompletedRounds());
        e.setRpeActual(req.getRpeActual());
        e.setHrRecoverySec(req.getHrRecoverySec());
        e.setSprintLandmark(req.getSprintLandmark());
        e.setDurationMin(req.getDurationMin());
        e.setNotes(req.getNotes());
        RunSessionLogResponse base = mapper.toResponse(logRepository.save(e));
        // Progression runs ONLY when the feature switch is on (gate bean present) and only here in
        // logSession — never via the GET list path. Atomic with the save (same @Transactional);
        // applyRun is idempotent on the saved log id, so a re-log returns the stored payload.
        if (progressionGate.getIfAvailable() != null) {
            RunSignal signal = runSignalCalculator.compute(userId, e.getId());
            base.setLevelUp(levelUpResultMapper.toDto(progressionService.applyRun(userId, signal)));
        }
        return base;
    }

    private void applyUpsert(RunningBlockEntity e, RunningBlockUpsertRequest req) {
        e.setTitle(req.getTitle());
        e.setGoal(req.getGoal());
        e.setKind(req.getKind());
        e.setStartDate(req.getStartDate());
        e.setEndDate(req.getEndDate());
        e.setWeeks(req.getWeeks());
        // currentWeek is derived, never trusted from the client (the request field is ignored):
        // the 1-based week containing today, clamped to [1, weeks] (mezo-478).
        e.setCurrentWeek(clampWeek(req.getStartDate(), req.getWeeks()));
        e.setSummary(req.getSummary());
        e.setStructure(mapper.toEntityStructure(req.getStructure()));
    }

    /**
     * The 1-based week of the block that contains today, clamped to [1, weeks] (week 1 before the
     * start date). Mirrors {@code TrainService.clampWeek} — currentWeek is a derived calendar fact,
     * not a stored pointer the client owns.
     */
    private int clampWeek(LocalDate startDate, int weeks) {
        long week = ChronoUnit.DAYS.between(startDate, LocalDate.now()) / 7 + 1;
        return (int) Math.max(1, Math.min(weeks, week));
    }

    /**
     * Map a block, healing a stale/invalid stored {@code currentWeek} (null, &lt; 1, or &gt; weeks) by
     * re-deriving it from the dates. So a block written before currentWeek was derived (e.g. a legacy
     * 0 that rendered "az aktuális hét nincs a tervben") self-corrects on read, while a valid stored
     * value is left untouched (mezo-478).
     */
    private RunningBlockResponse toResponse(RunningBlockEntity e) {
        RunningBlockResponse r = mapper.toResponse(e);
        Integer cw = r.getCurrentWeek();
        if (cw == null || cw < 1 || cw > e.getWeeks()) {
            r.setCurrentWeek(clampWeek(e.getStartDate(), e.getWeeks()));
        }
        return r;
    }

    /** Ownership gate: a missing row and a foreign row are indistinguishable to the caller (404). */
    private RunningBlockEntity requireOwned(UUID userId, UUID id) {
        return blockRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(OwnershipGuard::notFound);
    }
}
