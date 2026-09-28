package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.entity.ChatMemoryItem;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * S8 (mezo-d6ivw.12): the volatile prompt blocks that let the model speak truthfully about memory.
 * {@code [Elfelejtve]} — what the forget pre-screen of THIS turn forgot, so the reply confirms it.
 * {@code [Ebben a beszélgetésben]} — what this conversation learned or proposed, the only
 * items the model may call "megjegyeztem".
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatMemoryBlocks {

    static final String FORGET_HEADER = "[Elfelejtve]";
    static final String CONVERSATION_HEADER = "[Ebben a beszélgetésben]";
    static final int LINE_MAX_CHARS = 160;
    static final int CONVERSATION_MAX_LINES = 8;
    private static final Pattern CONTROL = Pattern.compile("[\\r\\n\\t\\p{Cc}]+");

    private final TurnMemoryService turnMemoryService;
    private final PromptPersona promptPersona;

    /** What this conversation learned or proposed (the turn-memory source), newest first, capped.
     *  "" when nothing — an absent block means there is nothing the model may claim. */
    public String conversationBlock(UUID userId, UUID conversationId) {
        List<ChatMemoryItem> items = turnMemoryService.liveItems(userId, conversationId);
        if (items.isEmpty()) {
            return "";
        }
        StringBuilder b = new StringBuilder("\n\n").append(CONVERSATION_HEADER)
                .append(" Amit ebből a beszélgetésből a háttérben megjegyeztél vagy javasoltál — csak ezekről "
                        + "mondhatod, hogy megjegyezted:");
        items.stream().limit(CONVERSATION_MAX_LINES).forEach(item -> b.append("\n- ").append(label(item))
                .append(line(item)));
        return promptPersona.render(userId, b.toString());
    }

    private static String label(ChatMemoryItem item) {
        return switch (item.kind()) {
            case ChatMemoryItem.KIND_FACT_CANDIDATE -> "javaslat, még nem döntött róla: ";
            case ChatMemoryItem.KIND_KNOWLEDGE_FACT -> "megjegyezve, {{NÉV}} jóváhagyta: ";
            default -> "megjegyezve: ";
        };
    }

    /** "" when the turn was not a forget request (null); a block otherwise. */
    public String forgetBlock(UUID userId, List<ChatMemoryItem> forgotten) {
        if (forgotten == null) {
            return "";
        }
        if (forgotten.isEmpty()) {
            return promptPersona.render(userId, "\n\n" + FORGET_HEADER + " {{NÉV}} azt kérte, ne jegyezz meg "
                    + "valamit, de ebből a beszélgetésből nem volt mit elfelejteni — ezt mondd meg neki őszintén.");
        }
        StringBuilder b = new StringBuilder("\n\n").append(FORGET_HEADER)
                .append(" {{NÉV}} kérésére ezeket most végleg elfelejtetted (erősítsd meg röviden, hogy "
                        + "elfelejtetted — mondd úgy: elfelejtettem, ne úgy: töröltem):");
        forgotten.forEach(item -> b.append("\n- ").append(line(item)));
        return promptPersona.render(userId, b.toString());
    }

    static String line(ChatMemoryItem item) {
        String text = CONTROL.matcher(item.text()).replaceAll(" ").strip();
        String who = item.who() == null ? "" : CONTROL.matcher(item.who()).replaceAll(" ").strip() + ": ";
        String full = who + text;
        return full.length() > LINE_MAX_CHARS ? full.substring(0, LINE_MAX_CHARS) + "…" : full;
    }
}
