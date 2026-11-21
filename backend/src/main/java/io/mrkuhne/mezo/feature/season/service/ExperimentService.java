package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonExperimentEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonExperimentResultJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonRevisionEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonMetricsPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonExperimentRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRevisionRepository;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The season's experiments (Boop B6 Évad S4, spec §5.9 / §5.11): one runs at a time, he marks the days he did it, and
 * when the window is over it is compared with the same number of days before it ({@link ExperimentEvaluator}) — the
 * verdict, the signals and the other changes inside the window are stored once. Boop's proposals come from
 * {@link ExperimentProposalDetector}. Every operation needs the active season (404 without one, like the menu).
 * Finishing is lazy (the list call) and daily ({@link SeasonExperimentJob}).
 */
@Service
@RequiredArgsConstructor
public class ExperimentService {

    static final String OVERLAP_MESOCYCLE = "Közben új edzésblokk indult";
    static final String OVERLAP_DELOAD = "Közben könnyebb edzéshét volt";
    static final String OVERLAP_KIMELO = "Közben kímélő napjaid voltak";
    static final String OVERLAP_SEASON = "Közben módosítottad az évadot";

    private final SeasonRepository seasons;
    private final SeasonRevisionRepository revisions;
    private final SeasonExperimentRepository experiments;
    private final SeasonMetricsPort metrics;
    private final SeasonTrainPort trainPort;
    private final ExperimentProposalDetector detector;
    private final WearableProperties wearableProperties;

    /** One experiment as the contract shows it: the row, today's day index (running), the overlaps so far / in all. */
    public record View(SeasonExperimentEntity experiment, Integer dayIndex, int needDays,
                       List<ExperimentEvaluator.Overlap> overlaps, List<String> watched) {
    }

    /** The Hatás tab: the open proposal, the running one, the finished ones newest first, the season's setting. */
    public record Listing(View proposal, View running, List<View> past, boolean proposeOn) {
    }

    // --- reads (with the lazy finish + the detector) ---------------------------------------------------------------

    @Transactional
    public Listing list(UUID owner, LocalDate today) {
        SeasonEntity s = requireActive(owner);
        finishDue(owner, today);
        detector.detect(owner, s, today);
        View proposal = first(owner, SeasonExperimentEntity.STATUS_PROPOSED).map(e -> view(owner, e, today)).orElse(null);
        View running = first(owner, SeasonExperimentEntity.STATUS_RUNNING).map(e -> view(owner, e, today)).orElse(null);
        List<View> past = experiments.findBySeasonIdOrderByCreatedAtDesc(s.getId()).stream()
            .filter(e -> e.is(SeasonExperimentEntity.STATUS_DONE))
            .sorted(Comparator.comparing(SeasonExperimentEntity::getFinishedOn,
                Comparator.nullsLast(Comparator.reverseOrder())))
            .map(e -> view(owner, e, today))
            .toList();
        return new Listing(proposal, running, past, s.isProposeExperiments());
    }

    /** The daily job's pass for one owner: finish what is due, then let Boop propose. */
    @Transactional
    public void daily(UUID owner, LocalDate today) {
        Optional<SeasonEntity> s = seasons.findActive(owner);
        if (s.isEmpty()) {
            return;
        }
        finishDue(owner, today);
        detector.detect(owner, s.get(), today);
    }

    // --- writes ----------------------------------------------------------------------------------------------------

