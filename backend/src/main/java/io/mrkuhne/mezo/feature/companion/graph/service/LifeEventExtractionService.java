package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphProposedEdge;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * W2.3 life-event extraction (bd mezo-b3pp.8, spec §6.3): one cheap-LLM pass over a day's
 * narrative — {@code journal_entry} + {@code ritual_day.reflection_text} + {@code daily_summary}
 * — proposing 0..N LIFE_EVENT **candidates** with edges parked in {@code meta.proposedEdges}.
 * Nothing here ever becomes active (IDENT-6): {@code LifeEventCandidateService} is the only path
 * from a proposal to durable graph structure.
 *
 * <p><b>Nothing schedules this.</b> W2.5's {@code GraphMaintenanceJob} calls {@code extractFor}
 * as one of its three nightly phases, exactly as it will call W2.2's {@code reconcile} — the same
 * "the sweep exists, the cron arrives with the job" split that shipped in W2.2. There is no REST
 * trigger: extraction is internal.
 *
 * <p><b>Two gates, both before any spend:</b> (1) the day already processed — {@code
 * countExtractorNodesOnDay} counts soft-deleted rows too, so a rejected night is never
 * re-proposed; (2) an empty narrative — a day with nothing written costs no LLM call at all.
 *
 * <p>IDENT-3: a failed, empty or unparseable MODEL ANSWER means zero candidates, logged and
 * swallowed — never an exception out of {@code extractFor} and never a half-written night. The
 * same holds for the PERSISTENCE side: {@code extractFor} itself carries no {@code @Transactional}
 * (each nightly call for a given user/day is its own unit of work, and there is no wider
 * transaction to join), so the suggestion-to-candidate writes are pulled into their own
 * {@link #persistCandidates} method and invoked through {@link #self}, the injected proxy — the
 * same idiom {@link GraphPromotionService#reconcile}'s javadoc explains (plain {@code this}
 * self-invocation bypasses the proxy and gets no transactional advice at all). That one
 * transaction covers every candidate the night proposes: a persistence failure on suggestion N
 * (a NUL byte Postgres rejects, a transient {@code DataAccessException}, ...) rolls back
 * suggestions 1..N too, so the night ends with zero candidates rather than a half-written one, and
 * {@code extractFor} degrades to {@code 0} instead of letting the exception escape — the day gate
 * ({@code countExtractorNodesOnDay}) then still finds nothing for the day, so a later run can
 * retry it cleanly.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class LifeEventExtractionService {

    /** Dispatch key for FakeCompanionLlm (the GraphEdgeStructurer.STRUCTURER_MARKER idiom). */
    public static final String EXTRACTOR_MARKER = "[life-event-extractor]";

    /** {@code knowledge_node.source_kind} for everything this service writes. */
    public static final String SOURCE_EXTRACTOR = "extractor";

    /** The extractor may only propose the two temporal/causal kinds (spec §6.3).
     *  {@link LifeEventCandidateService#decide} reuses this same set to re-validate a stored
     *  proposal at the confirm boundary rather than trusting the persisted JSON. */
    public static final Set<String> ALLOWED_KINDS =
        Set.of(GraphEdgeEntity.KIND_TRIGGERS, GraphEdgeEntity.KIND_PRECEDED_BY);

    /** Same bound as the W2.2 structurer: the model sees a small multiple of top-K existing
     *  nodes, newest first, so prompt size stays flat as the graph grows. */
    private static final int CANDIDATE_POOL_MULTIPLIER = 3;

    private static final String SYSTEM_PROMPT = EXTRACTOR_MARKER + """

        Te egy életesemény-kiszűrő vagy. Bemenet: {{NÉV}} egy napjának saját szövegei, és a
        tudásgráf meglévő csomópontjainak számozott listája. Feladat: megtalálni a nap valódi
        ÉLETESEMÉNYEIT — olyan konkrét, dátumhoz köthető eseményeket, amelyek később is
        számítanak (költözés, új munka, betegség, szakítás, utazás, veszteség, mérföldkő).

        A hétköznapi rutin (edzés, étkezés, alvás) NEM életesemény.

        Válasz KIZÁRÓLAG JSON tömb, magyarázat nélkül:
        [{"title": "rövid magyar cím", "summary": "1-2 mondat", "edges": [{"index": 0, "kind": "TRIGGERS", "confidence": 0.0}]}]

        - Legfeljebb 3 eseményt javasolj; ha a nap nem hozott ilyet, a válasz üres tömb: []
        - kind ∈ TRIGGERS | PRECEDED_BY (az eseménytől a listás csomópont felé)
        - PRECEDED_BY = a forrás-csomópontot megelőzte a cél-csomópont (a cél volt előbb)
        - confidence 0.0–1.0; ha nincs valódi kapcsolat, az edges üres tömb
        - Ne találj ki csomópontot, és ne hivatkozz a listán kívüli indexre.
        """;

    private final CompanionLlm companionLlm;
    private final GraphService graphService;
    private final GraphNodeRepository nodeRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final RitualDayRepository ritualDayRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final PromptPersona promptPersona;
    // Self-injected proxy (ObjectProvider defers resolution, so this is safe despite the apparent
    // circularity) — see GraphPromotionService.reconcile's javadoc for why persistCandidates is
    // invoked through this proxy instead of `this`.
    private final ObjectProvider<LifeEventExtractionService> self;

    /** @return how many LIFE_EVENT candidates were created for {@code day} (0 on either gate, on
     *  an empty answer, on any model/parse failure, or — atomically, see {@link #persistCandidates}
     *  — on any candidate-persistence failure). */
    public int extractFor(UUID userId, LocalDate day) {
        if (nodeRepository.countExtractorNodesOnDay(userId, day) > 0) {
            return 0;   // already processed (accepted, pending, or rejected) — never re-proposed
        }
        String narrative = gatherNarrative(userId, day);
        if (narrative.isBlank()) {
            return 0;   // emptiness gate — a silent night costs no LLM call
        }
        int topK = properties.graph().topK();
        List<GraphNodeEntity> existing = nodeRepository
            .findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(userId, GraphNodeEntity.STATUS_ACTIVE)
            .stream().limit((long) topK * CANDIDATE_POOL_MULTIPLIER).toList();
        List<LifeEventSuggestion> suggestions;
        try {
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("companion_graph", "extract_life_events", "day", null),
                () -> companionLlm.complete(promptPersona.render(userId, SYSTEM_PROMPT), buildUserMessage(narrative, existing)));
            suggestions = parse(raw).stream()
                .filter(s -> s != null && s.title() != null && !s.title().isBlank())
                .limit(topK)
                .toList();
        } catch (Exception e) {
            log.warn("Life-event extraction failed for {} on {}", userId, day, e);
            return 0;
        }
        if (suggestions.isEmpty()) {
            return 0;
        }
        try {
            return self.getObject().persistCandidates(userId, day, suggestions, existing);
        } catch (Exception e) {
            log.warn("Life-event candidate persistence failed for {} on {} — degrading to zero "
                + "candidates so the night stays reprocessable", userId, day, e);
            return 0;
        }
    }

    /** The whole night's candidate writes, in ONE transaction (see the class javadoc): either every
     *  suggestion becomes a candidate, or (on any persistence failure) none of them do. Called only
     *  through {@link #self} — see the class javadoc and {@link GraphPromotionService#reconcile}'s
     *  for why plain {@code this} self-invocation would not get this transactional advice at all. */
    @Transactional
    public int persistCandidates(UUID userId, LocalDate day, List<LifeEventSuggestion> suggestions,
            List<GraphNodeEntity> existing) {
        int created = 0;
        for (LifeEventSuggestion suggestion : suggestions) {
            graphService.createCandidate(userId, GraphNodeEntity.KIND_LIFE_EVENT,
                truncateTitle(suggestion.title()), suggestion.summary(),
                SOURCE_EXTRACTOR, day, meta(suggestion, existing));
            created++;
        }
        return created;
    }

    /** The day's own words, in the order the prompt reads best: free journal prose, the Napzárás
     *  reflection, then the generated daily summary. */
    private String gatherNarrative(UUID userId, LocalDate day) {
        StringBuilder sb = new StringBuilder();
        for (JournalEntryEntity entry : journalEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(userId, day, day)) {
            append(sb, "NAPLÓ", entry.getText());
        }
        ritualDayRepository.findByCreatedByAndRitualDate(userId, day)
            .ifPresent(r -> append(sb, "ESTI REFLEXIÓ", r.getReflectionText()));
        dailySummaryRepository.findByCreatedByAndSummaryDate(userId, day)
            .ifPresent(s -> append(sb, "NAPI ÖSSZEFOGLALÓ", s.getNarrative()));
        return sb.toString().trim();
    }

    private static void append(StringBuilder sb, String label, String text) {
        if (text != null && !text.isBlank()) {
            sb.append(label).append(": ").append(text.trim()).append('\n');
        }
    }

    private String buildUserMessage(String narrative, List<GraphNodeEntity> existing) {
        StringBuilder sb = new StringBuilder("A NAP SZÖVEGEI:\n").append(narrative).append('\n');
        sb.append("\nMEGLÉVŐ CSOMÓPONTOK:\n");
        for (int i = 0; i < existing.size(); i++) {
            GraphNodeEntity n = existing.get(i);
            sb.append(i).append(". (").append(n.getKind()).append(") ").append(n.getTitle()).append('\n');
        }
        return sb.toString();
    }

    /** {@code {proposedEdges: [...]}} — the spec's LIFE_EVENT meta envelope. Suggestions with an
     *  out-of-range index, a kind outside TRIGGERS/PRECEDED_BY, or a confidence outside
     *  {@code [edgeConfidenceFloor, 1.0]} are DROPPED, never clamped: an out-of-range confidence
     *  must not survive to the confirm path, where {@code weight = confidence x 0.5} would
     *  threaten {@code ck_knowledge_edge_weight}. */
    private Map<String, Object> meta(LifeEventSuggestion suggestion, List<GraphNodeEntity> existing) {
        List<Map<String, Object>> proposed = new ArrayList<>();
        List<LifeEventSuggestion.EdgeSuggestion> edges =
            suggestion.edges() == null ? List.of() : suggestion.edges();
        for (LifeEventSuggestion.EdgeSuggestion edge : edges) {
            if (edge == null || edge.index() == null || edge.index() < 0 || edge.index() >= existing.size()
                || edge.kind() == null || !ALLOWED_KINDS.contains(edge.kind())
                || edge.confidence() == null
                || edge.confidence() < properties.graph().edgeConfidenceFloor()
                || edge.confidence() > 1.0) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("toNodeId", existing.get(edge.index()).getId().toString());
            item.put("kind", edge.kind());
            item.put("confidence", edge.confidence());
            proposed.add(item);
        }
        return Map.of(GraphProposedEdge.META_KEY, proposed);
    }

    private List<LifeEventSuggestion> parse(String raw) throws Exception {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return List.of();
        }
        return objectMapper.readValue(raw.substring(start, end + 1),
            objectMapper.getTypeFactory().constructCollectionType(List.class, LifeEventSuggestion.class));
    }

    /** knowledge_node.title is varchar(120); a chatty model can exceed it. */
    private static String truncateTitle(String text) {
        return text.length() <= 120 ? text : text.substring(0, 117) + "…";
    }
}
