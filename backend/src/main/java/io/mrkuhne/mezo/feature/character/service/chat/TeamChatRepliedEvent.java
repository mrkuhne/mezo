package io.mrkuhne.mezo.feature.character.service.chat;

import java.util.UUID;

/** S7 (mezo-d6ivw.7): the user wrote USER line {@code lineId} on ügy {@code threadId} — published by
 *  {@link TeamChatService#reply}, answered after commit by {@link TeamChatReplyListener}. */
public record TeamChatRepliedEvent(UUID userId, UUID threadId, UUID lineId) {
}
