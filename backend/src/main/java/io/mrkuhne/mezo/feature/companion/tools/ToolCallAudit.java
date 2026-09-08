package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.IntStream;

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

    /** Dedup identity for a ref — (kind, id) ONLY (mezo-b3pp.33). {@link RefsEnvelope.Ref} is a
     *  record whose equals now also covers {@code label}, so the same (kind,id) arriving with and
     *  without a label (e.g. the same Memory day from a tool call vs. ambient recall, or a graph
     *  node reached by two edges) would stop deduping and both would eat the cap if the set kept
     *  keying on the whole record. */
    private record RefKey(String kind, String id) {
    }

    /** One executed tool call as the verdict judge sees it (mezo-indo). {@code result} is the raw
     *  tool output — the digest that renders it into the judge payload owns truncation. */
    public record ToolOutcome(String name, String args, String result) {
    }

    private final int maxCalls;
    private final int maxRefs;
    private final List<ToolCallsEnvelope.ToolCall> calls = new ArrayList<>();
    private final Map<RefKey, RefsEnvelope.Ref> refs = new LinkedHashMap<>();
    /** Positionally parallel to {@link #calls}; a null entry is a call whose output never arrived. */
    private final List<String> results = new ArrayList<>();

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
    // volatile: registered on the subscribing (request) thread via onCall, but invoked from
    // whatever thread Reactor executes the tool call on (mezo-280) — a plain field is not
    // guaranteed to be visible across that handoff.
    private volatile Consumer<ToolCallsEnvelope.ToolCall> listener;

    public void onCall(Consumer<ToolCallsEnvelope.ToolCall> listener) {
        this.listener = listener;
    }

    /** @return the call's index, the handle {@link #recordResult(int, String)} attaches its output to. */
    public int recordCall(String name, String args) {
        ToolCallsEnvelope.ToolCall call = new ToolCallsEnvelope.ToolCall(TYPE_READ, name, args);
        calls.add(call);
        results.add(null);
        if (listener != null) {
            try {
                listener.accept(call);
            } catch (RuntimeException e) {
                log.warn("Companion tool-call listener failed for {}", name, e);
            }
        }
        return calls.size() - 1;
    }

    /**
     * mezo-indo: attaches what the tool actually RETURNED to an already-recorded call. Two steps
     * rather than one because {@link #recordCall} fires the live SSE listener BEFORE the tool runs
     * — the chip must appear while the read is in flight, the result only exists afterwards.
     * Out-of-range indices are ignored: the audit is the turn's record and must never throw into a
     * streamed answer.
     */
    public void recordResult(int callIndex, String result) {
        if (callIndex < 0 || callIndex >= results.size()) {
            log.warn("Companion tool-result recorded for unknown call index {}", callIndex);
            return;
        }
        results.set(callIndex, result);
    }

    /** Deduped on (kind, id) and capped — the first {@code maxRefs} distinct refs win. Label-less
     *  form every non-graph producer uses. */
    public void addRef(String kind, String id) {
        addRef(kind, id, null);
    }

    /** Same dedup/cap as {@link #addRef(String, String)}, plus a display label (mezo-b3pp.33 —
     *  today only graph refs pass one). The FIRST ref for a given (kind, id) wins: a later call
     *  for the same key — labelled or not — is dropped rather than replacing it, so tool refs
     *  (added first) keep provenance priority over ambient refs added afterwards
     *  ({@code ChatService:281-283}). */
    public void addRef(String kind, String id, String label) {
        RefKey key = new RefKey(kind, id);
        if (refs.containsKey(key)) {
            return;
        }
        if (refs.size() < maxRefs) {
            refs.put(key, new RefsEnvelope.Ref(kind, id, label));
        }
    }

    public int callCount() {
        return calls.size();
    }

    /**
     * Name + args + OUTPUT of every call recorded so far — the verdict payload's tool block
     * (mezo-indo). The v1 payload listed names only, which made every tool-derived number
     * structurally unsupported to the judge (measured: 0% pass at every reasoning-effort level,
     * mezo-9yqq class 1). {@code result} is null when no output was ever recorded for the call.
     * NOT persisted — the tool_calls jsonb envelope deliberately keeps only {type,name,args}.
     */
    public List<ToolOutcome> toolOutcomes() {
        return IntStream.range(0, calls.size())
                .mapToObj(i -> new ToolOutcome(calls.get(i).name(), calls.get(i).args(), results.get(i)))
                .toList();
    }

    /** Null when no tool ran — a tool-less turn persists exactly like V0.2 (null envelope → [] on the wire). */
    public ToolCallsEnvelope toToolCallsEnvelope() {
        return calls.isEmpty() ? null : new ToolCallsEnvelope(List.copyOf(calls));
    }

    public RefsEnvelope toRefsEnvelope() {
        return refs.isEmpty() ? null : new RefsEnvelope(List.copyOf(refs.values()));
    }
}
