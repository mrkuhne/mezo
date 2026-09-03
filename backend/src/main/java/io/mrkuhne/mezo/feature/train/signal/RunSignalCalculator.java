package io.mrkuhne.mezo.feature.train.signal;

import io.mrkuhne.mezo.feature.progression.run.RunSignal;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunPrescribedSession;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Builds a RunSignal from a logged run session + its prescribed session's kind (sprint|steady). */
@Component
@RequiredArgsConstructor
public class RunSignalCalculator {

    private static final String DEFAULT_KIND = "steady";
    private static final String PYRAMID_KIND = "pyramid";
    private static final String WORK_SEGMENT = "work";

    private final RunSessionLogRepository runSessionLogRepository;
    private final RunningBlockRepository runningBlockRepository;

    public RunSignal compute(UUID createdBy, UUID runLogId) {
        RunSessionLogEntity log = runSessionLogRepository.findByIdAndCreatedBy(runLogId, createdBy)
            .orElseThrow(OwnershipGuard::notFound);
        RunPrescribedSession prescribed = resolveSession(log.getBlockId(), log.getSessionKey());
        String kind = prescribed != null && prescribed.kind() != null ? prescribed.kind() : DEFAULT_KIND;
        return new RunSignal(log.getId(), kind, log.getCompletedRounds(), log.getDurationMin(),
            log.getRpeActual(), log.getSprintLandmark(), log.getHrRecoverySec(),
            prescribedWorkSecs(kind, prescribed));
    }

    /** The prescribed session for the log's sessionKey; null when the block/structure/key is missing. */
    private RunPrescribedSession resolveSession(UUID blockId, String sessionKey) {
        RunningBlockEntity block = blockId == null ? null : runningBlockRepository.findById(blockId).orElse(null);
        if (block == null || block.getStructure() == null || sessionKey == null) {
            return null;
        }
        RunningBlockStructure structure = block.getStructure();
        // Walk weeks → sessions; match the prescribed session by key.
        return structure.weeks().stream()
            .flatMap(w -> w.sessions().stream())
            .filter(s -> sessionKey.equals(s.key()))
            .findFirst()
            .orElse(null);
    }

    /**
     * The ordered work-segment seconds — only for a pyramid, whose segments enumerate each round
     * individually so the scorer can weight partial completion by the work actually done
     * (mezo-d20.7.3). A sprint's segments are one work/rest template repeated {@code rounds}
     * times, i.e. not a per-round enumeration, so nothing is carried for it.
     */
    private static List<Integer> prescribedWorkSecs(String kind, RunPrescribedSession prescribed) {
        if (!PYRAMID_KIND.equals(kind) || prescribed == null || prescribed.segments() == null) {
            return null;
        }
        return prescribed.segments().stream()
            .filter(Objects::nonNull)
            .filter(s -> WORK_SEGMENT.equals(s.type()))
            .map(RunningBlockStructure.RunSegment::durationSec)
            .toList();
    }
}
