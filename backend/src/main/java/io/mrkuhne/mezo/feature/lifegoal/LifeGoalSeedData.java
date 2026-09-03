package io.mrkuhne.mezo.feature.lifegoal;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the three brainstorm goals (Kockahas · Side hustle · Az utolsó barátnő) + one parked
 * (Spanyol B2) for the owner as opt-in demo data — {@code @Profile("demofixtures")} only, the
 * {@link io.mrkuhne.mezo.feature.goal.GoalSeedData} idiom. Idempotent: no-op if any life goal
 * already exists. Every pillar below is checked against {@code SignalCatalog.ENTRIES} (source
 * shape + allowed {@code kinds}) and {@code ProgressionTaxonomy} (skill key) so a seeded pillar
 * would also survive {@code PUT /api/life-goals/{id}/pillars} — the frontend mock seed (Task 7)
 * mirrors this data field-for-field.
 */
@Component
@Profile("demofixtures")
@Order(125) // after GoalSeedData (120) — the Kockahas linked pillar reads the weight goal
@RequiredArgsConstructor
public class LifeGoalSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;

    /** CommandLineRunner entry point (startup). */
    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by integration tests to re-seed into a reset DB. */
    @Transactional
    public void run() {
        if (goalRepository.count() > 0) return;
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow();
        UUID uid = owner.getId();

        LifeGoalEntity kockahas = goal(uid, "Kockahas",
            "Erős, egészséges test, ami bírja a röpit és a hétköznapokat — a kockahas ennek a jele, nem a célja.",
            "intrinsic", "health", "accomplishment", "active", LocalDate.of(2026, 8, 10), LocalDate.of(2026, 11, 30),
            "Késő esti nassolás",
            List.of(new IfThenPlanJson("21 után éhes vagyok", "túró + fahéj, nem nassolás", null),
                new IfThenPlanJson("lábnap után fáradt vagyok", "20:30 lefekvés, telefon a konyhában",
                    new PlanTriggerJson("sport_session_logged", null, 4))));
        pillar(kockahas, 0, "Testkompozíció", "recovery", "linked", 2,
            new PillarSourceJson("weight_goal", null, null, null, null, null), empty());
        pillar(kockahas, 1, "Fehérje", "cooking", "average", 1, metric("DAILY_PROTEIN_G"), avg("160", "gte"));
        pillar(kockahas, 2, "Alvás", "recovery", "average", 2, metric("SLEEP_DURATION_H"), avg("7.0", "gte"));
        pillar(kockahas, 3, "Edzés", "max_strength", "habit", 1, metric("GYM_VOLUME_KG"), habit("1", 4));
        pillar(kockahas, 4, "Fegyelem · napzárás", "mindset", "habit", 1, metric("RITUAL_CLOSED"), habit("1", 6));

        LifeGoalEntity hustle = goal(uid, "Side hustle",
            "Egy saját termék, ami mások napját is rendbe teszi — és ami nem függ egy munkáltatótól.",
            "intrinsic", "accomplishment", "engagement", "active", LocalDate.of(2026, 8, 24), null,
            "Este nincs energia a mély munkára",
            List.of(new IfThenPlanJson("este 20:00 és nincs edzés", "90 perc mély munka, Slack lenémítva", null),
                new IfThenPlanJson("új ötlet jön", "a bd-be írom, nem kezdem el aznap", null)));
        pillar(hustle, 0, "Fejlesztés", "productivity", "baseline", 2,
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null), base());
        pillar(hustle, 1, "Tanulás", "learning", "habit", 1,
            new PillarSourceJson("activity", null, "learning", "count", null, null), habit("1", 2));
        pillar(hustle, 2, "Bevétel", "financial", "target", 1,
            new PillarSourceJson("activity", null, "financial", "huf", null, null),
            new PillarRuleJson(null, null, null, null, BigDecimal.ZERO, new BigDecimal("50000"),
                LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 31), "up", null));

        LifeGoalEntity baratno = goal(uid, "Az utolsó barátnő",
            "Olyan ember lenni, aki mellett jó lenni — és akkor jön, akinek jó.",
            "intrinsic", "relationships", "positive_emotion", "active", LocalDate.of(2026, 8, 1), null,
            "Hétvégi terv nélküli napok",
            List.of(new IfThenPlanJson("hétvégén nincs terv", "hívok valakit szombat délelőtt, nem várok", null),
                new IfThenPlanJson("tetszik valaki", "egy héten belül kérdezek, nem elemzek", null)));
        pillar(baratno, 0, "Társas élet", "connection", "baseline", 2,
            new PillarSourceJson("social_mentions", null, null, null, null, null), base());
        pillar(baratno, 1, "Tudatos ismerkedés", "connection", "habit", 1,
            new PillarSourceJson("activity", null, "connection", "count", null, null), habit("1", 1));
        pillar(baratno, 2, "Egészséges életmód", "recovery", "average", 1,
            new PillarSourceJson("needs_ring", null, null, null, null, "mozgas"), avg("60", "gte"));

        goal(uid, "Spanyol B2", "Hogy a nyaralás ne fordítóval menjen.", "intrinsic", "engagement", null, "parked",
            LocalDate.of(2026, 6, 1), null, null, List.of());
        pillarRepository.flush();
    }

    private LifeGoalEntity goal(UUID uid, String title, String why, String frame, String dim, String dim2,
            String status, LocalDate start, LocalDate target, String obstacle, List<IfThenPlanJson> plans) {
        LifeGoalEntity g = new LifeGoalEntity();
        g.setCreatedBy(uid);
        g.setTitle(title);
        g.setWhyText(why);
        g.setFrame(frame);
        g.setDimension(dim);
        g.setSecondaryDimension(dim2);
        g.setStatus(status);
        g.setStartDate(start);
        g.setTargetDate(target);
        g.setObstacleText(obstacle);
        g.setIfThenPlans(plans);
        if ("active".equals(status)) g.setActivatedAt(Instant.now());
        return goalRepository.save(g);
    }

    private void pillar(LifeGoalEntity g, int pos, String label, String skill, String kind, int weight,
            PillarSourceJson src, PillarRuleJson rule) {
        LifeGoalPillarEntity p = new LifeGoalPillarEntity();
        p.setCreatedBy(g.getCreatedBy());
        p.setGoalId(g.getId());
        p.setPosition(pos);
        p.setLabel(label);
        p.setSkillKey(skill);
        p.setKind(kind);
        p.setWeight(weight);
        p.setSource(src);
        p.setRule(rule);
        pillarRepository.save(p);
    }

    private static PillarSourceJson metric(String key) {
        return new PillarSourceJson("metric", key, null, null, null, null);
    }

    private static PillarRuleJson empty() {
        return new PillarRuleJson(null, null, null, null, null, null, null, null, null, null);
    }

    private static PillarRuleJson avg(String threshold, String cmp) {
        return new PillarRuleJson(new BigDecimal(threshold), cmp, null, 7, null, null, null, null, null, null);
    }

    private static PillarRuleJson habit(String threshold, int days) {
        return new PillarRuleJson(new BigDecimal(threshold), "gte", days, null, null, null, null, null, null, null);
    }

    private static PillarRuleJson base() {
        return new PillarRuleJson(null, null, null, 28, null, null, null, null, "up", 14);
    }
}
