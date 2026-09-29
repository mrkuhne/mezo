package io.mrkuhne.mezo.feature.companion.service.merge;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.companion.entity.FactMergeLedgerEntity;
import io.mrkuhne.mezo.feature.companion.entity.FactOwner;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.FactMergeLedgerRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactChangedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * S9 (mezo-d6ivw.10) Task 4: the weekly fact-merge sweep — turns {@link FactMergeJudge}'s
 * per-chunk verdicts and {@link FactMergePlanner}'s decisions into writes. {@code same} groups
 * are auto-merged without asking (a loser is muted and superseded, the survivor absorbs its
 * reinforcement); {@code combine} groups become a pending {@link LearnedFactEntity} proposal the
 * candidate inbox already knows how to show. Every decision is recorded once-ever in the
 * {@link FactMergeLedgerEntity} ledger so a run is naturally idempotent.
 *
 * <p><b>One transaction per PLAN, never one per run</b> — the {@code KnowledgeRecheckService}
 * idiom, copied exactly (see its class javadoc for the full rationale). One plan's DB failure
 * must never mark a shared {@code runFor} transaction rollback-only and so silently discard
 * every other plan's already-good work. The boundary is opened explicitly with a {@link
 * TransactionTemplate} at {@code REQUIRES_NEW} rather than with {@code @Transactional}, because
 * {@link #runFor} calls {@link #apply} on the SAME bean — Spring's proxy would never see the call
 * and the annotation would be decorative. This service is NOT class-level {@code @Transactional}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactMergeService {

    /** Facts are judged in chunks of at most this many per category — keeps the judge's prompt
     *  bounded even for a user with a very large Tudástár. */
    private static final int CHUNK_SIZE = 120;

    public record Outcome(int merged, int proposed) {}

    private final FactMergeJudge judge;
    private final FactMergeLedgerRepository ledgerRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final LearnedFactRepository learnedFactRepository;
    private final AppNotificationEmitter appNotificationEmitter;
    private final ApplicationEventPublisher eventPublisher;
    private final PlatformTransactionManager transactionManager;

    /**
     * One weekly pass over ONE user's approved, plan-less, still-prompt-eligible facts.
     * Deliberately NOT {@code @Transactional} — see the class javadoc: each plan opens its own
     * {@code REQUIRES_NEW} transaction in {@link #applyInOwnTx}, so one plan's failure can never
     * roll back another plan's already-committed write.
     */
    public Outcome runFor(UUID userId) {
        List<KnowledgeFactEntity> live = knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId).stream()
                .filter(f -> f.isIncludeInPrompt() && f.getSupersededBy() == null)
                .toList();
        Set<String> blocked = ledgerRepository.findByCreatedByAndDeletedFalse(userId).stream()
                .map(FactMergeLedgerEntity::getMemberKey).collect(Collectors.toCollection(HashSet::new));
        int merged = 0;
        int proposed = 0;
        for (List<KnowledgeFactEntity> chunk : chunksByCategory(live)) {
            if (chunk.size() < 2) {
                continue;
            }
            for (FactMergePlanner.Plan plan : FactMergePlanner.plan(chunk, judge.judge(userId, chunk), blocked)) {
                try {
                    if (applyInOwnTx(userId, plan)) {
                        if (plan instanceof FactMergePlanner.AutoMerge) {
                            merged++;
                        } else {
                            proposed++;
                        }
                    }
                } catch (Exception e) {
                    log.warn("Fact merge plan failed for user {} — the sweep continues", userId, e);
                }
                blocked.add(keyOf(plan));
            }
        }
        notify(userId, merged, proposed);
        return new Outcome(merged, proposed);
    }

    /** Facts grouped by category (a merge never crosses categories — {@code FactMergePlanner}'s
     *  own rule), each group further sliced to at most {@link #CHUNK_SIZE} facts per judge call. */
    private List<List<KnowledgeFactEntity>> chunksByCategory(List<KnowledgeFactEntity> facts) {
        Map<String, List<KnowledgeFactEntity>> byCategory = facts.stream()
                .collect(Collectors.groupingBy(KnowledgeFactEntity::getCategory,
                        LinkedHashMap::new, Collectors.toList()));
        List<List<KnowledgeFactEntity>> chunks = new ArrayList<>();
        for (List<KnowledgeFactEntity> group : byCategory.values()) {
            for (int from = 0; from < group.size(); from += CHUNK_SIZE) {
                chunks.add(group.subList(from, Math.min(from + CHUNK_SIZE, group.size())));
            }
        }
        return chunks;
    }

    /** Opens this plan's own {@code REQUIRES_NEW} transaction — see the class javadoc. */
    private boolean applyInOwnTx(UUID userId, FactMergePlanner.Plan plan) {
        TransactionTemplate own = new TransactionTemplate(transactionManager);
        own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        BooleanSupplier body = () -> apply(userId, plan);
        return Boolean.TRUE.equals(own.execute(status -> body.getAsBoolean()));
    }

    private boolean apply(UUID userId, FactMergePlanner.Plan plan) {
        if (plan instanceof FactMergePlanner.AutoMerge auto) {
            return applyAutoMerge(userId, auto);
        }
        return applyProposal(userId, (FactMergePlanner.Proposal) plan);
    }

    /** Re-reads survivor + losers by id+owner inside THIS transaction — a stale copy from the
     *  work-list read (taken before the judge call, possibly long before this plan's own turn in
     *  the loop) must never be written back. Bails (false, no write at all) if any member is gone,
     *  muted or superseded since the read — another plan in the same run, or a concurrent user
     *  action, may have already touched it. */
    private boolean applyAutoMerge(UUID userId, FactMergePlanner.AutoMerge plan) {
        KnowledgeFactEntity survivor = reread(userId, plan.survivor().getId());
        if (survivor == null) {
            return false;
        }
        List<KnowledgeFactEntity> losers = new ArrayList<>();
        for (KnowledgeFactEntity loserRef : plan.losers()) {
            KnowledgeFactEntity loser = reread(userId, loserRef.getId());
            if (loser == null) {
                return false;
            }
            losers.add(loser);
        }

        Instant now = Instant.now();
        Instant maxReinforcedAt = survivor.getLastReinforcedAt();
        int absorbedReinforcement = 0;
        for (KnowledgeFactEntity loser : losers) {
            absorbedReinforcement += loser.getReinforcementCount();
            if (loser.getLastReinforcedAt() != null
                    && (maxReinforcedAt == null || loser.getLastReinforcedAt().isAfter(maxReinforcedAt))) {
                maxReinforcedAt = loser.getLastReinforcedAt();
            }
            loser.mute(KnowledgeFactEntity.MUTED_MERGED, now);
            loser.setSupersededBy(survivor.getId());
        }
        survivor.setReinforcementCount(survivor.getReinforcementCount() + absorbedReinforcement);
        survivor.setLastReinforcedAt(maxReinforcedAt);

        List<UUID> loserIds = losers.stream().map(KnowledgeFactEntity::getId).toList();
        List<LearnedFactEntity> repointed = learnedFactRepository
                .findByCreatedByAndPromotedFactIdInAndDeletedFalse(userId, loserIds);
        repointed.forEach(candidate -> candidate.setPromotedFactId(survivor.getId()));

        knowledgeFactRepository.save(survivor);
        knowledgeFactRepository.saveAll(losers);
        learnedFactRepository.saveAll(repointed);

        FactMergeLedgerEntity ledger = new FactMergeLedgerEntity();
        ledger.setCreatedBy(userId);
        ledger.setMemberKey(plan.memberKey());
        ledger.setKind(FactMergeLedgerEntity.KIND_AUTO);
        ledgerRepository.save(ledger);

        eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, survivor.getId()));
        losers.forEach(loser -> eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, loser.getId())));
        return true;
    }

    /** Re-reads every member inside THIS transaction (see {@link #applyAutoMerge}'s javadoc);
     *  bails if any is gone, muted or superseded. The source facts themselves are NEVER touched —
     *  a proposal only mints a pending candidate for the user to judge. */
    private boolean applyProposal(UUID userId, FactMergePlanner.Proposal plan) {
        for (KnowledgeFactEntity memberRef : plan.members()) {
            if (reread(userId, memberRef.getId()) == null) {
                return false;
            }
        }

        LearnedFactEntity candidate = new LearnedFactEntity();
        candidate.setCreatedBy(userId);
        candidate.setSource(LearnedFactEntity.SOURCE_MERGE);
        candidate.setCandidateText(plan.sentence());
        candidate.setCategory(plan.category());
        candidate.setOwner(FactOwner.forCategory(plan.category()));
        candidate.setMergeMemberIds(plan.members().stream().map(KnowledgeFactEntity::getId).toList());
        candidate = learnedFactRepository.saveAndFlush(candidate);

        FactMergeLedgerEntity ledger = new FactMergeLedgerEntity();
        ledger.setCreatedBy(userId);
        ledger.setMemberKey(plan.memberKey());
        ledger.setKind(FactMergeLedgerEntity.KIND_PROPOSAL);
        ledger.setLearnedFactId(candidate.getId());
        ledgerRepository.save(ledger);
        return true;
    }

    /** {@code null} unless the fact is still live, still in the prompt, and not superseded. */
    private KnowledgeFactEntity reread(UUID userId, UUID factId) {
        KnowledgeFactEntity fact = knowledgeFactRepository
                .findByIdAndCreatedByAndDeletedFalse(factId, userId).orElse(null);
        if (fact == null || !fact.isIncludeInPrompt() || fact.getSupersededBy() != null) {
            return null;
        }
        return fact;
    }

    private static String keyOf(FactMergePlanner.Plan plan) {
        if (plan instanceof FactMergePlanner.AutoMerge auto) {
            return auto.memberKey();
        }
        return ((FactMergePlanner.Proposal) plan).memberKey();
    }

    /** Nothing when the run did nothing at all — a silent sweep is not news. Otherwise one line
     *  built from whichever half is non-zero, joined with ", " (the {@code KnowledgeRecheckService}
     *  "code decides, the model phrases" posture needs no model here — the copy is fixed). */
    private void notify(UUID userId, int merged, int proposed) {
        if (merged == 0 && proposed == 0) {
            return;
        }
        List<String> parts = new ArrayList<>();
        if (merged > 0) {
            parts.add("%d ismétlést összevontam".formatted(merged));
        }
        if (proposed > 0) {
            parts.add("%d javaslat vár rád".formatted(proposed));
        }
        String body = String.join(", ", parts);
        appNotificationEmitter.emit(userId, AppNotificationKind.FACT_CANDIDATE, "Rendet raktam", body,
                AppNotificationKind.FACT_CANDIDATE.deeplink(), null,
                "fact_merge:" + userId + ":" + LocalDate.now());
    }
}
