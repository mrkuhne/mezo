package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalProgressResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalTodaySummary;
import io.mrkuhne.mezo.api.dto.PillarDayEntry;
import io.mrkuhne.mezo.api.dto.PillarDayStatus;
import io.mrkuhne.mezo.api.dto.PillarProgress;
import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalSource;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * A companion {@link LifeGoalSource} portjának lifegoal-oldali adaptere (mezo-iizd.10) — a
 * {@code MetricSignalSource} tükörképe: ott a lifegoal olvas companion-adatot, itt a companion
 * olvas lifegoal-adatot, az irány mindkétszer lifegoal → companion. SZIGORÚAN read-only: a
 * „ma él" a {@link LifeGoalTriggerRules} pure predikátumainak újrafuttatása EMIT NÉLKÜL — a
 * nudge (és a dedup) a {@link LifeGoalTriggerService}-é; ez a felület tény-állítás a prompthoz.
 *
 * <p>ritual_missed: hiány-alapú jel, a MA reggel mindig „hiányozna" — az utolsó LEZÁRT napra
 * (tegnap) értékeljük, és csak adoptált rituálé mellett (14 napos ablak, a trigger-service F4
 * kapujának mása). Alvó jel (nincs kiszolgáló SignalSource bean) → a terv kimarad, nem tippelünk.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalCompanionAdapter implements LifeGoalSource {

    private static final String STATUS_ACTIVE = "active";
    private static final int WEEK_DAYS = 7;

    private final LifeGoalProgressService progressService;
    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;
    private final List<SignalSource> sources;

    @Override
    @Transactional(readOnly = true)
    public Summary summary(UUID userId, LocalDate today) {
        List<LifeGoalTodaySummary> todayGoals = progressService.today(userId, today).getGoals();
        List<GoalLine> lines = todayGoals.stream()
            .map(g -> new GoalLine(g.getTitle(),
                g.getDimension() == null ? null : g.getDimension().getValue(),
                g.getArrow() == null ? null : g.getArrow().getValue(),
                g.getPillarsHitToday() == null ? 0 : g.getPillarsHitToday(),
                g.getPillarsTotal() == null ? 0 : g.getPillarsTotal()))
            .toList();
        return new Summary(lines, weakestPillar(userId, today), livePlans(userId, today));
    }

    @Override
    @Transactional(readOnly = true)
    public Details details(UUID userId, LocalDate today) {
        List<GoalDetail> details = new ArrayList<>();
        for (LifeGoalEntity goal : activeGoals(userId)) {
            LifeGoalProgressResponse progress = progressService.progress(
                userId, goal.getId(), today.minusDays(WEEK_DAYS - 1L), today);
            Map<UUID, LifeGoalPillarEntity> pillarsById = activePillars(goal.getId()).stream()
                .collect(Collectors.toMap(LifeGoalPillarEntity::getId, p -> p));
            List<PillarLine> pillars = progress.getPillars().stream()
                .map(p -> pillarLine(p, pillarsById.get(p.getPillarId()), today))
                .filter(Objects::nonNull)
                .toList();
            List<PlanLine> plans = plansOf(goal).stream()
                .map(plan -> new PlanLine(plan.ha(), plan.akkor(), isLiveToday(userId, plan, today)))
                .toList();
            details.add(new GoalDetail(goal.getTitle(), goal.getDimension(), goal.getFrame(),
                progress.getArrow() == null ? null : progress.getArrow().getValue(),
                progress.getWeeklyPct(), pillars, plans));
        }
        return new Details(details);
    }

    private PillarLine pillarLine(PillarProgress p, LifeGoalPillarEntity entity, LocalDate today) {
        if (entity == null) {
            return null; // közben törölt/deaktivált pillér — nem találunk ki sort
        }
        Boolean hitToday = p.getDays().stream()
            .filter(d -> today.equals(d.getDay())).findFirst()
            .map(d -> d.getStatus() == PillarDayStatus.NO_DATA ? null
                : Boolean.valueOf(d.getStatus() == PillarDayStatus.HIT))
            .orElse(null);
        return new PillarLine(entity.getLabel(), entity.getKind(), hitToday,
            p.getArrow() == null ? null : p.getArrow().getValue());
    }

    /** A legkevesebb hit-napú aktív pillér az elmúlt 7 napból, célokon átívelően; csupa
     *  no_data pillér nem játszik; döntetlen → label ábécé; senki → null. */
    private String weakestPillar(UUID userId, LocalDate today) {
        record Candidate(String label, long hits) {}
        List<Candidate> candidates = new ArrayList<>();
        for (LifeGoalEntity goal : activeGoals(userId)) {
            LifeGoalProgressResponse progress = progressService.progress(
                userId, goal.getId(), today.minusDays(WEEK_DAYS - 1L), today);
            Map<UUID, LifeGoalPillarEntity> pillarsById = activePillars(goal.getId()).stream()
                .collect(Collectors.toMap(LifeGoalPillarEntity::getId, p -> p));
            for (PillarProgress p : progress.getPillars()) {
                LifeGoalPillarEntity entity = pillarsById.get(p.getPillarId());
                if (entity == null) {
                    continue;
                }
                List<PillarDayEntry> days = p.getDays();
                boolean hasData = days.stream().anyMatch(d -> d.getStatus() != PillarDayStatus.NO_DATA);
                if (!hasData) {
                    continue;
                }
                long hits = days.stream().filter(d -> d.getStatus() == PillarDayStatus.HIT).count();
                candidates.add(new Candidate(entity.getLabel(), hits));
            }
        }
        return candidates.stream()
            .min(Comparator.comparingLong(Candidate::hits).thenComparing(Candidate::label))
            .map(Candidate::label).orElse(null);
    }

    /**
     * „ma él": a trigger predikátuma áll ma — LifeGoalTriggerRules, EMIT NÉLKÜL.
     *
     * <p>SZÁNDÉKOS EGYSZERŰSÍTÉS: a {@code delayHours}-t (a {@code LifeGoalTriggerService.isDelayed}
     * gate-jét, ami a késleltetett tervet a job-ágra tolja és csak a három lezárt napra futtatná
     * újra) itt figyelmen kívül hagyjuk a {@code ritual_missed}-en kívül — minden más tervet a MAI
     * nap értékére kérdezünk. Ez a felület egy „ma él" TÉNY-állítás a promptnak, nem pontos
     * tüzelés-előrejelzés; egy delayHours&gt;0 terv tehát itt korábban látszhat élőnek, mint amikor
     * a valódi trigger-service ténylegesen kiértékelné (lásd {@code LifeGoalCompanionAdapterIT
     * .testSummary_shouldMarkDelayedPlanLiveOnToday_asADocumentedSimplification}, ami lepinneli ezt
     * a viselkedést).
     */
    private List<String> livePlans(UUID userId, LocalDate today) {
        List<String> live = new ArrayList<>();
        for (LifeGoalEntity goal : activeGoals(userId)) {
            for (IfThenPlanJson plan : plansOf(goal)) {
                if (isLiveToday(userId, plan, today)) {
                    live.add(plan.ha() + ", " + plan.akkor());
                }
            }
        }
        return live;
    }

    private boolean isLiveToday(UUID userId, IfThenPlanJson plan, LocalDate today) {
        PlanTriggerJson trigger = plan == null ? null : plan.trigger();
        if (trigger == null || trigger.source() == null) {
            return false; // kézi terv — nincs gépi jel
        }
        PillarSourceJson signal = LifeGoalTriggerRules.sourceFor(trigger.source()).orElse(null);
        if (signal == null) {
            return false;
        }
        SignalSource source = sources.stream().filter(s -> s.supports(signal)).findFirst().orElse(null);
        if (source == null) {
            return false; // a jel ALSZIK — nem értékelünk (trigger-service precedens)
        }
        LocalDate evalDay = today;
        if (LifeGoalTriggerRules.RITUAL_MISSED.equals(trigger.source())) {
            evalDay = today.minusDays(1); // a hiányt csak lezárt napra lehet kimondani
            LocalDate from = evalDay.minusDays(LifeGoalTriggerRules.RITUAL_ADOPTION_WINDOW_DAYS);
            boolean adopted = source.window(userId, signal, from, evalDay.minusDays(1))
                .values().values().stream().anyMatch(v -> v != null && v.signum() > 0);
            if (!adopted) {
                return false; // nem (vagy már nem) használt rituálé — nem nyaggatjuk (F4 kapu mása)
            }
        }
        BigDecimal value = source.window(userId, signal, evalDay, evalDay).values().get(evalDay);
        return LifeGoalTriggerRules.matches(trigger.source(), trigger.condition(), value);
    }

    private List<LifeGoalEntity> activeGoals(UUID userId) {
        return goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)
            .stream().filter(g -> STATUS_ACTIVE.equals(g.getStatus())).toList();
    }

    private List<LifeGoalPillarEntity> activePillars(UUID goalId) {
        return pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(goalId)
            .stream().filter(LifeGoalPillarEntity::isActive).toList();
    }

    private static List<IfThenPlanJson> plansOf(LifeGoalEntity goal) {
        return goal.getIfThenPlans() == null ? List.of() : goal.getIfThenPlans();
    }
}
