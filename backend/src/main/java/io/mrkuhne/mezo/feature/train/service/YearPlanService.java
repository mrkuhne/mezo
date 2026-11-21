package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.YearBlockPatch;
import io.mrkuhne.mezo.api.dto.YearNext;
import io.mrkuhne.mezo.api.dto.YearPlan;
import io.mrkuhne.mezo.api.dto.YearPlanRequest;
import io.mrkuhne.mezo.api.dto.YearUnlinkedRunning;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.config.YearPlanProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearPlanEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearPlanRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.Layout;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.MesoFacts;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.Placed;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.Slot;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Éves terv API (mezo-r36n9.113): preview, create, read, block edit and archive. Preview and create run
 * {@link YearGenerator} → {@link YearSchedule} → {@link YearRules} (via {@link YearPlanAssembler}); every write
 * re-lays the plan out and rewrites each block's {@code planned_start}. An edit that breaks a rule is accepted and
 * answered with warnings; only an impossible one is refused (400, or 409 {@code TRAIN_YEAR_BLOCK_LOCKED} for a
 * running/done block and for the consolidation's order, time or skip).
 *
 * <p>Task 6: every read and write of the active plan first reconciles block status from the linked mesocycles
 * ({@link YearReconciler}, controller call 2) and answers what comes next ({@code next}) and which started block the
 * plan does not know about ({@code unlinkedRunning}). Only blocks of the ACTIVE plan are ever linked; linking a
 * mesocycle first lets go of every other block holding it, so one mesocycle is never linked to two blocks.
 */
@Service
@RequiredArgsConstructor
public class YearPlanService {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");
    private static final String INVALID = "VALIDATION_INVALID_VALUE";
    private static final String EMPHASIZE = "emphasize";
    private static final int MIN_LOADING_WEEKS = 4;
    private static final int MAX_LOADING_WEEKS = 8;
    private static final int MAX_CONSOLIDATION_WEEKS = 2;

    private final TrainingYearPlanRepository plans;
    private final TrainingYearBlockRepository blocks;
    private final MesocycleRepository mesocycles;
    private final WorkoutSessionRepository workoutSessions;
    private final MesocycleDiscardService discardService;
    private final YearPlanProperties properties;
    private final VolumeProperties volume;
    private final YearPlanAssembler assembler;
    private final ObjectProvider<Clock> clock;

    @Transactional(readOnly = true)
    public YearPlan preview(UUID owner, YearPlanRequest req) {
        LocalDate today = today();
        Draft draft = draft(owner, req);
        // Throwaway ids only match blocks to the layout; the assembler hides them on a preview (plan id null).
        draft.blocks().forEach(b -> b.setId(UUID.randomUUID()));
        Layout layout = layout(owner, draft.plan(), draft.blocks(), today);
        return assembler.toDto(draft.plan(), draft.blocks(), layout, draft.result().relaxed(), today);
    }

    @Transactional
    public YearPlan create(UUID owner, YearPlanRequest req) {
        LocalDate today = today();
        Draft draft = draft(owner, req);
        plans.findByCreatedByAndStatusAndDeletedFalse(owner, TrainingYearPlanEntity.ACTIVE).ifPresent(old -> {
            if (!Boolean.TRUE.equals(req.getReplaceActive())) {
                throw error("TRAIN_YEAR_PLAN_ACTIVE_EXISTS", HttpStatus.CONFLICT);
            }
            archiveEntity(old);
            plans.saveAndFlush(old);
        });

        TrainingYearPlanEntity plan = plans.saveAndFlush(draft.plan());
        for (TrainingYearBlockEntity b : draft.blocks()) {
            b.setPlanId(plan.getId());
            if (b.getMesocycleId() != null) unlinkElsewhere(owner, b.getMesocycleId(), null);
        }
        List<TrainingYearBlockEntity> saved = new ArrayList<>(blocks.saveAllAndFlush(draft.blocks()));
        Layout layout = layout(owner, plan, saved, today);
        writePlannedStarts(saved, layout);
        return toActiveDto(owner, plan, saved, layout, draft.result().relaxed(), today);
    }

    /** Reconciles the blocks (persisted, with the re-dated {@code planned_start}s) before answering. */
    @Transactional
    public YearPlan active(UUID owner) {
        Active a = reconciledActive(owner).orElseThrow(() -> error("TRAIN_YEAR_PLAN_NONE", HttpStatus.NOT_FOUND));
        LocalDate today = today();
        Layout layout = layout(owner, a.plan(), a.blocks(), today);
        writePlannedStarts(a.blocks(), layout);
        return toActiveDto(owner, a.plan(), a.blocks(), layout, List.of(), today);
    }

    @Transactional
    public YearPlan patchBlock(UUID owner, UUID blockId, YearBlockPatch patch) {
        TrainingYearBlockEntity target = blocks.findByIdAndCreatedByAndDeletedFalse(blockId, owner)
            .orElseThrow(() -> error("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND));
        TrainingYearPlanEntity plan = plans.findByIdAndCreatedByAndDeletedFalse(target.getPlanId(), owner)
            .filter(TrainingYearPlanEntity::isActive)
            .orElseThrow(YearPlanService::locked);
        List<TrainingYearBlockEntity> all = blocks.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId());
        reconcile(owner, all); // the lock checks below see the status reality gives, not a stale one
        boolean consolidation = YearGenerator.CONSOLIDATION.equals(target.getKind());

        if (target.is(YearGenerator.RUNNING) || target.is(YearGenerator.DONE)) throw locked();
        if (consolidation && (patch.getFocus() != null || patch.getOrdinal() != null
            || patch.getShiftWeeks() != null || patch.getSkip() != null)) {
            throw locked();
        }
        boolean linkRunning = Boolean.TRUE.equals(patch.getLinkRunning());
        MesocycleEntity toLink = null;
        if (linkRunning) {
            toLink = unlinkedRunning(owner, plan, all)
                .orElseThrow(() -> error("TRAIN_YEAR_NOTHING_TO_LINK", HttpStatus.CONFLICT));
            if (target.getMesocycleId() != null) throw locked();
        }

        if (patch.getFocus() != null) applyFocus(target, patch.getFocus());
        if (patch.getWeeks() != null) applyWeeks(plan, target, consolidation, patch.getWeeks());
        if (patch.getOrdinal() != null) move(all, target, patch.getOrdinal());
        if (patch.getShiftWeeks() != null) shift(target, patch.getShiftWeeks());
        if (Boolean.TRUE.equals(patch.getSkip()) && target.getMesocycleId() != null) {
            // A skipped block linked to a never-started run: the run is thrown away („Mégsem, eldobom": soft delete,
            // no report, no event) so the skip sticks — otherwise the reconciler would pull the block back to planned
            // and the starter would still activate the run on its day. A run with logs is running/done → locked above.
            discardService.discard(owner, target.getMesocycleId());
            target.setMesocycleId(null);
        }
        if (patch.getSkip() != null) target.setStatus(patch.getSkip() ? YearGenerator.SKIPPED : YearGenerator.PLANNED);
        if (toLink != null) {
            if (!target.is(YearGenerator.PLANNED)) throw locked(); // a block skipped in this same edit
            attach(owner, all, target, toLink.getId());
        }

        plans.save(plan);
        LocalDate today = today();
        Layout layout = layout(owner, plan, all, today);
        writePlannedStarts(all, layout);
        return toActiveDto(owner, plan, all, layout, List.of(), today);
    }

    @Transactional
    public YearPlan archive(UUID owner, UUID planId) {
        TrainingYearPlanEntity plan = plans.findByIdAndCreatedByAndDeletedFalse(planId, owner)
            .orElseThrow(() -> error("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND));
        if (plan.isActive()) {
            // Freeze the statuses reality gave the blocks; the links stay as history (only the active plan links).
            reconcile(owner, blocks.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId()));
            archiveEntity(plan);
            plan = plans.saveAndFlush(plan);
        }
        return read(owner, plan);
    }

    // ---- linking (Task 6) ----

    /** The active plan and its blocks (ordinal order), reconciled against their mesocycles. */
    record Active(TrainingYearPlanEntity plan, List<TrainingYearBlockEntity> blocks) {}

    /** The owner's active plan with its block statuses reconciled and saved; empty when there is none. */
    Optional<Active> reconciledActive(UUID owner) {
        return plans.findByCreatedByAndStatusAndDeletedFalse(owner, TrainingYearPlanEntity.ACTIVE).map(plan -> {
            List<TrainingYearBlockEntity> all = blocks.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId());
            reconcile(owner, all);
            return new Active(plan, all);
        });
    }

    /** Each block's start in today's layout (loading blocks and the consolidation). */
    Map<UUID, LocalDate> startsNow(UUID owner, Active a) {
        return starts(layout(owner, a.plan(), a.blocks(), today()));
    }

    private static Map<UUID, LocalDate> starts(Layout layout) {
        Map<UUID, LocalDate> out = new HashMap<>();
        layout.blocks().forEach(p -> out.put(p.id(), p.start()));
        out.put(layout.consolidation().id(), layout.consolidation().start());
        return out;
    }

    /** Links {@code mesocycleId} to {@code target} (a planned, unlinked block of the active plan) and re-lays out. */
    void link(UUID owner, Active a, TrainingYearBlockEntity target, UUID mesocycleId) {
        attach(owner, a.blocks(), target, mesocycleId);
        Layout layout = layout(owner, a.plan(), a.blocks(), today());
        writePlannedStarts(a.blocks(), layout);
    }

    private void attach(UUID owner, List<TrainingYearBlockEntity> all, TrainingYearBlockEntity target,
                        UUID mesocycleId) {
        unlinkElsewhere(owner, mesocycleId, target.getId());
        target.setMesocycleId(mesocycleId);
        reconcile(owner, all); // planned meso keeps planned, active → running
    }

    /** Applies {@link YearReconciler} to the blocks in place and saves the changed ones. */
    private void reconcile(UUID owner, List<TrainingYearBlockEntity> all) {
        Map<UUID, YearReconciler.MesoState> states = new HashMap<>();
        List<YearReconciler.Row> rows = new ArrayList<>();
        for (TrainingYearBlockEntity b : all) {
            rows.add(new YearReconciler.Row(b.getId(), b.getStatus(), b.getMesocycleId()));
            UUID id = b.getMesocycleId();
            if (id != null && !states.containsKey(id)) {
                mesocycles.findByIdAndCreatedByAndDeletedFalse(id, owner).ifPresent(m -> states.put(id,
                    new YearReconciler.MesoState(m.getStatus(),
                        workoutSessions.existsByCreatedByAndMesocycleIdAndTemplateSessionIdIsNotNull(owner, id),
                        m.isDeleted())));
            }
        }
        Map<UUID, TrainingYearBlockEntity> byId = new HashMap<>();
        all.forEach(b -> byId.put(b.getId(), b));
        List<TrainingYearBlockEntity> changed = new ArrayList<>();
        for (YearReconciler.Change c : YearReconciler.reconcile(rows, states)) {
            TrainingYearBlockEntity b = byId.get(c.blockId());
            b.setStatus(c.status());
            if (c.unlink()) b.setMesocycleId(null);
            changed.add(b);
        }
        if (!changed.isEmpty()) blocks.saveAll(changed);
    }

    /** The active plan's DTO plus {@code next} and {@code unlinkedRunning}. */
    private YearPlan toActiveDto(UUID owner, TrainingYearPlanEntity plan, List<TrainingYearBlockEntity> all,
                                 Layout layout, List<YearGenerator.Note> relaxed, LocalDate today) {
        YearPlan dto = assembler.toDto(plan, all, layout, relaxed, today);
        dto.setNext(next(owner, all, layout, today));
        unlinkedRunning(owner, plan, all).ifPresent(m -> dto.setUnlinkedRunning(YearUnlinkedRunning.builder()
            .mesocycleId(m.getId()).title(m.getTitle()).startDate(m.getStartDate()).build()));
        return dto;
    }

    /**
     * (a) the active mesocycle is in its last week ({@code today ≥ endDate − 7 days}) and the block after it is
     * planned and unlinked → {@code last_week}, starting on its layout start; (b) no active or planned mesocycle and a
     * planned block exists → {@code no_block}, starting on its layout start or the Monday on/after today, whichever
     * is later. Otherwise null.
     */
    private YearNext next(UUID owner, List<TrainingYearBlockEntity> all, Layout layout, LocalDate today) {
        Map<UUID, LocalDate> starts = starts(layout);
        List<TrainingYearBlockEntity> ordered = all.stream()
            .sorted(Comparator.comparingInt(TrainingYearBlockEntity::getOrdinal)).toList();

        Optional<MesocycleEntity> active = mesocycles.findByCreatedByAndStatusAndDeletedFalse(owner, "active").stream()
            .filter(m -> m.getStartDate() != null)
            .max(Comparator.comparing(MesocycleEntity::getStartDate));
        if (active.isPresent()) {
            MesocycleEntity m = active.get();
            if (m.getEndDate() == null || today.isBefore(m.getEndDate().minusDays(7))) return null;
            int after = ordered.stream().filter(b -> m.getId().equals(b.getMesocycleId()))
                .mapToInt(TrainingYearBlockEntity::getOrdinal).findFirst().orElse(0);
            return ordered.stream()
                .filter(b -> b.getOrdinal() > after && !b.is(YearGenerator.SKIPPED))
                .findFirst()
                .filter(b -> b.is(YearGenerator.PLANNED) && b.getMesocycleId() == null)
                .map(b -> next(b, starts.get(b.getId()), YearNext.ReasonEnum.LAST_WEEK))
                .orElse(null);
        }
        if (!mesocycles.findByCreatedByAndStatusAndDeletedFalse(owner, "planned").isEmpty()) return null;
        LocalDate monday = today.with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        return ordered.stream().filter(b -> b.is(YearGenerator.PLANNED)).findFirst()
            .map(b -> {
                LocalDate start = starts.get(b.getId());
                return next(b, start.isBefore(monday) ? monday : start, YearNext.ReasonEnum.NO_BLOCK);
            })
            .orElse(null);
    }

    private static YearNext next(TrainingYearBlockEntity b, LocalDate startsOn, YearNext.ReasonEnum reason) {
        return YearNext.builder().blockId(b.getId()).startsOn(startsOn).reason(reason).build();
    }

    /**
     * An active or planned mesocycle started on/after the plan start and linked to no block of the plan: the active
     * one first, else the earliest planned one.
     */
    private Optional<MesocycleEntity> unlinkedRunning(UUID owner, TrainingYearPlanEntity plan,
                                                      List<TrainingYearBlockEntity> all) {
        Set<UUID> linked = new HashSet<>();
        all.forEach(b -> {
            if (b.getMesocycleId() != null) linked.add(b.getMesocycleId());
        });
        for (String status : List.of("active", "planned")) {
            Optional<MesocycleEntity> found = mesocycles.findByCreatedByAndStatusAndDeletedFalse(owner, status).stream()
                .filter(m -> m.getStartDate() != null && !m.getStartDate().isBefore(plan.getStartDate()))
                .filter(m -> !linked.contains(m.getId()))
                .min(Comparator.comparing(MesocycleEntity::getStartDate));
            if (found.isPresent()) return found;
        }
        return Optional.empty();
    }

    // ---- generation ----

    private record Draft(TrainingYearPlanEntity plan, List<TrainingYearBlockEntity> blocks,
                         YearGenerator.Result result) {}

    /** Validates the request and runs the rotation into unsaved entities (planned_start comes from the layout). */
    private Draft draft(UUID owner, YearPlanRequest req) {
        LocalDate start = req.getStartDate();
        if (start == null || start.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw error("TRAIN_YEAR_START_NOT_MONDAY", HttpStatus.BAD_REQUEST);
        }
        int blockWeeks = req.getBlockWeeks() != null ? req.getBlockWeeks() : properties.defaultBlockWeeks();
        int consolidationWeeks = req.getConsolidationWeeks() != null
            ? req.getConsolidationWeeks() : properties.defaultConsolidationWeeks();
        List<String> emphasis = List.copyOf(new LinkedHashSet<>(
            req.getEmphasis() == null ? List.of() : req.getEmphasis()));

        YearGenerator.Result result = YearGenerator.generate(
            new YearGenerator.Input(start, emphasis, blockWeeks, consolidationWeeks, adoptable(owner, start)),
            properties, mav());

        TrainingYearPlanEntity plan = new TrainingYearPlanEntity();
        plan.setCreatedBy(owner);
        plan.setStartDate(result.start());
        plan.setBlockWeeks(blockWeeks);
        plan.setConsolidationWeeks(consolidationWeeks);
        plan.setEmphasis(new ArrayList<>(emphasis));
        List<TrainingYearBlockEntity> out = new ArrayList<>();
        for (YearGenerator.Block g : result.blocks()) {
            TrainingYearBlockEntity b = new TrainingYearBlockEntity();
            b.setCreatedBy(owner);
            b.setOrdinal(g.ordinal());
            b.setKind(g.kind());
            b.setFocus(new ArrayList<>(g.focus()));
            b.setWeeks(g.weeks());
            b.setGapWeeks(0);
            b.setAdopted(g.adopted());
            b.setMesocycleId(g.mesocycleId());
            b.setStatus(g.adopted() ? YearGenerator.RUNNING : YearGenerator.PLANNED);
            out.add(b);
        }
        return new Draft(plan, out, result);
    }

    /**
     * The running block becomes block 1 only when it runs into the new plan ({@code start < endDate}); its focus is
     * its Hangsúly groups in config order (possibly none).
     */
    private YearGenerator.Adopted adoptable(UUID owner, LocalDate start) {
        List<String> order = new ArrayList<>(properties.kindGroups().getOrDefault(YearGenerator.UPPER, List.of()));
        order.addAll(properties.kindGroups().getOrDefault(YearGenerator.LOWER, List.of()));
        return mesocycles.findByCreatedByAndStatusAndDeletedFalse(owner, "active").stream()
            .filter(m -> m.getStartDate() != null && m.getEndDate() != null && m.getWeeks() != null)
            .filter(m -> start.isBefore(m.getEndDate()))
            .max(Comparator.comparing(MesocycleEntity::getStartDate))
            .map(m -> {
                Map<String, String> pr = m.getMusclePriorities() == null ? Map.of() : m.getMusclePriorities();
                List<String> focus = order.stream().filter(g -> EMPHASIZE.equals(pr.get(g))).toList();
                return new YearGenerator.Adopted(m.getId(), m.getStartDate(), m.getWeeks(), focus);
            })
            .orElse(null);
    }

    private Map<String, Integer> mav() {
        Map<String, Integer> mav = new HashMap<>();
        volume.baselines().forEach((g, b) -> mav.put(g, b.mav()));
        return mav;
    }

    /**
     * One mesocycle is linked to at most one block: every other block holding it (e.g. in an archived plan) lets it
     * go, and a {@code running} one becomes {@code planned} — never left running without a mesocycle.
     */
    private void unlinkElsewhere(UUID owner, UUID mesocycleId, UUID keep) {
        for (TrainingYearBlockEntity old : blocks.findByCreatedByAndMesocycleIdAndDeletedFalse(owner, mesocycleId)) {
            if (old.getId().equals(keep)) continue;
            old.setMesocycleId(null);
            if (old.is(YearGenerator.RUNNING)) old.setStatus(YearGenerator.PLANNED);
            blocks.saveAndFlush(old);
        }
    }

    // ---- edits ----

    private void applyFocus(TrainingYearBlockEntity target, List<String> focus) {
        List<String> distinct = List.copyOf(new LinkedHashSet<>(focus));
        if (distinct.isEmpty() || distinct.size() != focus.size()) throw invalid();
        target.setFocus(new ArrayList<>(distinct));
        String kind = kindOf(distinct);
        if (kind != null) target.setKind(kind);
    }

    /** All upper → upper, all lower → lower, mixed → null (keep the kind; YearRules warns mixed_focus). */
    private String kindOf(List<String> focus) {
        for (String kind : List.of(YearGenerator.UPPER, YearGenerator.LOWER)) {
            if (properties.kindGroups().getOrDefault(kind, List.of()).containsAll(focus)) return kind;
        }
        return null;
    }

    private void applyWeeks(TrainingYearPlanEntity plan, TrainingYearBlockEntity target, boolean consolidation,
                            int weeks) {
        if (consolidation) {
            if (weeks < 1 || weeks > MAX_CONSOLIDATION_WEEKS) throw invalid();
            plan.setConsolidationWeeks(weeks);
        } else if (weeks < MIN_LOADING_WEEKS || weeks > MAX_LOADING_WEEKS) {
            throw invalid();
        }
        target.setWeeks(weeks);
    }

    /**
     * Moves the block among the loading blocks and renumbers them 1..n (the consolidation stays n+1). A move across a
     * running/done block is impossible (they keep their place in time) → locked. The ordinal unique constraint is
     * deferred, so the renumbering only has to be contiguous at commit.
     */
    private static void move(List<TrainingYearBlockEntity> all, TrainingYearBlockEntity target, int ordinal) {
        List<TrainingYearBlockEntity> loading = new ArrayList<>(all.stream()
            .filter(b -> !YearGenerator.CONSOLIDATION.equals(b.getKind()))
            .sorted(Comparator.comparingInt(TrainingYearBlockEntity::getOrdinal)).toList());
        if (ordinal < 1 || ordinal > loading.size()) throw invalid();
        int from = loading.indexOf(target);
        int to = ordinal - 1;
        if (from == to) return;
        for (int i = Math.min(from, to); i <= Math.max(from, to); i++) {
            TrainingYearBlockEntity b = loading.get(i);
            if (b != target && (b.is(YearGenerator.RUNNING) || b.is(YearGenerator.DONE))) throw locked();
        }
        loading.remove(from);
        loading.add(to, target);
        for (int i = 0; i < loading.size(); i++) loading.get(i).setOrdinal(i + 1);
    }

    private static void shift(TrainingYearBlockEntity target, int shiftWeeks) {
        if (shiftWeeks < 0) {
            if (target.getGapWeeks() <= 0) throw invalid();
            target.setGapWeeks(target.getGapWeeks() - 1);
        } else if (shiftWeeks > 0) {
            target.setGapWeeks(target.getGapWeeks() + 1);
        }
    }

    // ---- layout ----

    private YearPlan read(UUID owner, TrainingYearPlanEntity plan) {
        LocalDate today = today();
        List<TrainingYearBlockEntity> all = blocks.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId());
        return assembler.toDto(plan, all, layout(owner, plan, all, today), List.of(), today);
    }

    private Layout layout(UUID owner, TrainingYearPlanEntity plan, List<TrainingYearBlockEntity> all,
                          LocalDate today) {
        List<Slot> loading = new ArrayList<>();
        Slot consolidation = null;
        for (TrainingYearBlockEntity b : all) {
            Slot s = new Slot(b.getId(), b.getOrdinal(), b.getWeeks(), b.getGapWeeks(), b.getStatus(),
                facts(owner, b.getMesocycleId()));
            if (YearGenerator.CONSOLIDATION.equals(b.getKind())) consolidation = s;
            else loading.add(s);
        }
        Objects.requireNonNull(consolidation, "a year plan always ends with a consolidation block");
        return YearSchedule.layout(plan.getStartDate(), loading, consolidation, plan.getConsolidationWeeks(), today,
            properties);
    }

    private MesoFacts facts(UUID owner, UUID mesocycleId) {
        if (mesocycleId == null) return null;
        return mesocycles.findByIdAndCreatedByAndDeletedFalse(mesocycleId, owner)
            .filter(m -> m.getStartDate() != null && m.getWeeks() != null)
            .map(m -> new MesoFacts(m.getStartDate(), m.getWeeks(),
                m.getClosedAt() == null ? null : m.getClosedAt().atZone(ZONE).toLocalDate()))
            .orElse(null);
    }

    private void writePlannedStarts(List<TrainingYearBlockEntity> all, Layout layout) {
        Map<UUID, Placed> placed = new HashMap<>();
        layout.blocks().forEach(p -> placed.put(p.id(), p));
        placed.put(layout.consolidation().id(), layout.consolidation());
        all.forEach(b -> b.setPlannedStart(placed.get(b.getId()).start()));
        blocks.saveAll(all);
    }

    // ---- helpers ----

    private void archiveEntity(TrainingYearPlanEntity plan) {
        plan.setStatus(TrainingYearPlanEntity.ARCHIVED);
        plan.setArchivedAt(Instant.now(clock()).truncatedTo(ChronoUnit.MICROS));
    }

    private LocalDate today() {
        return LocalDate.now(clock().withZone(ZONE));
    }

    private Clock clock() {
        return clock.getIfAvailable(Clock::systemUTC);
    }

    private static SystemRuntimeErrorException locked() {
        return error("TRAIN_YEAR_BLOCK_LOCKED", HttpStatus.CONFLICT);
    }

    private static SystemRuntimeErrorException invalid() {
        return error(INVALID, HttpStatus.BAD_REQUEST);
    }

    private static SystemRuntimeErrorException error(String key, HttpStatus status) {
        return new SystemRuntimeErrorException(SystemMessage.error(key).build(), status);
    }
}
