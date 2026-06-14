package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.RunSessionLogRequest;
import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockUpsertRequest;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.mapper.RunningMapper;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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

    public List<RunningBlockResponse> listBlocks(UUID userId) {
        return blockRepository.findByCreatedByOrderByStartDateAsc(userId)
            .stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public RunningBlockResponse createBlock(UUID userId, RunningBlockUpsertRequest req) {
        RunningBlockEntity e = new RunningBlockEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setStatus("planned");
        applyUpsert(e, req);
        return mapper.toResponse(blockRepository.save(e));
    }

    @Transactional
    public RunningBlockResponse updateBlock(UUID userId, UUID id, RunningBlockUpsertRequest req) {
        RunningBlockEntity e = requireOwned(userId, id);
        applyUpsert(e, req);
        return mapper.toResponse(blockRepository.save(e));
    }

    @Transactional
    public RunningBlockResponse activateBlock(UUID userId, UUID id) {
        RunningBlockEntity target = requireOwned(userId, id);
        // Single-active invariant (spec rule): activating archives every other active block.
        for (RunningBlockEntity other : blockRepository.findByCreatedByAndStatus(userId, "active")) {
            if (!other.getId().equals(id)) {
                other.setStatus("archived");
                blockRepository.save(other);
            }
        }
        target.setStatus("active");
        return mapper.toResponse(blockRepository.save(target));
    }

    @Transactional
    public RunningBlockResponse closeBlock(UUID userId, UUID id) {
        RunningBlockEntity e = requireOwned(userId, id);
        e.setStatus("archived");
        return mapper.toResponse(blockRepository.save(e));
    }

    @Transactional
    public void deleteBlock(UUID userId, UUID id) {
        blockRepository.delete(requireOwned(userId, id)); // @SQLDelete soft-deletes
    }

    public List<RunSessionLogResponse> listSessions(UUID userId) {
        return logRepository.findByCreatedByOrderByDateDesc(userId)
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
        return mapper.toResponse(logRepository.save(e));
    }

    private void applyUpsert(RunningBlockEntity e, RunningBlockUpsertRequest req) {
        e.setTitle(req.getTitle());
        e.setGoal(req.getGoal());
        e.setKind(req.getKind());
        e.setStartDate(req.getStartDate());
        e.setEndDate(req.getEndDate());
        e.setWeeks(req.getWeeks());
        e.setCurrentWeek(req.getCurrentWeek() != null ? req.getCurrentWeek() : 0);
        e.setSummary(req.getSummary());
        e.setStructure(mapper.toEntityStructure(req.getStructure()));
    }

    /** Ownership gate: a missing row and a foreign row are indistinguishable to the caller (404). */
    private RunningBlockEntity requireOwned(UUID userId, UUID id) {
        return blockRepository.findByIdAndCreatedBy(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
