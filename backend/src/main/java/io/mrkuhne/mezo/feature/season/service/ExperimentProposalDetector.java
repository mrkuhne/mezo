package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonExperimentEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonExperimentSourcePort;
import io.mrkuhne.mezo.feature.season.repository.SeasonExperimentRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Boop's experiment idea (Boop B6 Évad S4, spec §5.9): at most one proposal per run, only when the active season's
 * „Boop is javasol kísérletet” is on and there is neither an open proposal nor a running experiment. Candidates of the
 * last {@link #LOOKBACK_DAYS} days, newest first, skipping a subject this season already had an experiment about (any
 * status): a supplement newly in the stack, a recipe / food eaten for the first time and again within a week, a
 * journal line saying he started something („elkezdtem”, „mostantól”). The reason is one Hungarian sentence and never
 * carries a health value.
 *
 * <p>Called by {@link ExperimentService} in its own {@code REQUIRES_NEW} transaction, wrapped in a catch: a failing
 * detector rolls back only itself and never breaks the list call or the daily pass.
 */
@Component
@RequiredArgsConstructor
public class ExperimentProposalDetector {

    static final int LOOKBACK_DAYS = 3;
    static final int TITLE_MAX = 80;
    /** At a word start only (not inside „visszaelkezdtem”); no negation handling. */
    private static final Pattern STARTED = Pattern.compile("(?iu)(?<![\\p{L}])(elkezdtem|mostantól)");
    private static final List<String> WEEKDAYS = List.of("Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat",
        "Vasárnap");

    private final SeasonExperimentRepository experiments;
    private final SeasonExperimentSourcePort source;

    private record Candidate(LocalDate date, String kind, UUID ref, String title, String reason) {
    }

    /** Creates (and returns) at most one proposal for the season; empty when nothing qualifies. */
    public Optional<SeasonExperimentEntity> detect(UUID owner, SeasonEntity season, LocalDate today) {
        if (!season.isProposeExperiments()
            || !experiments.findBySeasonIdAndStatus(season.getId(), SeasonExperimentEntity.STATUS_PROPOSED).isEmpty()
            || !experiments.findBySeasonIdAndStatus(season.getId(), SeasonExperimentEntity.STATUS_RUNNING).isEmpty()) {
            return Optional.empty();
        }
        Set<UUID> seenRefs = new HashSet<>();
        Set<String> seenTitles = new HashSet<>();
        for (SeasonExperimentEntity e : experiments.findBySeasonIdOrderByCreatedAtDesc(season.getId())) {
            if (e.getSubjectRef() != null) {
                seenRefs.add(e.getSubjectRef());
            }
            seenTitles.add(key(e.getTitle()));
        }
        LocalDate from = today.minusDays(LOOKBACK_DAYS);
        Optional<Candidate> pick = candidates(owner, from, today).stream()
            .filter(c -> c.ref() == null ? !seenTitles.contains(key(c.title())) : !seenRefs.contains(c.ref()))
            .filter(c -> !c.title().isBlank())
            .findFirst();
        return pick.map(c -> {
            SeasonExperimentEntity e = new SeasonExperimentEntity();
            e.setCreatedBy(owner);
            e.setSeasonId(season.getId());
            e.setSubjectKind(c.kind());
            e.setSubjectRef(c.ref());
            e.setTitle(c.title());
            e.setReason(c.reason());
            e.setStatus(SeasonExperimentEntity.STATUS_PROPOSED);
            return experiments.saveAndFlush(e);
        });
    }

    private List<Candidate> candidates(UUID owner, LocalDate from, LocalDate today) {
        List<Candidate> out = new ArrayList<>();
        for (SeasonExperimentSourcePort.NewSupplement s : source.newSupplements(owner, from)) {
            String name = shorten(s.name());
            String reason = s.since().equals(today)
                ? "Ma került a napi étrend-kiegészítőid közé: " + name + "."
                : WEEKDAYS.get(s.since().getDayOfWeek().getValue() - 1) + " óta szerepel a napi étrend-kiegészítőid között: "
                    + name + ".";
            out.add(new Candidate(s.since(), "supplement", s.pantryItemId(), name, reason));
        }
        for (SeasonExperimentSourcePort.RepeatedFood f : source.repeatedFirstFoods(owner,
            from.minusDays(SeasonExperimentSourcePort.REPEAT_WITHIN_DAYS), today)) {
            if (!f.againOn().isBefore(from)) {
                String name = shorten(f.name());
                out.add(new Candidate(f.againOn(), f.kind(), f.ref(), name,
                    "Nemrég ettél először ilyet, és egy héten belül újra: " + name + "."));
            }
        }
        for (SeasonExperimentSourcePort.JournalLine j : source.journalLines(owner, from, today)) {
            startedSentence(j.text()).ifPresent(t -> out.add(new Candidate(j.date(), "text", null, t,
                "A naplódba azt írtad, hogy belekezdtél valami újba.")));
        }
        out.sort(Comparator.comparing(Candidate::date).reversed());
        return out;
    }

    /** The first sentence of the journal text saying he started something, trimmed to a title; empty without one. */
    static Optional<String> startedSentence(String text) {
        if (text == null) {
            return Optional.empty();
        }
        for (String sentence : text.split("[.!?\\n]+")) {
            if (STARTED.matcher(sentence).find()) {
                String t = shorten(sentence);
                if (!t.isEmpty()) {
                    return Optional.of(t);
                }
            }
        }
        return Optional.empty();
    }

    /** One inert line of at most {@link #TITLE_MAX} characters (whitespace collapsed, brackets dropped). */
    static String shorten(String raw) {
        String t = raw == null ? "" : raw.replaceAll("[\\[\\]]", "").replaceAll("\\s+", " ").strip();
        return t.length() <= TITLE_MAX ? t : t.substring(0, TITLE_MAX - 1).strip() + "…";
    }

    private static String key(String title) {
        return title == null ? "" : title.strip().toLowerCase(Locale.ROOT);
    }
}
