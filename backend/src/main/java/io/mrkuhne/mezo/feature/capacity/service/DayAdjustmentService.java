package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentKind;
import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.entity.ProposalStatus;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySkipPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.SkipSession;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The day-adjustment ledger (Boop B7 K3, mezo-r36n9.17, spec §5.5/§5.7): the ONE list of this week's changes the owner
 * accepted. Every reader consults it; it never writes the season plan, the gym schedule, the mesocycle or the goal —
 * the only write outside its own tables is a {@code SKIP_SESSION} step, which goes through train's planned-skip path.
 *
 * <p>Days are his (the {@code mezo.wearable.zone} calendar, through the injected {@link Clock}); a week is Monday–Sunday.
 * A day "has started" once it is in the past, or it is today and its session is running or done. Rules:
 * <ul>
 *   <li>{@code MOVE_SESSION_DAY} only onto a day of the same Mon–Sun week that has no gym session — neither in the plan,
 *       nor done, nor already the target of another live move (decision #71); never a running session (409
 *       {@code TRAIN_DAY_WORKOUT_RUNNING}, train's own rule).</li>
 *   <li>A bundle is written whole or not at all, with one {@code bundle_id}; replaying the same {@code clientRef}
 *       returns the rows already written.</li>
 *   <li>Undo takes back the whole bundle while none of its days has started.</li>
 * </ul>
 */
@Service
public class DayAdjustmentService {

    /** Train's code for "a workout of that day is running" — surfaced as-is so the phone shows train's own words. */
    static final String TRAIN_DAY_WORKOUT_RUNNING = AdjustmentRules.TRAIN_DAY_WORKOUT_RUNNING;
    private static final int MAX_RANGE_DAYS = 62;
    private static final List<String> LIVE = List.of(AdjustmentState.ACTIVE.wire(), AdjustmentState.WAITING.wire());

    private final DayAdjustmentRepository rows;
    private final CapacityProposalRepository proposals;
    private final CapacityTrainPort train;
    private final CapacitySkipPort skips;
    private final WearableProperties wearable;
    private final ObjectProvider<Clock> clock;
    private final CapacityLock lock;

    public DayAdjustmentService(DayAdjustmentRepository rows, CapacityProposalRepository proposals,
                                CapacityTrainPort train, CapacitySkipPort skips, WearableProperties wearable,
                                ObjectProvider<Clock> clock, CapacityLock lock) {
        this.lock = lock;
        this.rows = rows;
        this.proposals = proposals;
        this.train = train;
        this.skips = skips;
        this.wearable = wearable;
        this.clock = clock;
    }

    // ── accept ────────────────────────────────────────────────────────────────

    /**
     * Writes every step of the proposal's bundle in one transaction (shared {@code bundle_id}) and marks the proposal
     * accepted. Same {@code clientRef} again → the rows already written (an Outbox replay never moves twice); the same
     * {@code clientRef} with another proposal → 409 {@code CAPACITY_CLIENT_REF_REUSED}, never the first one's rows.
     * A proposal that is no longer {@code open}, or whose steps no longer match the plan → 409
     * {@code CAPACITY_PROPOSAL_STALE}. Runs under the owner's {@link CapacityLock}: two different proposals accepted
     * at the same moment serialize, so the second sees the first one's move and cannot claim the same target day.
     */
    @Transactional
    public List<DayAdjustmentView> applyBundle(UUID owner, UUID proposalId, UUID clientRef) {
        Objects.requireNonNull(clientRef, "clientRef");
        lock.lock(owner);
        CapacityProposalEntity proposal = proposals.findWithLockByIdAndCreatedByAndDeletedFalse(proposalId, owner)
            .orElseThrow(DayAdjustmentService::notFound);
        Optional<DayAdjustmentEntity> replay = rows.findByCreatedByAndClientRefAndDeletedFalse(owner, clientRef);
        if (replay.isPresent()) {
            if (!proposalId.equals(replay.get().getProposalId())) {
                throw error("CAPACITY_CLIENT_REF_REUSED", HttpStatus.CONFLICT);
            }
            return rows.findByCreatedByAndBundleIdAndDeletedFalseOrderByCreatedAtAsc(owner, replay.get().getBundleId())
                .stream().map(DayAdjustmentService::view).toList();
        }
        if (!ProposalStatus.OPEN.wire().equals(proposal.getStatus())) {
            throw error("CAPACITY_PROPOSAL_STALE", HttpStatus.CONFLICT);
        }
        List<AdjustmentPayload> steps = AdjustmentDraft.fromBundle(proposal.getBundle()).stream()
            .map(d -> AdjustmentPayload.parse(d.kind(), d.payload()))
            .toList();
        if (steps.isEmpty()) {
            throw error("CAPACITY_PROPOSAL_STALE", HttpStatus.CONFLICT);
        }

        LocalDate today = today();
        List<DayAdjustmentEntity> live = rows.findByCreatedByAndStateInAndDeletedFalse(owner, LIVE);
        Set<LocalDate> claimedTargets = new HashSet<>();
        Set<LocalDate> movedFrom = new HashSet<>();
        for (DayAdjustmentEntity e : live) {
            if (view(e).payload() instanceof MoveSessionDay m) {
                claimedTargets.add(m.toDate());
                movedFrom.add(m.fromDate());
            }
        }
        for (AdjustmentPayload step : steps) {
            validate(owner, step, today, claimedTargets, movedFrom);
        }

        UUID bundleId = UUID.randomUUID();
        Instant now = clock().instant();
        List<DayAdjustmentEntity> written = new ArrayList<>();
        for (int i = 0; i < steps.size(); i++) {
            AdjustmentPayload step = steps.get(i);
            if (step instanceof SkipSession s) {
                step = new SkipSession(s.date(), skips.skipGym(owner, s.date()));
            }
            DayAdjustmentEntity e = new DayAdjustmentEntity();
            e.setCreatedBy(owner);
            e.setDate(step.day());
            e.setKind(step.kind().name());
            e.setPayload(step.toMap());
            e.setBundleId(bundleId);
            e.setProposalId(proposalId);
            e.setState((step.kind() == AdjustmentKind.CALENDAR_TODO ? AdjustmentState.WAITING : AdjustmentState.ACTIVE)
                .wire());
            e.setClientRef(stepRef(clientRef, i));
            e.setUpdatedAt(now);
            written.add(e);
        }
        List<DayAdjustmentEntity> saved = rows.saveAllAndFlush(written);
        proposal.setStatus(ProposalStatus.ACCEPTED.wire());
        proposal.setDecidedAt(now);
        proposal.setUpdatedAt(now);
        proposals.save(proposal);
        return saved.stream().map(DayAdjustmentService::view).toList();
    }

    /**
     * The unique key is (owner, client_ref) per row, so a bundle's first step carries the request's {@code clientRef}
     * and step {@code i} a name-based UUID derived from it — deterministic, so a replay finds the same rows.
     */
    static UUID stepRef(UUID clientRef, int index) {
        return index == 0 ? clientRef : UUID.nameUUIDFromBytes((clientRef + ":" + index).getBytes());
    }

    private void validate(UUID owner, AdjustmentPayload step, LocalDate today, Set<LocalDate> claimedTargets,
                          Set<LocalDate> movedFrom) {
        AdjustmentRules.check(step, today, planView(owner), claimedTargets, movedFrom)
            .ifPresent(v -> {
                throw error(v.code(), v.status());
            });
    }

    /** The accept rules' view of the plan: the raw-plan ports (never the ledger itself). */
    private AdjustmentRules.PlanView planView(UUID owner) {
        return new AdjustmentRules.PlanView() {
            @Override public boolean gymPlanned(LocalDate date) { return train.gymPlanned(owner, date); }
            @Override public boolean gymDoneOn(LocalDate date) { return train.gymDoneOn(owner, date); }
            @Override public Optional<UUID> plannedTemplate(LocalDate date) { return train.plannedTemplate(owner, date); }
            @Override public boolean ownsTemplate(UUID id) { return train.ownsTemplate(owner, id); }
            @Override public boolean workoutRunning(UUID id) { return train.workoutRunning(owner, id); }
            @Override public boolean gymSkipped(LocalDate date) { return skips.gymSkipped(owner, date); }
        };
    }

    // ── undo ──────────────────────────────────────────────────────────────────

    /**
     * Takes back the whole bundle the row belongs to (state {@code undone}; a skip step removes its planned skip) and
     * marks the proposal {@code undone}. 404 for a missing or foreign row; 409 {@code CAPACITY_ADJUSTMENT_NOT_UNDOABLE}
     * when it is no longer live; 409 {@code CAPACITY_DAY_STARTED} once any of the bundle's days has started.
     */
    @Transactional
    public void undo(UUID owner, UUID adjustmentId) {
        // The owner's lock first (accept's order: lock, then the proposal row), so the staleness sweep and the
        // new-block expiry can never write over an undo in flight (K3 final review finding 6).
        lock.lock(owner);
        // Lock the proposal BEFORE the rows are loaded: a concurrent undo / accept of the same bundle then waits, and
        // this transaction reads the rows as that one left them.
        Optional<CapacityProposalEntity> proposal = rows.findProposalIdOf(adjustmentId, owner)
            .flatMap(id -> proposals.findWithLockByIdAndCreatedByAndDeletedFalse(id, owner));
        DayAdjustmentEntity row = rows.findByIdAndCreatedByAndDeletedFalse(adjustmentId, owner)
            .orElseThrow(DayAdjustmentService::notFound);
        if (!LIVE.contains(row.getState())) {
            throw error("CAPACITY_ADJUSTMENT_NOT_UNDOABLE", HttpStatus.CONFLICT);
        }
        List<DayAdjustmentEntity> bundle = rows
            .findByCreatedByAndBundleIdAndDeletedFalseOrderByCreatedAtAsc(owner, row.getBundleId()).stream()
            .filter(e -> LIVE.contains(e.getState()))
            .toList();
        LocalDate today = today();
        for (DayAdjustmentEntity e : bundle) {
            if (started(owner, view(e).payload(), today)) {
                throw error("CAPACITY_DAY_STARTED", HttpStatus.CONFLICT);
            }
        }
        Instant now = clock().instant();
        for (DayAdjustmentEntity e : bundle) {
            if (view(e).payload() instanceof SkipSession s && s.skipId() != null) {
                skips.undoSkip(owner, s.skipId());
            }
            e.setState(AdjustmentState.UNDONE.wire());
            e.setUpdatedAt(now);
        }
        rows.saveAll(bundle);
        proposal.ifPresent(p -> {
            p.setStatus(ProposalStatus.UNDONE.wire());
            p.setUpdatedAt(now);
            proposals.save(p);
        });
    }

    /** Past, or today with its session running or done. */
    private boolean started(UUID owner, AdjustmentPayload payload, LocalDate today) {
        for (LocalDate d : payload.touchedDays()) {
            if (d.isBefore(today)) {
                return true;
            }
        }
        boolean sessionShaped = switch (payload.kind()) {
            case MOVE_SESSION_DAY, SHIFT_SESSION_TIME, SHORTEN_SESSION, LIGHTEN_SESSION, SWAP_SESSION_KIND,
                 SKIP_SESSION -> true;
            default -> false;
        };
        if (!sessionShaped || !payload.touchedDays().contains(today)) {
            return false;
        }
        if (payload instanceof MoveSessionDay m && train.workoutRunning(owner, m.templateSessionId())) {
            return true;
        }
        Optional<UUID> template = train.plannedTemplate(owner, today);
        return (template.isPresent() && train.workoutRunning(owner, template.get())) || train.gymDoneOn(owner, today);
    }

    // ── staleness ─────────────────────────────────────────────────────────────

    /**
     * Sweeps the owner's live rows against the plan as it is now. An active move whose target day gained a gym session
     * before the day (the schedule changed) → {@code expired}; whose session was done on its new day, or whose target
     * day passed (trained or not — the re-dating stays in history) → {@code done}. A waiting calendar to-do whose day
     * passed → {@code expired}. Once the move's OLD day has passed it settles {@code done}, never {@code expired}: an
     * expired move would put the session back onto a day that is behind him, a missed workout he never chose. Runs
     * under the owner's {@link CapacityLock} (as the calendar watcher does), so it never writes over an undo or an
     * accept that is committing at the same moment.
     *
     * @return the rows whose state changed
     */
    @Transactional
    public List<DayAdjustmentView> expireStale(UUID owner, LocalDate today) {
        lock.lock(owner);
        Instant now = clock().instant();
        List<DayAdjustmentEntity> changed = new ArrayList<>();
        for (DayAdjustmentEntity e : rows.findByCreatedByAndStateInAndDeletedFalse(owner, LIVE)) {
            AdjustmentPayload p = view(e).payload();
            AdjustmentState next = null;
            if (p instanceof MoveSessionDay m && AdjustmentState.ACTIVE.wire().equals(e.getState())) {
                // Controller ruling (K3 fix round 1): a move whose target day has passed is DONE whether or not he
                // trained — the re-dating stays in history; only a target that gains a gym session before the day
                // expires it.
                if (m.toDate().isBefore(today) || train.gymDoneOn(owner, m.toDate())) {
                    next = AdjustmentState.DONE;
                } else if (train.gymPlanned(owner, m.toDate())) {
                    next = m.fromDate().isBefore(today) ? AdjustmentState.DONE : AdjustmentState.EXPIRED;
                }
            } else if (p instanceof AdjustmentPayload.CalendarTodo
                && AdjustmentState.WAITING.wire().equals(e.getState()) && e.getDate().isBefore(today)) {
                next = AdjustmentState.EXPIRED;
            }
            if (next != null) {
                e.setState(next.wire());
                e.setUpdatedAt(now);
                changed.add(e);
            }
        }
        return rows.saveAll(changed).stream().map(DayAdjustmentService::view).toList();
    }

    /**
     * A new block became the active mesocycle (a planned block starting mid-week, or a manual activation): the plan
     * wins (K3 final review ruling). A live move whose session is not a template day of the new block would leave
     * that session nowhere — so it expires; a session time shift or shortening still ahead was decided for the old
     * block's session of that day — it expires too. Settled ({@code done}) rows and past days stay as history; every
     * other kind (bedtime, meal energy, calendar to-dos, lighten, skip) is not about which template the day holds.
     *
     * @return the rows that expired
     */
    @Transactional
    public List<DayAdjustmentView> expireForNewBlock(UUID owner, UUID mesocycleId) {
        lock.lock(owner);
        LocalDate today = today();
        Instant now = clock().instant();
        List<DayAdjustmentEntity> changed = new ArrayList<>();
        for (DayAdjustmentEntity e : rows.findByCreatedByAndStateInAndDeletedFalse(owner,
                List.of(AdjustmentState.ACTIVE.wire()))) {
            AdjustmentPayload p = view(e).payload();
            boolean expire = switch (p) {
                case MoveSessionDay m -> !train.templateInBlock(owner, m.templateSessionId(), mesocycleId);
                case AdjustmentPayload.ShiftSessionTime s -> !s.date().isBefore(today);
                case AdjustmentPayload.ShortenSession s -> !s.date().isBefore(today);
                default -> false;
            };
            if (expire) {
                e.setState(AdjustmentState.EXPIRED.wire());
                e.setUpdatedAt(now);
                changed.add(e);
            }
        }
        return rows.saveAll(changed).stream().map(DayAdjustmentService::view).toList();
    }

    // ── reads ─────────────────────────────────────────────────────────────────

    /** The rows in effect ({@code active | waiting | done}) that change {@code date}. */
    public List<DayAdjustmentView> activeFor(UUID owner, LocalDate date) {
        return activeForRange(owner, date, date);
    }

    /** The rows in effect that change any day of {@code from..to} (a move counts on both of its days). */
    public List<DayAdjustmentView> activeForRange(UUID owner, LocalDate from, LocalDate to) {
        return touching(owner, from, to).stream().filter(v -> v.state().inEffect()).toList();
    }

    /**
     * Every row (any state) that changes a day of {@code from..to} — the Átrendezés page's own list ("Korábban
     * áttettük" shows undone and expired rows too). 400 on an inverted or over-long range.
     */
    public List<DayAdjustmentView> list(UUID owner, LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= MAX_RANGE_DAYS) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "to").build(),
                HttpStatus.BAD_REQUEST);
        }
        return touching(owner, from, to);
    }

    /** A move stays inside one week, so every row touching {@code from..to} is filed within six days of it. */
    private List<DayAdjustmentView> touching(UUID owner, LocalDate from, LocalDate to) {
        return rows.findByCreatedByAndDateBetweenAndDeletedFalseOrderByDateAscCreatedAtAsc(owner, from.minusDays(6),
                to.plusDays(6)).stream()
            .map(DayAdjustmentService::view)
            .filter(v -> v.payload().touchedDays().stream().anyMatch(d -> !d.isBefore(from) && !d.isAfter(to)))
            .sorted(Comparator.comparing(DayAdjustmentView::date).thenComparing(DayAdjustmentView::createdAt,
                Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    static DayAdjustmentView view(DayAdjustmentEntity e) {
        return new DayAdjustmentView(e.getId(), e.getDate(), AdjustmentPayload.parse(e.getKind(), e.getPayload()),
            e.getBundleId(), e.getProposalId(), AdjustmentState.fromWire(e.getState()), e.getReason(), e.getCreatedAt());
    }

    private Clock clock() {
        return clock.getIfAvailable(Clock::systemUTC);
    }

    private LocalDate today() {
        return LocalDate.now(clock().withZone(ZoneId.of(wearable.zone())));
    }

    private static SystemRuntimeErrorException notFound() {
        return error("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    private static SystemRuntimeErrorException error(String code, HttpStatus status) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), status);
    }
}
