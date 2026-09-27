package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.EffectMuteRequest;
import io.mrkuhne.mezo.api.dto.EffectResponse;
import io.mrkuhne.mezo.api.dto.PersonEffectsResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectLinkRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * S6 (mezo-d6ivw.6): the hub read (GET without {@code personId}, every live subject) and the
 * mute/forget endpoints, on top of A12's {@code EffectLinkService#effectViews}/{@code
 * EffectMuteService}.
 */
class CompanionEffectsHubApiIT extends ApiIntegrationTest {

    private static final String EFFECTS = "/api/companion/effects";

    @Autowired private EffectLinkRepository effectLinkRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void list_shouldWorkWithoutPersonId() {
        PersonEffectsResponse all = getForBody(EFFECTS, ownerAuthHeaders(), HttpStatus.OK, PersonEffectsResponse.class);
        assertThat(all.getEffects()).isNotNull();
    }

    @Test
    void mute_thenUnmute_shouldReturn204() {
        putForBody(EFFECTS + "/event/munka/mute",
                EffectMuteRequest.builder().mode(EffectMuteRequest.ModeEnum.MUTED).build(),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);
        deleteAndExpect(EFFECTS + "/event/munka/mute", ownerAuthHeaders(), HttpStatus.NO_CONTENT);
    }

    @Test
    void mute_shouldReturn400_forUnknownSubjectKind() {
        putForBody(EFFECTS + "/planet/mars/mute",
                EffectMuteRequest.builder().mode(EffectMuteRequest.ModeEnum.MUTED).build(),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void list_shouldReturnAStrongEventSubject_thenReflectMuteAndForget() {
        seedStrongEdzesEffect();

        PersonEffectsResponse before = getForBody(EFFECTS, ownerAuthHeaders(), HttpStatus.OK, PersonEffectsResponse.class);
        EffectResponse edzes = before.getEffects().stream()
                .filter(e -> "edzes".equals(e.getSubjectKey()))
                .findFirst().orElseThrow();
        assertThat(edzes.getSubjectKind()).isEqualTo(EffectResponse.SubjectKindEnum.EVENT);
        assertThat(edzes.getSubjectLabel()).isEqualTo("Edzésnapok");
        assertThat(edzes.getMuted()).isFalse();

        putForBody(EFFECTS + "/event/edzes/mute",
                EffectMuteRequest.builder().mode(EffectMuteRequest.ModeEnum.MUTED).build(),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);
        PersonEffectsResponse muted = getForBody(EFFECTS, ownerAuthHeaders(), HttpStatus.OK, PersonEffectsResponse.class);
        assertThat(muted.getEffects().stream().filter(e -> "edzes".equals(e.getSubjectKey())).findFirst().orElseThrow()
                .getMuted()).isTrue();

        putForBody(EFFECTS + "/event/edzes/mute",
                EffectMuteRequest.builder().mode(EffectMuteRequest.ModeEnum.FORGOTTEN).build(),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);
        PersonEffectsResponse forgotten = getForBody(EFFECTS, ownerAuthHeaders(), HttpStatus.OK, PersonEffectsResponse.class);
        assertThat(forgotten.getEffects()).noneMatch(e -> "edzes".equals(e.getSubjectKey()));
    }

    private void seedStrongEdzesEffect() {
        EffectLinkEntity row = new EffectLinkEntity();
        row.setCreatedBy(ownerId());
        row.setSubjectKind(EffectLinkEntity.SUBJECT_EVENT);
        row.setSubjectKey("edzes");
        row.setMetric(EffectLinkEntity.METRIC_MENTAL);
        row.setCliffsDelta(new BigDecimal("0.500"));
        row.setMeanDiff(new BigDecimal("1.20"));
        row.setSubjectDays(16);
        row.setComplementDays(12);
        row.setStrengthBand("eros");
        row.setConfidenceTier("eros");
        row.setWindowDays(28);
        row.setComputedAt(Instant.now());
        effectLinkRepository.save(row);
    }

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }
}
