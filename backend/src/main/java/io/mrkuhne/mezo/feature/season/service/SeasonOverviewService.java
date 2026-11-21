package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.SeasonBlockPillar;
import io.mrkuhne.mezo.api.dto.SeasonFoodPillar;
import io.mrkuhne.mezo.api.dto.SeasonInsight;
import io.mrkuhne.mezo.api.dto.SeasonMap;
import io.mrkuhne.mezo.api.dto.SeasonMapLink;
import io.mrkuhne.mezo.api.dto.SeasonMapPillar;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.api.dto.SeasonOverviewHead;
import io.mrkuhne.mezo.api.dto.SeasonPillars;
import io.mrkuhne.mezo.api.dto.SeasonSleepPillar;
import io.mrkuhne.mezo.api.dto.SeasonSportLine;
import io.mrkuhne.mezo.api.dto.SeasonUpcoming;
import io.mrkuhne.mezo.api.dto.SeasonWeight;
import io.mrkuhne.mezo.api.dto.SeasonWeightPillar;
import io.mrkuhne.mezo.api.dto.SeasonWeightPoint;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonNumbersJson;
import io.mrkuhne.mezo.feature.season.mapper.SeasonMapper;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.port.SeasonMetricsPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonAllowedRecipeRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one read model the Évad tab renders (spec §5.4) — composed server-side from the active season, the engine's
 * numbers for the season as it stands, the weight trend, the block and the sleep log. 404 without an active season
 * (the phone shows the empty state). {@code adherence} = the last seven days ending yesterday
 * ({@link AdherenceService#lastWeek}), null only when nothing at all could be judged; {@code insights} and the
 * {@code sleep_food} link come from {@link SeasonInsights} (absent / null below their gates).
 *
 * <p>Head status: {@code no_data} with fewer than 4 weigh-in days in the last 21; a maintain season is
 * {@code in_band} / {@code out_of_band} by the latest trend point; cut / bulk compare the engine's trend rate with
 * the planned rate — under 50 % (or the wrong way) {@code slower}, over 150 % {@code faster}, else {@code on_course}.
 */
@Service
@RequiredArgsConstructor
public class SeasonOverviewService {

    static final int NO_DATA_WINDOW_DAYS = 21;
    static final int NO_DATA_MIN_WEIGH_INS = 4;
    private static final BigDecimal SLOWER = new BigDecimal("0.5");
    private static final BigDecimal FASTER = new BigDecimal("1.5");

    private final SeasonRepository seasonRepository;
    private final SeasonAllowedRecipeRepository allowedRepository;
    private final SeasonPreviewService previewService;
    private final SeasonGoalPort goalPort;
    private final SeasonTrainPort trainPort;
    private final SeasonMetricsPort metricsPort;
    private final SeasonMapper mapper;
    private final AdherenceService adherenceService;
    private final SeasonInsights seasonInsights;

    @Transactional(readOnly = true)
    public SeasonOverview overview(UUID owner) {
        SeasonEntity s = seasonRepository.findActive(owner)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        LocalDate today = LocalDate.now();
        SeasonDraftJson draft = previewService.currentDraft(owner, s);
        SeasonPreviewService.Computed computed = previewService.compute(owner, s, draft);
        SeasonNumbersJson n = computed.numbers();
        BigDecimal startKg = computed.goal().startWeightKg();
        List<SeasonMetricsPort.TrendPoint> trend = metricsPort.trend(owner);
        BigDecimal trendKg = trend.isEmpty() ? null : trend.get(trend.size() - 1).kg();
        Optional<SeasonTrainPort.Block> block = block(owner, s);
        int week = weekOf(s, today);
        int sleepBase = s.getSleepBaseMin() != null ? s.getSleepBaseMin() : previewService.sleepBase(owner);
        String anchor = draft.sleepAnchor() == null ? "WAKE" : draft.sleepAnchor().anchor();
        String anchorTime = draft.sleepAnchor() == null ? null : draft.sleepAnchor().time();
        SeasonInsights.Result insights = seasonInsights.compute(owner, s, draft.trajectory(), computed.warnings(), today);

        return SeasonOverview.builder()
            .season(mapper.toResponse(s, draft, block.map(SeasonTrainPort.Block::id).orElse(null)))
            .head(SeasonOverviewHead.builder()
                .title(s.getTitle()).week(week).weeks(s.getWeeks())
                .trajectory(SeasonOverviewHead.TrajectoryEnum.fromValue(draft.trajectory()))
                .status(SeasonOverviewHead.StatusEnum.fromValue(status(owner, draft, n, trendKg, today)))
                .build())
            .map(SeasonMap.builder()
                .pillars(new ArrayList<>(List.of(
                    pillar(SeasonMapPillar.KeyEnum.EDZES, SeasonFormat.training(draft)),
                    pillar(SeasonMapPillar.KeyEnum.ETEL, SeasonFormat.kcal(n.trainDayKcal())),
                    pillar(SeasonMapPillar.KeyEnum.ALVAS, SeasonFormat.hoursMinutes(n.sleepNeedMin())),
                    pillar(SeasonMapPillar.KeyEnum.SULY, SeasonFormat.weight(trendKg, computed.goal().targetWeightKg()))
                )))
                .links(new ArrayList<>(List.of(
                    link(SeasonMapLink.FromEnum.EDZES, SeasonMapLink.ToEnum.ETEL, SeasonMapLink.KeyEnum.TRAIN_FOOD,
                        n.restDayKcal() == null ? null : BigDecimal.valueOf(n.trainDayKcal() - n.restDayKcal())),
                    link(SeasonMapLink.FromEnum.EDZES, SeasonMapLink.ToEnum.ALVAS, SeasonMapLink.KeyEnum.TRAIN_SLEEP,
                        BigDecimal.valueOf(n.sleepNeedMin() - sleepBase)),
                    link(SeasonMapLink.FromEnum.ETEL, SeasonMapLink.ToEnum.SULY, SeasonMapLink.KeyEnum.FOOD_WEIGHT,
                        n.kgPerWeek()),
                    link(SeasonMapLink.FromEnum.ALVAS, SeasonMapLink.ToEnum.ETEL, SeasonMapLink.KeyEnum.SLEEP_FOOD,
                        insights.sleepFoodKcal() == null ? null : BigDecimal.valueOf(insights.sleepFoodKcal())),
                    link(SeasonMapLink.FromEnum.ETEL, SeasonMapLink.ToEnum.EDZES, SeasonMapLink.KeyEnum.FOOD_TRAIN, null),
                    link(SeasonMapLink.FromEnum.ALVAS, SeasonMapLink.ToEnum.EDZES, SeasonMapLink.KeyEnum.SLEEP_TRAIN, null)
                )))
                .build())
            .weight(SeasonWeight.builder()
                .series(new ArrayList<>(trend.stream().filter(p -> !p.date().isBefore(s.getStartDate()))
                    .map(p -> point(p.date(), p.kg())).toList()))
                .projection(projection(s, today, trendKg != null ? trendKg : startKg, n, computed.goal().targetWeightKg()))
                .trendKg(trendKg)
                .targetKg(computed.goal().targetWeightKg())
                .band(SeasonMapper.band(n.bandLowKg(), n.bandHighKg()))
                .kgPerWeek(n.kgPerWeek())
                .paceVerdict(n.paceVerdict() == null ? null : SeasonWeight.PaceVerdictEnum.fromValue(n.paceVerdict()))
                .build())
            .pillars(SeasonPillars.builder()
                .block(blockPillar(s, draft, block))
                .food(SeasonFoodPillar.builder()
                    .trainDayKcal(n.trainDayKcal()).trainSportDayKcal(n.trainSportDayKcal()).restDayKcal(n.restDayKcal()).proteinG(n.proteinG())
                    .allowedCount((int) allowedRepository.countBySeasonId(s.getId()))
                    .recipeCount((int) metricsPort.recipeCount(owner))
                    .novaMax(s.getProcessedFoodMaxNova())
                    .build())
                .sleep(SeasonSleepPillar.builder()
                    .needMin(n.sleepNeedMin()).baseMin(sleepBase).bedtime(n.bedtime())
                    .anchor(SeasonSleepPillar.AnchorEnum.fromValue(anchor)).anchorTime(anchorTime)
                    .avgMin(metricsPort.averageSleepMinutes(owner, today.minusDays(7), today.minusDays(1)))
                    .build())
                .weight(SeasonWeightPillar.builder()
                    .targetKg(computed.goal().targetWeightKg())
                    .targetDate(n.targetDate())
                    .deltaKg(trendKg == null ? null : trendKg.subtract(startKg).setScale(1, RoundingMode.HALF_UP))
                    .kgPerWeek(n.kgPerWeek())
                    .band(SeasonMapper.band(n.bandLowKg(), n.bandHighKg()))
                    .build())
                .build())
            .adherence(adherenceService.lastWeek(owner, today).map(mapper::toDto).orElse(null))
            .insights(new ArrayList<>(insights.insights().stream().map(i -> SeasonInsight.builder()
                .key(i.key()).title(i.title()).body(i.body()).build()).toList()))
            .upcoming(upcoming(s, block, week))
            .build();
    }

    private String status(UUID owner, SeasonDraftJson draft, SeasonNumbersJson n, BigDecimal trendKg, LocalDate today) {
        if (trendKg == null
            || metricsPort.weighInDaysSince(owner, today.minusDays(NO_DATA_WINDOW_DAYS - 1)) < NO_DATA_MIN_WEIGH_INS) {
            return "no_data";
        }
        if ("maintain".equals(draft.trajectory())) {
            boolean inside = trendKg.compareTo(n.bandLowKg()) >= 0 && trendKg.compareTo(n.bandHighKg()) <= 0;
            return inside ? "in_band" : "out_of_band";
        }
        BigDecimal planned = n.kgPerWeek();
        BigDecimal actual = metricsPort.trendRateKgPerWeek(owner);
        if (actual == null) {
            return "no_data";
        }
        if (planned == null || planned.signum() == 0) {
            return "on_course";
        }
        BigDecimal ratio = actual.divide(planned, 4, RoundingMode.HALF_UP);
        if (ratio.compareTo(SLOWER) < 0) {
            return "slower";
        }
        return ratio.compareTo(FASTER) > 0 ? "faster" : "on_course";
    }

    /** The season's block: the newest mesocycle linked to its goal. */
    private Optional<SeasonTrainPort.Block> block(UUID owner, SeasonEntity s) {
        List<UUID> linked = goalPort.linkedMesocycles(owner, s.getGoalId());
        for (int i = linked.size() - 1; i >= 0; i--) {
            Optional<SeasonTrainPort.Block> b = trainPort.mesocycle(owner, linked.get(i));
            if (b.isPresent()) {
                return b;
            }
        }
        return Optional.empty();
    }

    private SeasonBlockPillar blockPillar(SeasonEntity s, SeasonDraftJson draft, Optional<SeasonTrainPort.Block> block) {
        return SeasonBlockPillar.builder()
            .title(block.map(SeasonTrainPort.Block::title).orElse(null))
            .mesocycleId(block.map(SeasonTrainPort.Block::id).orElse(null))
            .blockWeeks(block.map(SeasonTrainPort.Block::weeks).orElse(null))
            .fromWeek(block.map(b -> weekOf(s, b.startDate())).orElse(null))
            .toWeek(block.filter(b -> b.endDate() != null).map(b -> weekOf(s, b.endDate().minusDays(1))).orElse(null))
            .gymDays(new ArrayList<>(draft.gymDaysOrEmpty()))
            .sport(new ArrayList<>(draft.sportOrEmpty().stream().map(x -> SeasonSportLine.builder()
                .dayOfWeek(x.dayOfWeek()).time(x.time()).durationMin(x.durationMin()).sport(x.sport()).build()).toList()))
            .build();
    }

    private static List<SeasonUpcoming> upcoming(SeasonEntity s, Optional<SeasonTrainPort.Block> block, int week) {
        List<SeasonUpcoming> out = new ArrayList<>();
        block.ifPresent(b -> {
            for (int i = 0; i < b.phaseCurve().size(); i++) {
                if ("deload".equalsIgnoreCase(b.phaseCurve().get(i))) {
                    int w = weekOf(s, b.startDate().plusWeeks(i));
                    if (w >= week && w < s.getWeeks()) {
                        out.add(SeasonUpcoming.builder().week(w).kind(SeasonUpcoming.KindEnum.DELOAD)
                            .text("könnyebb edzéshét").build());
                    }
                }
            }
        });
        out.add(SeasonUpcoming.builder().week(s.getWeeks()).kind(SeasonUpcoming.KindEnum.END).text("az évad vége").build());
        return out;
    }

    /**
     * The planned course from today to the season's end, one point a week: at the planned pace until the target,
     * then flat on it (a pace can reach the target before the season ends); flat for maintain.
     */
    private static List<SeasonWeightPoint> projection(SeasonEntity s, LocalDate today, BigDecimal fromKg,
                                                      SeasonNumbersJson n, BigDecimal targetKg) {
        List<SeasonWeightPoint> out = new ArrayList<>();
        if (fromKg == null) {
            return out;
        }
        LocalDate end = s.endDate();
        LocalDate from = today.isBefore(s.getStartDate()) ? s.getStartDate() : today;
        BigDecimal perWeek = n.kgPerWeek() == null ? BigDecimal.ZERO : n.kgPerWeek();
        for (LocalDate d = from; !d.isAfter(end); d = d.plusWeeks(1)) {
            long weeks = ChronoUnit.WEEKS.between(from, d);
            BigDecimal kg = fromKg.add(perWeek.multiply(BigDecimal.valueOf(weeks)));
            if (targetKg != null && perWeek.signum() < 0 && kg.compareTo(targetKg) < 0) {
                kg = targetKg;
            } else if (targetKg != null && perWeek.signum() > 0 && kg.compareTo(targetKg) > 0) {
                kg = targetKg;
            }
            out.add(point(d, kg.setScale(1, RoundingMode.HALF_UP)));
        }
        return out;
    }

    /** 1-based season week of {@code date}, clamped to 1..weeks. */
    static int weekOf(SeasonEntity s, LocalDate date) {
        long w = Math.floorDiv(ChronoUnit.DAYS.between(s.getStartDate(), date), 7) + 1;
        return (int) Math.max(1, Math.min(s.getWeeks(), w));
    }

    private static SeasonWeightPoint point(LocalDate date, BigDecimal kg) {
        return SeasonWeightPoint.builder().date(date).kg(kg).build();
    }

    private static SeasonMapPillar pillar(SeasonMapPillar.KeyEnum key, String value) {
        return SeasonMapPillar.builder().key(key).value(value).build();
    }

    private static SeasonMapLink link(SeasonMapLink.FromEnum from, SeasonMapLink.ToEnum to, SeasonMapLink.KeyEnum key,
                                      BigDecimal value) {
        return SeasonMapLink.builder().from(from).to(to).key(key).value(value).build();
    }
}
