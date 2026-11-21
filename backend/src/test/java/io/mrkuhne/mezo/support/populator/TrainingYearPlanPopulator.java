package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.TrainingYearBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearPlanEntity;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearPlanRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the year plan (mezo-r36n9.113). Persists via {@code saveAndFlush} so DB CHECKs fire.
 */
@TestComponent
@RequiredArgsConstructor
public class TrainingYearPlanPopulator {

    private static final List<String> LOWER = List.of("quad", "ham", "glute", "calf");

    private final TrainingYearPlanRepository plans;
    private final TrainingYearBlockRepository blocks;

    /**
     * An active plan (6-week blocks, 2-week consolidation) starting {@code monday}; one block per token
     * ({@code "back+biceps"}; {@code "consolidation"} for the last). Blocks are planned back to back.
     */
    public TrainingYearPlanEntity plan(UUID owner, LocalDate monday, String... focusPerBlock) {
        TrainingYearPlanEntity p = new TrainingYearPlanEntity();
        p.setCreatedBy(owner);
        p.setStartDate(monday);
        p.setBlockWeeks(6);
        p.setConsolidationWeeks(2);
        p = plans.saveAndFlush(p);
        LocalDate start = monday;
        List<TrainingYearBlockEntity> saved = new ArrayList<>();
        int ordinal = 1;
        for (String token : focusPerBlock) {
            boolean consolidation = "consolidation".equals(token);
            List<String> focus = consolidation ? List.of() : Arrays.asList(token.split("\\+"));
            int weeks = consolidation ? 2 : 6;
            TrainingYearBlockEntity b = new TrainingYearBlockEntity();
            b.setCreatedBy(owner);
            b.setPlanId(p.getId());
            b.setOrdinal(ordinal++);
            b.setKind(consolidation ? "consolidation" : (LOWER.containsAll(focus) ? "lower" : "upper"));
            b.setFocus(new ArrayList<>(focus));
            b.setWeeks(weeks);
            b.setPlannedStart(start);
            saved.add(blocks.saveAndFlush(b));
            start = start.plusWeeks(weeks);
        }
        return p;
    }
}
