package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.entity.ProposalStatus;
import io.mrkuhne.mezo.feature.capacity.port.CapacityMealPort.FuelDay;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.capacity.service.ProposalCompareLines.Line;
import io.mrkuhne.mezo.feature.capacity.service.ProposalWordingWriter.Wording;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The Átrendezés page's server side (Boop B7 K3, mezo-r36n9.17, spec §5.5/§5.6): the week read, accept, decline and
 * regenerate of the stored {@code capacity_proposal} rows.
 *
 * <ul>
 *   <li><b>Week read</b> — settles stale ledger rows first ({@link DayAdjustmentService#expireStale}); for the current
 *       or the next week with no proposal yet it generates ({@link ProposalGenerator}), prices
 *       ({@link CrossEffectCalculator}) and stores them with the rule-built words ({@code templateOnly}), then hands a
 *       model rephrase to the background. Past and later weeks are read-only.</li>
 *   <li><b>Accept</b> — under the owner's {@link CapacityLock}: a replayed {@code clientRef} goes straight to the
 *       ledger (which returns the rows already written); otherwise the proposal's {@link ProposalFingerprint} is
 *       recomputed and a changed week answers 409 {@code CAPACITY_PROPOSAL_STALE}.</li>
 *   <li><b>Decline</b> — {@code declined}; regenerate does not propose the same kind for the same day again.</li>
 *   <li><b>Regenerate</b> — the week's open proposals become {@code ignored}; accepted and declined ones stay.</li>
 * </ul>
 *
 * <p>The model never runs on the request thread or inside a transaction: the rephrase is one background task per
 * stored set, on the shared {@code applicationTaskExecutor} (the {@link EventScoringRunner} pattern), and it keeps the
 * model's words only when {@link ProposalWordingWriter#word} accepted them (digits ⊂ the template's).
 */
@Slf4j
@Service
public class ProposalService {

    static final short GENERATOR_VERSION = 1;
    private static final String RANK = "rank";

    /** A proposal as the API shows it. */
    public record ProposalView(UUID id, String kind, LocalDate day, ProposalStatus status, String title, String move,
                               List<String> effectLines, List<String> why, List<Line> compare,
                               List<AdjustmentDraft> steps, List<LocalDate> touchedDays, Instant decidedAt) {
    }

    /** A learned pattern line (K4 fills them; empty until then). */
    public record PatternView(String key, String line, int evidence) {
    }

    /** The Átrendezés page's week. */
    public record WeekView(LocalDate monday, List<CapacityDay> days, List<ProposalView> proposals,
                           List<DayAdjustmentView> adjustments, List<PatternView> patterns) {
    }

    /** One generated proposal, priced and worded, before it is stored. */
    record Built(ProposalDraft draft, Effects effects, Wording wording, LocalDate day, String fingerprint) {
    }

    private record Generated(WeekPicture picture, List<Built> built) {
    }

    private record Stored(UUID id, Built built) {
    }

    private final CapacityProposalRepository proposals;
    private final DayAdjustmentRepository rows;
    private final DayAdjustmentService ledger;
    private final CapacityDayService days;
    private final WeekPictureService pictures;
    private final CrossEffectCalculator calculator;
    private final ProposalWordingWriter words;
    private final CapacityLock lock;
    private final CapacityProperties props;
    private final WearableProperties wearable;
    private final ObjectProvider<Clock> clock;
    private final TransactionTemplate tx;
    private final AsyncTaskExecutor executor;

    public ProposalService(CapacityProposalRepository proposals, DayAdjustmentRepository rows,
                           DayAdjustmentService ledger, CapacityDayService days, WeekPictureService pictures,
                           CrossEffectCalculator calculator, ProposalWordingWriter words, CapacityLock lock,
                           CapacityProperties props, WearableProperties wearable, ObjectProvider<Clock> clock,
                           PlatformTransactionManager transactionManager,
                           @Qualifier("applicationTaskExecutor") AsyncTaskExecutor executor) {
        this.proposals = proposals;
        this.rows = rows;
        this.ledger = ledger;
        this.days = days;
        this.pictures = pictures;
        this.calculator = calculator;
        this.words = words;
        this.lock = lock;
        this.props = props;
        this.wearable = wearable;
        this.clock = clock;
        this.tx = new TransactionTemplate(transactionManager);
        this.executor = executor;
    }

    // ── the week ──────────────────────────────────────────────────────────────

    /**
     * The week of {@code monday}: day verdicts, stored proposals (generated on this read when the current or next week
     * has none yet), every ledger row touching the week, patterns (empty until K4). Never waits for a model.
     */
    public WeekView week(UUID owner, LocalDate monday) {
        requireMonday(monday);
        LocalDate today = today();
        ledger.expireStale(owner, today);
        List<CapacityDay> dayList = null;
        if (generatable(monday, today) && proposals.findByCreatedByAndWeekStartAndDeletedFalse(owner, monday)
            .isEmpty()) {
            Generated g = generate(owner, monday, Set.of());
            dayList = g.picture().days();
            List<Stored> stored = tx.execute(s -> {
                lock.lock(owner);
                if (!proposals.findByCreatedByAndWeekStartAndDeletedFalse(owner, monday).isEmpty()) {
                    return List.<Stored>of(); // a parallel first read stored its set meanwhile
                }
                return store(owner, monday, g.built());
            });
            rephraseLater(owner, stored);
        }
        return view(owner, monday, dayList != null ? dayList : days.week(owner, monday));
    }

    /**
     * Replaces the week's open proposals ({@code ignored}) with freshly generated ones; accepted and declined stay, and
     * a declined proposal's kind is not proposed again for its day. Only the current or the next week (400 otherwise).
     */
    public WeekView regenerate(UUID owner, LocalDate monday) {
        requireMonday(monday);
        LocalDate today = today();
        if (!generatable(monday, today)) {
            throw invalidMonday();
        }
        ledger.expireStale(owner, today);
        Set<String> declined = new HashSet<>();
        for (CapacityProposalEntity p : proposals.findByCreatedByAndWeekStartAndDeletedFalse(owner, monday)) {
            if (ProposalStatus.DECLINED.wire().equals(p.getStatus())) {
                declined.add(suppressKey(p.getKind(), p.getDay()));
            }
        }
        Generated g = generate(owner, monday, declined);
        List<Stored> stored = tx.execute(s -> {
            lock.lock(owner);
            Instant now = clock().instant();
            for (CapacityProposalEntity p : proposals.findByCreatedByAndWeekStartAndDeletedFalse(owner, monday)) {
                if (ProposalStatus.OPEN.wire().equals(p.getStatus())) {
                    p.setStatus(ProposalStatus.IGNORED.wire());
                    p.setUpdatedAt(now);
                    proposals.save(p);
                }
            }
            return store(owner, monday, g.built());
        });
        rephraseLater(owner, stored);
        return view(owner, monday, g.picture().days());
    }

    // ── decisions ─────────────────────────────────────────────────────────────

    /**
     * Accepts the proposal: its steps go into the ledger as one bundle ({@link DayAdjustmentService#applyBundle}).
     * The same {@code clientRef} again → the rows already written; a week that changed since the proposal was built
     * (its {@link ProposalFingerprint}) → 409 {@code CAPACITY_PROPOSAL_STALE}.
     */
    public List<DayAdjustmentView> accept(UUID owner, UUID proposalId, UUID clientRef) {
        if (clientRef == null) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_REQUIRED_FIELD", "clientRef").build(),
                HttpStatus.BAD_REQUEST);
        }
        return tx.execute(s -> {
            lock.lock(owner);
            CapacityProposalEntity p = owned(owner, proposalId);
            boolean replay = rows.findByCreatedByAndClientRefAndDeletedFalse(owner, clientRef).isPresent();
            if (!replay && ProposalStatus.OPEN.wire().equals(p.getStatus()) && p.getFingerprint() != null) {
                WeekPicture now = pictures.picture(owner, p.getWeekStart());
                if (!p.getFingerprint().equals(ProposalFingerprint.of(now, touchedDays(p)))) {
                    throw error("CAPACITY_PROPOSAL_STALE", HttpStatus.CONFLICT);
                }
            }
            return ledger.applyBundle(owner, proposalId, clientRef);
        });
    }

    /** "Most nem": {@code declined}. A declined proposal again is a no-op; any other settled one → 409 stale. */
    public ProposalView decline(UUID owner, UUID proposalId) {
        return tx.execute(s -> {
            lock.lock(owner);
            CapacityProposalEntity p = owned(owner, proposalId);
            if (ProposalStatus.DECLINED.wire().equals(p.getStatus())) {
                return toView(p);
            }
            if (!ProposalStatus.OPEN.wire().equals(p.getStatus())) {
                throw error("CAPACITY_PROPOSAL_STALE", HttpStatus.CONFLICT);
            }
            Instant now = clock().instant();
            p.setStatus(ProposalStatus.DECLINED.wire());
            p.setDecidedAt(now);
            p.setUpdatedAt(now);
            return toView(proposals.save(p));
        });
    }

    // ── generation ────────────────────────────────────────────────────────────

    /** Reads the week once, generates, prices and words (template only) every draft not suppressed. */
    private Generated generate(UUID owner, LocalDate monday, Set<String> suppressed) {
        WeekPicture w = pictures.picture(owner, monday);
        List<ProposalDraft> drafts = ProposalGenerator.forWeek(w, List.of(), props);
        if (drafts.isEmpty()) {
            return new Generated(w, List.of());
        }
        Map<LocalDate, FuelDay> fuel = calculator.fuelWeek(owner, w);
        List<Built> built = new ArrayList<>();
        for (ProposalDraft d : drafts) {
            LocalDate day = dayOf(d);
            if (suppressed.contains(suppressKey(d.kind(), day))) {
                continue;
            }
            Effects e = calculator.effects(owner, w, d, fuel);
            built.add(new Built(d, e, words.word(d, e, true), day, ProposalFingerprint.of(w, d.touchedDays())));
        }
        return new Generated(w, List.copyOf(built));
    }

    /** Inside the caller's transaction: one open row per built proposal, in rank order. */
    private List<Stored> store(UUID owner, LocalDate monday, List<Built> built) {
        Instant now = clock().instant();
        List<Stored> out = new ArrayList<>();
        for (int i = 0; i < built.size(); i++) {
            Built b = built.get(i);
            CapacityProposalEntity e = new CapacityProposalEntity();
            e.setCreatedBy(owner);
            e.setWeekStart(monday);
            e.setDay(b.day());
            e.setKind(b.draft().kind());
            e.setBundle(AdjustmentDraft.toBundle(b.draft().bundle()));
            Map<String, Object> facts = new LinkedHashMap<>(b.draft().facts());
            facts.put(RANK, i);
            e.setFacts(facts);
            e.setEffects(effectsMap(b.wording(), ProposalCompareLines.lines(b.effects()), b.draft().touchedDays()));
            e.setTitle(b.wording().title());
            e.setWhy(b.wording().why());
            e.setGeneratorVersion(GENERATOR_VERSION);
            e.setStatus(ProposalStatus.OPEN.wire());
            e.setFingerprint(b.fingerprint());
            e.setUpdatedAt(now);
            out.add(new Stored(proposals.save(e).getId(), b));
        }
        proposals.flush();
        return out;
    }

    // ── the background rephrase ───────────────────────────────────────────────

    /** Fire-and-forget, after the rows committed: the request never waits for (or fails on) the model. */
    private void rephraseLater(UUID owner, List<Stored> stored) {
        if (stored == null || stored.isEmpty()) {
            return;
        }
        try {
            executor.execute(() -> rephrase(owner, stored));
        } catch (RuntimeException e) { // the pool refused the task: the template words stay
            log.warn("Capacity proposal rephrase could not start: {}", e.getMessage());
        }
    }

    /** Runs on a background thread, no transaction around the model; each changed row is saved in its own one. */
    void rephrase(UUID owner, List<Stored> stored) {
        LlmActorContext.runAs(owner, () -> {
            for (Stored s : stored) {
                try {
                    Wording w = words.word(s.built().draft(), s.built().effects());
                    if (!w.equals(s.built().wording())) {
                        tx.executeWithoutResult(t -> reword(owner, s, w));
                    }
                } catch (RuntimeException e) {
                    log.warn("Capacity proposal rephrase failed, the template words stay: {}", e.getMessage());
                }
            }
        });
    }

    /** Only a still-open row that still carries the template's words takes the rephrase. */
    private void reword(UUID owner, Stored s, Wording w) {
        proposals.findById(s.id())
            .filter(p -> owner.equals(p.getCreatedBy()) && !p.isDeleted())
            .filter(p -> ProposalStatus.OPEN.wire().equals(p.getStatus()))
            .filter(p -> Objects.equals(p.getTitle(), s.built().wording().title()))
            .ifPresent(p -> {
                Map<String, Object> effects = new LinkedHashMap<>(p.getEffects() == null ? Map.of() : p.getEffects());
                effects.put("lines", w.effectLines());
                p.setEffects(effects);
                p.setTitle(w.title());
                p.setWhy(w.why());
                p.setUpdatedAt(clock().instant());
                proposals.save(p);
            });
    }

    // ── reads ─────────────────────────────────────────────────────────────────

    private WeekView view(UUID owner, LocalDate monday, List<CapacityDay> dayList) {
        List<ProposalView> list = proposals.findByCreatedByAndWeekStartAndDeletedFalse(owner, monday).stream()
            .sorted(Comparator.comparing((CapacityProposalEntity p) -> !ProposalStatus.OPEN.wire().equals(p.getStatus()))
                .thenComparing(CapacityProposalEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(ProposalService::rank))
            .map(ProposalService::toView)
            .toList();
        return new WeekView(monday, dayList, list, ledger.list(owner, monday, monday.plusDays(6)), List.of());
    }

    static ProposalView toView(CapacityProposalEntity p) {
        Map<String, Object> effects = p.getEffects() == null ? Map.of() : p.getEffects();
        List<Line> compare = new ArrayList<>();
        if (effects.get("compare") instanceof List<?> raw) {
            for (Object o : raw) {
                if (o instanceof Map<?, ?> m) {
                    compare.add(Line.fromMap(m));
                }
            }
        }
        return new ProposalView(p.getId(), p.getKind(), p.getDay(), ProposalStatus.valueOf(p.getStatus().toUpperCase()),
            p.getTitle(), effects.get("move") == null ? "" : effects.get("move").toString(), strings(effects.get("lines")),
            p.getWhy() == null ? List.of() : List.copyOf(p.getWhy()), List.copyOf(compare),
            AdjustmentDraft.fromBundle(p.getBundle()), touchedDays(p), p.getDecidedAt());
    }

    private static Map<String, Object> effectsMap(Wording w, List<Line> compare, List<LocalDate> touched) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("move", w.move());
        m.put("lines", w.effectLines());
        m.put("compare", compare.stream().map(Line::toMap).toList());
        m.put("touchedDays", touched.stream().map(LocalDate::toString).toList());
        return m;
    }

    /** The days the bundle changes, read from the stored steps. */
    static List<LocalDate> touchedDays(CapacityProposalEntity p) {
        return AdjustmentDraft.fromBundle(p.getBundle()).stream()
            .flatMap(d -> AdjustmentPayload.parse(d.kind(), d.payload()).touchedDays().stream())
            .distinct().sorted().toList();
    }

    private static List<String> strings(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        return list.stream().map(String::valueOf).toList();
    }

    private static int rank(CapacityProposalEntity p) {
        return p.getFacts() != null && p.getFacts().get(RANK) instanceof Number n ? n.intValue() : Integer.MAX_VALUE;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** The day a proposal is about: its session's day, else its first touched day. */
    static LocalDate dayOf(ProposalDraft d) {
        return ProposalGenerator.sessionDay(d).orElseGet(() -> {
            Object date = d.facts().get("date");
            return date != null ? LocalDate.parse(date.toString()) : d.touchedDays().get(0);
        });
    }

    private static String suppressKey(String kind, LocalDate day) {
        return kind + "|" + day;
    }

    /** The current or the next Mon–Sun week of his zone. */
    private static boolean generatable(LocalDate monday, LocalDate today) {
        LocalDate current = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return monday.equals(current) || monday.equals(current.plusWeeks(1));
    }

    private CapacityProposalEntity owned(UUID owner, UUID id) {
        return proposals.findById(id)
            .filter(p -> owner.equals(p.getCreatedBy()) && !p.isDeleted())
            .orElseThrow(() -> error("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND));
    }

    private static void requireMonday(LocalDate monday) {
        if (monday == null || monday.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw invalidMonday();
        }
    }

    private static SystemRuntimeErrorException invalidMonday() {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "monday").build(),
            HttpStatus.BAD_REQUEST);
    }

    private Clock clock() {
        return clock.getIfAvailable(Clock::systemUTC);
    }

    private LocalDate today() {
        return LocalDate.now(clock().withZone(ZoneId.of(wearable.zone())));
    }

    private static SystemRuntimeErrorException error(String code, HttpStatus status) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), status);
    }
}
