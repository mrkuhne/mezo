package io.mrkuhne.mezo.feature.goal;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import java.math.BigDecimal;
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
 * Seeds ONE active demo goal ("Nyári cut") + its plan-links for the owner as
 * <strong>opt-in demo data</strong>: active only under {@code @Profile("demofixtures")}, so a plain
 * {@code demodata} app starts clean with the owner only
 * ({@link io.mrkuhne.mezo.feature.auth.OwnerSeedData}) — a real user starts with NO goal and creates
 * one via the wizard (empty-state CTA). Run with
 * {@code --spring.profiles.active=demodata,demofixtures} to load the demo content so the Cél hero
 * renders in REAL mode. Mirrors {@link io.mrkuhne.mezo.feature.train.RunningSeedData}'s owner
 * resolution + idempotency. Idempotent: no-op if any goal already exists.
 */
@Component
@Profile("demofixtures")
@Order(120) // after OwnerSeedData (0) and the train/running seeds (100/110) — needs the seeded owner
@RequiredArgsConstructor
public class GoalSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final GoalRepository goalRepository;
    private final GoalPlanLinkRepository goalPlanLinkRepository;
    private final MesocycleRepository mesocycleRepository;
    private final RunningBlockRepository runningBlockRepository;

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
        GoalEntity g = new GoalEntity();
        g.setCreatedBy(owner.getId());
        g.setTitle("Nyári cut");
        g.setTrajectory("cut");
        g.setGuards(List.of("strength", "muscle"));
        g.setStatus("active");
        g.setStartDate(LocalDate.of(2026, 6, 1));
        g.setTargetDate(LocalDate.of(2026, 7, 27));
        g.setStartWeightKg(new BigDecimal("84.20"));
        g.setTargetWeightKg(new BigDecimal("80.00"));
        g.setRateTargetPctPerWeek(new BigDecimal("0.70"));
        g.setIdentityFrame("Erő megtartva a cut alatt — nem csak a szám.");
        goalRepository.save(g);

        // Link the owner's active training plans so the Cél hero renders real coverage in REAL
        // mode. The train/running seeds run at @Order(100/110) — these plans exist by now — but
        // each link is guarded defensively. Volleyball is intentionally NOT linked (it's ambient).
        UUID ownerId = owner.getId();
        UUID goalId = g.getId();
        mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(ownerId, "active").stream()
            .findFirst()
            .ifPresent(m -> linkPlan(ownerId, goalId, "mesocycle", m.getId(), m.getWeeks()));
        runningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(ownerId, "active").stream()
            .findFirst()
            .ifPresent(b -> linkPlan(ownerId, goalId, "running_block", b.getId(), b.getWeeks()));
    }

    /** Creates one positioned goal⇄plan link starting at week 1; end_week derives from the plan. */
    private void linkPlan(UUID owner, UUID goalId, String planType, UUID planId, int weeks) {
        GoalPlanLinkEntity link = new GoalPlanLinkEntity();
        link.setCreatedBy(owner);
        link.setGoalId(goalId);
        link.setPlanType(planType);
        link.setPlanId(planId);
        link.setStartWeek(1);
        link.setEndWeek(1 + weeks - 1); // = weeks (start_week + plan.weeks - 1, matching the link service)
        goalPlanLinkRepository.save(link);
    }
}
