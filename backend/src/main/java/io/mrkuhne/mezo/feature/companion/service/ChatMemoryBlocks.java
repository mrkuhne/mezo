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
 * {@code [Ebben a beszélgetésben]} (Task 8) — what this conversation learned or proposed, the only
 * items the model may call "megjegyeztem".
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatMemoryBlocks {

    static final String FORGET_HEADER = "[Elfelejtve]";
    static final int LINE_MAX_CHARS = 160;
    private static final Pattern CONTROL = Pattern.compile("[\\r\\n\\t\\p{Cc}]+");

    private final TurnMemoryService turnMemoryService;
    private final PromptPersona promptPersona;

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
