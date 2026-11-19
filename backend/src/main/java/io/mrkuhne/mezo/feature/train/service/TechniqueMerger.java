package io.mrkuhne.mezo.feature.train.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Validates the AI's technique refinement against the planner's frame (T4, {@code mezo-r36n9.82}, spec §6.5). Pure.
 * Every change the model proposes is re-checked; whatever breaks a rule is dropped silently, so the worst a bad
 * answer can do is change nothing.
 *
 * <ul>
 *   <li><b>Challenge moves first</b> (the challenge wins, spec §11 Q6): onto a row of the same day that is a valid
 *       challenge candidate ({@link TechniquePlanner#challengeValid}), never onto or away from an owner's pick; a
 *       machine technique on the new challenge row is cleared. One move per day.</li>
 *   <li><b>Technique changes</b>, removals first (they free allowance): {@code rest_drop | myo | drop | none} on a row
 *       that is not the owner's and not a challenge; a technique only from the start week on an eligible row
 *       ({@link TechniquePlanner#eligible}); an added technique must fit the day's allowance and the muscle's
 *       weekly limit counted on the result (the owner's picks included). A kind swap keeps the counts.</li>
 *   <li>Every accepted change needs a non-blank reason (trimmed, at most {@link #MAX_NOTE} characters); unknown
 *       rows, days or technique values are dropped.</li>
 * </ul>
 * Accepted picks carry source {@code ai} and reason {@code ai_suggested}; {@code notes} maps every row an accepted
 * change touched (a challenge move: both rows) to the model's reason.
 */
public final class TechniqueMerger {

    static final int MAX_NOTE = 160;

    private TechniqueMerger() {}

    public record Merged(TechniquePlanner.Week week, Map<UUID, String> notes) {

        public boolean changed() {
            return !notes.isEmpty();
        }
    }

    private record Located(TechniquePlanner.PlanRow row, TechniquePlanner.PlanDay day) {}

    public static Merged merge(TechniquePlanner.Input in, TechniquePlanner.Week planned,
                               TechniqueLlm.Suggestion suggestion) {
        if (suggestion == null || in.deloadWeek()) {
            return new Merged(planned, Map.of());
        }
        Map<UUID, Located> rows = new HashMap<>();
        in.days().forEach(d -> d.rows().forEach(r -> rows.put(r.id(), new Located(r, d))));

        Map<UUID, TechniquePlanner.Pick> techniques = new LinkedHashMap<>();
        planned.techniques().forEach(p -> techniques.put(p.id(), p));
        List<TechniquePlanner.Pick> challenges = new ArrayList<>(planned.challenges());
        Map<UUID, String> notes = new LinkedHashMap<>();

        // 1. challenge moves
        Set<Integer> movedDays = new HashSet<>();
        for (TechniqueLlm.ChallengeMove move : nullSafe(suggestion.challenges())) {
            Optional<String> note = note(move.reason());
            Located target = move.exerciseId() == null ? null : rows.get(move.exerciseId());
            if (note.isEmpty() || target == null || move.dayIndex() == null
                    || target.day().dayIndex() != move.dayIndex() || !movedDays.add(move.dayIndex())) continue;
            TechniquePlanner.PlanRow r = target.row();
            List<TechniquePlanner.Pick> dayChallenges = challenges.stream()
                .filter(p -> p.dayIndex() == r.dayIndex()).toList();
            boolean ownerHolds = dayChallenges.stream().anyMatch(p -> TechniquePlanner.SOURCE_OWNER.equals(p.source()));
            boolean already = dayChallenges.stream().anyMatch(p -> p.id().equals(r.id()));
            TechniquePlanner.Pick onTarget = techniques.get(r.id());
            boolean ownerTechnique = TechniquePlanner.owned(r)
                || (onTarget != null && TechniquePlanner.SOURCE_OWNER.equals(onTarget.source()));
            if (ownerHolds || already || ownerTechnique || !TechniquePlanner.challengeValid(r, target.day(), in)) {
                movedDays.remove(move.dayIndex());
                continue;
            }
            dayChallenges.forEach(p -> notes.put(p.id(), note.get()));
            challenges.removeAll(dayChallenges);
            challenges.add(aiPick(r, Technique.PARTIALS));
            techniques.remove(r.id());
            notes.put(r.id(), note.get());
        }
        Set<UUID> challengeIds = new HashSet<>();
        challenges.forEach(p -> challengeIds.add(p.id()));

        // 2. technique changes, removals first
        List<TechniqueLlm.Change> changes = new ArrayList<>(nullSafe(suggestion.changes()));
        changes.sort(Comparator.comparing(c -> parse(c.technique()).map(t -> t != Technique.NONE).orElse(true)));
        Set<UUID> changedRows = new HashSet<>();
        for (TechniqueLlm.Change change : changes) {
            Optional<String> note = note(change.reason());
            Optional<Technique> want = parse(change.technique());
            Located at = change.exerciseId() == null ? null : rows.get(change.exerciseId());
            if (note.isEmpty() || want.isEmpty() || at == null || !changedRows.add(change.exerciseId())) continue;
            TechniquePlanner.PlanRow r = at.row();
            TechniquePlanner.Pick current = techniques.get(r.id());
            Technique now = current == null ? Technique.NONE : current.technique();
            boolean ownerRow = TechniquePlanner.owned(r)
                || (current != null && TechniquePlanner.SOURCE_OWNER.equals(current.source()));
            if (ownerRow || challengeIds.contains(r.id()) || want.get() == now) continue;
            if (want.get() == Technique.NONE) {
                techniques.remove(r.id());
                notes.put(r.id(), note.get());
                continue;
            }
            if (in.week() < in.cfg().startWeek() || r.group() == null
                    || !TechniquePlanner.eligible(r, at.day(), in, challengeIds)) continue;
            if (current == null) {   // an add: must fit the day's allowance and the muscle's weekly limit
                long onDay = techniques.values().stream().filter(p -> p.dayIndex() == r.dayIndex()).count();
                long inGroup = techniques.values().stream()
                    .filter(p -> r.group().equals(groupOf(rows, p.id()))).count();
                if (onDay + 1 > TechniquePlanner.allowance(at.day(), in)
                        || inGroup + 1 > in.cfg().maxPerMuscleWeek()) continue;
            }
            techniques.put(r.id(), aiPick(r, want.get()));
            notes.put(r.id(), note.get());
        }

        if (notes.isEmpty()) {
            return new Merged(planned, Map.of());
        }
        Comparator<TechniquePlanner.Pick> byPosition = Comparator.comparingInt(TechniquePlanner.Pick::dayIndex)
            .thenComparingInt(TechniquePlanner.Pick::exerciseIndex);
        List<TechniquePlanner.Pick> t = new ArrayList<>(techniques.values());
        t.sort(byPosition);
        challenges.sort(byPosition);
        return new Merged(new TechniquePlanner.Week(List.copyOf(t), List.copyOf(challenges), planned.warnings(),
            planned.remainingByDay(), planned.perGroup()), Map.copyOf(notes));
    }

    private static TechniquePlanner.Pick aiPick(TechniquePlanner.PlanRow r, Technique technique) {
        return new TechniquePlanner.Pick(r.dayIndex(), r.exerciseIndex(), r.id(), technique,
            TechniquePlanner.SOURCE_AI, TechniquePlanner.REASON_AI_SUGGESTED);
    }

    private static String groupOf(Map<UUID, Located> rows, UUID id) {
        Located l = rows.get(id);
        return l == null ? null : l.row().group();
    }

    /** {@code rest_drop | myo | drop | none}; anything else (partials included) is not the AI's to set. */
    static Optional<Technique> parse(String wire) {
        if (wire == null) return Optional.empty();
        return switch (wire.strip().toLowerCase(Locale.ROOT)) {
            case "rest_drop" -> Optional.of(Technique.REST_DROP);
            case "myo" -> Optional.of(Technique.MYO);
            case "drop" -> Optional.of(Technique.DROP);
            case "none" -> Optional.of(Technique.NONE);
            default -> Optional.empty();
        };
    }

    private static Optional<String> note(String reason) {
        if (reason == null || reason.isBlank()) return Optional.empty();
        String s = reason.strip().replaceAll("\\s+", " ");
        return Optional.of(s.length() > MAX_NOTE ? s.substring(0, MAX_NOTE - 1).strip() + "…" : s);
    }

    private static <T> List<T> nullSafe(List<T> list) {
        return list == null ? List.of() : list.stream().filter(java.util.Objects::nonNull).toList();
    }
}
