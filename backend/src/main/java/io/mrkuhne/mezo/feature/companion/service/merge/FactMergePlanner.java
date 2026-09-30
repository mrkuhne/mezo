package io.mrkuhne.mezo.feature.companion.service.merge;

import io.mrkuhne.mezo.feature.companion.entity.FactMergeLedgerEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.service.merge.FactMergeJudge.JudgedGroup;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * S9 (mezo-d6ivw.10): turns the judge's raw {@link JudgedGroup} answers into decisions — pure,
 * no Spring, no persistence. A {@code same} group becomes an {@link AutoMerge} (a survivor
 * absorbs the losers, no user involved); a {@code combine} group becomes a {@link Proposal} the
 * candidate inbox will offer. Every decision respects the once-ever ledger ({@code blocked}) and
 * keeps each fact in at most one plan per run.
 */
public final class FactMergePlanner {

    private static final String VERDICT_SAME = "same";

    private static final Set<String> MERGEABLE = Set.of(
            KnowledgeFactEntity.SOURCE_CHAT, KnowledgeFactEntity.SOURCE_WEEKLY_REVIEW,
            KnowledgeFactEntity.SOURCE_MANUAL, KnowledgeFactEntity.SOURCE_MERGE);

    static boolean mergeable(KnowledgeFactEntity f) {
        return !f.isPinned() && MERGEABLE.contains(f.getSource());
    }

    static boolean survivorOnly(KnowledgeFactEntity f) {
        return !f.isPinned() && KnowledgeFactEntity.SOURCE_PATTERN.equals(f.getSource());
    }

    static final Comparator<KnowledgeFactEntity> SURVIVOR_FIRST = Comparator
            .comparing((KnowledgeFactEntity f) -> !KnowledgeFactEntity.SOURCE_PATTERN.equals(f.getSource()))
            .thenComparing(KnowledgeFactEntity::getReinforcementCount, Comparator.reverseOrder())
            .thenComparing(KnowledgeFactEntity::getCreatedAt);

    private FactMergePlanner() {
    }

    public sealed interface Plan permits AutoMerge, Proposal {}

    public record AutoMerge(KnowledgeFactEntity survivor, List<KnowledgeFactEntity> losers, String memberKey)
            implements Plan {}

    public record Proposal(List<KnowledgeFactEntity> members, String sentence, String category, String memberKey)
            implements Plan {}

    /** facts = the list the judge saw (indexes are 1-based into it); blocked = ledger keys already used. */
    public static List<Plan> plan(List<KnowledgeFactEntity> facts, List<JudgedGroup> groups, Set<String> blocked) {
        List<Plan> plans = new ArrayList<>();
        Set<UUID> used = new HashSet<>();
        for (JudgedGroup group : groups) {
            List<KnowledgeFactEntity> members = resolveMembers(facts, group);
            if (members == null || alreadyUsed(members, used)) {
                continue;
            }
            String memberKey = FactMergeLedgerEntity.keyOf(memberIds(members));
            if (blocked.contains(memberKey)) {
                continue;
            }
            Plan resolved = VERDICT_SAME.equals(group.verdict())
                    ? planSame(members, memberKey)
                    : planCombine(members, group.sentence(), memberKey);
            if (resolved == null) {
                continue;
            }
            plans.add(resolved);
            used.addAll(memberIds(members));
        }
        return plans;
    }

    private static List<KnowledgeFactEntity> resolveMembers(List<KnowledgeFactEntity> facts, JudgedGroup group) {
        List<Integer> indexes = group.members();
        if (indexes == null) {
            return null;
        }
        Set<Integer> seen = new LinkedHashSet<>();
        List<KnowledgeFactEntity> members = new ArrayList<>();
        for (Integer index : indexes) {
            if (index == null || index < 1 || index > facts.size() || !seen.add(index)) {
                return null;
            }
            members.add(facts.get(index - 1));
        }
        return members;
    }

    private static boolean alreadyUsed(List<KnowledgeFactEntity> members, Set<UUID> used) {
        return members.stream().anyMatch(f -> used.contains(f.getId()));
    }

    private static List<UUID> memberIds(List<KnowledgeFactEntity> members) {
        return members.stream().map(KnowledgeFactEntity::getId).toList();
    }

    private static Plan planSame(List<KnowledgeFactEntity> members, String memberKey) {
        if (!sameCategory(members)) {
            return null;
        }
        long survivorOnlyCount = members.stream().filter(FactMergePlanner::survivorOnly).count();
        if (survivorOnlyCount > 1) {
            return null;
        }
        boolean allEligible = members.stream().allMatch(f -> survivorOnly(f) || mergeable(f));
        if (!allEligible) {
            return null;
        }
        List<KnowledgeFactEntity> sorted = members.stream().sorted(SURVIVOR_FIRST).toList();
        KnowledgeFactEntity survivor = sorted.get(0);
        List<KnowledgeFactEntity> losers = List.copyOf(sorted.subList(1, sorted.size()));
        return new AutoMerge(survivor, losers, memberKey);
    }

    private static Plan planCombine(List<KnowledgeFactEntity> members, String sentence, String memberKey) {
        if (sentence == null || sentence.isBlank()) {
            return null;
        }
        if (!sameCategory(members)) {
            return null;
        }
        if (!members.stream().allMatch(FactMergePlanner::mergeable)) {
            return null;
        }
        // Drift guard (spec S9 delta): a merged sentence is written from ORIGINALS only — a fact
        // that is itself a merge result may absorb exact repeats (same) but never feeds a rewrite.
        if (members.stream().anyMatch(f -> KnowledgeFactEntity.SOURCE_MERGE.equals(f.getSource()))) {
            return null;
        }
        return new Proposal(List.copyOf(members), sentence, members.get(0).getCategory(), memberKey);
    }

    private static boolean sameCategory(List<KnowledgeFactEntity> members) {
        String category = members.get(0).getCategory();
        return members.stream().allMatch(f -> category.equals(f.getCategory()));
    }
}
