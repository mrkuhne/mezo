package io.mrkuhne.mezo.feature.companion.profile.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.profile.config.ProfileProperties;
import io.mrkuhne.mezo.feature.companion.profile.entity.ProfileMetaEnvelope;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
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

            Te Daniel személyes társának a tanuló rétege vagy. A lenti nyers jelekből írj EGYETLEN
            tömör, magyar bekezdést arról, HOGYAN érdemes Daniellel beszélni: milyen üzenet válik be
            nála, mikor, milyen hosszban, mit utasít el. Csak abból dolgozz, amit a jelek mutatnak —
            ha valamire nincs jel, hallgass róla. Ne szólítsd meg, ne adj tanácsot, ne sorold fel a
            számokat: a megfigyelést fogalmazd meg. Legfeljebb 5 mondat.""";

    private final FeedbackRollupRepository rollupRepository;
    private final DecisionEntryRepository decisionRepository;
    private final GraphService graphService;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ProfileProperties properties;

    /**
     * Rebuilds the profile for one user. Returns the node id, or empty when there was no signal
     * to learn from or the model came back blank (both honest no-ops, not failures).
     *
     * <p>W5.3 (mezo-b3pp.20) calls this too, after the quarterly pass.
     */
    @Transactional
    public Optional<UUID> rebuild(UUID userId) {
        List<FeedbackRollupEntity> rollups = rollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(userId);
        List<DecisionEntryEntity> decisions = decisionRepository
                .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(
                        userId, Limit.of(properties.maxDecisions()));
        List<GraphNodeEntity> nodes = habitNodes(userId);
        int signals = feedbackSignals(rollups);
        if (signals == 0 && decisions.isEmpty() && nodes.isEmpty()) {
            log.debug("Profile skipped for user {} — no feedback, no reviewed decisions, no graph nodes", userId);
            return Optional.empty();
        }
        String payload = renderPayload(rollups, decisions, nodes);
        String prose = llmCallContextHolder.runWith(
                new LlmCallContext("companion_profile", "assemble", null, null),
                () -> companionLlm.completeSmart(PROMPT, payload));
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

    private static int feedbackSignals(List<FeedbackRollupEntity> rollups) {
        return rollups.stream()
                .map(FeedbackRollupEntity::getStats)
                .filter(Objects::nonNull)
                .map(FeedbackRollupStatsEnvelope::total)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
    }

    /** The LLM payload — pure code, honest about absence (a section with nothing stays out). */
    String renderPayload(List<FeedbackRollupEntity> rollups, List<DecisionEntryEntity> decisions,
            List<GraphNodeEntity> nodes) {
        StringBuilder out = new StringBuilder();
        List<String> feedbackLines = rollups.stream()
                .filter(r -> r.getStats() != null && r.getStats().total() != null && r.getStats().total() > 0)
                .map(r -> "- " + r.getScope() + ": " + r.getStats().up() + " tetszik / "
                        + r.getStats().down() + " nem tetszik")
                .toList();
        if (!feedbackLines.isEmpty()) {
            out.append("VISSZAJELZÉSEK (utolsó 30 nap):\n").append(String.join("\n", feedbackLines)).append('\n');
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
        if (!nodes.isEmpty()) {
            out.append("\nAMIT A GRÁF TUD RÓLA:\n");
            for (GraphNodeEntity n : nodes) {
                out.append("- ").append(n.getTitle()).append('\n');
            }
        }
        return out.toString();
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
