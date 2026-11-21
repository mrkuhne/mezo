package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.YearBlockPatch;
import io.mrkuhne.mezo.api.dto.YearPlan;
import io.mrkuhne.mezo.api.dto.YearPlanRequest;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.config.YearPlanProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearPlanEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearPlanRepository;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
            if (b.getMesocycleId() != null) unlinkElsewhere(owner, b.getMesocycleId());
        }
        List<TrainingYearBlockEntity> saved = blocks.saveAllAndFlush(draft.blocks());
        Layout layout = layout(owner, plan, saved, today);
        writePlannedStarts(saved, layout);
        return assembler.toDto(plan, saved, layout, draft.result().relaxed(), today);
    }

    @Transactional(readOnly = true)
    public YearPlan active(UUID owner) {
        TrainingYearPlanEntity plan = plans.findByCreatedByAndStatusAndDeletedFalse(owner, TrainingYearPlanEntity.ACTIVE)
            .orElseThrow(() -> error("TRAIN_YEAR_PLAN_NONE", HttpStatus.NOT_FOUND));
        return read(owner, plan);
    }

    @Transactional
    public YearPlan patchBlock(UUID owner, UUID blockId, YearBlockPatch patch) {
        TrainingYearBlockEntity target = blocks.findByIdAndCreatedByAndDeletedFalse(blockId, owner)
            .orElseThrow(() -> error("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND));
        TrainingYearPlanEntity plan = plans.findByIdAndCreatedByAndDeletedFalse(target.getPlanId(), owner)
            .filter(TrainingYearPlanEntity::isActive)
            .orElseThrow(YearPlanService::locked);
        List<TrainingYearBlockEntity> all = blocks.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId());
        boolean consolidation = YearGenerator.CONSOLIDATION.equals(target.getKind());

        if (target.is(YearGenerator.RUNNING) || target.is(YearGenerator.DONE)) throw locked();
        if (consolidation && (patch.getFocus() != null || patch.getOrdinal() != null
            || patch.getShiftWeeks() != null || patch.getSkip() != null)) {
            throw locked();
        }
        if (Boolean.TRUE.equals(patch.getLinkRunning())) {
            // Nothing is ever unlinked-running before the linker exists (Task 6 fills this in).
            throw error("TRAIN_YEAR_NOTHING_TO_LINK", HttpStatus.CONFLICT);
        }

        if (patch.getFocus() != null) applyFocus(target, patch.getFocus());
        if (patch.getWeeks() != null) applyWeeks(plan, target, consolidation, patch.getWeeks());
        if (patch.getOrdinal() != null) move(all, target, patch.getOrdinal());
        if (patch.getShiftWeeks() != null) shift(target, patch.getShiftWeeks());
        if (patch.getSkip() != null) target.setStatus(patch.getSkip() ? YearGenerator.SKIPPED : YearGenerator.PLANNED);

        plans.save(plan);
        LocalDate today = today();
        Layout layout = layout(owner, plan, all, today);
        writePlannedStarts(all, layout);
        return assembler.toDto(plan, all, layout, List.of(), today);
    }

    @Transactional
    public YearPlan archive(UUID owner, UUID planId) {
        TrainingYearPlanEntity plan = plans.findByIdAndCreatedByAndDeletedFalse(planId, owner)
            .orElseThrow(() -> error("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND));
        if (plan.isActive()) {
            archiveEntity(plan);
            plan = plans.saveAndFlush(plan);
        }
        return read(owner, plan);
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

    /** One mesocycle is linked to at most one block: a block of an older plan holding it lets it go. */
    private void unlinkElsewhere(UUID owner, UUID mesocycleId) {
        blocks.findByCreatedByAndMesocycleIdAndDeletedFalse(owner, mesocycleId).ifPresent(old -> {
            old.setMesocycleId(null);
            blocks.saveAndFlush(old);
        });
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

    private static void archiveEntity(TrainingYearPlanEntity plan) {
        plan.setStatus(TrainingYearPlanEntity.ARCHIVED);
        plan.setArchivedAt(Instant.now());
    }

    private LocalDate today() {
        return LocalDate.now(clock.getIfAvailable(Clock::systemUTC).withZone(ZONE));
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
