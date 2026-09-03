package io.mrkuhne.mezo.feature.companion.quarterly.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphProposedEdge;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.quarterly.config.QuarterlyProperties;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * W5.3 quarterly deep pass (bd mezo-b3pp.20, spec §9.3): ONE smart-tier pass per quarter that
 * reads the just-finished quarter's {@code period_summary} month rungs against the previous
 * quarter's, plus the W4.2 feedback rollups, and proposes 0..N {@code SEASON} **candidates**.
 * Nothing here ever becomes active (IDENT-6): {@code LifeEventCandidateService.decide} — the
 * existing L2 confirm inbox, which is kind-agnostic — remains the only path from a proposal to
 * durable graph structure. A season proposes NO edges ({@code meta.proposedEdges} is empty): a
 * season is a reading of a period, not a causal claim.
 *
 * <p><b>Smart tier, deliberately.</b> The consolidation ladder condenses on the cheap tier
 * because it only shortens prose; this pass genuinely SYNTHESISES across two quarters, which is
 * exactly the weekly/quarterly case spec §11 reserves the smart tier for (the memoir/profile
 * precedent).
 *
 * <p><b>Two gates, both before any spend:</b> (1) the quarter already processed — {@link
 * GraphNodeRepository#countQuarterlyNodesOnQuarter} counts soft-deleted rows too, so a rejected
 * quarter is never re-proposed; (2) the quarter carries no month rungs at all — a quarter with
 * nothing consolidated in it costs no LLM call. A MISSING PREVIOUS quarter is NOT a gate: the
 * first quarter of a history still deserves a season reading, the prompt just says honestly that
 * there is nothing to compare it against.
 *
 * <p>IDENT-3: a failed, empty or unparseable model answer means zero candidates, logged and
 * swallowed — never an exception out of {@link #runFor}. The same holds for the persistence side:
 * {@link #runFor} carries no {@code @Transactional} (each quarterly call for a user is its own
 * unit of work), so the writes are pulled into {@link #persistCandidates} and invoked through
 * {@link #self}, the injected proxy — plain {@code this} self-invocation bypasses the proxy and
 * gets no transactional advice at all (the {@code LifeEventExtractionService} idiom). That one
 * transaction covers every candidate the quarter proposes: a persistence failure on suggestion N
 * rolls back 1..N too, so the quarter ends with zero candidates rather than a half-written one
 * and the gate then still finds nothing, leaving the quarter cleanly re-runnable.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class QuarterlyReviewService {

    /** Dispatch key for FakeCompanionLlm (the {@code EXTRACTOR_MARKER} idiom). */
    public static final String SEASON_MARKER = "NEGYEDEVES-SZEZON-FELADAT";

    /** {@code knowledge_node.source_kind} for everything this service writes. MUST stay equal to
     *  the literal in {@link GraphNodeRepository#countQuarterlyNodesOnQuarter}'s native query. */
    public static final String SOURCE_QUARTERLY = "quarterly";

    private static final String SYSTEM_PROMPT = SEASON_MARKER + """


        Te {{NÉV}} személyes társának a negyedéves olvasata vagy. Bemenet: a most lezárult
        negyedév havi összefoglalói, az azt megelőző negyedévé, és az AI-felületek
        visszajelzés-statisztikái. Feladat: megnevezni, MILYEN SZEZON volt ez a negyedév —
        egy-egy visszatérő ív, ami a hónapokon átnyúlik, és amit az előző negyedévhez képest
        látni lehet.

        Egy szezon nem esemény és nem tanács: a periódus olvasata.

        Válasz KIZÁRÓLAG JSON tömb, magyarázat nélkül:
        [{"title": "rövid magyar cím", "summary": "2-3 mondat, múlt idő"}]

        - Legfeljebb %d szezont javasolj; ha a negyedév nem áll össze ilyenné, a válasz: []
        - Csak a megadott szövegekre támaszkodj, semmit ne találj ki
        - Ne szólítsd meg őt, és ne adj javaslatot a jövőre
        """;

    private final CompanionLlm companionLlm;
    private final GraphService graphService;
    private final GraphNodeRepository nodeRepository;
    private final PeriodSummaryRepository periodSummaryRepository;
    private final FeedbackRollupRepository feedbackRollupRepository;
    private final QuarterlyProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final PromptPersona promptPersona;
    // Self-injected proxy (ObjectProvider defers resolution, so this is safe despite the apparent
    // circularity) — see the class javadoc for why persistCandidates is invoked through this
    // proxy instead of `this`.
    private final ObjectProvider<QuarterlyReviewService> self;

    /**
     * @param quarterStart the first day of the quarter being reviewed (see {@link Quarters}).
     * @return how many SEASON candidates were created (0 on either gate, on an empty answer, on
     *     any model/parse failure, or — atomically — on any candidate-persistence failure).
     */
    public int runFor(UUID userId, LocalDate quarterStart) {
        if (nodeRepository.countQuarterlyNodesOnQuarter(userId, quarterStart) > 0) {
            return 0;   // already processed (accepted, pending, or rejected) — never re-proposed
        }
        List<PeriodSummaryEntity> current = monthRungs(userId, quarterStart);
        if (current.isEmpty()) {
            log.debug("No month rungs in quarter {} for {} — no quarterly pass", quarterStart, userId);
            return 0;   // emptiness gate — an unconsolidated quarter costs no LLM call
        }
        List<PeriodSummaryEntity> previous = monthRungs(userId, Quarters.previous(quarterStart));
        List<SeasonSuggestion> suggestions;
        try {
            String prompt = promptPersona.render(userId, SYSTEM_PROMPT.formatted(properties.maxCandidates()));
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("companion_quarterly", "season_candidates", "quarter", null),
                () -> companionLlm.completeSmart(prompt, buildUserMessage(userId, quarterStart, current, previous)));
            suggestions = parse(raw).stream()
                .filter(Objects::nonNull)
                .filter(s -> s.title() != null && !s.title().isBlank())
                .limit(properties.maxCandidates())
                .toList();
        } catch (Exception e) {
            log.warn("Quarterly season proposal failed for {} on {}", userId, quarterStart, e);
            return 0;
        }
        if (suggestions.isEmpty()) {
            return 0;
        }
        try {
            return self.getObject().persistCandidates(userId, quarterStart, suggestions);
        } catch (Exception e) {
            log.warn("Quarterly candidate persistence failed for {} on {} — degrading to zero so "
                + "the quarter stays reprocessable", userId, quarterStart, e);
            return 0;
        }
    }

    /** Every proposal of the quarter, in ONE transaction (see the class javadoc). Called only
     *  through {@link #self} — plain {@code this} self-invocation gets no transactional advice. */
    @Transactional
    public int persistCandidates(UUID userId, LocalDate quarterStart, List<SeasonSuggestion> suggestions) {
        int created = 0;
        for (SeasonSuggestion suggestion : suggestions) {
            graphService.createCandidate(userId, GraphNodeEntity.KIND_SEASON,
                truncateTitle(suggestion.title().strip()), suggestion.summary(),
                SOURCE_QUARTERLY, quarterStart, Map.of(GraphProposedEdge.META_KEY, List.of()));
            created++;
        }
        return created;
    }

    private List<PeriodSummaryEntity> monthRungs(UUID userId, LocalDate quarterStart) {
        return periodSummaryRepository
            .findByCreatedByAndGranularityAndPeriodStartBetweenOrderByPeriodStartAsc(
                userId, PeriodSummaryEntity.GRANULARITY_MONTH, quarterStart, Quarters.endOf(quarterStart))
            .stream()
            .limit(properties.maxPeriodLines())
            .toList();
    }

    /**
     * Pure-code gather — the two quarters side by side, then the feedback rollups. Honest about
     * absence: a quarter with no rungs renders the sentence rather than an empty heading.
     *
     * <p>Package-private, not private, on purpose (the {@code ProfileAssembler#renderPayload}
     * precedent): {@code QuarterlyReviewPayloadIT} asserts the rendered headings directly, so the
     * prompt's own wording is pinned without a public seam existing only for tests.
     */
    String buildUserMessage(UUID userId, LocalDate quarterStart,
            List<PeriodSummaryEntity> current, List<PeriodSummaryEntity> previous) {
        LocalDate previousStart = Quarters.previous(quarterStart);
        StringBuilder sb = new StringBuilder();
        sb.append("EZ A NEGYEDÉV (").append(Quarters.label(quarterStart)).append("):\n");
        appendRungs(sb, current);
        sb.append("\nAZ ELŐZŐ NEGYEDÉV (").append(Quarters.label(previousStart)).append("):\n");
        if (previous.isEmpty()) {
            sb.append("- nincs adat, ez az első ilyen negyedév\n");
        } else {
            appendRungs(sb, previous);
        }
        appendFeedback(sb, userId);
        return sb.toString();
    }

    /**
     * The feedback rollups, WITH THEIR WINDOW SPELLED OUT (mezo-b3pp.20 final review, F3).
     *
     * <p>Everything else in this payload is quarter-wide, and the prompt's own frame is "this
     * quarter against the previous one" plus {@code Csak a megadott szövegekre támaszkodj} — so an
     * undisclosed window here is read by the model as quarter-wide evidence. It is not:
     * {@code feedback_rollup} rows are a TRAILING window (default {@code
     * mezo.companion.feedback-learning.window-days: 30}) that the nightly job overwrites, so at
     * 04:00 on the 1st they describe roughly the quarter's LAST MONTH. A quiet July and August
     * followed by a rough September would otherwise be handed to the model as if September's 9
     * 👎 characterised the whole quarter — and that reading would become a durable SEASON
     * candidate.
     *
     * <p>The number is RENDERED from {@code FeedbackRollupEntity.windowDays}, not hardcoded — the
     * window is a config knob, and a heading that lies about it is the same class of bug. The rows
     * are keyed by {@code (created_by, scope, window_days)}, so a window change can leave rows
     * from two windows side by side; in that case the heading cannot name one window for all of
     * them and each line carries its own instead.
     *
     * <p><b>This deliberately DIVERGES from {@code ProfileAssembler.renderPayload} (mezo-b3pp.35,
     * item 3), not agrees with it.</b> The profile filters to the ONE currently-configured window
     * ({@code findByCreatedByAndWindowDaysAndDeletedFalseOrderByScopeAsc}) and names that one
     * window in a single header, because it needs a single trustworthy count
     * ({@code feedbackSignals}) for its honest-absence gate — a stale second window would inflate
     * that count. This method instead reads EVERY row unfiltered
     * ({@code findByCreatedByAndDeletedFalseOrderByScopeAsc}), because a quarterly retrospective
     * has no such gate to protect and dropping a retired window's rows would silently erase real
     * quarter-old evidence; the per-row window label below is how it stays honest about coexisting
     * windows instead. Two legitimate resolutions of the same "windows can change under you"
     * problem, not one bug and one echo of it — after a window-days change, seeing
     * {@code surface:chat_message} twice with two different window labels in a quarterly payload
     * is this method working as designed, not the profile's window filter leaking.
     */
    private void appendFeedback(StringBuilder sb, UUID userId) {
        List<FeedbackRollupEntity> rows = feedbackRollupRepository
            .findByCreatedByAndDeletedFalseOrderByScopeAsc(userId).stream()
            .filter(r -> r.getStats() != null && r.getStats().total() != null && r.getStats().total() > 0)
            .toList();
        if (rows.isEmpty()) {
            return;
        }
        List<Integer> windows = rows.stream()
            .map(FeedbackRollupEntity::getWindowDays)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
        boolean oneWindow = windows.size() == 1;
        sb.append("\nVISSZAJELZÉSEK AZ AI-FELÜLETEKRŐL (")
            .append(oneWindow ? "utolsó " + windows.getFirst() + " nap" : "gördülő ablak")
            .append(", nem a teljes negyedév):\n");
        for (FeedbackRollupEntity r : rows) {
            sb.append("- ").append(r.getScope());
            if (!oneWindow && r.getWindowDays() != null) {
                sb.append(" (utolsó ").append(r.getWindowDays()).append(" nap)");
            }
            sb.append(": ").append(r.getStats().up()).append(" tetszik / ")
                .append(r.getStats().down()).append(" nem tetszik\n");
        }
    }

    private static void appendRungs(StringBuilder sb, List<PeriodSummaryEntity> rungs) {
        for (PeriodSummaryEntity rung : rungs) {
            sb.append("- ").append(rung.getPeriodStart()).append(": ").append(rung.getSummaryText()).append('\n');
        }
    }

    private List<SeasonSuggestion> parse(String raw) throws Exception {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return List.of();
        }
        return objectMapper.readValue(raw.substring(start, end + 1),
            objectMapper.getTypeFactory().constructCollectionType(List.class, SeasonSuggestion.class));
    }

    /** knowledge_node.title is varchar(120); a chatty model can exceed it. */
    private static String truncateTitle(String text) {
        return text.length() <= 120 ? text : text.substring(0, 117) + "…";
    }
}