    /** His own experiment („Új kísérlet”), running from today; 409 {@code EXPERIMENT_ALREADY_RUNNING} while one runs. */
    @Transactional
    public View create(UUID owner, String title, String subjectKind, UUID subjectRef, Integer lengthDays, LocalDate today) {
        SeasonEntity s = requireActive(owner);
        finishDue(owner, today);
        requireNoneRunning(owner);
        String t = ExperimentProposalDetector.shorten(title);
        if (t.isEmpty()) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "title").build(),
                HttpStatus.BAD_REQUEST);
        }
        SeasonExperimentEntity e = new SeasonExperimentEntity();
        e.setCreatedBy(owner);
        e.setSeasonId(s.getId());
        e.setSubjectKind(subjectKind == null ? "habit" : subjectKind);
        e.setSubjectRef(subjectRef);
        e.setTitle(t);
        e.setLengthDays(lengthDays == null ? SeasonExperimentEntity.DEFAULT_LENGTH : lengthDays);
        e.setStatus(SeasonExperimentEntity.STATUS_RUNNING);
        e.setStartDate(today);
        return view(owner, experiments.saveAndFlush(e), today);
    }

    /** A proposal starts („Indulhat”) from today. */
    @Transactional
    public View start(UUID owner, UUID id, LocalDate today) {
        requireActive(owner);
        finishDue(owner, today);
        SeasonExperimentEntity e = require(owner, id);
        if (!e.is(SeasonExperimentEntity.STATUS_PROPOSED)) {
            throw conflict("EXPERIMENT_NOT_PROPOSED");
        }
        requireNoneRunning(owner);
        e.setStatus(SeasonExperimentEntity.STATUS_RUNNING);
        e.setStartDate(today);
        touch(e);
        return view(owner, experiments.saveAndFlush(e), today);
    }

    /** Marks (or unmarks) one day of the running experiment — inside the window, never in the future. */
    @Transactional
    public View markDay(UUID owner, UUID id, LocalDate date, boolean done, LocalDate today) {
        requireActive(owner);
        SeasonExperimentEntity e = require(owner, id);
        if (!e.is(SeasonExperimentEntity.STATUS_RUNNING)) {
            throw conflict("EXPERIMENT_NOT_RUNNING");
        }
        LocalDate last = e.endDate().isBefore(today) ? e.endDate() : today;
        if (date == null || date.isBefore(e.getStartDate()) || date.isAfter(last)) {
            throw new SystemRuntimeErrorException(SystemMessage.error("EXPERIMENT_DAY_OUTSIDE").build(),
                HttpStatus.BAD_REQUEST);
        }
        TreeSet<LocalDate> days = new TreeSet<>(e.getMarkedDays() == null ? List.of() : e.getMarkedDays());
        if (done) {
            days.add(date);
        } else {
            days.remove(date);
        }
        e.setMarkedDays(new ArrayList<>(days));
        touch(e);
        return view(owner, experiments.saveAndFlush(e), today);
    }

    /** „Most nem” (a proposal) or „Leállítom” (a running one) → dismissed; anything else stays as it is. */
    @Transactional
    public View dismiss(UUID owner, UUID id, LocalDate today) {
        requireActive(owner);
        SeasonExperimentEntity e = require(owner, id);
        if (e.is(SeasonExperimentEntity.STATUS_PROPOSED) || e.is(SeasonExperimentEntity.STATUS_RUNNING)) {
            e.setStatus(SeasonExperimentEntity.STATUS_DISMISSED);
            touch(e);
            experiments.saveAndFlush(e);
        }
        return view(owner, e, today);
    }

    /** „Megtartom szokásnak” — only a finished experiment; idempotent. */
    @Transactional
    public View keep(UUID owner, UUID id, LocalDate today) {
        requireActive(owner);
        SeasonExperimentEntity e = require(owner, id);
        if (!e.is(SeasonExperimentEntity.STATUS_DONE)) {
            throw conflict("EXPERIMENT_NOT_DONE");
        }
        if (!e.isKept()) {
            e.setKept(true);
            touch(e);
            experiments.saveAndFlush(e);
        }
        return view(owner, e, today);
    }

    // --- finishing -------------------------------------------------------------------------------------------------

    /** Finishes the running experiment whose window ended before today. */
    void finishDue(UUID owner, LocalDate today) {
        for (SeasonExperimentEntity e : experiments.findByCreatedByAndStatus(owner, SeasonExperimentEntity.STATUS_RUNNING)) {
            if (e.getStartDate() != null && e.endDate().isBefore(today)) {
                finish(owner, e);
            }
        }
    }

    /** Compares the window with the same number of days before it and stores the verdict once. */
    void finish(UUID owner, SeasonExperimentEntity e) {
        LocalDate start = e.getStartDate();
        LocalDate end = e.endDate();
        LocalDate baselineFrom = start.minusDays(e.getLengthDays());
        LocalDate baselineTo = start.minusDays(1);
        List<ExperimentEvaluator.Overlap> overlaps = overlaps(owner, e.getSeasonId(), start, end);
        int marked = (int) markedIn(e, start, end);
        ExperimentEvaluator.Result r = ExperimentEvaluator.evaluate(
            metrics.experimentSignals(owner, baselineFrom, baselineTo), metrics.experimentSignals(owner, start, end),
            marked, e.getLengthDays(), overlaps);
        e.setResult(new SeasonExperimentResultJson(r.verdict(),
            r.signals().stream().map(x -> new SeasonExperimentResultJson.Signal(x.key(), x.before(), x.after(),
                x.nBefore(), x.nAfter(), x.cliffsDelta(), x.clear(), x.better())).toList(),
            baselineFrom, baselineTo, marked,
            r.overlaps().stream().map(o -> new SeasonExperimentResultJson.Overlap(o.kind(), o.date(), o.text())).toList()));
        e.setStatus(SeasonExperimentEntity.STATUS_DONE);
        e.setFinishedOn(end.plusDays(1));
        touch(e);
        experiments.saveAndFlush(e);
    }

    /** The other changes inside {@code from..to}: a block started, a deload week, kímélő days, a season change. */
    List<ExperimentEvaluator.Overlap> overlaps(UUID owner, UUID seasonId, LocalDate from, LocalDate to) {
        List<ExperimentEvaluator.Overlap> out = new ArrayList<>();
        if (to.isBefore(from)) {
            return out;
        }
        for (SeasonTrainPort.TrainEvent t : trainPort.trainEvents(owner, from, to)) {
            out.add(switch (t.kind()) {
                case MESOCYCLE -> new ExperimentEvaluator.Overlap("mesocycle", t.date(), OVERLAP_MESOCYCLE);
                case DELOAD -> new ExperimentEvaluator.Overlap("deload", t.date(), OVERLAP_DELOAD);
                case KIMELO -> new ExperimentEvaluator.Overlap("kimelo", t.date(), OVERLAP_KIMELO);
            });
        }
        ZoneId zone = ZoneId.of(wearableProperties.zone());
        List<SeasonRevisionEntity> revs = revisions.findBySeasonIdOrderByCreatedAtAsc(seasonId);
        // the first revision is the activation itself, not a change
        for (SeasonRevisionEntity r : revs.stream().skip(1).toList()) {
            LocalDate d = r.getCreatedAt() == null ? null : r.getCreatedAt().atZone(zone).toLocalDate();
            if (d != null && !d.isBefore(from) && !d.isAfter(to)) {
                out.add(new ExperimentEvaluator.Overlap("season", d, OVERLAP_SEASON));
                break;
            }
        }
        out.sort(Comparator.comparing(ExperimentEvaluator.Overlap::date));
        return out;
    }

    // --- view ------------------------------------------------------------------------------------------------------

    View view(UUID owner, SeasonExperimentEntity e, LocalDate today) {
        Integer dayIndex = null;
        List<ExperimentEvaluator.Overlap> overlaps = List.of();
        if (e.is(SeasonExperimentEntity.STATUS_RUNNING) && e.getStartDate() != null) {
            dayIndex = dayIndex(e, today);
            LocalDate to = e.endDate().isBefore(today) ? e.endDate() : today;
            overlaps = overlaps(owner, e.getSeasonId(), e.getStartDate(), to);
        } else if (e.is(SeasonExperimentEntity.STATUS_DONE) && e.getResult() != null) {
            overlaps = e.getResult().overlapsOrEmpty().stream()
                .map(o -> new ExperimentEvaluator.Overlap(o.kind(), o.date(), o.text())).toList();
        }
        return new View(e, dayIndex, ExperimentEvaluator.needDays(e.getLengthDays()), overlaps, ExperimentEvaluator.KEYS);
    }

    // --- helpers ---------------------------------------------------------------------------------------------------

    /** Which day of the window today is (1-based, capped at the length). */
    public static int dayIndex(SeasonExperimentEntity e, LocalDate today) {
        return (int) Math.max(1, Math.min(e.getLengthDays(), ChronoUnit.DAYS.between(e.getStartDate(), today) + 1));
    }

    private static long markedIn(SeasonExperimentEntity e, LocalDate from, LocalDate to) {
        return e.getMarkedDays() == null ? 0
            : e.getMarkedDays().stream().distinct().filter(d -> !d.isBefore(from) && !d.isAfter(to)).count();
    }

    private Optional<SeasonExperimentEntity> first(UUID owner, String status) {
        return experiments.findByCreatedByAndStatus(owner, status).stream().findFirst();
    }

    private void requireNoneRunning(UUID owner) {
        if (first(owner, SeasonExperimentEntity.STATUS_RUNNING).isPresent()) {
            throw conflict("EXPERIMENT_ALREADY_RUNNING");
        }
    }

    private SeasonEntity requireActive(UUID owner) {
        return seasons.findActive(owner).orElseThrow(ExperimentService::notFound);
    }

    private SeasonExperimentEntity require(UUID owner, UUID id) {
        return experiments.findByIdAndCreatedBy(id, owner).orElseThrow(ExperimentService::notFound);
    }

    private static void touch(SeasonExperimentEntity e) {
        e.setUpdatedAt(Instant.now());
    }

    private static SystemRuntimeErrorException conflict(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.CONFLICT);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
