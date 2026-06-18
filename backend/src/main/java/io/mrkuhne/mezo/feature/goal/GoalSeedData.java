package io.mrkuhne.mezo.feature.goal;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds ONE active demo goal for the owner under {@code @Profile("demodata")} so the Cél hero
 * renders in REAL mode. Mirrors {@link io.mrkuhne.mezo.feature.train.RunningSeedData}'s owner
 * resolution + idempotency. Idempotent: no-op if any goal already exists.
 */
@Component
@Profile("demodata")
@Order(120) // after OwnerSeedData (0) and the train/running seeds (100/110) — needs the seeded owner
@RequiredArgsConstructor
public class GoalSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final GoalRepository goalRepository;

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
    }
}
