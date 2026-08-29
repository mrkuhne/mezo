package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.WeeklyLessonResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "A hét tanulságai" (mezo-d20.7.6, handoff §6.2) — the weekly round's write into the SAME
 * candidate flow chat extraction feeds ({@code learned_fact} → user decision →
 * {@code knowledge_fact}), plus the closed-week read behind
 * {@code GET /api/proactive/weekly-review/{start}/lessons}.
 *
 * <p>Three disciplines carried over from {@code FactExtractionService}, deliberately:
 * <ul>
 *   <li><b>bounds-check</b> — blank/over-long text and unknown categories are dropped, exactly
 *       like the model-selected anchor indexes are bounds-checked against the code-collected
 *       candidate list;</li>
 *   <li><b>dedupe</b> — the same {@code trim().toLowerCase()} + whitespace-collapse normalisation,
 *       filtered against the confirmed facts, EVERY existing candidate (not just the open ones —
 *       the design promises "amit elvetsz, nem kérdezi újra", so a rejected lesson must not come
 *       back next Monday) and the current batch;</li>
 *   <li><b>a per-round ceiling</b> — the extraction's {@code max-candidates-per-turn}, reused as
 *       the per-week cap rather than minting a second knob for the same idea.</li>
 * </ul>
 *
 * <p>Two deliberate NON-behaviours: a weekly duplicate of a confirmed fact does <b>not</b>
 * reinforce it (the chat path does — but there the user re-stated the fact themselves; here the
 * model merely restated the code's own data, which is not a re-confirmation), and no
 * {@code FACT_CANDIDATE} notification is emitted — Monday's {@code WEEKLY_REVIEW_READY} already
 * fired, and the count shows on the Heti tile and the Tudástár inbox counter.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class WeeklyLessonService {

    /** Mirrors ck_learned_fact_category / ck_knowledge_fact_category. */
    private static final Set<String> CATEGORIES = Set.of("train", "fuel", "health", "life");

    /** A lesson longer than this is prose, not a fact — dropped, never truncated into a half-claim. */
    private static final int MAX_TEXT_LENGTH = 500;

    /** The evidence line is a UI chip row; an essay in that slot is dropped to null (the field is
     *  nullable BECAUSE unknown provenance stays unknown — the candidate itself still stands). */
    private static final int MAX_EVIDENCE_LENGTH = 300;

    private final LearnedFactRepository learnedFactRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final CompanionProperties companionProperties;
    private final ProactiveMapper mapper;

    /** One model-proposed lesson, already parsed out of the weekly answer. */
    public record LessonProposal(String text, String category, String evidence) {
    }

    /** The week's candidates, decided or not, newest first — the closed-week read. */
    public List<WeeklyLessonResponse> list(UUID userId, LocalDate weekStart) {
        return learnedFactRepository
                .findByCreatedByAndWeekStartAndDeletedFalseOrderByCreatedAtDesc(userId, weekStart)
                .stream()
                .map(mapper::toWeeklyLessonResponse)
                .toList();
    }

    /**
     * Persists the survivors as undecided weekly candidates; returns how many were written.
     * Nothing usable ⇒ nothing written (the generator's own no-placeholder rule).
     */
    @Transactional
    public int propose(UUID userId, LocalDate weekStart, List<LessonProposal> proposals) {
        if (proposals == null || proposals.isEmpty()) {
            return 0;
        }
        Set<String> known = new HashSet<>();
        knowledgeFactRepository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)
                .stream().map(KnowledgeFactEntity::getFactText).map(WeeklyLessonService::normalize)
                .forEach(known::add);
        learnedFactRepository.findByCreatedByAndDeletedFalse(userId)
                .stream().map(LearnedFactEntity::getCandidateText).map(WeeklyLessonService::normalize)
                .forEach(known::add);

        int cap = companionProperties.extraction().maxCandidatesPerTurn();
        int persisted = 0;
        for (LessonProposal proposal : proposals) {
            if (persisted >= cap) {
                break;
            }
            if (proposal == null || proposal.text() == null || proposal.text().isBlank()
                    || !CATEGORIES.contains(proposal.category())) {
                continue;
            }
            String text = proposal.text().trim();
            if (text.length() > MAX_TEXT_LENGTH) {
                log.debug("Weekly lesson dropped — {} chars is prose, not a fact", text.length());
                continue;
            }
            if (!known.add(normalize(text))) {
                continue; // already confirmed, already offered, or a duplicate inside this batch
            }
            LearnedFactEntity candidate = new LearnedFactEntity();
            candidate.setCreatedBy(userId);
            candidate.setCandidateText(text);
            candidate.setCategory(proposal.category());
            candidate.setSource(LearnedFactEntity.SOURCE_WEEKLY_REVIEW);
            candidate.setWeekStart(weekStart);
            candidate.setEvidence(evidenceOrNull(proposal.evidence()));
            learnedFactRepository.saveAndFlush(candidate);
            persisted++;
        }
        return persisted;
    }

    /**
     * Regeneration policy (handoff §6.2/4): the DECIDED candidates of the week are never touched —
     * the user's decision (and any knowledge fact it minted) must survive a re-run — while the
     * still-open ones are archived together with the review row they were proposed alongside, so
     * the fresh round starts from a clean, non-duplicated slate.
     */
    @Transactional
    public int archiveOpen(UUID userId, LocalDate weekStart) {
        List<LearnedFactEntity> open = learnedFactRepository
                .findByCreatedByAndWeekStartAndUserDecisionIsNullAndDeletedFalse(userId, weekStart);
        open.forEach(learnedFactRepository::delete); // @SQLDelete — soft, like the review row
        return open.size();
    }

    private static String evidenceOrNull(String evidence) {
        if (evidence == null || evidence.isBlank() || evidence.trim().length() > MAX_EVIDENCE_LENGTH) {
            return null;
        }
        return evidence.trim();
    }

    private static String normalize(String text) {
        return text.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}
