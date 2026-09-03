package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalSource;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalWindow;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A ha–akkor tervek kiértékelése és megszólalása (mezo-iizd.7, spec §.7 + D-3).
 *
 * <p>Két belépő, egy döntés: az AZONNALI ág ({@code delayHours} null vagy 0) az esemény
 * pillanatában fut a {@code LifeGoalTriggerListener}-ből, a KÉSLELTETETT ág ({@code delayHours > 0})
 * a {@code LifeGoalEvalJob} következő futásából a tegnapi napra — külön ütemező-mechanika nincs
 * (D-3). A {@code ritual_missed} MINDIG a késleltetett ágon fut, akármit mond a delay: nincs
 * „napzárás elmaradt" esemény, a hiányt csak a nap lezárása után lehet kimondani.
 *
 * <p>Egy terv naponta legfeljebb egyszer szólal meg, és csak az ELSŐ átmenetkor: ezt a
 * {@code dedupKey = <goalId>:<planIdx>:<day>} adja, amit az {@code AppNotificationService}
 * exists-check + unique index szinten kikényszerít — az újra-kiértékelés (kézi evaluate, második
 * job-futás) így néma marad. Csak {@code active} cél szólal meg: ugyanaz az „evaluable" definíció,
 * amit a {@code LifeGoalProgressService.evaluateDays} használ.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalTriggerService {

    private static final String STATUS_ACTIVE = "active";

    private final LifeGoalRepository goalRepository;
    private final List<SignalSource> sources;
    private final AppNotificationEmitter emitter;

    /** Az esemény-ág: minden aktív cél azonnali terve, ami erre a forrásra figyel. */
    @Transactional(readOnly = true)
    public void fireImmediate(UUID userId, String triggerSource, LocalDate day) {
        for (LifeGoalEntity goal : goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)) {
            if (!STATUS_ACTIVE.equals(goal.getStatus())) {
                continue;
            }
            evaluatePlans(userId, goal, day, triggerSource, false);
        }
    }

    /** A job-ág: a tegnapi napra a késleltetett tervek + minden {@code ritual_missed}. */
    @Transactional(readOnly = true)
    public void fireDelayed(UUID userId, LifeGoalEntity goal, LocalDate today) {
        if (!STATUS_ACTIVE.equals(goal.getStatus())) {
            return;
        }
        evaluatePlans(userId, goal, today.minusDays(1), null, true);
    }

    private void evaluatePlans(UUID userId, LifeGoalEntity goal, LocalDate day,
                               String onlySource, boolean delayedPass) {
        List<IfThenPlanJson> plans = goal.getIfThenPlans();
        if (plans == null) {
            return;
        }
        for (int i = 0; i < plans.size(); i++) {
            IfThenPlanJson plan = plans.get(i);
            PlanTriggerJson trigger = plan == null ? null : plan.trigger();
            if (trigger == null || trigger.source() == null) {
                continue; // kézi terv — nincs gépi jel, sosem szólal meg magától
            }
            if (!delayedPass && (onlySource == null || !onlySource.equals(trigger.source()))) {
                continue;
            }
            if (delayedPass != isDelayed(trigger)) {
                continue;
            }
            BigDecimal value = dayValue(userId, trigger.source(), day);
            if (!LifeGoalTriggerRules.matches(trigger.source(), trigger.condition(), value)) {
                continue;
            }
            emit(goal, plan, i, day);
        }
    }

    /** Késleltetett-e: a pozitív delayHours az, ÉS a hiány-alapú ritual_missed mindig az. */
    private boolean isDelayed(PlanTriggerJson trigger) {
        return LifeGoalTriggerRules.RITUAL_MISSED.equals(trigger.source())
            || (trigger.delayHours() != null && trigger.delayHours() > 0);
    }

    private BigDecimal dayValue(UUID userId, String triggerSource, LocalDate day) {
        PillarSourceJson source = LifeGoalTriggerRules.sourceFor(triggerSource).orElse(null);
        if (source == null) {
            return null;
        }
        SignalWindow window = sources.stream().filter(s -> s.supports(source)).findFirst()
            .map(s -> s.window(userId, source, day, day))
            .orElseGet(() -> SignalWindow.of(Map.of()));
        return window.values().get(day);
    }

    private void emit(LifeGoalEntity goal, IfThenPlanJson plan, int planIdx, LocalDate day) {
        emitter.emit(
            goal.getCreatedBy(),
            AppNotificationKind.LIFE_GOAL_PLAN,
            "Ha–akkor · " + goal.getTitle(),
            plan.akkor(),
            AppNotificationKind.LIFE_GOAL_PLAN.deeplink() + "/" + goal.getId(),
            goal.getId(),
            goal.getId() + ":" + planIdx + ":" + day);
    }
}
