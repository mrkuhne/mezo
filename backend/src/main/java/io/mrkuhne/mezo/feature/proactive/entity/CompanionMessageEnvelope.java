package io.mrkuhne.mezo.feature.proactive.entity;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Typed jsonb envelope for companion_message.content (ADR 0006 / ProvenanceEnvelope precedent).
 * Refs are code-collected candidates the model selected by index (never invented).
 * {@code interventionKey} (W5.2, bd mezo-b3pp.19) names the intervention-LIBRARY ENTRY
 * ({@code mezo.companion.interventions[].key}) so the „Segített?" verdict can be rolled up per
 * entry, the per-entry cooldown can be applied, and {@code AnchorResolver} can read the entry's
 * push channel; it is set on pre-S4 {@code intervention} rows and on flag-sourced {@code advice}
 * rows, null everywhere else. {@code setupKey} (S3, bd mezo-d58h.3) names the setup check; set on
 * pre-S4 {@code setup} rows and on setup-sourced {@code advice} rows.
 *
 * <p>{@code adviceKey} / {@code facts} / {@code suggestions} (S4, bd mezo-d58h.4, spec §5) are set
 * ONLY on {@code kind=advice} rows. {@code adviceKey} is the SEVERITY key — the flag key or the
 * setup-check key that {@code AdvicePriority} ranks — deliberately NOT the same identifier as
 * {@code interventionKey}: one flag can be served by several library entries. Old rows
 * deserialize every one of these to null (trailing components are jsonb-safe to ADD; removing one
 * would not be).
 *
 * <p>{@code actions} / {@code applied} (S5, bd mezo-d58h.5, spec §6) carry the card's mutation
 * set. {@code actions} is RULE-provided — assembled by the dispatch layer from the fired
 * check/flag, never written or invented by the model, which stays prose-only. {@code applied} is
 * written by the apply path (a later task), not by delivery: every card is generated with
 * {@code applied == null}, and it only ever gets set in place, once, when the user actually taps
 * a button — so a re-tap can be told apart from a first application. Both are trailing components
 * for the same jsonb-safety reason as the S4 fields: pre-S5 advice rows deserialize them to null.
 */
public record CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                       String interventionKey, String setupKey,
                                       String adviceKey, List<String> facts,
                                       List<String> suggestions,
                                       List<Action> actions, Applied applied) {

    /** The pre-W5.2 shape — every prose-kind writer stays on this. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs) {
        this(eyebrow, body, refs, null, null, null, null, null, null, null);
    }

    /** The W5.2 intervention shape — kept so existing call sites compile unchanged. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                    String interventionKey) {
        this(eyebrow, body, refs, interventionKey, null, null, null, null, null, null);
    }

    /** The S3 setup shape — kept so existing call sites compile unchanged. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                    String interventionKey, String setupKey) {
        this(eyebrow, body, refs, interventionKey, setupKey, null, null, null, null, null);
    }

    /** The S4 advice shape, kept for callers with no actions to offer. Delegates to the S5
     *  shape with an empty action list so {@code AdviceCardService} compiles unchanged until a
     *  later task wires the real catalog. */
    public static CompanionMessageEnvelope advice(String eyebrow, String prose, String adviceKey,
                                                  String interventionKey, String setupKey,
                                                  List<String> facts, List<String> suggestions) {
        return advice(eyebrow, prose, adviceKey, interventionKey, setupKey, facts, suggestions,
            List.of());
    }

    /** The S5 advice shape — with the rule's offered actions. {@code applied} always starts null:
     *  delivery never pre-applies anything. */
    public static CompanionMessageEnvelope advice(String eyebrow, String prose, String adviceKey,
                                                  String interventionKey, String setupKey,
                                                  List<String> facts, List<String> suggestions,
                                                  List<Action> actions) {
        return new CompanionMessageEnvelope(eyebrow, List.of(prose), List.of(),
            interventionKey, setupKey, adviceKey, List.copyOf(facts), List.copyOf(suggestions),
            List.copyOf(actions), null);
    }

    public record Ref(String kind, String label) {
    }

    /**
     * One offered action button (S5, spec §6). {@code params} is ALWAYS rule-provided — the model
     * writes prose only and can never invent an action or a parameter. The map is deliberately
     * loose ({@code Map<String, Object>}) because each action key has its own parameter shape and
     * the apply layer validates its own; a typed union here would need a new envelope component per
     * action, which is exactly the churn trailing-component safety exists to avoid.
     *
     * <p>{@code params} can be null or absent — a key with no parameters (or an old row written
     * before a key gained one) has nothing to carry. Downstream readers must not assume
     * non-null; the apply layer (a later task) is what validates a given key's params, not this
     * record.
     */
    public record Action(String key, String label, Map<String, Object> params) {
    }

    /** Stamped by the apply path when an action actually took effect — the card's own record that
     *  it has been acted on, and what makes a re-tap a no-op rather than a second mutation. */
    public record Applied(String actionKey, Instant at) {
    }
}
