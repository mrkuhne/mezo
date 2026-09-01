package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Chat topic shift (round 4, spec §5.4): which domain the user's conversations with the companion
 * revolve around, from the assistant's executed tool calls over the trailing 28 days. The state is
 * the dominant domain; the "shift" IS the state change (yesterday's dominant domain is the
 * "korábban" clause). Two conversation titles ride along as bounded evidence — never parsed.
 * No new-data pre-filter (spec §4.3): a domain can fall out of the window on a quiet day.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class ChatTopicShiftDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 28;
    static final int MIN_CALLS = 10;
    static final double DOMINANT_MIN_SHARE = 0.40;
    static final int EVIDENCE_MAX = 2;

    @Override
    public String key() {
        return "chat-topic-shift";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.domain().equals(yesterday == null ? "" : yesterday.domain())) {
            return List.of();
        }
        StringBuilder sb = new StringBuilder("Az elmúlt 4 hétben a társsal folytatott beszélgetéseid ")
                .append(TrailingWindow.pct(today.share())).append("%-a a(z) ").append(ChatToolDomains.hu(today.domain()))
                .append(" körül forgott (").append(today.calls()).append(" eszközhívás a ").append(today.total())
                .append("-ból); korábban ")
                .append(yesterday == null ? "nem volt kirajzolódó fő téma." : "a(z) " + ChatToolDomains.hu(yesterday.domain()) + " volt az első.");
        if (today.evidence().size() == 2) {
            sb.append(" Két friss beszélgetés: „").append(today.evidence().get(0)).append("”, „")
                    .append(today.evidence().get(1)).append("”.");
        } else if (today.evidence().size() == 1) {
            sb.append(" Egy friss beszélgetés: „").append(today.evidence().get(0)).append("”.");
        }
        return List.of(new DetectorSignal(key(), "pszichologus", sb.toString(), 3));
    }

    record State(String domain, int calls, int total, double share, List<String> evidence) {}

    private record ConversationHit(UUID id, LocalDate latest, String title) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        List<DetectorInput.ChatToolCallPoint> mapped = new ArrayList<>();
        for (DetectorInput.ChatToolCallPoint c : in.trend().chatToolCalls()) {
            String domain = ChatToolDomains.domainOf(c.toolName());
            if (domain == null || !TrailingWindow.inWindow(c.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            counts.merge(domain, 1, Integer::sum);
            mapped.add(c);
        }
        int total = mapped.size();
        if (total < MIN_CALLS) {
            return null;
        }
        String dominant = null;
        int best = 0;
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            if (e.getValue() > best || (e.getValue() == best && dominant != null && e.getKey().compareTo(dominant) < 0)) {
                best = e.getValue();
                dominant = e.getKey();
            }
        }
        double share = (double) best / total;
        if (share < DOMINANT_MIN_SHARE) {
            return null;
        }
        Map<UUID, ConversationHit> byConversation = new LinkedHashMap<>();
        for (DetectorInput.ChatToolCallPoint c : mapped) {
            if (!dominant.equals(ChatToolDomains.domainOf(c.toolName())) || c.conversationId() == null) {
                continue;
            }
            ConversationHit prev = byConversation.get(c.conversationId());
            if (prev == null || c.date().isAfter(prev.latest())) {
                byConversation.put(c.conversationId(), new ConversationHit(c.conversationId(), c.date(), c.titlePreview()));
            }
        }
        List<String> evidence = byConversation.values().stream()
                .sorted(Comparator.comparing(ConversationHit::latest).reversed()
                        .thenComparing(h -> h.id().toString()))
                .map(ConversationHit::title)
                .filter(t -> t != null && !t.isBlank())
                .limit(EVIDENCE_MAX)
                .toList();
        return new State(dominant, best, total, share, evidence);
    }
}
