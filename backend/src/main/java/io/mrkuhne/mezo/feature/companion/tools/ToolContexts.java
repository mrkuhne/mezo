package io.mrkuhne.mezo.feature.companion.tools;

import org.springframework.ai.chat.model.ToolContext;

import java.util.UUID;

/**
 * Keys + typed accessors for the per-turn Spring AI ToolContext. The user id ALWAYS comes from
 * here (JWT principal via ChatService), never from model-provided args — ownership scoping is
 * structural (spec §5).
 */
public final class ToolContexts {

    public static final String USER_ID = "userId";
    public static final String AUDIT = "audit";

    private ToolContexts() {
    }

    public static UUID userId(ToolContext ctx) {
        return (UUID) ctx.getContext().get(USER_ID);
    }

    public static ToolCallAudit audit(ToolContext ctx) {
        return (ToolCallAudit) ctx.getContext().get(AUDIT);
    }
}
