package io.mrkuhne.mezo.feature.goal;

import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureLearningService;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * One-shot deploy rollout for the learned-expenditure feature (mezo-zz91i): on every boot (all
 * profiles incl. prod), reviews the week that just ended for every active-goal owner who is not
 * yet a learner ({@code expenditure_estimate} has no row for them) via
 * {@link ExpenditureLearningService#reviewWeek}. Idempotent — the next boot finds the row and
 * skips. A user whose intake/weigh-in history is too thin simply stays not-a-learner (empty
 * result); {@code @Order(208)}: after {@link ActivityModelMigrationRunner} (207) so it reads
 * goals already migrated to the current activity model.
 *
 * <p>Explanation backfill (mezo-y72o3): an existing learner whose LATEST row has no
 * {@code explanation} yet (written before the "Hogy tanultam?" explainer) gets it through
 * {@link ExpenditureLearningService#backfillExplanation} — explain-only: the served decision (status,
 * posterior, applied base, step) is never touched, and the explanation reflects the data as of the
 * backfill. The next boot finds it filled and skips.
 */
@Slf4j
@Component
@Order(208)
@RequiredArgsConstructor
public class ExpenditureRolloutRunner implements CommandLineRunner {

    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_ARCHIVED = "archived";

    private final GoalRepository goalRepository;
    private final ExpenditureEstimateRepository estimates;
    private final ExpenditureLearningService expenditureLearning;

    @Override
    public void run(String... args) {
        run();
    }

    public void run() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        List<GoalEntity> active = goalRepository.findByStatusNotAndDeletedFalse(STATUS_ARCHIVED).stream()
            .filter(g -> STATUS_ACTIVE.equals(g.getStatus()))
            .toList();
        int learned = 0;
        int explained = 0;
        for (GoalEntity goal : active) {
            try {
                Optional<ExpenditureEstimateEntity> latest =
                    estimates.findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(goal.getCreatedBy());
                if (latest.isEmpty()) {
                    if (expenditureLearning.reviewWeek(goal.getCreatedBy(), weekStart).isPresent()) {
                        learned++;
                    }
                } else if (latest.get().getExplanation() == null) {
                    if (expenditureLearning.backfillExplanation(goal.getCreatedBy(), latest.get().getWeekStart())
                        .isPresent()) {
                        explained++;
                    } else {
                        log.info("Expenditure rollout: no explanation backfilled for user {} (week {}) — nothing to replay.",
                            goal.getCreatedBy(), latest.get().getWeekStart());
                    }
                }
            } catch (Exception e) {
                log.warn("Expenditure rollout: skipped user {} (goal {}) — {}",
                    goal.getCreatedBy(), goal.getId(), e.getMessage());
            }
        }
        if (learned > 0) {
            log.info("Expenditure rollout for {}: {} user(s) now learning.", weekStart, learned);
        }
        if (explained > 0) {
            log.info("Expenditure rollout: explanation backfilled for {} learner(s).", explained);
        }
    }
}
