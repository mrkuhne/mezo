package io.mrkuhne.mezo.feature.companion.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.EffectResponse;
import io.mrkuhne.mezo.api.dto.PersonEffectsResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectLinkRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * The named-effect HTTP surface for one person (Emlékezet S4, mezo-d6ivw.4) —
 * {@code EffectLinkService.effectsForPerson} is unit-covered by {@code EffectLinkServiceIT}; this
 * class only checks the wire: field mapping, direction-from-sign, and the auth gate.
 */
@ActiveProfiles("companion-fake")
class CompanionEffectsControllerIT extends ApiIntegrationTest {

    @Autowired private EffectLinkRepository effectLinkRepository;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private EffectLinkEntity seedRow(UUID owner, UUID personId) {
        EffectLinkEntity row = new EffectLinkEntity();
        row.setCreatedBy(owner);
        row.setSubjectKind(EffectLinkEntity.SUBJECT_PERSON);
        row.setSubjectKey(personId.toString());
        row.setMetric(EffectLinkEntity.METRIC_MENTAL);
        row.setCliffsDelta(new BigDecimal("0.700"));
        row.setMeanDiff(new BigDecimal("1.50"));
        row.setSubjectDays(6);
        row.setComplementDays(20);
        row.setStrengthBand("eros");
        row.setConfidenceTier("kozepes");
        row.setWindowDays(60);
        row.setComputedAt(Instant.now().truncatedTo(ChronoUnit.SECONDS));
        return effectLinkRepository.saveAndFlush(row);
    }

    @Test
    void listPersonEffectsReturnsTheRowMappedFromTheEntity() {
        UUID owner = ownerId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        EffectLinkEntity seeded = seedRow(owner, anna.getId());

        PersonEffectsResponse response = getForBody(
                "/api/companion/effects?personId=" + anna.getId(),
                ownerAuthHeaders(), HttpStatus.OK, PersonEffectsResponse.class);

        assertThat(response.getEffects()).singleElement().satisfies(effect -> {
            assertThat(effect.getMetric()).isEqualTo(EffectResponse.MetricEnum.MENTAL);
            assertThat(effect.getDirection()).isEqualTo(EffectResponse.DirectionEnum.HIGHER);
            assertThat(effect.getStrengthBand()).isEqualTo(EffectResponse.StrengthBandEnum.EROS);
            assertThat(effect.getConfidenceTier()).isEqualTo(EffectResponse.ConfidenceTierEnum.KOZEPES);
            assertThat(effect.getMeanDiff()).isEqualTo(1.50);
            assertThat(effect.getSubjectDays()).isEqualTo(6);
            assertThat(effect.getComplementDays()).isEqualTo(20);
            assertThat(effect.getComputedAt().toInstant()).isEqualTo(seeded.getComputedAt());
        });
    }

    @Test
    void listPersonEffectsDirectionIsLowerForANegativeDelta() {
        UUID owner = ownerId();
        PersonEntity bela = personPopulator.createPerson(owner, "Béla");
        EffectLinkEntity row = seedRow(owner, bela.getId());
        row.setCliffsDelta(new BigDecimal("-0.500"));
        effectLinkRepository.saveAndFlush(row);

        PersonEffectsResponse response = getForBody(
                "/api/companion/effects?personId=" + bela.getId(),
                ownerAuthHeaders(), HttpStatus.OK, PersonEffectsResponse.class);

        assertThat(response.getEffects()).singleElement()
                .extracting(EffectResponse::getDirection).isEqualTo(EffectResponse.DirectionEnum.LOWER);
    }

    @Test
    void listPersonEffectsIsHonestlyEmptyForAPersonWithoutRows() {
        UUID owner = ownerId();
        PersonEntity cili = personPopulator.createPerson(owner, "Cili");

        PersonEffectsResponse response = getForBody(
                "/api/companion/effects?personId=" + cili.getId(),
                ownerAuthHeaders(), HttpStatus.OK, PersonEffectsResponse.class);

        assertThat(response.getEffects()).isEmpty();
    }

    @Test
    void listPersonEffectsIs401WhenNoToken() {
        getForBody("/api/companion/effects?personId=" + UUID.randomUUID(),
                null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
