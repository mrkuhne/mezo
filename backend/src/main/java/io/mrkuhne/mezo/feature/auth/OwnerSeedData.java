package io.mrkuhne.mezo.feature.auth;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.entity.UserProfileEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("demodata")
@RequiredArgsConstructor
public class OwnerSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final UserProfileRepository userProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final OwnerProperties ownerProperties;

    @Override
    public void run(String... args) {
        if (appUserRepository.existsByEmail(ownerProperties.ownerEmail())) return;
        AppUserEntity owner = new AppUserEntity();
        owner.setEmail(ownerProperties.ownerEmail());
        owner.setName(ownerProperties.ownerName());
        owner.setPasswordHash(passwordEncoder.encode(ownerProperties.ownerPassword()));
        owner = appUserRepository.save(owner);

        UserProfileEntity profile = new UserProfileEntity();
        profile.setCreatedBy(owner.getId());
        userProfileRepository.save(profile);
    }
}
