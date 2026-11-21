package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonAllowedRecipeEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonNumbersJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonRevisionEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonAllowedRecipeRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRevisionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * The season lifecycle (spec §5.2, §5.3): create (planned, with its planned goal) → activate (goal, slots, sleep
 * need, block — one transaction; the previous active season closes) → apply previewed changes (fingerprint-checked,
 * one transaction, a revision row) → close. Only these and {@link #putRules} write; previews never do.
 */
@lombok.extern.slf4j.Slf4j
@Service
@RequiredArgsConstructor
public class SeasonService {

    private final SeasonRepository seasonRepository;
    private final SeasonAllowedRecipeRepository allowedRepository;
    private final SeasonRevisionRepository revisionRepository;
    private final SeasonPreviewService previewService;
    private final SeasonGoalPort goalPort;
    private final SeasonTrainPort trainPort;
    private final SeasonSleepPort sleepPort;
    private final MenuService menuService;

    public List<SeasonEntity> list(UUID owner) {
        return seasonRepository.findByCreatedByAndDeletedFalseOrderByStartDateDesc(owner);
    }

    /** A planned season and its planned goal. Planned seasons may coexist with the active one. */
    @Transactional
    public SeasonEntity create(UUID owner, SeasonDraftJson draft) {
        SeasonGoalPort.GoalFields fields = previewService.goalFields(owner, null, draft);
        UUID goalId = goalPort.createGoal(owner, fields);
        SeasonEntity s = new SeasonEntity();
        s.setCreatedBy(owner);
        s.setStatus(SeasonEntity.STATUS_PLANNED);
        s.setGoalId(goalId);
        take(s, draft);
        SeasonEntity saved = seasonRepository.save(s);
        replaceAllowed(owner, saved.getId(), draft.allowedOrEmpty());
        return saved;
    }

    /**
     * Activates a planned season in one transaction: the season row first (so the block gate sees it), the previous
     * active season closed, its goal activated, the weekly slots and the sleep need written, the block attached.
     */
    @Transactional
    public SeasonEntity activate(UUID owner, UUID id) {
        SeasonEntity s = previewService.requireEditable(owner, id);
        if (SeasonEntity.STATUS_ACTIVE.equals(s.getStatus())) {
            return s;
        }
        SeasonDraftJson draft = s.getDraft();
        SeasonNumbersJson before = previewService.liveNumbers(owner, draft).orElse(null);
        int sleepBase = previewService.sleepBase(owner); // before the previous season lets go of the sleep goal
        SeasonPreviewService.Computed after = previewService.compute(owner, s, draft);

        seasonRepository.findActive(owner).ifPresent(prev -> {
            prev.setStatus(SeasonEntity.STATUS_CLOSED);
            prev.setClosedSummary(summary(prev));
            prev.setUpdatedAt(Instant.now());
            seasonRepository.saveAndFlush(prev); // the one-active index must see it closed first
        });
        s.setStatus(SeasonEntity.STATUS_ACTIVE);
        s.setSleepBaseMin(sleepBase);
        s.setSleepNeedMin(after.numbers().sleepNeedMin());
        s.setUpdatedAt(Instant.now());
        seasonRepository.saveAndFlush(s);

        goalPort.activate(owner, s.getGoalId());
        trainPort.replaceSlots(owner, draft);
        writeSleep(owner, draft, after.numbers().sleepNeedMin());
        attachBlock(owner, s, draft.block());
        revision(owner, s, draft, before, after.numbers());
        return s;
    }

    /**
     * Applies a previewed draft: 409 {@code SEASON_PREVIEW_STALE} when anything the preview depended on moved since
     * (the fingerprint); else goal, slots, sleep need and block in one transaction, plus a revision row.
     */
    @Transactional
    public SeasonEntity apply(UUID owner, UUID id, SeasonDraftJson draft, String fingerprint) {
        SeasonEntity s = previewService.requireEditable(owner, id);
        requireBlockDaysUnchanged(owner, s, draft);
        if (fingerprint == null || !fingerprint.equals(previewService.fingerprint(owner, s))) {
            throw new SystemRuntimeErrorException(SystemMessage.error("SEASON_PREVIEW_STALE").build(), HttpStatus.CONFLICT);
        }
        SeasonPreviewService.Preview preview = previewService.preview(owner, id, draft);
        SeasonPreviewService.Computed after = previewService.compute(owner, s, draft);

        SeasonDraftJson.Block heldBlock = s.getDraft() == null ? null : s.getDraft().block();
        goalPort.updateGoal(owner, s.getGoalId(), after.goal());
        take(s, draft);
        if (SeasonEntity.STATUS_ACTIVE.equals(s.getStatus())) {
            // replaceSlots recomputes the (active) goal, so the updated pace lands in the prescription too.
            trainPort.replaceSlots(owner, draft);
            writeSleep(owner, draft, preview.after().sleepNeedMin());
            s.setSleepNeedMin(preview.after().sleepNeedMin());
            if (draft.block() != null && !draft.block().equals(heldBlock)) {
                attachBlock(owner, s, draft.block());
            }
        }
        s.setUpdatedAt(Instant.now());
        seasonRepository.save(s);
        replaceAllowed(owner, s.getId(), draft.allowedOrEmpty());
        revision(owner, s, draft, preview.before(), preview.after());
        if (SeasonEntity.STATUS_ACTIVE.equals(s.getStatus())) {
            refitAfterCommit(owner); // spec §5.12-4: the rest of the menu follows the new budgets; past days stay
        }
        return s;
    }

    /**
     * Replaces the recipes the season allows („Kiválasztott receptek", Évad S3) — no kcal effect, so no preview. Ids
     * that are not his recipes are dropped. The stored draft follows, so a later accept carries the same set.
     */
    @Transactional
    public SeasonEntity putRecipes(UUID owner, UUID id, List<UUID> recipeIds, Set<UUID> his) {
        SeasonEntity s = previewService.requireEditable(owner, id);
        List<UUID> kept = new java.util.ArrayList<>(new LinkedHashSet<>(recipeIds == null ? List.of() : recipeIds));
        kept.removeIf(r -> !his.contains(r));
        replaceAllowed(owner, s.getId(), kept);
        SeasonDraftJson d = s.getDraft();
        if (d != null) {
            s.setDraft(new SeasonDraftJson(d.title(), d.trajectory(), d.targetWeightKg(), d.ratePctPerWeek(), d.kgPerWeek(),
                d.startDate(), d.weeks(), d.gymDays(), d.gymTime(), d.sport(), d.sleepAnchor(), List.copyOf(kept),
                d.block()));
        }
        s.setUpdatedAt(Instant.now());
        SeasonEntity saved = seasonRepository.save(s);
        if (SeasonEntity.STATUS_ACTIVE.equals(s.getStatus())) {
            refitAfterCommit(owner); // a recipe he no longer allows leaves the menu from tomorrow
        }
        return saved;
    }

    /**
     * Re-fits the menu from tomorrow once this transaction has committed, in its own transaction, so a menu problem
     * never rolls back his change (it is logged; the menu keeps its old meals, and the day plan stops offering a meal
     * that no longer fits its window or his allowed recipes on its own).
     */
    private void refitAfterCommit(UUID owner) {
        Runnable refit = () -> {
            try {
                menuService.refitInOwnTransaction(owner, LocalDate.now().plusDays(1));
            } catch (RuntimeException e) {
                log.warn("Menu re-fit after a season change failed for {}", owner, e);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    refit.run();
                }
            });
        } else {
            refit.run();
        }
    }

    /**
     * Closes a season (its goal and the weekly slots stay as they are). An active season hands the sleep goal back:
     * when its minutes are still the season's derived need, they return to the base (anchor kept), so the next
     * season's need does not stack on this one's.
     */
    @Transactional
    public SeasonEntity close(UUID owner, UUID id) {
        SeasonEntity s = requireOwned(owner, id);
        if (SeasonEntity.STATUS_ACTIVE.equals(s.getStatus())) {
            restoreSleepBase(owner, s);
        }
        if (!SeasonEntity.STATUS_CLOSED.equals(s.getStatus())) {
            s.setStatus(SeasonEntity.STATUS_CLOSED);
            s.setClosedSummary(summary(s));
            s.setUpdatedAt(Instant.now());
        }
        return s;
    }

    /** The season's switches — no kcal effect, so no preview. */
    @Transactional
    public SeasonEntity putRules(UUID owner, UUID id, int processedFoodMaxNova, boolean deloadMaintain,
                                 boolean useLearnedExpenditure, boolean proposeExperiments, Integer menuDay,
                                 String menuTime) {
        SeasonEntity s = previewService.requireEditable(owner, id);
        s.setProcessedFoodMaxNova(processedFoodMaxNova);
        s.setDeloadMaintain(deloadMaintain);
        s.setUseLearnedExpenditure(useLearnedExpenditure);
        s.setProposeExperiments(proposeExperiments);
        s.setMenuDay(menuDay);
        s.setMenuTime(menuTime);
        s.setUpdatedAt(Instant.now());
        return s;
    }

    public SeasonEntity requireOwned(UUID owner, UUID id) {
        return seasonRepository.findByIdAndCreatedBy(id, owner)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    /** The block the draft names: adopt a running one, re-run one, or start one from a template — then link it. */
    private void attachBlock(UUID owner, SeasonEntity s, SeasonDraftJson.Block block) {
        if (block == null || block.source() == null) {
            return;
        }
        LocalDate start = s.getStartDate().isAfter(LocalDate.now()) ? s.getStartDate() : LocalDate.now();
        UUID mesoId = switch (block.source()) {
            case "adopt" -> block.mesocycleId() != null ? block.mesocycleId()
                : trainPort.activeMesocycle(owner).map(SeasonTrainPort.Block::id).orElse(null);
            case "rerun" -> block.mesocycleId() == null ? null
                : trainPort.startFromTemplate(owner, trainPort.templateOf(owner, block.mesocycleId()), start);
            case "template" -> block.templateId() == null ? null
                : trainPort.startFromTemplate(owner, block.templateId(), start);
            default -> null;
        };
        if (mesoId == null) {
            return;
        }
        trainPort.mesocycle(owner, mesoId)
            .ifPresent(m -> goalPort.link(owner, s.getGoalId(), m.id(), m.startDate()));
        // From now on the season holds that block: a later accept compares against "adopt <id>", never re-starts it.
        SeasonDraftJson d = s.getDraft();
        s.setDraft(new SeasonDraftJson(d.title(), d.trajectory(), d.targetWeightKg(), d.ratePctPerWeek(), d.kgPerWeek(),
            d.startDate(), d.weeks(), d.gymDays(), d.gymTime(), d.sport(), d.sleepAnchor(), d.allowedRecipeIds(),
            new SeasonDraftJson.Block("adopt", mesoId, null)));
    }

    /**
     * Spec §5.12-1: while the season's block runs, its weekdays are the gym slots' — the gym DAYS are locked (409
     * {@code SEASON_BLOCK_DAYS_LOCKED}); the gym time, sport, pace, target and length stay changeable. Previews stay
     * allowed (the phone disables the control).
     */
    private void requireBlockDaysUnchanged(UUID owner, SeasonEntity s, SeasonDraftJson draft) {
        if (!SeasonEntity.STATUS_ACTIVE.equals(s.getStatus()) || trainPort.activeMesocycle(owner).isEmpty()) {
            return;
        }
        Set<Integer> now = new HashSet<>(previewService.currentDraft(owner, s).gymDaysOrEmpty());
        if (!now.equals(new HashSet<>(draft.gymDaysOrEmpty()))) {
            throw new SystemRuntimeErrorException(SystemMessage.error("SEASON_BLOCK_DAYS_LOCKED").build(),
                HttpStatus.CONFLICT);
        }
    }

    private void restoreSleepBase(UUID owner, SeasonEntity s) {
        SeasonSleepPort.SleepGoal sleep = sleepPort.get(owner);
        if (s.getSleepBaseMin() != null && s.getSleepNeedMin() != null && sleep.isSet()
            && sleep.targetMinutes() == s.getSleepNeedMin()) {
            sleepPort.setTargetMinutes(owner, s.getSleepBaseMin());
        }
    }

    private void writeSleep(UUID owner, SeasonDraftJson draft, int needMin) {
        if (draft.sleepAnchor() != null) {
            sleepPort.write(owner, needMin, draft.sleepAnchor().anchor(), draft.sleepAnchor().time());
        } else {
            sleepPort.setTargetMinutes(owner, needMin);
        }
    }


    private void revision(UUID owner, SeasonEntity s, SeasonDraftJson draft, SeasonNumbersJson before,
                          SeasonNumbersJson after) {
        SeasonRevisionEntity r = new SeasonRevisionEntity();
        r.setCreatedBy(owner);
        r.setSeasonId(s.getId());
        r.setDraft(draft);
        r.setBefore(before);
        r.setAfter(after);
        revisionRepository.save(r);
    }

    /**
     * Entity-level replace: rows no longer wanted are removed, new ones inserted, kept ones left alone. (A bulk JPQL
     * delete followed by {@code save} of the same composite keys would merge into rows still managed in this
     * persistence context and never re-insert them — the kept recipes would silently vanish.)
     */
    private void replaceAllowed(UUID owner, UUID seasonId, List<UUID> recipeIds) {
        Set<UUID> wanted = new LinkedHashSet<>(recipeIds);
        List<SeasonAllowedRecipeEntity> current = allowedRepository.findBySeasonId(seasonId);
        Set<UUID> have = new HashSet<>();
        for (SeasonAllowedRecipeEntity e : current) {
            if (wanted.contains(e.getRecipeId())) {
                have.add(e.getRecipeId());
            } else {
                allowedRepository.delete(e);
            }
        }
        for (UUID recipeId : wanted) {
            if (!have.contains(recipeId)) {
                allowedRepository.save(SeasonAllowedRecipeEntity.of(owner, seasonId, recipeId));
            }
        }
        allowedRepository.flush();
    }

    private static void take(SeasonEntity s, SeasonDraftJson d) {
        s.setTitle(d.title());
        s.setStartDate(d.startDate());
        s.setWeeks(d.weeks());
        s.setDraft(d);
    }

    private Map<String, Object> summary(SeasonEntity s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("closedOn", LocalDate.now().toString());
        m.put("plannedEnd", s.endDate().toString());
        m.put("weeks", s.getWeeks());
        m.put("revisions", revisionRepository.findBySeasonIdOrderByCreatedAtAsc(s.getId()).size());
        return m;
    }
}
