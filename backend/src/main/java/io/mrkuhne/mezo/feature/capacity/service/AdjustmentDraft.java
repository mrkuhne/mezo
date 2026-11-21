package io.mrkuhne.mezo.feature.capacity.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One step of a proposal's bundle before it is accepted (Boop B7 K3, mezo-r36n9.17): an {@code AdjustmentKind} name and
 * its payload map (shape: {@link AdjustmentPayload}). A proposal stores its steps in {@code capacity_proposal.bundle} as
 * {@code {"steps": [{"kind": ..., "payload": {...}}, ...]}} — {@link #toBundle} / {@link #fromBundle} are the only
 * writers/readers of that shape.
 */
public record AdjustmentDraft(String kind, Map<String, Object> payload) {

    static final String STEPS = "steps";

    public static AdjustmentDraft of(AdjustmentPayload payload) {
        return new AdjustmentDraft(payload.kind().name(), payload.toMap());
    }

    public static Map<String, Object> toBundle(List<AdjustmentDraft> steps) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (AdjustmentDraft d : steps) {
            Map<String, Object> step = new LinkedHashMap<>();
            step.put("kind", d.kind());
            step.put("payload", d.payload());
            list.add(step);
        }
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put(STEPS, list);
        return bundle;
    }

    /** The bundle's steps in order; an unreadable bundle yields no steps (the caller treats it as stale). */
    @SuppressWarnings("unchecked")
    public static List<AdjustmentDraft> fromBundle(Map<String, Object> bundle) {
        if (bundle == null || !(bundle.get(STEPS) instanceof List<?> raw)) {
            return List.of();
        }
        List<AdjustmentDraft> out = new ArrayList<>();
        for (Object o : raw) {
            if (o instanceof Map<?, ?> step && step.get("kind") instanceof String kind) {
                Object payload = step.get("payload");
                out.add(new AdjustmentDraft(kind, payload instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of()));
            }
        }
        return out;
    }
}
