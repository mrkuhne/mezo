package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.YearBlock;
import io.mrkuhne.mezo.api.dto.YearNote;
import io.mrkuhne.mezo.api.dto.YearPlan;
import io.mrkuhne.mezo.api.dto.YearReview;
import io.mrkuhne.mezo.feature.train.config.YearPlanProperties;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearPlanEntity;
import io.mrkuhne.mezo.feature.train.service.YearGenerator.Note;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.Layout;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.Placed;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Builds the {@link YearPlan} the phone shows (mezo-r36n9.113): every date from the {@link Layout}, warnings and the
 * skip consequence from {@link YearRules}, the focus counts and the year review. A plan without an id is a preview:
 * no block id leaves the server then (the blocks carry throwaway ids only to match the layout).
 */
@Component
@RequiredArgsConstructor
public class YearPlanAssembler {

    private final YearPlanProperties properties;

    /**
     * @param relaxed the rotation's relaxations (preview/create only; empty on later reads)
     */
    public YearPlan toDto(TrainingYearPlanEntity plan, List<TrainingYearBlockEntity> blocks, Layout layout,
                          List<Note> relaxed, LocalDate today) {
        boolean preview = plan.getId() == null;
        Map<UUID, Placed> placed = new HashMap<>();
        layout.blocks().forEach(pl -> placed.put(pl.id(), pl));
        placed.put(layout.consolidation().id(), layout.consolidation());

        List<TrainingYearBlockEntity> ordered = blocks.stream()
            .sorted(Comparator.comparingInt(TrainingYearBlockEntity::getOrdinal)).toList();
        List<YearRules.View> views = ordered.stream().map(b -> new YearRules.View(b.getId(), b.getOrdinal(),
            b.getKind(), b.getFocus(), b.getStatus(), placed.get(b.getId()).start())).toList();
        List<String> groups = groups();

        List<YearBlock> out = new ArrayList<>();
        for (TrainingYearBlockEntity b : ordered) {
            Placed pl = placed.get(b.getId());
            LocalDate lastDay = pl.start().plusWeeks(pl.weeks()).minusDays(1);
            boolean consolidation = YearGenerator.CONSOLIDATION.equals(b.getKind());
            boolean editable = b.is(YearGenerator.PLANNED) || b.is(YearGenerator.SKIPPED);
            out.add(YearBlock.builder()
                .id(preview ? null : b.getId())
                .ordinal(b.getOrdinal())
                .kind(YearBlock.KindEnum.fromValue(b.getKind()))
                .focus(List.copyOf(b.getFocus()))
                .weeks(pl.weeks())
                .plannedStart(pl.start())
                .lastDay(lastDay)
                .status(YearBlock.StatusEnum.fromValue(b.getStatus()))
                .mesocycleId(b.getMesocycleId())
                .currentWeek(today.isBefore(pl.start()) || today.isAfter(lastDay) ? null : weekOf(pl.start(), today))
                .adopted(b.isAdopted())
                .canMoveEarlier(!consolidation && editable && b.getGapWeeks() > 0)
                .skipConsequence(consolidation ? List.of() : YearRules.skipConsequence(views, b.getId()))
                .build());
        }

        List<YearNote> warnings = new ArrayList<>();
        for (Note n : YearRules.warnings(views, new LinkedHashSet<>(groups), properties)) {
            YearNote note = note(n);
            if (YearRules.NO_FOCUS_THIS_YEAR.equals(n.code())) {
                YearRules.placeFor(n.group(), views, today, properties).ifPresent(s -> {
                    note.setBlockId(preview ? null : s.blockId());
                    note.setOrdinal(s.ordinal());
                    note.setReplaces(s.replaces());
                });
            }
            warnings.add(note);
        }

        Map<String, Integer> focusCount = new LinkedHashMap<>();
        groups.forEach(g -> focusCount.put(g, 0));
        Set<String> trained = new LinkedHashSet<>();
        int done = 0;
        int skipped = 0;
        for (TrainingYearBlockEntity b : ordered) {
            if (YearGenerator.CONSOLIDATION.equals(b.getKind())) continue;
            if (b.is(YearGenerator.SKIPPED)) {
                skipped++;
                continue;
            }
            b.getFocus().forEach(g -> focusCount.merge(g, 1, Integer::sum));
            if (b.is(YearGenerator.DONE)) done++;
            if (b.is(YearGenerator.DONE) || b.is(YearGenerator.RUNNING)) trained.addAll(b.getFocus());
        }
        long loading = ordered.stream().filter(b -> !YearGenerator.CONSOLIDATION.equals(b.getKind())).count();

        return YearPlan.builder()
            .id(plan.getId())
            .status(YearPlan.StatusEnum.fromValue(plan.getStatus()))
            .startDate(plan.getStartDate())
            .endDate(layout.end().minusDays(1))
            .blockWeeks(plan.getBlockWeeks())
            .consolidationWeeks(plan.getConsolidationWeeks())
            .emphasis(List.copyOf(plan.getEmphasis()))
            .currentWeek(today.isBefore(plan.getStartDate()) ? null : weekOf(plan.getStartDate(), today))
            .loadingBlocks((int) loading)
            .bufferWeeks(layout.bufferWeeks())
            .bufferStart(layout.bufferStart())
            .overrunWeeks(layout.overrunWeeks())
            .blocks(out)
            .relaxed(relaxed.stream().map(YearPlanAssembler::note).toList())
            .warnings(warnings)
            .focusCount(focusCount)
            .review(YearReview.builder()
                .blocksDone(done)
                .blocksSkipped(skipped)
                .focused(groups.stream().filter(trained::contains).toList())
                .unfocused(groups.stream().filter(g -> !trained.contains(g)).toList())
                .build())
            .build();
    }

    /** The landmark groups in config order (upper, then lower). */
    private List<String> groups() {
        List<String> out = new ArrayList<>(properties.kindGroups().getOrDefault(YearGenerator.UPPER, List.of()));
        out.addAll(properties.kindGroups().getOrDefault(YearGenerator.LOWER, List.of()));
        return out;
    }

    private static YearNote note(Note n) {
        return YearNote.builder().code(YearNote.CodeEnum.fromValue(n.code())).group(n.group()).ordinal(n.ordinal())
            .build();
    }

    private static int weekOf(LocalDate start, LocalDate today) {
        return (int) (ChronoUnit.DAYS.between(start, today) / 7) + 1;
    }
}
