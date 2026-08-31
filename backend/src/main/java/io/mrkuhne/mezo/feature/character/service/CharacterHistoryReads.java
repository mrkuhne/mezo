package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic, no-LLM history reader for the monthly bootstrap konzílium (Karakter S4,
 * mezo-1gim.6): turns the companion's existing episodic memory (L1 daily narratives, L2
 * confirmed patterns, L3 prompt-eligible facts, plus — S7 widening, mezo-1gim.7 — weekly
 * reviews, journal entries and life events) into per-expert {@link ExpertEvidence} blocks so
 * {@link KonziliumProposalRound#runOnEvidence} can run the SAME per-expert proposal pipeline over
 * a user's whole history instead of a single week's observations.
 *
 * <p>Routing rule:
 * <ul>
 *   <li>daily-summary narratives go to EVERY expert — they are whole-life prose. Capped at the
 *       newest {@value #HISTORY_SUMMARY_CAP} days, one line each:
 *       {@code "<date>: <narrative capped at 300 chars>"}.</li>
 *   <li>a CONFIRMED pattern goes to the expert(s) whose dimension its {@code pairKey} mentions,
 *       via {@link #PATTERN_KEYWORDS} (first matching keyword wins, case-insensitive substring
 *       match against the pair key); unmatched → {@code drill} (the cross-cutting behaviour
 *       expert). Capped at the newest {@value #HISTORY_PATTERN_CAP} patterns (same treatment as
 *       the narrative read above — a CONFIRMED pattern is equally unbounded over time).</li>
 *   <li>a prompt-eligible knowledge fact goes to the expert whose dimension its {@code category}
 *       matches, via {@link #FACT_CATEGORY_EXPERT} (mirrors {@code ck_knowledge_fact_category}:
 *       train|fuel|health|life); unmatched → {@code antropologus} (life context). Capped at the
 *       top {@value #HISTORY_FACT_CAP} facts (by reinforcement count, then newest — the same
 *       ordering {@code KnowledgeFactService.topFactsForPrompt} uses), each fact's text capped at
 *       {@value #FACT_TEXT_CAP_CHARS} chars — {@code includeInPrompt} is persistent, so an
 *       unbounded read here would let a heavy user's fact set blow up the bootstrap prompt.</li>
 *   <li>a {@code weekly_review} row goes to EVERY expert — same whole-life-prose treatment as a
 *       daily-summary narrative. Capped at the newest {@value #HISTORY_WEEKLY_REVIEW_CAP} reviews,
 *       one line each: {@code "<weekStart>: <summary capped at 300 chars>"}.</li>
 *   <li>a journal entry goes to {@code pszichologus} only — it is the emotional-signal source
 *       (mirrors {@link CharacterSignalReads}' own S2 use of the same repository method). Capped
 *       at the newest {@value #HISTORY_JOURNAL_CAP} entries, one line each:
 *       {@code "<occurredOn>: <text capped at 300 chars>"}.</li>
 *   <li>an active {@code LIFE_EVENT} graph node goes to {@code antropologus} only — life context
 *       is its dimension. Capped at the newest {@value #HISTORY_LIFE_EVENT_CAP} nodes, one line
 *       each: the node's title, capped at {@value #LIFE_EVENT_TEXT_CAP_CHARS} chars.</li>
 * </ul>
 * Every line carries the source row's real id in {@code refIds} as {@code "<kind>:<uuid>"}.
 *
 * <p>Dependency-direction note (S7, mezo-1gim.7): this class now also depends on
 * {@code feature.proactive} ({@link WeeklyReviewRepository}) and {@code feature.journal}
 * ({@link JournalEntryRepository}, already imported by {@link CharacterSignalReads} for the S2
 * detector). Neither {@code proactive} nor {@code journal} depends on {@code character}, so
 * {@code character → proactive} / {@code character → journal} are BRAND NEW one-directional
 * edges, not the closing leg of an existing cycle — unlike {@code companion → proactive}, which
 * DOES close a cycle (proactive already depends on companion) and is why {@code
 * feature.companion.WeekReviewSource} exists as a port. A direct repository import here is
 * therefore safe and is what {@code ArchitectureTest#feature_slices_are_cycle_free} enforces.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class CharacterHistoryReads {

    /** Newest N daily summaries carried into the history evidence — whole-life prose is cheap per
     *  line but adds up; this caps the monthly bootstrap prompt to a sane size. */
    static final int HISTORY_SUMMARY_CAP = 60;

    private static final int NARRATIVE_CAP_CHARS = 300;

    /** Newest N CONFIRMED patterns carried into the history evidence (final-review Finding M6) —
     *  mirrors {@link #HISTORY_SUMMARY_CAP}'s treatment of narratives: a CONFIRMED pattern has no
     *  natural upper bound either, so an unbounded read here would let a heavy user's pattern set
     *  blow up the bootstrap prompt the same way an uncapped fact read would. */
    static final int HISTORY_PATTERN_CAP = 60;

    /** Top-N prompt-eligible knowledge facts carried into the history evidence, ordered by
     *  reinforcement count then newest (same ordering the repository method's other caller,
     *  {@code KnowledgeFactService.topFactsForPrompt}, uses before anything reaches a prompt).
     *  {@code includeInPrompt} is a persistent flag with no natural upper bound, so this read is
     *  capped the same deterministic way the narrative read is — a local default rather than
     *  {@code CompanionProperties.Facts.topN()} to avoid a cross-feature config dependency. */
    static final int HISTORY_FACT_CAP = 40;

    /** Per-fact text cap (chars) — mirrors {@link #NARRATIVE_CAP_CHARS}'s treatment of narratives. */
    private static final int FACT_TEXT_CAP_CHARS = 300;

    /** Newest N {@code weekly_review} rows carried into the history evidence — same rationale as
     *  {@link #HISTORY_SUMMARY_CAP}: whole-life prose with no natural upper bound. A weekly
     *  review is generated at most once a week, so this cap (over a year's worth) is generous
     *  in practice but still documented and enforced the same deterministic way. */
    static final int HISTORY_WEEKLY_REVIEW_CAP = 60;

    /** Newest N journal entries carried into the history evidence — mirrors
     *  {@link #HISTORY_SUMMARY_CAP}'s treatment of narratives: free prose with no natural upper
     *  bound, routed to a single expert rather than fanned out to every one. */
    static final int HISTORY_JOURNAL_CAP = 60;

    /** Per-journal-entry text cap (chars) — mirrors {@link #NARRATIVE_CAP_CHARS}. */
    private static final int JOURNAL_TEXT_CAP_CHARS = 300;

    /** Newest N active {@code LIFE_EVENT} graph nodes carried into the history evidence — capped
     *  the same deterministic way the other unbounded-over-time sources are, even though life
     *  events are naturally sparser than daily narratives or journal entries. */
    static final int HISTORY_LIFE_EVENT_CAP = 40;

    /** Per-life-event title cap (chars) — mirrors {@link #NARRATIVE_CAP_CHARS}; {@code
     *  GraphNodeEntity.title} is already DB-bounded to 120 chars, but the cap is applied the same
     *  way as every other source for consistency. */
    private static final int LIFE_EVENT_TEXT_CAP_CHARS = 300;

    /** Practical "since forever" floor for the narrative read — {@link LocalDate#MIN} overflows
     *  postgres's {@code date} range (4713 BC..294276 AD, but the JDBC/text round-trip chokes on
     *  proleptic-Gregorian years this extreme); the app has no data anywhere near this old. */
    private static final LocalDate EPOCH_FLOOR = LocalDate.of(1970, 1, 1);

    /** Explicit keyword → expert routing for a CONFIRMED pattern's {@code pairKey} (case-insensitive
     *  substring match; iteration order is the priority order, first match wins). */
    private static final Map<String, String> PATTERN_KEYWORDS = new LinkedHashMap<>();
    static {
        PATTERN_KEYWORDS.put("sleep", "szomnologus");
        PATTERN_KEYWORDS.put("recovery", "szomnologus");
        PATTERN_KEYWORDS.put("rpe", "edzo");
        PATTERN_KEYWORDS.put("training", "edzo");
        PATTERN_KEYWORDS.put("workout", "edzo");
        PATTERN_KEYWORDS.put("strength", "edzo");
        PATTERN_KEYWORDS.put("nutrition", "taplalkozo");
        PATTERN_KEYWORDS.put("meal", "taplalkozo");
        PATTERN_KEYWORDS.put("macro", "taplalkozo");
        PATTERN_KEYWORDS.put("calorie", "taplalkozo");
        PATTERN_KEYWORDS.put("weight", "doki");
        PATTERN_KEYWORDS.put("body", "doki");
        PATTERN_KEYWORDS.put("health", "doki");
        PATTERN_KEYWORDS.put("mood", "pszichologus");
        PATTERN_KEYWORDS.put("stress", "pszichologus");
        PATTERN_KEYWORDS.put("journal", "pszichologus");
    }

    /** Explicit category → expert routing for a prompt-eligible knowledge fact. Mirrors
     *  {@code ck_knowledge_fact_category} (train|fuel|health|life) exactly, so nothing is ever
     *  actually unmatched today — the fallback exists for a future category. */
    private static final Map<String, String> FACT_CATEGORY_EXPERT = Map.of(
            "train", "edzo",
            "fuel", "taplalkozo",
            "health", "doki",
            "life", "antropologus");

    private static final String FALLBACK_PATTERN_EXPERT = "drill";
    private static final String FALLBACK_FACT_EXPERT = "antropologus";

    private final DailySummaryRepository dailySummaryRepository;
    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final WeeklyReviewRepository weeklyReviewRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final GraphNodeRepository graphNodeRepository;

    /** Exposed for the routing-coverage IT ({@code CharacterHistoryReadsIT}, S4-review follow-up,
     *  mezo-1gim.7): an immutable view of {@link #PATTERN_KEYWORDS} so the test can parameterize
     *  over EVERY entry instead of a hand-picked subset. */
    public static Map<String, String> patternKeywordRouting() {
        return Map.copyOf(PATTERN_KEYWORDS);
    }

    /** Exposed for the routing-coverage IT, same rationale as {@link #patternKeywordRouting()}. */
    public static Map<String, String> factCategoryRouting() {
        return FACT_CATEGORY_EXPERT;
    }

    /** Builds one {@link ExpertEvidence} per expert that has any evidence — empty list when the
     *  user has no history yet. */
    @Transactional
    public List<ExpertEvidence> gatherHistory(UUID owner) {
        Map<String, List<String>> linesByExpert = new LinkedHashMap<>();
        Map<String, List<String>> refIdsByExpert = new LinkedHashMap<>();

        addNarratives(owner, linesByExpert, refIdsByExpert);
        addPatterns(owner, linesByExpert, refIdsByExpert);
        addFacts(owner, linesByExpert, refIdsByExpert);
        addWeeklyReviews(owner, linesByExpert, refIdsByExpert);
        addJournalEntries(owner, linesByExpert, refIdsByExpert);
        addLifeEvents(owner, linesByExpert, refIdsByExpert);

        List<ExpertEvidence> evidence = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : linesByExpert.entrySet()) {
            evidence.add(new ExpertEvidence(entry.getKey(), entry.getValue(), refIdsByExpert.get(entry.getKey())));
        }
        return evidence;
    }

    private void addNarratives(UUID owner, Map<String, List<String>> linesByExpert,
                                Map<String, List<String>> refIdsByExpert) {
        List<DailySummaryEntity> summaries = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(owner, EPOCH_FLOOR);
        List<DailySummaryEntity> capped =
                summaries.size() > HISTORY_SUMMARY_CAP ? summaries.subList(0, HISTORY_SUMMARY_CAP) : summaries;
        for (DailySummaryEntity summary : capped) {
            String line = summary.getSummaryDate() + ": " + cap(summary.getNarrative(), NARRATIVE_CAP_CHARS);
            String refId = "daily-summary:" + summary.getId();
            for (CharacterExpertCatalog.Expert expert : CharacterExpertCatalog.EXPERTS) {
                append(linesByExpert, refIdsByExpert, expert.key(), line, refId);
            }
        }
    }

    private void addPatterns(UUID owner, Map<String, List<String>> linesByExpert,
                              Map<String, List<String>> refIdsByExpert) {
        List<PatternEntity> confirmed = patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(owner, PatternEntity.STATUS_CONFIRMED);
        List<PatternEntity> capped =
                confirmed.size() > HISTORY_PATTERN_CAP ? confirmed.subList(0, HISTORY_PATTERN_CAP) : confirmed;
        for (PatternEntity pattern : capped) {
            String expertKey = routeByKeyword(pattern.getPairKey(), PATTERN_KEYWORDS, FALLBACK_PATTERN_EXPERT);
            String line = pattern.getTitle() + " (" + pattern.getPairKey() + ")";
            String refId = "pattern:" + pattern.getId();
            append(linesByExpert, refIdsByExpert, expertKey, line, refId);
        }
    }

    private void addFacts(UUID owner, Map<String, List<String>> linesByExpert,
                           Map<String, List<String>> refIdsByExpert) {
        List<KnowledgeFactEntity> facts = knowledgeFactRepository
                .findByCreatedByAndIncludeInPromptTrueAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
                        owner, PageRequest.of(0, HISTORY_FACT_CAP));
        for (KnowledgeFactEntity fact : facts) {
            String expertKey = FACT_CATEGORY_EXPERT.getOrDefault(fact.getCategory(), FALLBACK_FACT_EXPERT);
            String refId = "knowledge-fact:" + fact.getId();
            append(linesByExpert, refIdsByExpert, expertKey, cap(fact.getFactText(), FACT_TEXT_CAP_CHARS), refId);
        }
    }

    private void addWeeklyReviews(UUID owner, Map<String, List<String>> linesByExpert,
                                   Map<String, List<String>> refIdsByExpert) {
        List<WeeklyReviewEntity> reviews = weeklyReviewRepository
                .findByCreatedByAndWeekStartGreaterThanEqualOrderByWeekStartDesc(owner, EPOCH_FLOOR);
        List<WeeklyReviewEntity> capped =
                reviews.size() > HISTORY_WEEKLY_REVIEW_CAP ? reviews.subList(0, HISTORY_WEEKLY_REVIEW_CAP) : reviews;
        for (WeeklyReviewEntity review : capped) {
            String line = review.getWeekStart() + ": " + cap(review.getSummary(), NARRATIVE_CAP_CHARS);
            String refId = "weekly-review:" + review.getId();
            for (CharacterExpertCatalog.Expert expert : CharacterExpertCatalog.EXPERTS) {
                append(linesByExpert, refIdsByExpert, expert.key(), line, refId);
            }
        }
    }

    private void addJournalEntries(UUID owner, Map<String, List<String>> linesByExpert,
                                    Map<String, List<String>> refIdsByExpert) {
        List<JournalEntryEntity> entries = journalEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        owner, EPOCH_FLOOR, LocalDate.now());
        List<JournalEntryEntity> capped =
                entries.size() > HISTORY_JOURNAL_CAP ? entries.subList(0, HISTORY_JOURNAL_CAP) : entries;
        for (JournalEntryEntity entry : capped) {
            String line = entry.getOccurredOn() + ": " + cap(entry.getText(), JOURNAL_TEXT_CAP_CHARS);
            String refId = "journal:" + entry.getId();
            append(linesByExpert, refIdsByExpert, "pszichologus", line, refId);
        }
    }

    private void addLifeEvents(UUID owner, Map<String, List<String>> linesByExpert,
                                Map<String, List<String>> refIdsByExpert) {
        List<GraphNodeEntity> events = graphNodeRepository
                .findByCreatedByAndKindAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                        owner, GraphNodeEntity.KIND_LIFE_EVENT, GraphNodeEntity.STATUS_ACTIVE);
        List<GraphNodeEntity> capped =
                events.size() > HISTORY_LIFE_EVENT_CAP ? events.subList(0, HISTORY_LIFE_EVENT_CAP) : events;
        for (GraphNodeEntity event : capped) {
            String line = cap(event.getTitle(), LIFE_EVENT_TEXT_CAP_CHARS);
            String refId = "life-event:" + event.getId();
            append(linesByExpert, refIdsByExpert, "antropologus", line, refId);
        }
    }

    private static String routeByKeyword(String haystack, Map<String, String> keywords, String fallback) {
        if (haystack == null) {
            return fallback;
        }
        String lower = haystack.toLowerCase(Locale.ROOT);
        for (Map.Entry<String, String> entry : keywords.entrySet()) {
            if (lower.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return fallback;
    }

    private static void append(Map<String, List<String>> linesByExpert, Map<String, List<String>> refIdsByExpert,
                                String expertKey, String line, String refId) {
        linesByExpert.computeIfAbsent(expertKey, k -> new ArrayList<>()).add(line);
        refIdsByExpert.computeIfAbsent(expertKey, k -> new ArrayList<>()).add(refId);
    }

    private static String cap(String text, int max) {
        if (text == null) {
            return "";
        }
        return text.length() > max ? text.substring(0, max) : text;
    }
}
