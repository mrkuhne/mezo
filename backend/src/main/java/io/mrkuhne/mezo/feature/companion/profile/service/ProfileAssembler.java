package io.mrkuhne.mezo.feature.companion.profile.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.feedback.config.FeedbackLearningProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.profile.config.ProfileProperties;
import io.mrkuhne.mezo.feature.companion.profile.entity.ProfileMetaEnvelope;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W4.3 (mezo-b3pp.17, spec §8.3) — the pragmatic profile: one weekly smart-tier synthesis of
 * "hogyan érdemes Daniellel beszélni", distilled from the W4.2 feedback rollups (per-surface
 * effectiveness + 👎-reason histogram), the reviewed W1.4 decisions, and what the graph already
 * knows about how he works.
 *
 * <p><b>Storage:</b> the singleton {@code knowledge_node(kind=INSIGHT, source_kind='profile',
 * source_id=userId)} — spec §4.2 ("not a separate table"). The user id as {@code source_id} is
 * load-bearing: {@code uq_knowledge_node_source} is a PARTIAL index ({@code where source_id is not
 * null}), so a null source id would silently drop the DB-level singleton guarantee.
 *
 * <p><b>Graph nodes as input (spec interpretation):</b> §8.3 asks for "RECOVERY-related graph
 * nodes when W2 live". There is no RECOVERY node kind; the faithful reading is what the graph
 * knows about how he works, i.e. the active PATTERN/PREFERENCE titles (the profile node itself
 * excluded — it must never eat its own output).
 *
 * <p><b>Decision-quality trend (W5.3, mezo-b3pp.20, spec §9.3):</b> the ANCHOR quarter's mean
 * reviewed outcome rating against the quarter before it, computed quarter-over-quarter in pure
 * code — see {@link #decisionQuality}. The anchor is a REQUIRED argument of {@link #rebuild}, not
 * something this class derives from {@code LocalDate.now()}: the two callers legitimately want
 * different anchors, and the class cannot guess which. See {@link #rebuild} for the failure that
 * a self-derived anchor caused.
 *
 * <p><b>Honest absence:</b> with no feedback verdicts, no reviewed decisions and no graph nodes
 * there is nothing to learn from — no LLM call, no node, and any existing profile is left exactly
 * as it is rather than overwritten with an invention.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class ProfileAssembler {

    /** The {@code source_kind} of the singleton (spec §4.2). */
    public static final String SOURCE_PROFILE = "profile";

    /** Fixed node title — the prose lives in {@code summary}; the title is the Tudástár label. */
    public static final String PROFILE_TITLE = "Rólad tanultam";

    /** First line of the prompt — the fake LLM dispatches on it (FakeCompanionLlm). */
    public static final String PROFILE_MARKER = "ROLAD-TANULTAM";

    /** Same chars-per-token estimate as the [Emlékek]/[Összefüggések] blocks. */
    static final int CHARS_PER_TOKEN = 3;

    private static final String PROMPT = PROFILE_MARKER + """

            Te {{NÉV}} személyes társának a tanuló rétege vagy. A lenti nyers jelekből írj EGYETLEN
            tömör, magyar bekezdést arról, HOGYAN érdemes vele beszélni: milyen üzenet válik be
            nála, mikor, milyen hosszban, mit utasít el. Csak abból dolgozz, amit a jelek mutatnak —
            ha valamire nincs jel, hallgass róla. Ne szólítsd meg, ne adj tanácsot, ne sorold fel a
            számokat: a megfigyelést fogalmazd meg. Legfeljebb 5 mondat.""";

    private final FeedbackRollupRepository rollupRepository;
    private final DecisionEntryRepository decisionRepository;
    private final GraphService graphService;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ProfileProperties properties;
    /** The SAME source {@code FeedbackLearningService} writes {@code feedback_rollup.window_days}
     *  with (mezo-b3pp.35, item 3) — {@code ProfileProperties} owns no window knob of its own. A
     *  retired window (after a config change) leaves its rows behind forever (nothing prunes
     *  them; see {@code FeedbackRollupRepository}), so reading unfiltered would surface BOTH the
     *  live window's numbers and the stale ones as separate, contradictory lines per scope. Filter
     *  on this same property, or the filter and the data disagree. */
    private final FeedbackLearningProperties feedbackLearningProperties;
    private final PromptPersona promptPersona;

    /**
     * Rebuilds the profile for one user. Returns the node id, or empty when there was no signal
     * to learn from or the model came back blank (both honest no-ops, not failures).
     *
     * <p><b>{@code anchorQuarter} is the quarter the {@code DÖNTÉSI MINŐSÉG} trend calls "ez a
     * negyedév"</b> — the first day of a calendar quarter ({@link Quarters#startOf}); the "előző
     * negyedév" line is always {@link Quarters#previous} of it. It is a REQUIRED parameter with no
     * no-anchor overload, deliberately (mezo-b3pp.20 final review, F1): while {@code
     * decisionQuality} derived its own window from {@code LocalDate.now()}, the two callers
     * silently disagreed about which quarter was being profiled.
     * {@link io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssemblerJob} runs mid-quarter
     * and means the quarter in progress, but the W5.3 quarterly job runs at 04:00 ON the 1st of
     * Jan/Apr/Jul/Oct and means the quarter that JUST FINISHED — and a now()-derived window handed
     * it the four-hour-old new quarter instead, which has nothing reviewed in it yet, so
     * {@code decisionQuality}'s "nothing this quarter" rule dropped the ENTIRE section and the
     * quarterly rebuild regenerated the prose from a payload strictly POORER than the previous
     * weekly run's. The one day of the year the trend is guaranteed missing was exactly the day
     * the "quarterly deep pass" ran. An overload defaulting to now() would let a future caller
     * walk straight back into that, so there is none: every caller states its anchor.
     *
     * <p>W5.3 (mezo-b3pp.20) calls this too, after the quarterly pass.
     */
    @Transactional
    public Optional<UUID> rebuild(UUID userId, LocalDate anchorQuarter) {
        List<FeedbackRollupEntity> rollups = rollupRepository.findByCreatedByAndWindowDaysAndDeletedFalseOrderByScopeAsc(
                userId, feedbackLearningProperties.windowDays());
        List<DecisionEntryEntity> decisions = decisionRepository
                .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(
                        userId, Limit.of(properties.maxDecisions()));
        List<GraphNodeEntity> nodes = habitNodes(userId);
        int signals = feedbackSignals(rollups);
        if (signals == 0 && decisions.isEmpty() && nodes.isEmpty()) {
            log.debug("Profile skipped for user {} — no feedback, no reviewed decisions, no graph nodes", userId);
            return Optional.empty();
        }
        String payload = renderPayload(userId, anchorQuarter, rollups, decisions, nodes);
        String prose = llmCallContextHolder.runWith(
                new LlmCallContext("companion_profile", "assemble", null, null),
                () -> companionLlm.completeSmart(promptPersona.render(userId, PROMPT), payload));
        if (prose == null || prose.isBlank()) {
            log.warn("Profile skipped for user {} — the model returned nothing", userId);
            return Optional.empty();
        }
        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_INSIGHT, PROFILE_TITLE,
                cap(prose.strip(), properties.renderMaxTokens()), SOURCE_PROFILE, userId, null,
                new ProfileMetaEnvelope(Instant.now().truncatedTo(ChronoUnit.MICROS),
                        signals, decisions.size(), nodes.size()).toMeta());
        // upsertNode deliberately does not touch status (W2.2 owns its own status rules); the
        // weekly run is exactly the "reset what you think of me" recovery path spec §8.3 promises,
        // so an archived profile comes back ACTIVE here.
        if (!GraphNodeEntity.STATUS_ACTIVE.equals(node.getStatus())) {
            node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
        }
        return Optional.of(node.getId());
    }

    /** Active PATTERN/PREFERENCE nodes, newest first, capped — never the profile node itself. */
    private List<GraphNodeEntity> habitNodes(UUID userId) {
        return graphService.listActive(userId).stream()
                .filter(n -> GraphNodeEntity.KIND_PATTERN.equals(n.getKind())
                        || GraphNodeEntity.KIND_PREFERENCE.equals(n.getKind()))
                .filter(n -> !SOURCE_PROFILE.equals(n.getSourceKind()))
                .limit(properties.maxGraphNodes())
                .toList();
    }

    /**
     * Sums ONLY {@code surface:}-prefixed rows (mezo-b3pp.35, item 4). The scope taxonomy is
     * {@code style}, {@code surface:<artifact_kind>}, {@code feed:<feed_kind>},
     * {@code intervention:<key>} — {@code surface:*} is the complete, non-overlapping partition
     * (exactly one row per artifact kind ever verdicted), while {@code feed:*} and
     * {@code intervention:*} are REFINEMENTS of a subset of it (a {@code feed_message} verdict
     * also lands in {@code surface:feed_message}). Summing every scope therefore double- (or
     * triple-) counts every feed/intervention verdict. Do not "fix" this back to all-scopes —
     * {@code surface:*} alone is the canonical count; only the meta number and the
     * {@code signals == 0} skip gate's magnitude depend on it, never which rows render.
     */
    private static int feedbackSignals(List<FeedbackRollupEntity> rollups) {
        return rollups.stream()
                .filter(r -> r.getScope() != null && r.getScope().startsWith(FeedbackRollupEntity.SCOPE_SURFACE_PREFIX))
                .map(FeedbackRollupEntity::getStats)
                .filter(Objects::nonNull)
                .map(FeedbackRollupStatsEnvelope::total)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
    }

    /**
     * The LLM payload: no model is consulted anywhere in here — every number is arithmetic this
     * method does itself (NFR-M-4, never derive and narrate in one step). That is what "pure code"
     * means in this codebase's vocabulary, and it is the only sense in which this method is pure.
     *
     * <p>It is NOT a pure function of its arguments and cannot be called without a database: since
     * W5.3 (mezo-b3pp.20) {@link #decisionQuality} issues two more {@code DecisionEntryRepository}
     * round-trips of its own, keyed off {@code userId}/{@code anchorQuarter} rather than off the
     * {@code decisions} list passed in (that list is review-time-ordered and capped, so it cannot
     * answer a per-quarter question). Hence the {@code userId}/{@code anchorQuarter} parameters
     * next to the already-gathered rows.
     *
     * <p>Honest about absence throughout: a section with nothing behind it stays out entirely.
     */
    String renderPayload(UUID userId, LocalDate anchorQuarter, List<FeedbackRollupEntity> rollups,
            List<DecisionEntryEntity> decisions, List<GraphNodeEntity> nodes) {
        StringBuilder out = new StringBuilder();
        List<String> feedbackLines = rollups.stream()
                .filter(r -> r.getStats() != null && r.getStats().total() != null && r.getStats().total() > 0)
                .map(r -> "- " + r.getScope() + ": " + r.getStats().up() + " tetszik / "
                        + r.getStats().down() + " nem tetszik")
                .toList();
        if (!feedbackLines.isEmpty()) {
            out.append("VISSZAJELZÉSEK (utolsó ").append(feedbackLearningProperties.windowDays())
                    .append(" nap):\n").append(String.join("\n", feedbackLines)).append('\n');
        }
        List<String> reasonLines = rollups.stream()
                .filter(r -> FeedbackRollupEntity.SCOPE_STYLE.equals(r.getScope()))
                .filter(r -> r.getStats() != null && r.getStats().bySurface() != null)
                .flatMap(r -> r.getStats().bySurface().entrySet().stream())
                .map(e -> "- " + e.getKey() + ": pontatlan " + e.getValue().inaccurate()
                        + " · túl sok " + e.getValue().tooMuch()
                        + " · rossz időzítés " + e.getValue().badTiming()
                        + " · nem rólam szól " + e.getValue().notAboutMe())
                .toList();
        if (!reasonLines.isEmpty()) {
            out.append("\nELUTASÍTÁS OKAI:\n").append(String.join("\n", reasonLines)).append('\n');
        }
        if (!decisions.isEmpty()) {
            out.append("\nÉRTÉKELT DÖNTÉSEK:\n");
            for (DecisionEntryEntity d : decisions) {
                out.append("- ").append(d.getDecidedOn()).append(" · ").append(d.getDecisionText())
                        .append(" → ").append(d.getOutcomeRating()).append("/5");
                if (d.getOutcomeText() != null && !d.getOutcomeText().isBlank()) {
                    out.append(" · ").append(d.getOutcomeText());
                }
                out.append('\n');
            }
        }
        String quality = decisionQuality(userId, anchorQuarter);
        if (!quality.isEmpty()) {
            out.append("\nDÖNTÉSI MINŐSÉG:\n").append(quality).append('\n');
        }
        if (!nodes.isEmpty()) {
            out.append("\nAMIT A GRÁF TUD RÓLA:\n");
            for (GraphNodeEntity n : nodes) {
                out.append("- ").append(n.getTitle()).append('\n');
            }
        }
        return out.toString();
    }

    /**
     * W5.3 (mezo-b3pp.20, spec §9.3): the decision-quality trend — the ANCHOR quarter's mean
     * outcome rating against the quarter before it, computed in PURE CODE (NFR-M-4: never derive
     * and narrate in one step; the model gets the observation, not the arithmetic).
     *
     * <p>The Hungarian labels are relative to the anchor, not to the wall clock: "ez a negyedév"
     * IS {@code anchorQuarter} and "előző negyedév" is always {@link Quarters#previous} of it. So
     * when the quarterly job anchors on the quarter that just finished, both lines name the two
     * quarters it is actually comparing — see {@link #rebuild} for why the anchor is passed in.
     *
     * <p>Honest absence, both halves: a quarter with no reviewed decision contributes no line at
     * all, and with neither quarter present the whole section stays out of the payload rather
     * than telling the model "0,0/5", which would read as terrible judgement instead of no data.
     */
    private String decisionQuality(UUID userId, LocalDate anchorQuarter) {
        String current = quarterLine("ez a negyedév", userId, anchorQuarter);
        String previous = quarterLine("előző negyedév", userId, Quarters.previous(anchorQuarter));
        if (current.isEmpty()) {
            return "";   // nothing reviewed in the anchor quarter — a lone historical line is not a trend
        }
        return previous.isEmpty() ? current : current + "\n" + previous;
    }

    /** "- ez a negyedév: 4,5/5 (2 értékelt döntés)" — empty when the quarter has none. */
    private String quarterLine(String label, UUID userId, LocalDate quarterStart) {
        ZoneId zone = ZoneId.systemDefault();
        List<DecisionEntryEntity> reviewed = decisionRepository
                .findByCreatedByAndReviewedAtGreaterThanEqualAndReviewedAtLessThanAndOutcomeRatingIsNotNullAndDeletedFalse(
                        userId,
                        quarterStart.atStartOfDay(zone).toInstant(),
                        Quarters.endOf(quarterStart).plusDays(1).atStartOfDay(zone).toInstant());
        OptionalDouble mean = reviewed.stream().mapToInt(DecisionEntryEntity::getOutcomeRating).average();
        if (mean.isEmpty()) {
            return "";
        }
        return String.format(Locale.forLanguageTag("hu"), "- %s: %.1f/5 (%d értékelt döntés)",
                label, mean.getAsDouble(), reviewed.size());
    }

    /** Hard cap at the injection budget, cut on a word boundary — Tudástár must never show more
     *  than the model is given. */
    static String cap(String text, int maxTokens) {
        int maxChars = maxTokens * CHARS_PER_TOKEN;
        if (text.length() <= maxChars) {
            return text;
        }
        String head = text.substring(0, maxChars - 1);
        int lastSpace = head.lastIndexOf(' ');
        return (lastSpace > 0 ? head.substring(0, lastSpace) : head) + "…";
    }
}
