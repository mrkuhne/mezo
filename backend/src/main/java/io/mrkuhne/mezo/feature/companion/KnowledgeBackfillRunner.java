package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * S6 (mezo-d6ivw.6) folds in mezo-4rh4r: before S2, "Igen, ez igaz rám" on a PLAN-LESS grounded
 * row only moved it to {@code monitoring} — nothing was left to measure, so it never promoted and
 * the user's confirmed knowledge never became a fact. On every start this runner re-applies the
 * S2 confirm (PatternService.applyUserConfirm — events, provenance, graph event, veto guard) to
 * exactly those rows. Idempotent by construction: a promoted row is {@code confirmed} with a
 * {@code promotedFactId} and leaves the work list. One REQUIRES_NEW transaction per row (slice
 * lesson 11), so one bad row never rolls back the others.
 */
@Slf4j
@Component
@Order(220)
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class KnowledgeBackfillRunner implements CommandLineRunner {

    private static final String CHOICE_WATCH = "watch";

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    private final PatternService patternService;
    private final PlatformTransactionManager transactionManager;

    @Override
    public void run(String... args) {
        int promoted = backfill();
        if (promoted > 0) {
            log.info("Knowledge backfill (mezo-4rh4r): {} stuck confirmed observation(s) promoted", promoted);
        }
    }

    public int backfill() {
        List<PatternEntity> work = patternRepository.findByKindInAndStatusAndPromotedFactIdIsNullAndDeletedFalse(
                        PatternEntity.REFLECTION_OWNED_KINDS, PatternEntity.STATUS_MONITORING).stream()
                .filter(row -> row.getTestPlan() == null)
                .filter(row -> !row.isDrift())
                .toList();
        int promoted = 0;
        for (PatternEntity row : work) {
            try {
                if (promoteOne(row.getCreatedBy(), row.getId())) promoted++;
            } catch (Exception e) {
                log.warn("Knowledge backfill skipped pattern {} — {}", row.getId(), e.getMessage());
            }
        }
        return promoted;
    }

    private boolean promoteOne(UUID userId, UUID patternId) {
        TransactionTemplate own = new TransactionTemplate(transactionManager);
        own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return Boolean.TRUE.equals(own.execute(status -> {
            PatternEntity row = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId).orElse(null);
            if (row == null || row.getPromotedFactId() != null || !newestReplyIsWatch(userId, patternId)) return false;
            patternService.applyUserConfirm(userId, row);
            patternRepository.saveAndFlush(row);
            return row.getPromotedFactId() != null;
        }));
    }

    private boolean newestReplyIsWatch(UUID userId, UUID patternId) {
        return patternEventRepository
                .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        userId, patternId, PatternEventEntity.KIND_USER_REPLY)
                .map(e -> CHOICE_WATCH.equals(e.getPayload().choice()))
                .orElse(false);
    }
}
