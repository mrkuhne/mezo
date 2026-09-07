package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * The konzílium's cross-talk round (mezo-xlvr, spec §6): between the proposal round and the
 * verdict round, every chapter that TWO OR MORE experts touched this week gets a real debate —
 * each involved expert sees its peers' proposals for that chapter (never its own) and takes a
 * stance on them, in its own persona. The stances reach the Integrátor's prompt alongside the
 * Szkeptikus's verdicts; nothing here mutates a proposal, and the Szkeptikus round is untouched.
 *
 * <p>Isolation mirrors {@link KonziliumProposalRound}: a failed or unparseable answer drops only
 * that expert's reactions, never the round. Chapters are visited most-contested first and the
 * round stops at {@link #MAX_CROSS_TALK_CALLS} calls — an uncalled chapter honestly has no
 * reactions rather than a fabricated one.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class KonziliumCrossTalkRound {

    /** The cross-talk prompt's first line — the fake LLM keys its deterministic answer on it. */
    public static final String CROSS_TALK_MARKER = "KARAKTER-KERESZTVITA-FELADAT";

    /** Hard cap on cross-talk LLM calls per conference — the Sunday run must stay bounded. */
    public static final int MAX_CROSS_TALK_CALLS = 6;

    private static final Set<String> VALID_STANCES = Set.of("SUPPORT", "CHALLENGE", "NUANCE");

    private final KonziliumChapterResolver chapterResolver;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;

    /** One reaction as the LLM returns it, before validation. */
    record Draft(Integer index, String stance, String argument) {}

    /** One peer expert's stance on the proposal at {@code index} of the round's flat list. */
    public record Reaction(int index, String expertKey, String stance, String argument) {}

    /** The round's output — empty when nothing was contested or every call failed. */
    public record Result(List<Reaction> reactions) {}

    @Transactional(readOnly = true)
    public Result run(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals) {
        if (proposals.size() < 2) {
            return new Result(List.of());
        }

        Map<String, List<Integer>> byChapter = groupByChapter(owner, proposals);
        List<Map.Entry<String, List<Integer>>> contested = byChapter.entrySet().stream()
                .filter(entry -> distinctExperts(proposals, entry.getValue()).size() >= 2)
                .sorted(Comparator.comparingInt(
                        (Map.Entry<String, List<Integer>> entry) -> distinctExperts(proposals, entry.getValue()).size())
                        .reversed())
                .toList();

        List<Reaction> reactions = new ArrayList<>();
        int calls = 0;
        for (Map.Entry<String, List<Integer>> chapter : contested) {
            for (String expertKey : distinctExperts(proposals, chapter.getValue())) {
                if (calls >= MAX_CROSS_TALK_CALLS) {
                    return new Result(List.copyOf(reactions));
                }
                calls++;
                reactions.addAll(runExpert(owner, weekStart, expertKey, chapter.getKey(),
                        chapter.getValue(), proposals));
            }
        }
        return new Result(List.copyOf(reactions));
    }

    /** Chapter key -> the proposal indexes that belong to it, resolved by the SHARED
     *  {@link KonziliumChapterResolver} the stored thread view uses (mezo-xlvr final review,
     *  M11) — a proposal whose chapter cannot be resolved joins no chapter at all, so it simply
     *  gets no cross-talk, never a wrong one. */
    private Map<String, List<Integer>> groupByChapter(UUID owner, List<ClaimProposal> proposals) {
        KonziliumChapters chapters = chapterResolver.resolve(owner, proposals);
        Map<String, List<Integer>> byChapter = new LinkedHashMap<>();
        for (int i = 0; i < proposals.size(); i++) {
            String chapterKey = chapters.chapterKeyOf(proposals.get(i));
            if (chapterKey != null) {
                byChapter.computeIfAbsent(chapterKey, key -> new ArrayList<>()).add(i);
            }
        }
        return byChapter;
    }

    private static List<String> distinctExperts(List<ClaimProposal> proposals, List<Integer> indexes) {
        Set<String> experts = new LinkedHashSet<>();
        for (int index : indexes) {
            experts.add(proposals.get(index).expertKey());
        }
        return List.copyOf(experts);
    }

    /** One expert's reactions to its PEERS' proposals in one chapter. Any failure here drops
     *  only this expert's reactions. */
    private List<Reaction> runExpert(UUID owner, LocalDate weekStart, String expertKey, String chapterKey,
                                      List<Integer> chapterIndexes, List<ClaimProposal> proposals) {
        List<Integer> peerIndexes = chapterIndexes.stream()
                .filter(index -> !expertKey.equals(proposals.get(index).expertKey()))
                .toList();
        if (peerIndexes.isEmpty()) {
            return List.of();
        }

        String raw;
        try {
            CharacterExpertCatalog.Expert expert = CharacterExpertCatalog.byKey(expertKey);
            String systemPrompt = promptPersona.render(owner,
                    CROSS_TALK_MARKER + "\n" + expert.systemPersona() + "\n" + crossTalkInstruction() + "\n"
                            + outputContract());
            String userMessage = promptPersona.render(owner,
                    userMessage(weekStart, chapterKey, peerIndexes, proposals));
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("character", "crosstalk", "expert", null),
                    () -> companionLlm.complete(systemPrompt, userMessage));
        } catch (Exception e) {
            log.warn("Cross-talk call failed for owner {} expert {} chapter {}", owner, expertKey, chapterKey, e);
            return List.of();
        }
        if (raw == null || raw.isBlank()) {
            log.warn("Cross-talk answer was blank for owner {} expert {} chapter {}", owner, expertKey, chapterKey);
            return List.of();
        }

        List<Draft> drafts;
        try {
            drafts = objectMapper.readValue(stripArrayFences(raw), new TypeReference<List<Draft>>() {});
        } catch (Exception e) {
            log.warn("Cross-talk answer was not parseable JSON for owner {} expert {} — {}", owner, expertKey, raw, e);
            return List.of();
        }

        List<Reaction> reactions = new ArrayList<>();
        // One stance per proposal, as the prompt asks for: a second answer on the same index from
        // the same expert is not a second opinion, it is the model repeating itself — the first
        // one is kept and the rest dropped (mezo-xlvr final review, M1).
        Set<Integer> answered = new LinkedHashSet<>();
        for (Draft draft : drafts) {
            if (draft.index() == null || !peerIndexes.contains(draft.index())) {
                continue;
            }
            if (draft.stance() == null || !VALID_STANCES.contains(draft.stance())) {
                continue;
            }
            if (draft.argument() == null || draft.argument().isBlank()) {
                continue;
            }
            if (!answered.add(draft.index())) {
                continue;
            }
            reactions.add(new Reaction(draft.index(), expertKey, draft.stance(), draft.argument()));
        }
        return reactions;
    }

    private static String crossTalkInstruction() {
        return """
                A heti konzíliumon a saját fejezetedhez MÁS szakértők is tettek javaslatot. \
                Mondd el róluk a szakmai álláspontodat: támogatod, vitatod vagy árnyalod. \
                Egy javaslathoz legfeljebb egy álláspontot adj, és mindig indokold egy mondatban. \
                A saját javaslataidról nem nyilatkozol — azok nincsenek is felsorolva.""";
    }

    private static String outputContract() {
        return """
                Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat és formázás nélkül, pontosan ebben \
                a formában: [{"index":0,"stance":"SUPPORT|CHALLENGE|NUANCE","argument":"..."}]. \
                Az "index" a felsorolt javaslat sorszáma (P0, P1, …).""";
    }

    private static String userMessage(LocalDate weekStart, String chapterKey, List<Integer> peerIndexes,
                                       List<ClaimProposal> proposals) {
        String periodLabel = weekStart != null
                ? "Hét: " + weekStart + " – " + weekStart.plusDays(6)
                : "Teljes eddigi történet";
        StringBuilder sb = new StringBuilder(periodLabel)
                .append("\nFejezet: ").append(chapterKey)
                .append("\nA társak javaslatai ebben a fejezetben:");
        for (int index : peerIndexes) {
            ClaimProposal proposal = proposals.get(index);
            sb.append("\nP").append(index).append(". ")
                    .append(CharacterExpertCatalog.byKey(proposal.expertKey()).displayName())
                    .append(" — ").append(proposal.text())
                    .append(proposal.sensitive() ? " (ÉRZÉKENY)" : "")
                    .append(" indoklás: ").append(proposal.rationale());
        }
        return sb.toString();
    }

    /** Strips optional ```json fences (and surrounding prose) around a JSON ARRAY — same shape
     *  {@link KonziliumVerdictRound} uses for its own array answers. */
    private static String stripArrayFences(String raw) {
        String trimmed = raw.strip();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline > 0) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            int fence = trimmed.lastIndexOf("```");
            if (fence >= 0) {
                trimmed = trimmed.substring(0, fence);
            }
        }
        int start = trimmed.indexOf('[');
        int end = trimmed.lastIndexOf(']');
        return start >= 0 && end > start ? trimmed.substring(start, end + 1) : trimmed.strip();
    }
}
