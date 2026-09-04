package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

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
 */
public record CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                       String interventionKey, String setupKey,
                                       String adviceKey, List<String> facts,
                                       List<String> suggestions) {

    /** The pre-W5.2 shape — every prose-kind writer stays on this. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs) {
        this(eyebrow, body, refs, null, null, null, null, null);
    }

    /** The W5.2 intervention shape — kept so existing call sites compile unchanged. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                    String interventionKey) {
        this(eyebrow, body, refs, interventionKey, null, null, null, null);
    }

    /** The S3 setup shape — kept so existing call sites compile unchanged. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                    String interventionKey, String setupKey) {
        this(eyebrow, body, refs, interventionKey, setupKey, null, null, null);
    }

    /** The S4 advice shape. {@code interventionKey}/{@code setupKey} stay nullable: a flag-sourced
     *  card carries the library entry key, a setup-sourced one the check key, never both. */
    public static CompanionMessageEnvelope advice(String eyebrow, String prose, String adviceKey,
                                                  String interventionKey, String setupKey,
                                                  List<String> facts, List<String> suggestions) {
        return new CompanionMessageEnvelope(eyebrow, List.of(prose), List.of(),
            interventionKey, setupKey, adviceKey, List.copyOf(facts), List.copyOf(suggestions));
    }

    public record Ref(String kind, String label) {
    }
}
