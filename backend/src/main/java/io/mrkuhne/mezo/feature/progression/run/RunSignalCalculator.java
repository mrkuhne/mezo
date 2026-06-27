package io.mrkuhne.mezo.feature.progression.run;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Builds a RunSignal from a logged run session + its prescribed session's kind (sprint|steady). */
@Component
@RequiredArgsConstructor
public class RunSignalCalculator {

    private static final String DEFAULT_KIND = "steady";

    private final RunSessionLogRepository runSessionLogRepository;
    private final RunningBlockRepository runningBlockRepository;

    public RunSignal compute(UUID createdBy, UUID runLogId) {
        RunSessionLogEntity log = runSessionLogRepository.findByIdAndCreatedBy(runLogId, createdBy)
            .orElseThrow();
        String kind = resolveKind(log.getBlockId(), log.getSessionKey());
        return new RunSignal(log.getId(), kind, log.getCompletedRounds(), log.getDurationMin(),
            log.getRpeActual(), log.getSprintLandmark(), log.getHrRecoverySec());
    }

    /** The prescribed session's kind from the block's jsonb structure; "steady" if not found. */
    private String resolveKind(UUID blockId, String sessionKey) {
        RunningBlockEntity block = runningBlockRepository.findById(blockId).orElse(null);
        if (block == null || block.getStructure() == null) {
            return DEFAULT_KIND;
        }
        RunningBlockStructure structure = block.getStructure();
        // Walk weeks → sessions; match the prescribed session by key, return its kind.
        return structure.weeks().stream()
            .flatMap(w -> w.sessions().stream())
            .filter(s -> sessionKey.equals(s.key()))
            .map(RunningBlockStructure.RunPrescribedSession::kind)
            .findFirst()
            .orElse(DEFAULT_KIND);
    }
}
