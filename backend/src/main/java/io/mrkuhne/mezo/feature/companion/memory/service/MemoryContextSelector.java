package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Greedy stable selection with duplicate, source-conversation and exact token-budget bounds. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryContextSelector {

    private static final int CHARS_PER_TOKEN = 3;
    private static final int MAX_ITEMS_PER_CHAT_SOURCE = 2;

    private final MemoryContextRenderer renderer;

    public List<FusedCandidate> select(List<FusedCandidate> ranked, int maxTokenBudget) {
        return select(ranked, maxTokenBudget, null);
    }

    public List<FusedCandidate> select(
            List<FusedCandidate> ranked, int maxTokenBudget, LocalDate asOf) {
        int maxChars = Math.max(0, maxTokenBudget) * CHARS_PER_TOKEN;
        int usedChars = MemoryContextRenderer.headerLength();
        List<FusedCandidate> selected = new ArrayList<>();
        Map<Object, Integer> chatSourceCounts = new HashMap<>();

        for (int index = 0; index < ranked.size(); index++) {
            FusedCandidate candidate = ranked.get(index);
            if (selected.contains(candidate)) {
                continue;
            }
            if (candidate.candidate().conflictingWithId() != null) {
                List<FusedCandidate> pair = conflictPair(ranked, index, selected);
                int pairChars = pair.stream().mapToInt(item -> renderer.candidateLineLength(item, asOf)).sum();
                if (!pair.isEmpty() && usedChars + pairChars <= maxChars) {
                    for (FusedCandidate member : pair) {
                        if (!selected.contains(member)) {
                            selected.add(member);
                            usedChars += renderer.candidateLineLength(member, asOf);
                            incrementChatSource(member, chatSourceCounts);
                        }
                    }
                }
                continue;
            }
            if ((!candidate.candidate().conflicting() && isNearDuplicate(candidate, selected))
                    || exceedsChatSourceCap(candidate, chatSourceCounts)) {
                continue;
            }
            int lineChars = renderer.candidateLineLength(candidate, asOf);
            if (usedChars + lineChars > maxChars) {
                continue;
            }
            selected.add(candidate);
            usedChars += lineChars;
            incrementChatSource(candidate, chatSourceCounts);
        }
        return List.copyOf(selected);
    }

    private static List<FusedCandidate> conflictPair(
            List<FusedCandidate> ranked, int index, List<FusedCandidate> selected) {
        FusedCandidate seed = ranked.get(index);
        List<FusedCandidate> pair = new ArrayList<>();
        if (!selected.contains(seed)) {
            pair.add(seed);
        }
        ranked.stream()
                .filter(item -> item.candidate().stableId().equals(seed.candidate().conflictingWithId()))
                .filter(item -> !selected.contains(item))
                .findFirst()
                .ifPresent(pair::add);
        return pair.size() == 2 ? pair : List.of();
    }

    private static boolean isNearDuplicate(FusedCandidate candidate, List<FusedCandidate> selected) {
        Set<String> candidateTokens = tokens(candidate.candidate().content());
        return selected.stream().filter(item -> !item.candidate().conflicting()).anyMatch(item -> {
            Set<String> existingTokens = tokens(item.candidate().content());
            if (candidateTokens.equals(existingTokens)) {
                return true;
            }
            Set<String> intersection = new HashSet<>(candidateTokens);
            intersection.retainAll(existingTokens);
            Set<String> union = new HashSet<>(candidateTokens);
            union.addAll(existingTokens);
            return !union.isEmpty() && intersection.size() / (double) union.size() >= 0.80;
        });
    }

    private static Set<String> tokens(String content) {
        String normalized = ToolText.fold(content == null ? "" : content)
                .replaceAll("[^a-z0-9]+", " ").trim();
        return normalized.isBlank() ? Set.of() : new HashSet<>(Arrays.asList(normalized.split(" +")));
    }

    private static boolean exceedsChatSourceCap(FusedCandidate candidate, Map<Object, Integer> counts) {
        return "chat_turn".equals(candidate.candidate().sourceKind())
                && counts.getOrDefault(diversityKey(candidate), 0) >= MAX_ITEMS_PER_CHAT_SOURCE;
    }

    private static void incrementChatSource(FusedCandidate candidate, Map<Object, Integer> counts) {
        if ("chat_turn".equals(candidate.candidate().sourceKind())) {
            counts.merge(diversityKey(candidate), 1, Integer::sum);
        }
    }

    private static Object diversityKey(FusedCandidate candidate) {
        return candidate.candidate().diversityGroupId() != null
                ? candidate.candidate().diversityGroupId() : candidate.candidate().sourceId();
    }
}
