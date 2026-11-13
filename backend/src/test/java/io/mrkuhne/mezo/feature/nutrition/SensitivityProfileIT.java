package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SensitivityItem;
import io.mrkuhne.mezo.api.dto.SensitivityNovaRule;
import io.mrkuhne.mezo.api.dto.SensitivityProfileRequest;
import io.mrkuhne.mezo.api.dto.SensitivityProfileResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the generated {@code SensitivityApi} contract. */
class SensitivityProfileIT extends ApiIntegrationTest {

    @Test
    void testGetSensitivityProfile_shouldReturnDefaults_whenNoRow() {
        SensitivityProfileResponse p = getForBody(
            "/api/sensitivity", ownerAuthHeaders(), HttpStatus.OK, SensitivityProfileResponse.class);

        assertThat(p.getItems()).isEmpty();
        assertThat(p.getNovaRule().getEnabled()).isTrue();
        assertThat(p.getNovaRule().getMaxLevel()).isEqualTo(2);
    }

    @Test
    void testSetSensitivityProfile_shouldRoundTrip_whenSavedThenRead() {
        HttpHeaders auth = ownerAuthHeaders();
        SensitivityProfileRequest req = SensitivityProfileRequest.builder()
            .items(List.of(
                SensitivityItem.builder().key("laktóz").level(SensitivityItem.LevelEnum.INTOLERANCE)
                    .note("főzve is").build(),
                SensitivityItem.builder().key("peanuts").level(SensitivityItem.LevelEnum.ALLERGY).build()))
            .novaRule(SensitivityNovaRule.builder().enabled(true).maxLevel(3).build())
            .build();

        putForBody("/api/sensitivity", req, auth, HttpStatus.OK, SensitivityProfileResponse.class);
        SensitivityProfileResponse read =
            getForBody("/api/sensitivity", auth, HttpStatus.OK, SensitivityProfileResponse.class);

        assertThat(read.getItems()).extracting(SensitivityItem::getKey).containsExactly("laktóz", "peanuts");
        assertThat(read.getItems().get(0).getLevel()).isEqualTo(SensitivityItem.LevelEnum.INTOLERANCE);
        assertThat(read.getItems().get(0).getNote()).isEqualTo("főzve is");
        assertThat(read.getNovaRule().getMaxLevel()).isEqualTo(3);
    }

    @Test
    void testSetSensitivityProfile_shouldReplaceSingleRow_whenSavedTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        SensitivityNovaRule nova = SensitivityNovaRule.builder().enabled(false).maxLevel(2).build();
        putForBody("/api/sensitivity", SensitivityProfileRequest.builder()
            .items(List.of(SensitivityItem.builder().key("gluten").level(SensitivityItem.LevelEnum.AVOID).build()))
            .novaRule(nova).build(), auth, HttpStatus.OK, SensitivityProfileResponse.class);
        SensitivityProfileResponse second = putForBody("/api/sensitivity", SensitivityProfileRequest.builder()
            .items(List.of()).novaRule(nova).build(), auth, HttpStatus.OK, SensitivityProfileResponse.class);

        assertThat(second.getItems()).isEmpty();
        assertThat(second.getNovaRule().getEnabled()).isFalse();
    }
}
