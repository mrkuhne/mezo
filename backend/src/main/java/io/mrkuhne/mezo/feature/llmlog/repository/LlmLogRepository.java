package io.mrkuhne.mezo.feature.llmlog.repository;

import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Write-and-read-back access to the INSERT-only {@code llm_log_history} audit table (mezo-2zyu).
 * Query methods (feature/model/day rollups, retention pruning) arrive with the later tasks.
 */
public interface LlmLogRepository extends JpaRepository<LlmLogEntity, UUID> {
}
