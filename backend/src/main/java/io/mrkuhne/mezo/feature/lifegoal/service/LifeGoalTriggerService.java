package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalSource;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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
 * a {@code LifeGoalEvalJob} következő futásából — külön ütemező-mechanika nincs (D-3). A
 * {@code ritual_missed} MINDIG a késleltetett ágon fut, akármit mond a delay: nincs „napzárás
 * elmaradt" esemény, a hiányt csak a nap lezárása után lehet kimondani.
 *
 * <p>A késleltetett ág UGYANAZT a három lezárt napot nézi (tegnap, -2, -3, legfrissebbtől), amit a
 * {@code LifeGoalProgressService.evaluateDays} — a gördülő ablak az, ami a KÉSVE rögzített naplózást
 * behozza (egy hétfői edzés kedd este beírva is megkapja a késleltetett bökést). Ez azért
 * biztonságos, mert a dedup-kulcs NAP-onkénti: az újra-futás nem tud duplázni.
 *
 * <p>Egy terv naponta legfeljebb egyszer szólal meg, és csak az ELSŐ átmenetkor: ezt a
 * {@code dedupKey = <goalId>:<planKey>:<day>} adja, ahol a {@code planKey} a terv TARTALMI
 * lenyomata ({@link LifeGoalTriggerRules#planKey}) — nem a lista-indexe, ami egy terv
 * törlésekor/beszúrásakor elcsúszna. Az {@code AppNotificationService} exists-check + unique index
 * szinten kényszeríti ki, így az újra-kiértékelés (kézi evaluate, második job-futás) néma marad.
 * Csak {@code active} cél szólal meg: ugyanaz az „evaluable" definíció, amit a
 * {@code LifeGoalProgressService.evaluateDays} használ.
 *
 * <p>„Nincs adat" ≠ „a jel alszik": ha a trigger jelére EGYETLEN {@code SignalSource} bean sem
 * felel (pl. kikapcsolt companion mellett nincs {@code MetricSignalSource}), a tervet KIHAGYJUK —
 * kiértékelés és megszólalás nélkül. E nélkül a hiány-alapú {@code ritual_missed} minden éjjel
 * tüzelne annak is, aki minden nap lezárta a napját. Ugyanez az „alszik" állapot, amit a
 * {@code LifeGoalSignalService} liveness-e is kimond.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalTriggerService {

    private static final String STATUS_ACTIVE = "active";

    /** A késleltetett ág lezárt napjai — ugyanaz a hármas, amit az {@code evaluateDays} ír. */
    private static final int DELAYED_CLOSED_DAYS = 3;

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

    /**
     * A job-ág: a három lezárt napra (tegnap, -2, -3, legfrissebbtől) a késleltetett tervek +
     * minden {@code ritual_missed}. A napra bontott dedup-kulcs miatt az ismételt futás néma.
     */
    @Transactional(readOnly = true)
    public void fireDelayed(UUID userId, LifeGoalEntity goal, LocalDate today) {
        if (!STATUS_ACTIVE.equals(goal.getStatus())) {
            return;
        }
        for (int back = 1; back <= DELAYED_CLOSED_DAYS; back++) {
            evaluatePlans(userId, goal, today.minusDays(back), null, true);
        }
    }

    private void evaluatePlans(UUID userId, LifeGoalEntity goal, LocalDate day,
                               String onlySource, boolean delayedPass) {
        List<IfThenPlanJson> plans = goal.getIfThenPlans();
        if (plans == null) {
            return;
        }
        for (IfThenPlanJson plan : plans) {
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
            PillarSourceJson signal = LifeGoalTriggerRules.sourceFor(trigger.source()).orElse(null);
            if (signal == null) {
                continue; // ismeretlen forrás
            }
            SignalSource source = signalSource(signal);
            if (source == null) {
                continue; // a jel ALSZIK (nincs kiszolgáló bean) — nem „nincs adat", nem értékelünk
            }
            if (LifeGoalTriggerRules.RITUAL_MISSED.equals(trigger.source())
                    && !ritualAdopted(userId, source, signal, day)) {
                continue; // a felhasználó nem (vagy már nem) használja a rituálét — nem nyaggatjuk
            }
            BigDecimal value = source.window(userId, signal, day, day).values().get(day);
            if (!LifeGoalTriggerRules.matches(trigger.source(), trigger.condition(), value)) {
                continue;
            }
            emit(goal, plan, trigger, day);
        }
    }

    /** Késleltetett-e: a pozitív delayHours az, ÉS a hiány-alapú ritual_missed mindig az. */
    private boolean isDelayed(PlanTriggerJson trigger) {
        return LifeGoalTriggerRules.RITUAL_MISSED.equals(trigger.source())
            || (trigger.delayHours() != null && trigger.delayHours() > 0);
    }

    private SignalSource signalSource(PillarSourceJson signal) {
        return sources.stream().filter(s -> s.supports(signal)).findFirst().orElse(null);
    }

    /**
     * Adopciós kapu a {@code ritual_missed} elé (mezo-iizd.7 review, F4): a jel a kiértékelt napot
     * megelőző {@value LifeGoalTriggerRules#RITUAL_ADOPTION_WINDOW_DAYS} napban legalább EGY lezárt
     * rituálé-napot kíván. Enélkül az a felhasználó is minden éjjel bökést kapna, aki soha nem is
     * kezdte el a rituálét — vagy aki már abbahagyta.
     */
    private boolean ritualAdopted(UUID userId, SignalSource source, PillarSourceJson signal, LocalDate day) {
        LocalDate from = day.minusDays(LifeGoalTriggerRules.RITUAL_ADOPTION_WINDOW_DAYS);
        return source.window(userId, signal, from, day.minusDays(1)).values().values().stream()
            .anyMatch(v -> v != null && v.signum() > 0);
    }

    private void emit(LifeGoalEntity goal, IfThenPlanJson plan, PlanTriggerJson trigger, LocalDate day) {
        String planKey = LifeGoalTriggerRules.planKey(plan.ha(), plan.akkor(), trigger.source());
        log.debug("Life-goal plan fired — goal {}, plan {}, source {}, day {}",
            goal.getId(), planKey, trigger.source(), day);
        emitter.emit(
            goal.getCreatedBy(),
            AppNotificationKind.LIFE_GOAL_PLAN,
            "Ha–akkor · " + goal.getTitle(),
            plan.akkor(),
            AppNotificationKind.LIFE_GOAL_PLAN.deeplink() + "/" + goal.getId(),
            goal.getId(),
            goal.getId() + ":" + planKey + ":" + day);
    }
}
