package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingAnnQuery;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * W3.1 always-on ambient recall (mezo-b3pp.12, spec §7.1): every chat turn opens already grounded
 * in relevant past. The incoming user message is embedded ONCE (RETRIEVAL_QUERY), four kind-group
 * ANN searches run over {@code memory_embedding} with per-group caps, the raw-similarity floor and
 * the same {@code similarity × exp(-age/τ)} re-rank the V2.3 tool uses, and the survivors render
 * as the {@code [Emlékek]} block under a hard token cap. Broad ambient recall — the
 * {@code find_similar_past_days} tool stays for deep, targeted recall on demand.
 *
 * <p>Failure honesty (IDENT-3): an embed/ANN failure is logged and the block is simply omitted —
 * the turn itself is fine, so the caller's {@code degraded} flag is NOT touched.
 *
 * <p>No {@code @Transactional} here: the embed hop runs before any DB work, and each kind-group
 * ANN query runs through {@code MemoryEmbeddingAnnQuery} on the caller's connection under a JDBC
 * savepoint, so a failed statement can never poison the turn's transaction — the {@code [Emlékek]}
 * block is optional, the turn is not (IDENT-3).
 *
 * <p>W3.2 (mezo-b3pp.13): the daily-summary query carries a coverage floor
 * ({@code today - ambient-recall.weekly-shadow-days}) and a weekly/monthly rung group is queried
 * unfiltered, so an old stretch is remembered through its consolidation rung instead of a stray
 * single day. Shadowing only changes what recall ASKS for — no row is ever deleted (spec §12).
 *
 * <p>Dedupe: today's episodes are skipped (the context snapshot already carries the day), and
 * items are keyed by {@code (kind, ref_id)} so no unit enters the block twice.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PromptMemoryAssembler {

    /** Header of the block — same "\n\n…:\n" shape as the facts/pattern-ack headers. */
    public static final String MEMORIES_HEADER = "\n\n[Emlékek] (hasonló korábbi epizódok — nyersanyag,"
            + " nem felolvasandó lista; dátum (forrás): kivonat):\n";

    /**
     * What one turn's ambient recall produced: the rendered block ("" when nothing), the Memory
     * refs, and (W3.1b, mezo-b3pp.28) the disclosable items themselves — same order as the block,
     * so the answer can show exactly what it was given. Refs collapse a day, items do not.
     */
    public record AmbientRecall(String block, List<RefsEnvelope.Ref> refs,
                                List<RecalledMemoriesEnvelope.Item> items) {
        public static final AmbientRecall EMPTY = new AmbientRecall("", List.of(), List.of());
    }

    /** One recalled unit after re-ranking (package-private: the render tests build these by hand). */
    record RecalledItem(String kind, UUID refId, LocalDate occurredOn, String content,
                        double similarity, double score) {}

    /** The render result: the block text + exactly the items that made it in under the cap. */
    record Rendered(String block, List<RecalledItem> rendered) {
        static final Rendered EMPTY = new Rendered("", List.of());
    }

    static final List<String> KINDS_DAILY_SUMMARY = List.of(MemoryEmbeddingEntity.KIND_DAILY_SUMMARY);
    /** W3.2 (mezo-b3pp.13): the consolidation ladder's rungs — queried WITHOUT a date floor. */
    static final List<String> KINDS_PERIOD_SUMMARY = List.of(MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY,
            MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY);
    static final List<String> KINDS_JOURNAL = List.of(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY,
            MemoryEmbeddingEntity.KIND_REFLECTION, MemoryEmbeddingEntity.KIND_GRATITUDE,
            MemoryEmbeddingEntity.KIND_DECISION);
    static final List<String> KINDS_CHAT_TURN = List.of(MemoryEmbeddingEntity.KIND_CHAT_TURN);
    static final List<String> KINDS_OTHER = List.of(MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE,
            MemoryEmbeddingEntity.KIND_CHECKIN_NOTE);

    /** Hungarian source tag per kind — unknown kinds fall back to the raw kind string. */
    static final Map<String, String> KIND_LABELS = Map.ofEntries(
            Map.entry(MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "napi összefoglaló"),
            Map.entry(MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, "heti összefoglaló"),
            Map.entry(MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY, "havi összefoglaló"),
            Map.entry(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "napló"),
            Map.entry(MemoryEmbeddingEntity.KIND_REFLECTION, "esti reflexió"),
            Map.entry(MemoryEmbeddingEntity.KIND_GRATITUDE, "hála"),
            Map.entry(MemoryEmbeddingEntity.KIND_DECISION, "döntés"),
            Map.entry(MemoryEmbeddingEntity.KIND_CHAT_TURN, "korábbi beszélgetés"),
            Map.entry(MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, "aktivitásjegyzet"),
            Map.entry(MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, "check-in jegyzet"));

    /** Conservative chars-per-token for accented, agglutinative Hungarian prose (Gemini ≈ 3–3.5). */
    static final int CHARS_PER_TOKEN = 3;

    private final EmbeddingPort embeddingPort;
    private final MemoryEmbeddingAnnQuery annQuery;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    /**
     * The block for one turn. {@code today} is the snapshot's day — episodes of that day are
     * skipped. Never throws: any failure ⇒ {@link AmbientRecall#EMPTY} + a warn log.
     */
    public AmbientRecall recall(UUID userId, UUID conversationId, String userMessage, LocalDate today) {
        CompanionProperties.AmbientRecall ambient = properties.ambientRecall();
        if (!ambient.enabled() || userMessage == null || userMessage.isBlank()) {
            return AmbientRecall.EMPTY;
        }
        try {
            float[] queryVector = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_recall", "recall_embed", "conversation", conversationId),
                    () -> embeddingPort.embedQuery(userMessage));
            String literal = MemoryEmbeddingRepository.toVectorLiteral(queryVector);
            CompanionProperties.Recall recall = properties.recall();

            // (kind, ref_id)-keyed so a unit can never enter twice; groups are disjoint today, the
            // map is the cheap guarantee that they stay so. Order matters only for the dedupe
            // tie-break — the final sort below is by score.
            // W3.2 (mezo-b3pp.13) coverage filter: fine-grained days are only asked for inside the
            // shadow window — beyond it the ladder's weekly/monthly rungs (queried WITHOUT a floor)
            // speak for the stretch. The daily rows themselves are never touched (spec §12).
            LocalDate dailyCutoff = today.minusDays(ambient.weeklyShadowDays());
            List<Group> groups = List.of(
                    new Group(KINDS_DAILY_SUMMARY, ambient.capDailySummary(), dailyCutoff),
                    new Group(KINDS_PERIOD_SUMMARY, ambient.capPeriodSummary(), null),
                    new Group(KINDS_JOURNAL, ambient.capJournal(), null),
                    new Group(KINDS_CHAT_TURN, ambient.capChatTurn(), null),
                    new Group(KINDS_OTHER, ambient.capOther(), null));
            Map<String, RecalledItem> byUnit = new LinkedHashMap<>();
            for (Group group : groups) {
                for (RecalledItem item : recallGroup(userId, group, literal, today, ambient, recall)) {
                    byUnit.putIfAbsent(item.kind() + ':' + item.refId(), item);
                }
            }
            List<RecalledItem> items = new ArrayList<>(byUnit.values());
            items.sort(Comparator.comparingDouble(RecalledItem::score).reversed());

            Rendered rendered = renderBlock(items, ambient.maxTokens(), recall.renderMaxChars());
            if (rendered.rendered().isEmpty()) {
                return AmbientRecall.EMPTY;
            }
            // Memory refs carry the DATE (the V2.3 tool's convention — the FE chip is generic);
            // two items of one day collapse to one ref.
            LinkedHashSet<RefsEnvelope.Ref> refs = new LinkedHashSet<>();
            // W3.1b: the disclosure is per EPISODE (no day collapse) and reuses oneLine, so the
            // gist on the wire is byte-identical to the line the model actually read.
            List<RecalledMemoriesEnvelope.Item> disclosed = new ArrayList<>();
            for (RecalledItem item : rendered.rendered()) {
                refs.add(new RefsEnvelope.Ref("Memory", item.occurredOn().toString()));
                disclosed.add(new RecalledMemoriesEnvelope.Item(item.kind(), item.refId(),
                        item.occurredOn(), KIND_LABELS.getOrDefault(item.kind(), item.kind()),
                        oneLine(item.content(), recall.renderMaxChars()), item.similarity()));
            }
            return new AmbientRecall(rendered.block(), List.copyOf(refs), List.copyOf(disclosed));
        } catch (RuntimeException e) {
            log.warn("Ambient recall skipped for conversation {} — the turn continues without [Emlékek]",
                    conversationId, e);
            return AmbientRecall.EMPTY;
        }
    }

    /** One ANN query's shape: which kinds, how many may enter the block, and the date floor. */
    private record Group(List<String> kinds, int cap, LocalDate notBefore) {}

    private List<RecalledItem> recallGroup(UUID userId, Group group, String literal,
                                           LocalDate today, CompanionProperties.AmbientRecall ambient,
                                           CompanionProperties.Recall recall) {
        if (group.cap() == 0) {
            return List.of();
        }
        return annQuery.nearestInKinds(userId, group.kinds(), literal, recall.candidatePool(),
                        group.notBefore())
                .stream()
                // the snapshot already carries today — and a future-dated unit is not a memory yet
                .filter(hit -> hit.occurredOn().isBefore(today))
                .map(hit -> toItem(hit, today, recall.decayDays()))
                .filter(item -> item.similarity() >= ambient.minSimilarity())
                .sorted(Comparator.comparingDouble(RecalledItem::score).reversed())
                .limit(group.cap())
                .toList();
    }

    private static RecalledItem toItem(MemoryEmbeddingAnnQuery.Hit hit, LocalDate today, int decayDays) {
        double similarity = 1.0 - hit.distance();
        long ageDays = Math.max(0, ChronoUnit.DAYS.between(hit.occurredOn(), today));
        double score = similarity * Math.exp(-(double) ageDays / decayDays);
        return new RecalledItem(hit.kind(), hit.refId(), hit.occurredOn(),
                hit.content(), similarity, score);
    }

    /**
     * Renders relevance-ordered items under the token cap. Stops at the FIRST item that would
     * overflow — a later, shorter item never jumps ahead of a more relevant one (the order IS the
     * relevance statement). Items whose gist is blank are skipped outright (no dangling line, no
     * ref). Empty when nothing fits.
     */
    static Rendered renderBlock(List<RecalledItem> items, int maxTokens, int renderMaxChars) {
        if (items.isEmpty()) {
            return Rendered.EMPTY;
        }
        StringBuilder block = new StringBuilder(MEMORIES_HEADER);
        List<RecalledItem> rendered = new ArrayList<>();
        for (RecalledItem item : items) {
            String gist = oneLine(item.content(), renderMaxChars);
            if (gist.isBlank()) {
                // whitespace-only content would render a dangling "- <date> (napló): " line and
                // claim a ref for nothing — skip it; this is NOT a budget stop, so keep scanning.
                continue;
            }
            String line = "- " + item.occurredOn()
                    + " (" + KIND_LABELS.getOrDefault(item.kind(), item.kind()) + "): "
                    + gist + '\n';
            if (estimateTokens(block.length() + line.length()) > maxTokens) {
                break;
            }
            block.append(line);
            rendered.add(item);
        }
        return rendered.isEmpty() ? Rendered.EMPTY : new Rendered(block.toString(), List.copyOf(rendered));
    }

    /** The gist: first line only (chat turns are "Daniel: …\nMezo: …"), capped like the tool's render. */
    static String oneLine(String content, int maxChars) {
        String first = content.strip();
        int newline = first.indexOf('\n');
        if (newline >= 0) {
            first = first.substring(0, newline).strip();
        }
        return first.length() > maxChars ? first.substring(0, maxChars) + "…" : first;
    }

    /** Ceil(chars / CHARS_PER_TOKEN) — an estimate, deliberately conservative. */
    static int estimateTokens(int chars) {
        return (chars + CHARS_PER_TOKEN - 1) / CHARS_PER_TOKEN;
    }
}
