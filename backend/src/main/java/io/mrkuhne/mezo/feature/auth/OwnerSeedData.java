package io.mrkuhne.mezo.feature.auth;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Seeds the founder account (role OWNER, already onboarded). Idempotent by email. */
@Component
@Profile("demodata")
@Order(0) // seeds the owner that later runners (e.g. TrainSeedData) depend on
@RequiredArgsConstructor
public class OwnerSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final OwnerProperties ownerProperties;

    @Override
    public void run(String... args) {
        if (appUserRepository.existsByEmail(ownerProperties.ownerEmail())) return;
        AppUserEntity owner = new AppUserEntity();
        owner.setEmail(ownerProperties.ownerEmail());
        owner.setName(ownerProperties.ownerName());
        owner.setPasswordHash(passwordEncoder.encode(ownerProperties.ownerPassword()));
        owner.setRole(AppUserEntity.UserRole.OWNER);
        owner.setOnboardedAt(Instant.now());
        appUserRepository.save(owner);
    }
}
