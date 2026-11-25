package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.YearPlanProperties;
import io.mrkuhne.mezo.feature.train.service.YearGenerator.Note;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Rule checks on an edited Éves terv (mezo-r36n9.113). Pure. An owner edit that breaks a rule is always accepted;
 * these produce the warnings, the skip consequence and the "where could this group go" suggestion. Skipped blocks
 * and the consolidation are ignored, so two blocks around a skipped one count as consecutive.
 */
public final class YearRules {

    public static final String FOCUS_CONSECUTIVE = "focus_consecutive";
    public static final String NO_FOCUS_THIS_YEAR = "no_focus_this_year";
    public static final String PAIR_UNUSUAL = "pair_unusual";
    public static final String MIXED_FOCUS = "mixed_focus";

    private YearRules() {}

    public record View(UUID id, int ordinal, String kind, List<String> focus, String status, LocalDate start) {}

    /** {@code replaces} null = add {@code group} as a second focus; else swap that group out. */
    public record Suggestion(UUID blockId, int ordinal, String replaces) {}

    /**
     * Per block in ordinal order: {@code focus_consecutive}, {@code mixed_focus} (a group outside the block's kind)
     * or else {@code pair_unusual} (two groups not in the pair table); then {@code no_focus_this_year} per group of
     * {@code groups} in config order.
     */
    public static List<Note> warnings(List<View> blocks, Set<String> groups, YearPlanProperties p) {
        Set<Set<String>> pairs = new HashSet<>();
        for (List<String> pr : p.pairs()) pairs.add(Set.copyOf(pr));
        List<Note> notes = new ArrayList<>();
        List<View> live = live(blocks);
        View prev = null;
        for (View b : live) {
            if (prev != null) {
                for (String g : b.focus()) {
                    if (prev.focus().contains(g)) notes.add(new Note(FOCUS_CONSECUTIVE, g, b.ordinal()));
                }
            }
            List<String> kindGroups = p.kindGroups().getOrDefault(b.kind(), List.of());
            if (!kindGroups.containsAll(b.focus())) {
                notes.add(new Note(MIXED_FOCUS, null, b.ordinal()));
            } else if (b.focus().size() == 2 && !pairs.contains(Set.copyOf(b.focus()))) {
                notes.add(new Note(PAIR_UNUSUAL, null, b.ordinal()));
            }
            prev = b;
        }
        Set<String> focused = new HashSet<>();
        for (View b : live) focused.addAll(b.focus());
        for (String g : configOrder(groups, p)) {
            if (!focused.contains(g)) notes.add(new Note(NO_FOCUS_THIS_YEAR, g, null));
        }
        return List.copyOf(notes);
    }

    /** The focus groups of {@code blockId} that no other non-skipped block focuses (lost for the year if skipped). */
    public static List<String> skipConsequence(List<View> blocks, UUID blockId) {
        View target = blocks.stream().filter(b -> b.id().equals(blockId)).findFirst().orElse(null);
        if (target == null) return List.of();
        Set<String> elsewhere = new HashSet<>();
        for (View b : live(blocks)) if (!b.id().equals(blockId)) elsewhere.addAll(b.focus());
        return target.focus().stream().filter(g -> !elsewhere.contains(g)).toList();
    }

    /**
     * Among planned blocks of the group's kind starting after {@code today} (and not already focusing it): the latest
     * one holding a group focused ≥ 2× this year → replace that group (the most repeated; ties by focus order). Else
     * the latest single-focus block → add. Else empty.
     */
    public static Optional<Suggestion> placeFor(String group, List<View> blocks, LocalDate today,
                                                YearPlanProperties p) {
        String kind = p.kindGroups().entrySet().stream().filter(e -> e.getValue().contains(group))
            .map(Map.Entry::getKey).findFirst().orElse(null);
        if (kind == null) return Optional.empty();
        Map<String, Integer> counts = new HashMap<>();
        for (View b : live(blocks)) for (String g : b.focus()) counts.merge(g, 1, Integer::sum);
        List<View> candidates = blocks.stream()
            .filter(b -> YearGenerator.PLANNED.equals(b.status()) && kind.equals(b.kind()))
            .filter(b -> b.start() != null && b.start().isAfter(today))
            .filter(b -> !b.focus().contains(group))
            .sorted(Comparator.comparingInt(View::ordinal).reversed())
            .toList();
        for (View b : candidates) {
            String best = null;
            for (String g : b.focus()) {
                int c = counts.getOrDefault(g, 0);
                if (c >= 2 && (best == null || c > counts.get(best))) best = g;
            }
            if (best != null) return Optional.of(new Suggestion(b.id(), b.ordinal(), best));
        }
        return candidates.stream().filter(b -> b.focus().size() == 1).findFirst()
            .map(b -> new Suggestion(b.id(), b.ordinal(), null));
    }

    private static List<View> live(List<View> blocks) {
        return blocks.stream()
            .filter(b -> !YearGenerator.SKIPPED.equals(b.status()) && !YearGenerator.CONSOLIDATION.equals(b.kind()))
            .sorted(Comparator.comparingInt(View::ordinal))
            .toList();
    }

    private static List<String> configOrder(Set<String> groups, YearPlanProperties p) {
        List<String> out = new ArrayList<>();
        for (String kind : List.of(YearGenerator.UPPER, YearGenerator.LOWER)) {
            for (String g : p.kindGroups().getOrDefault(kind, List.of())) if (groups.contains(g)) out.add(g);
        }
        groups.stream().filter(g -> !out.contains(g)).sorted().forEach(out::add);
        return out;
    }
}
