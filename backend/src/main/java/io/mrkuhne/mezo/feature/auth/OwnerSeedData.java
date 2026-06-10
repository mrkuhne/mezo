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
        if (appUserRepository.existsByEmail(ownerProperties.email())) return;
        AppUserEntity owner = new AppUserEntity();
        owner.setEmail(ownerProperties.email());
        owner.setName(ownerProperties.name());
        owner.setPasswordHash(passwordEncoder.encode(ownerProperties.password()));
        owner = appUserRepository.save(owner);

        UserProfileEntity profile = new UserProfileEntity();
        profile.setCreatedBy(owner.getId());
        userProfileRepository.save(profile);
    }
}
