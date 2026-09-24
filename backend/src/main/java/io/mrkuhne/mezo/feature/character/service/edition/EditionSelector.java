package io.mrkuhne.mezo.feature.character.service.edition;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * A válogatás szíve — tiszta függvény: jelöltekből 3–6 rangsorolt kiadás-poszt (spec 2026-09-24
 * §3.4). Karakter-sapka (max 2/karakter), forrás-sapka (max 1/sourceKey), feltöltő műfajok csak
 * akkor mennek ki, ha a fő jelöltek 3 alatt maradnak, és 7 napos ismétlés-tilalom, hacsak a
 * forrás időközben nem változott.
 */
public final class EditionSelector {
    public static final int MIN = 3, MAX = 6, PER_CHARACTER = 2;

    private EditionSelector() {
    }

    public static List<EditionCandidate> select(List<EditionCandidate> candidates, List<PriorShowing> last7Days,
            Instant lastEditionAt) {
        Map<String, Instant> shown = new HashMap<>();
        last7Days.forEach(p -> shown.merge(p.sourceKey(), p.shownAt(), (a, b) -> a.isAfter(b) ? a : b));
        Comparator<EditionCandidate> order = Comparator
                .comparingInt((EditionCandidate c) -> -score(c, lastEditionAt))
                .thenComparing(EditionCandidate::changedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(EditionCandidate::sourceKey);
        var eligible = candidates.stream()
                .filter(c -> {
                    var at = shown.get(c.sourceKey());
                    return at == null || (c.changedAt() != null && c.changedAt().isAfter(at));
                })
                .sorted(order).toList();
        var picked = new ArrayList<EditionCandidate>();
        take(eligible.stream().filter(c -> !c.genre().filler()).toList(), picked, MAX);
        if (picked.size() < MIN) {
            take(eligible.stream().filter(c -> c.genre().filler()).toList(), picked, MIN);
        }
        return List.copyOf(picked);
    }

    private static void take(List<EditionCandidate> pool, List<EditionCandidate> picked, int upTo) {
        for (var c : pool) {
            if (picked.size() >= upTo) {
                return;
            }
            if (picked.stream().anyMatch(p -> p.sourceKey().equals(c.sourceKey()))) {
                continue;
            }
            if (picked.stream().filter(p -> p.character() == c.character()).count() >= PER_CHARACTER) {
                continue;
            }
            picked.add(c);
        }
    }

    static int score(EditionCandidate c, Instant lastEditionAt) {
        int base = c.waiting() ? 100 : c.claimChange() ? 80 : switch (c.genre()) {
            case KISERLET -> 70;
            case ELOREJELZES -> 60;
            case ERTEKELES -> 55;
            case MEGFIGYELES -> 50;
            case KONZILIUM -> 45;
            case KERDES -> 40;
            case SEJTES -> 20;
            case KERES -> 10;
        };
        boolean fresh = lastEditionAt == null || (c.changedAt() != null && c.changedAt().isAfter(lastEditionAt));
        return base + (fresh ? 15 : 0);
    }
}
