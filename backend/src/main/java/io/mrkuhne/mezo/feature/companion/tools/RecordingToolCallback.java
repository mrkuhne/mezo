package io.mrkuhne.mezo.feature.companion.tools;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;
import org.springframework.lang.Nullable;

/**
 * Audit + budget decorator around every companion tool (V0.5). Recording lives HERE so a tool
 * can never forget the audit; the per-turn cap soft-fails with honest in-band text (the model
 * answers from what it already has), and a tool exception becomes an honest error result —
 * one broken read must not kill a streamed turn.
 */
@Slf4j
@RequiredArgsConstructor
public class RecordingToolCallback implements ToolCallback {

    public static final String BUDGET_EXHAUSTED =
            "A tool-hívási keret erre a körre elfogyott — válaszolj a már lekért adatokból.";
    public static final String TOOL_FAILED = "Nem sikerült lekérdezni az adatot (belső hiba).";

    private final ToolCallback delegate;
    private final ToolCallAudit audit;

    @Override
    public ToolDefinition getToolDefinition() {
        return delegate.getToolDefinition();
    }

    @Override
    public ToolMetadata getToolMetadata() {
        return delegate.getToolMetadata();
    }

    @Override
    public String call(String toolInput) {
        return call(toolInput, null);
    }

    @Override
    public String call(String toolInput, @Nullable ToolContext toolContext) {
        if (audit.budgetExhausted()) {
            return BUDGET_EXHAUSTED;
        }
        audit.recordCall(getToolDefinition().name(), compactArgs(toolInput));
        try {
            return delegate.call(toolInput, toolContext);
        } catch (Exception e) {
            log.warn("Companion tool {} failed", getToolDefinition().name(), e);
            return TOOL_FAILED;
        }
    }

    /**
     * {"days":7} → "days=7". V0.5 tool args are flat scalar JSON objects, so a manual parse is
     * full-fidelity and avoids coupling the audit to a JSON library. Anything unparseable
     * renders best-effort — never throws.
     */
    static String compactArgs(@Nullable String toolInput) {
        if (toolInput == null || toolInput.isBlank()) {
            return "";
        }
        String body = toolInput.trim();
        if (body.startsWith("{")) {
            body = body.substring(1, body.endsWith("}") ? body.length() - 1 : body.length());
        }
        if (body.isBlank()) {
            return "";
        }
        return body.replace("\"", "").replace(":", "=").replace(",", ", ").trim();
    }
}
