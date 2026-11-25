package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonExperimentEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonExperimentResultJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonRevisionEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonExperimentSourcePort;
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
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The season's experiments (Boop B6 Évad S4, spec §5.9 / §5.11): one runs at a time, he marks the days he did it, and
 * when the window is over it is compared with the same number of days before it ({@link ExperimentEvaluator}) — the
 * verdict, the signals and the other changes inside the window are stored once. Boop's proposals come from
 * {@link ExperimentProposalDetector}. Every operation needs the active season (404 without one, like the menu).
 * Finishing is lazy (the list call) and daily ({@link SeasonExperimentJob}).
 *
 * <p><b>Season scope.</b> Proposals and the running experiment are read per active season (like {@code past} and the
 * kept rules); the unique indexes stay per owner, so {@code SeasonService} dismisses the old season's proposed /
 * running rows when it closes or another one activates — the new season starts with a clean Hatás tab.
 *
 * <p><b>Detector isolation.</b> {@link #list} and {@link #daily} are not one transaction: finishing runs in one,
 * the detector in its own {@code REQUIRES_NEW} one inside a catch (a failure is logged and the call goes on), and the
 * listing is read afterwards — so a broken proposal source never fails the tab or the job.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExperimentService {

    static final String OVERLAP_MESOCYCLE = "Közben új edzésblokk indult";
    static final String OVERLAP_DELOAD = "Közben könnyebb edzéshét volt";
    static final String OVERLAP_KIMELO = "Közben kímélő napjaid voltak";
    static final String OVERLAP_SEASON = "Közben módosítottad az évadot";
    static final String OVERLAP_SUPPLEMENT = "Közben új étrend-kiegészítőt kezdtél: ";
    static final String OVERLAP_JOURNAL = "Közben ezt írtad a naplóba: „%s”";
    /** „Another change he logged”: at most one per day, at most this many per window. */
    static final int OTHER_MAX = 3;
    static final int QUOTE_MAX = 60;

    private final SeasonRepository seasons;
    private final SeasonRevisionRepository revisions;
    private final SeasonExperimentRepository experiments;
    private final SeasonMetricsPort metrics;
    private final SeasonTrainPort trainPort;
    private final ExperimentProposalDetector detector;
    private final SeasonExperimentSourcePort sources;
    private final WearableProperties wearableProperties;
    private final PlatformTransactionManager transactionManager;

    /** One experiment as the contract shows it: the row, today's day index (running), the overlaps so far / in all. */
    public record View(SeasonExperimentEntity experiment, Integer dayIndex, int needDays,
                       List<ExperimentEvaluator.Overlap> overlaps, List<String> watched) {
    }

    /** The Hatás tab: the open proposal, the running one, the finished ones newest first, the season's setting. */
    public record Listing(View proposal, View running, List<View> past, boolean proposeOn) {
    }

    // --- reads (with the lazy finish + the detector) ---------------------------------------------------------------

    /** Not {@code @Transactional} on purpose — see the class comment (detector isolation). */
    public Listing list(UUID owner, LocalDate today) {
        SeasonEntity s = requireActive(owner);
        tx(TransactionDefinition.PROPAGATION_REQUIRED).executeWithoutResult(st -> finishDue(s.getId(), today));
        detectSafely(owner, s, today);
        return tx(TransactionDefinition.PROPAGATION_REQUIRED).execute(st -> {
            View proposal = first(s.getId(), SeasonExperimentEntity.STATUS_PROPOSED)
                .map(e -> view(owner, e, today)).orElse(null);
            View running = first(s.getId(), SeasonExperimentEntity.STATUS_RUNNING)
                .map(e -> view(owner, e, today)).orElse(null);
            List<View> past = experiments.findBySeasonIdOrderByCreatedAtDesc(s.getId()).stream()
                .filter(e -> e.is(SeasonExperimentEntity.STATUS_DONE))
                .sorted(Comparator.comparing(SeasonExperimentEntity::getFinishedOn,
                    Comparator.nullsLast(Comparator.reverseOrder())))
                .map(e -> view(owner, e, today))
                .toList();
            return new Listing(proposal, running, past, s.isProposeExperiments());
        });
    }

    /** The daily job's pass for one owner: finish what is due (one transaction), then let Boop propose (its own). */
    public void daily(UUID owner, LocalDate today) {
        Optional<SeasonEntity> s = seasons.findActive(owner);
        if (s.isEmpty()) {
            return;
        }
        tx(TransactionDefinition.PROPAGATION_REQUIRED).executeWithoutResult(st -> finishDue(s.get().getId(), today));
        detectSafely(owner, s.get(), today);
    }

    /** The detector in its own transaction; a failure rolls back only the detector and is logged. */
    private void detectSafely(UUID owner, SeasonEntity s, LocalDate today) {
        try {
            tx(TransactionDefinition.PROPAGATION_REQUIRES_NEW).executeWithoutResult(st -> detector.detect(owner, s, today));
        } catch (RuntimeException e) {
            log.warn("Experiment proposal detector failed for season {}", s.getId(), e);
        }
    }

    private TransactionTemplate tx(int propagation) {
        TransactionTemplate t = new TransactionTemplate(transactionManager);
        t.setPropagationBehavior(propagation);
        return t;
    }

    // --- writes ----------------------------------------------------------------------------------------------------

    /** His own experiment („Új kísérlet”), running from today; 409 {@code EXPERIMENT_ALREADY_RUNNING} while one runs. */
    @Transactional
    public View create(UUID owner, String title, String subjectKind, UUID subjectRef, Integer lengthDays, LocalDate today) {
        SeasonEntity s = requireActive(owner);
        finishDue(s.getId(), today);
        requireNoneRunning(s.getId());
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
        return view(owner, saveRunning(e), today);
    }

    /** A proposal starts („Indulhat”) from today. */
    @Transactional
    public View start(UUID owner, UUID id, LocalDate today) {
        SeasonEntity s = requireActive(owner);
        finishDue(s.getId(), today);
        SeasonExperimentEntity e = require(owner, id);
        if (!e.is(SeasonExperimentEntity.STATUS_PROPOSED)) {
            throw conflict("EXPERIMENT_NOT_PROPOSED");
        }
        requireNoneRunning(s.getId());
        e.setStatus(SeasonExperimentEntity.STATUS_RUNNING);
        e.setStartDate(today);
        touch(e);
        return view(owner, saveRunning(e), today);
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

    /** Finishes the season's running experiment whose window ended before today. */
    void finishDue(UUID seasonId, LocalDate today) {
        for (SeasonExperimentEntity e : experiments.findBySeasonIdAndStatus(seasonId, SeasonExperimentEntity.STATUS_RUNNING)) {
            if (e.getStartDate() != null && e.endDate().isBefore(today)) {
                finish(e.getCreatedBy(), e);
            }
        }
    }

    /** Compares the window with the same number of days before it and stores the verdict once. */
    void finish(UUID owner, SeasonExperimentEntity e) {
        LocalDate start = e.getStartDate();
        LocalDate end = e.endDate();
        LocalDate baselineFrom = start.minusDays(e.getLengthDays());
        LocalDate baselineTo = start.minusDays(1);
        List<ExperimentEvaluator.Overlap> overlaps = overlaps(owner, e, start, end);
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

    /** The other changes inside {@code from..to}: a block started, a deload week, kímélő days, a season change, and
     *  another change he logged himself ({@link #otherChanges}). */
    List<ExperimentEvaluator.Overlap> overlaps(UUID owner, SeasonExperimentEntity e, LocalDate from, LocalDate to) {
        UUID seasonId = e.getSeasonId();
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
        out.addAll(otherChanges(owner, e, from, to));
        out.sort(Comparator.comparing(ExperimentEvaluator.Overlap::date));
        return out;
    }

    /**
     * Kind {@code other} (spec §5.9): a supplement newly in the stack or a journal line saying he started something
     * (the detector's sources and pattern), inside {@code from..to}, never the experiment's own subject (same
     * {@code subjectRef} / same normalised title); at most one per day, at most {@link #OTHER_MAX}, earliest first.
     */
    private List<ExperimentEvaluator.Overlap> otherChanges(UUID owner, SeasonExperimentEntity e, LocalDate from,
                                                           LocalDate to) {
        List<ExperimentEvaluator.Overlap> all = new ArrayList<>();
        for (SeasonExperimentSourcePort.NewSupplement s : sources.newSupplements(owner, from)) {
            if (!s.since().isAfter(to) && !s.pantryItemId().equals(e.getSubjectRef())) {
                all.add(new ExperimentEvaluator.Overlap("other", s.since(),
                    OVERLAP_SUPPLEMENT + ExperimentProposalDetector.shorten(s.name())));
            }
        }
        String own = ExperimentProposalDetector.key(e.getTitle());
        for (SeasonExperimentSourcePort.JournalLine j : sources.journalLines(owner, from, to)) {
            ExperimentProposalDetector.startedSentence(j.text())
                .filter(t -> !ExperimentProposalDetector.key(t).equals(own))
                .ifPresent(t -> all.add(new ExperimentEvaluator.Overlap("other", j.date(),
                    OVERLAP_JOURNAL.formatted(quote(t)))));
        }
        // stable: a supplement wins its day over a journal line; journal lines of one day keep their order
        all.sort(Comparator.comparing(ExperimentEvaluator.Overlap::date));
        Set<LocalDate> days = new HashSet<>();
        List<ExperimentEvaluator.Overlap> out = new ArrayList<>();
        for (ExperimentEvaluator.Overlap o : all) {
            if (out.size() < OTHER_MAX && days.add(o.date())) {
                out.add(o);
            }
        }
        return out;
    }

    private static String quote(String t) {
        return t.length() <= QUOTE_MAX ? t : t.substring(0, QUOTE_MAX - 1).strip() + "…";
    }

    // --- view ------------------------------------------------------------------------------------------------------

    View view(UUID owner, SeasonExperimentEntity e, LocalDate today) {
        Integer dayIndex = null;
        List<ExperimentEvaluator.Overlap> overlaps = List.of();
        if (e.is(SeasonExperimentEntity.STATUS_RUNNING) && e.getStartDate() != null) {
            dayIndex = dayIndex(e, today);
            LocalDate to = e.endDate().isBefore(today) ? e.endDate() : today;
            overlaps = overlaps(owner, e, e.getStartDate(), to);
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

    private Optional<SeasonExperimentEntity> first(UUID seasonId, String status) {
        return experiments.findBySeasonIdAndStatus(seasonId, status).stream().findFirst();
    }

    private void requireNoneRunning(UUID seasonId) {
        if (first(seasonId, SeasonExperimentEntity.STATUS_RUNNING).isPresent()) {
            throw conflict("EXPERIMENT_ALREADY_RUNNING");
        }
    }

    /** Saves (and flushes) a row going running; a concurrent start hitting the one-running index → 409. */
    private SeasonExperimentEntity saveRunning(SeasonExperimentEntity e) {
        try {
            return experiments.saveAndFlush(e);
        } catch (DataIntegrityViolationException ex) {
            if (isOneOpenIndex(ex)) {
                throw conflict("EXPERIMENT_ALREADY_RUNNING");
            }
            throw ex;
        }
    }

    private static boolean isOneOpenIndex(DataIntegrityViolationException ex) {
        String msg = ex.getMostSpecificCause().getMessage();
        return msg != null && (msg.contains("uq_season_experiment_one_running")
            || msg.contains("uq_season_experiment_one_proposed"));
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
