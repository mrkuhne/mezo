package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.function.Consumer;

import lombok.extern.slf4j.Slf4j;

/**
 * Per-turn tool audit collector (V0.5). One instance per chat turn, carried to the tools inside
 * the Spring AI ToolContext ({@link ToolContexts#AUDIT}); the {@link RecordingToolCallback}
 * decorator records every call, the tools add their data refs. Spring AI executes a turn's tool
 * calls sequentially, so no synchronization is needed.
 */
@Slf4j
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

    /**
     * Optional per-turn progress listener (mezo-280). The streamed path registers one to turn each
     * recorded call into a live SSE 'tool' event; the sync path registers none. Kept to a single
     * listener — this is a progress hook, not an event bus — and deliberately fail-safe: the audit
     * is the authoritative record of the turn and must survive a broken listener.
     */
    private Consumer<ToolCallsEnvelope.ToolCall> listener;

    public void onCall(Consumer<ToolCallsEnvelope.ToolCall> listener) {
        this.listener = listener;
    }

    public void recordCall(String name, String args) {
        ToolCallsEnvelope.ToolCall call = new ToolCallsEnvelope.ToolCall(TYPE_READ, name, args);
        calls.add(call);
        if (listener != null) {
            try {
                listener.accept(call);
            } catch (RuntimeException e) {
                log.warn("Companion tool-call listener failed for {}", name, e);
            }
        }
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
