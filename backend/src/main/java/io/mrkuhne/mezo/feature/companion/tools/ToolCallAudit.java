package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Per-turn tool audit collector (V0.5). One instance per chat turn, carried to the tools inside
 * the Spring AI ToolContext ({@link ToolContexts#AUDIT}); the {@link RecordingToolCallback}
 * decorator records every call, the tools add their data refs. Spring AI executes a turn's tool
 * calls sequentially, so no synchronization is needed.
 */
public class ToolCallAudit {

    public static final String TYPE_READ = "read";

    private final int maxCalls;
    private final int maxRefs;
    private final List<ToolCallsEnvelope.ToolCall> calls = new ArrayList<>();
    private final LinkedHashSet<RefsEnvelope.Ref> refs = new LinkedHashSet<>();

    public ToolCallAudit(int maxCalls, int maxRefs) {
        this.maxCalls = maxCalls;
        this.maxRefs = maxRefs;
    }

    public boolean budgetExhausted() {
        return calls.size() >= maxCalls;
    }

    public void recordCall(String name, String args) {
        calls.add(new ToolCallsEnvelope.ToolCall(TYPE_READ, name, args));
    }

    /** Deduped (LinkedHashSet) and capped — the first {@code maxRefs} distinct refs win. */
    public void addRef(String kind, String id) {
        if (refs.size() < maxRefs) {
            refs.add(new RefsEnvelope.Ref(kind, id));
        }
    }

    public int callCount() {
        return calls.size();
    }

    /** Names of the calls recorded so far — the V1.3 verdict payload's tool-call list. */
    public List<String> callNames() {
        return calls.stream().map(ToolCallsEnvelope.ToolCall::name).toList();
    }

    /** Null when no tool ran — a tool-less turn persists exactly like V0.2 (null envelope → [] on the wire). */
    public ToolCallsEnvelope toToolCallsEnvelope() {
        return calls.isEmpty() ? null : new ToolCallsEnvelope(List.copyOf(calls));
    }

    public RefsEnvelope toRefsEnvelope() {
        return refs.isEmpty() ? null : new RefsEnvelope(List.copyOf(refs));
    }
}
