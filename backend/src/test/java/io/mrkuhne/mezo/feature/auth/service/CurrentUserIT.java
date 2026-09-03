package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class CurrentUserIT extends ApiIntegrationTest {

    @Autowired private AppUserRepository appUserRepository;

    private AppUserEntity owner() {
        return appUserRepository.findByEmail("owner@mezo.local").orElseThrow();
    }

    @Test
    void testProtectedCall_shouldReturn403_whenAccountDisabled() {
        HttpHeaders headers = ownerAuthHeaders(); // token minted while ACTIVE
        AppUserEntity o = owner();
        o.setStatus(AppUserEntity.UserStatus.DISABLED);
        appUserRepository.saveAndFlush(o);
        try {
            String body = getForBody("/api/biometrics/weight", headers, HttpStatus.FORBIDDEN, String.class);
            assertHasRequestError(body, "AUTH_ACCOUNT_DISABLED");
        } finally {
            o.setStatus(AppUserEntity.UserStatus.ACTIVE);
            appUserRepository.saveAndFlush(o);
        }
    }

    @Test
    void testProtectedCall_shouldStampLastSeen_whenFirstSeen() {
        AppUserEntity o = owner();
        o.setLastSeenAt(null);
        appUserRepository.saveAndFlush(o);
        Instant before = Instant.now().minusSeconds(1);
        getForBody("/api/biometrics/weight", ownerAuthHeaders(), HttpStatus.OK, String.class);
        assertThat(owner().getLastSeenAt()).isAfter(before);
    }

    @Test
    void testProtectedCall_shouldNotRestampLastSeen_whenSeenRecently() {
        AppUserEntity o = owner();
        Instant recent = Instant.now().minusSeconds(60).truncatedTo(ChronoUnit.MICROS);
        o.setLastSeenAt(recent);
        appUserRepository.saveAndFlush(o);
        getForBody("/api/biometrics/weight", ownerAuthHeaders(), HttpStatus.OK, String.class);
        assertThat(owner().getLastSeenAt()).isEqualTo(recent);
    }
}
