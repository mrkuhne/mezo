package io.mrkuhne.mezo.feature.character.service.chat;

import java.util.List;

/** The parsed model answer — every field already trimmed/validated by the writer; verdict null = unknown. */
public record TeamChatReplyDraft(String reply, boolean voiced, String verdict, String contextTag,
        String factText, List<String> keywords) {
    public static final String CONCRETE = "concrete_context";
    public static TeamChatReplyDraft template(String reply) {
        return new TeamChatReplyDraft(reply, false, null, null, null, List.of());
    }
}
