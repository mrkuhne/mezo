package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternEventAppender;
import io.mrkuhne.mezo.feature.companion.service.PatternGate;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Reflexió S2 (bd mezo-eq85.2, spec 2026-09-06 §4.3): every night, re-run each open hypothesis's
 * OWN test plan through the shared {@link PatternGate}, append an {@code evidence} event with the
 * outcome, recompute {@code belief} and let the pure {@link HypothesisLifecycle} decide whether the
 * row moves. Nothing here talks to a language model: the statistic, the tallies, the belief and the
 * status are all code — Gemini phrases, code decides (plan Global Constraints).
 *
 * <p><b>One transaction per ROW, never one per run.</b> A single row's evaluation writes an
 * {@code evidence} event, mutates the tallies/belief/status and — on a confirm — a
 * {@code knowledge_fact} plus two more events; all of that has to commit or roll back together, or
 * a failure at the final save leaves a durable fact behind a row that is still {@code monitoring},
 * and the next night promotes it AGAIN. The boundary is opened explicitly with a
 * {@link TransactionTemplate} at {@code REQUIRES_NEW} (the {@code PantryCatalogService}
 * {@code insertOrBind} idiom) rather than with {@code @Transactional} on {@link #evaluateOne},
 * because {@link #evaluate} calls it on the SAME bean — Spring's proxy would never see the call and
 * the annotation would be decorative. {@code REQUIRES_NEW} also keeps the per-row try/catch in
 * {@link #evaluate} honest: one row's rollback can never mark a caller's transaction rollback-only
 * and so discard every other row's work. The service itself is NOT class-level
 * {@code @Transactional} (house rule).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class HypothesisEvaluationService {

    /** Chip/notice answers that count FOR the hypothesis; anything else counts against it. */
    private static final Set<String> POSITIVE_CHOICES = Set.of("watch", "confirm");
    private static final Set<String> NEGATIVE_CHOICES = Set.of("reject");

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    /** S4 (mezo-eq85.4): one shared way to append a pattern event — see PatternEventAppender. */
    private final PatternEventAppender patternEventAppender;
    private final DerivedSeriesService derivedSeriesService;
    private final PatternService patternService;
    private final ReflectionProperties properties;
    private final PlatformTransactionManager transactionManager;

    /**
     * Evaluates every open row that carries a test plan.
     *
     * <p>{@code confirmed}/{@code rejected} rows are not even read: the user judged them, and the
     * engine never overrides a judgement. {@code statistical} rows are skipped too — the nightly
     * Pearson job already owns them; their test plan is display metadata only.
     *
     * @return how many rows this run actually evaluated.
     */
    public int evaluate(UUID userId, LocalDate today) {
        List<PatternEntity> open = patternRepository.findByCreatedByAndStatusInAndDeletedFalse(userId,
                List.of(PatternEntity.STATUS_PROPOSED, PatternEntity.STATUS_MONITORING,
                        PatternEntity.STATUS_DORMANT));
        int evaluated = 0;
        for (PatternEntity row : open) {
            if (row.getTestPlan() == null || PatternEntity.KIND_STATISTICAL.equals(row.getKind())) {
                continue;
            }
            try {
                evaluateOne(userId, row.getId(), today);
                evaluated++;
            } catch (Exception e) {
                log.warn("Hypothesis evaluation failed for {} of user {}", row.getId(), userId, e);
            }
        }
        return evaluated;
    }

    /**
     * One row, one transaction: every write below (the evidence event, the tallies, the belief, the
     * status transition and — via {@link PatternService#applyEngineConfirm} — the promoted
     * {@code knowledge_fact} and its two events) commits together or not at all.
     * {@code REQUIRES_NEW} so a rollback here can never poison a caller's transaction.
     */
    private void evaluateOne(UUID userId, UUID patternId, LocalDate today) {
        TransactionTemplate own = new TransactionTemplate(transactionManager);
        own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        own.executeWithoutResult(status -> evaluateRow(userId, patternId, today));
    }

    /** The row body itself — always runs inside {@link #evaluateOne}'s transaction. Re-reads the
     *  row by id so a stale copy from the work-list read can never be written back. */
    private void evaluateRow(UUID userId, UUID patternId, LocalDate today) {
        PatternEntity row = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
                .orElseThrow();
        TestPlanEnvelope plan = row.getTestPlan();
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(plan.windowDays() - 1L);
        Map<LocalDate, Double> a = derivedSeriesService.series(userId, plan.seriesA(), from, to);
        Map<LocalDate, Double> b = derivedSeriesService.series(userId, plan.seriesB(),
                from, to.plusDays(plan.lagDays()));
        PatternGate.Outcome outcome = PatternGate.evaluate(a, b, plan.lagDays(), plan.minN(),
                plan.minGroupN(), derivedSeriesService.valueKindOf(plan.seriesA()));
        Double r = outcome.result() == null ? null : outcome.result().r();
        Double p = outcome.result() == null ? null : outcome.result().p();
        boolean live = outcome.verdict() == PatternGate.Verdict.LIVE;
        boolean strong = r != null && Math.abs(r) >= properties.lifecycle().strongR()
                && p <= properties.lifecycle().strongP();
        boolean hit = live && strong && plan.directionMatches(r);
        if (live) {
            // only a LIVE night is evidence either way — "we could not tell" is not a miss
            if (hit) {
                row.setEvidenceHits(row.getEvidenceHits() + 1);
            } else {
                row.setEvidenceMisses(row.getEvidenceMisses() + 1);
            }
        }
        record(row, PatternEventEntity.KIND_EVIDENCE, PatternEventPayloadEnvelope.evidence(
                r, outcome.alignedDays(), p, outcome.verdict().name(), live ? hit : null));

        int hitStreak = streak(userId, row.getId(), true);
        int missStreak = streak(userId, row.getId(), false);
        int positive = replies(userId, row.getId(), POSITIVE_CHOICES);
        int negative = replies(userId, row.getId(), NEGATIVE_CHOICES);
        long daysWithoutData = outcome.verdict() == PatternGate.Verdict.NO_DATA
                ? ChronoUnit.DAYS.between(lastDataDay(userId, row.getId(), row.getCreatedAt()), today)
                : 0;
        row.setBelief(BigDecimal.valueOf(HypothesisLifecycle.belief(r, p, positive, negative,
                        row.getEvidenceHits(), row.getEvidenceMisses(), properties.lifecycle()))
                .setScale(3, RoundingMode.HALF_UP));
        // timestamptz stores micros — truncate so the persisted row equals the in-memory one (mezo-mfmb)
        row.setLastDetectedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));

        HypothesisLifecycle.Decision decision = HypothesisLifecycle.decide(row.getStatus(),
                outcome.verdict(), hit, hitStreak, missStreak, positive, negative, daysWithoutData,
                properties.lifecycle());
        if (decision.newStatus() != null) {
            if (PatternEntity.STATUS_CONFIRMED.equals(decision.newStatus())) {
                // the engine confirm goes through the SAME body as the user's own confirm, so the
                // fact promotion and the graph event can never drift between the two paths
                patternService.applyEngineConfirm(userId, row);
            } else {
                row.setStatus(decision.newStatus());
                record(row, decision.eventKind(), PatternEventPayloadEnvelope.empty());
            }
        }
        patternRepository.saveAndFlush(row);
    }

    /** Consecutive newest-first evidence nights of one kind. A no-data night ({@code hit == null})
     *  BREAKS both streaks — it is silence, not counter-evidence. */
    private int streak(UUID userId, UUID patternId, boolean wantHit) {
        int streak = 0;
        for (PatternEventEntity event : patternEventRepository
                .findTop10ByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        userId, patternId, PatternEventEntity.KIND_EVIDENCE)) {
            Boolean hit = event.getPayload().hit();
            if (hit == null || hit != wantHit) {
                break;
            }
            streak++;
        }
        return streak;
    }

    private int replies(UUID userId, UUID patternId, Set<String> choices) {
        return (int) patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(userId, patternId)
                .stream()
                .filter(e -> PatternEventEntity.KIND_USER_REPLY.equals(e.getKind()))
                .filter(e -> e.getPayload().choice() != null && choices.contains(e.getPayload().choice()))
                .count();
    }

    /** The last night that actually saw data; before the first such night the row's own birthday
     *  is the honest floor — a hypothesis proposed today is not 30 days starved. */
    private LocalDate lastDataDay(UUID userId, UUID patternId, Instant createdAt) {
        return patternEventRepository
                .findTop10ByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        userId, patternId, PatternEventEntity.KIND_EVIDENCE)
                .stream()
                .filter(e -> !PatternGate.Verdict.NO_DATA.name().equals(e.getPayload().verdict()))
                .map(e -> e.getOccurredAt().atZone(ZoneId.systemDefault()).toLocalDate())
                .findFirst()
                .orElse(createdAt.atZone(ZoneId.systemDefault()).toLocalDate());
    }

    private void record(PatternEntity row, String kind, PatternEventPayloadEnvelope payload) {
        patternEventAppender.append(row.getCreatedBy(), row.getId(), kind, payload);
    }
}
