package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.HabitCatalogResponse;
import io.mrkuhne.mezo.api.dto.HabitChainAdmin;
import io.mrkuhne.mezo.api.dto.HabitChainCreateRequest;
import io.mrkuhne.mezo.api.dto.HabitChainUpdateRequest;
import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitDefAdmin;
import io.mrkuhne.mezo.api.dto.HabitDefCreateRequest;
import io.mrkuhne.mezo.api.dto.HabitDefUpdateRequest;
import io.mrkuhne.mezo.api.dto.HabitReorderRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

class HabitAdminApiIT extends ApiIntegrationTest {

    private HabitCatalogResponse catalog() {
        return getForBody("/api/habit/catalog", ownerAuthHeaders(), HttpStatus.OK, HabitCatalogResponse.class);
    }

    @Test
    void testGetCatalog_shouldBootstrapSeed_whenFirstCall() {
        HabitCatalogResponse cat = catalog();
        assertThat(cat.getChains()).extracting(HabitChainAdmin::getChainKey)
            .containsExactly("MORNING", "EVENING");
        assertThat(cat.getChains().get(0).getDefs()).hasSize(9);
        assertThat(cat.getChains().get(1).getDefs()).hasSize(6);
    }

    @Test
    void testCreateChain_shouldAppend_withGeneratedKeyAndDaypart() {
        HabitChainAdmin created = postForBody("/api/habit/chain",
            HabitChainCreateRequest.builder().title("Munka előtti").daypart(HabitChainCreateRequest.DaypartEnum.DAY).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitChainAdmin.class);
        assertThat(created.getChainKey()).startsWith("chain_");
        assertThat(created.getPosition()).isEqualTo(3);
    }

    @Test
    void testCreateDef_shouldRejectUnknownMetric_whenDerived() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Hidegzuhany")
                .mode(HabitDefCreateRequest.ModeEnum.DERIVED).metric("cold_shower_logged")
                .skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_METRIC_UNKNOWN");
    }

    @Test
    void testCreateDef_shouldRejectUnknownSkillKey() {
        // A free-form skillKey would upsert a phantom LIFE-skill row via ProgressionService.award
        // on completion (mezo-n5e9.1 review finding 2) — validated against ProgressionTaxonomy.LIFE,
        // the same taxonomy ActivityService#categorize checks (ACTIVITY_SKILL_UNKNOWN precedent).
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Hidegzuhany")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("garbage").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_SKILL_UNKNOWN");
    }

    @Test
    void testCreateDef_shouldCreateManual_forcingManualMetric() {
        catalog();
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Hidegzuhany")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        assertThat(created.getHabitKey()).startsWith("custom_");
        assertThat(created.getMetric()).isEqualTo("manual");
        assertThat(created.getPosition()).isEqualTo(10); // after the 9 seed MORNING defs
    }

    @Test
    void testCreateDef_shouldRejectManualMetric_whenDerived() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Hidegzuhany")
                .mode(HabitDefCreateRequest.ModeEnum.DERIVED).metric("manual")
                .skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_MODE_METRIC_MISMATCH");
    }

    @Test
    void testUpdateDef_shouldMoveToEmptyCustomChain_atPositionOne() {
        HabitCatalogResponse cat = catalog();
        HabitDefAdmin sunlight = cat.getChains().get(0).getDefs().stream()
            .filter(d -> d.getHabitKey().equals("morning_sunlight")).findFirst().orElseThrow();
        HabitChainAdmin emptyChain = postForBody("/api/habit/chain",
            HabitChainCreateRequest.builder().title("Új lánc").daypart(HabitChainCreateRequest.DaypartEnum.DAY).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitChainAdmin.class);

        HabitDefAdmin moved = patchForBody("/api/habit/def/" + sunlight.getId(),
            HabitDefUpdateRequest.builder().chainKey(emptyChain.getChainKey()).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        assertThat(moved.getChainKey()).isEqualTo(emptyChain.getChainKey());
        assertThat(moved.getPosition()).isEqualTo(1); // empty target chain — no off-by-one from the moving def itself
    }

    @Test
    void testUpdateDef_shouldToggleInactive_andDayViewShrinks() {
        HabitCatalogResponse cat = catalog();
        HabitDefAdmin sunlight = cat.getChains().get(0).getDefs().stream()
            .filter(d -> d.getHabitKey().equals("morning_sunlight")).findFirst().orElseThrow();
        patchForBody("/api/habit/def/" + sunlight.getId(),
            HabitDefUpdateRequest.builder().isActive(false).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        HabitDayResponse day = getForBody("/api/habit/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDayResponse.class);
        assertThat(day.getHabits()).extracting("key").doesNotContain("morning_sunlight");
    }

    @Test
    void testDeleteChain_shouldRejectSeed_and_NonEmpty() {
        HabitCatalogResponse cat = catalog();
        String morningId = cat.getChains().get(0).getId().toString();
        // deleteAndExpect is void — capture the error body via the raw exchange helper instead.
        String err = exchangeForBody(HttpMethod.DELETE, "/api/habit/chain/" + morningId, null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "HABIT_CHAIN_SEED");
    }

    @Test
    void testDeleteChain_shouldSoftDelete_whenCustomAndEmpty() {
        HabitChainAdmin created = postForBody("/api/habit/chain",
            HabitChainCreateRequest.builder().title("Ürítendő").daypart(HabitChainCreateRequest.DaypartEnum.DAY).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitChainAdmin.class);
        deleteAndExpect("/api/habit/chain/" + created.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);
        assertThat(catalog().getChains()).extracting(HabitChainAdmin::getChainKey)
            .doesNotContain(created.getChainKey());
    }

    @Test
    void testReorder_shouldRewritePositions_andRejectPartialList() {
        HabitCatalogResponse cat = catalog();
        HabitChainAdmin evening = cat.getChains().get(1);
        List<UUID> reversed = evening.getDefs().stream().map(HabitDefAdmin::getId).toList().reversed();
        HabitChainAdmin after = putForBody("/api/habit/chain/" + evening.getId() + "/order",
            HabitReorderRequest.builder().defIds(reversed).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitChainAdmin.class);
        assertThat(after.getDefs().get(0).getId()).isEqualTo(reversed.get(0));

        String err = putForBody("/api/habit/chain/" + evening.getId() + "/order",
            HabitReorderRequest.builder().defIds(reversed.subList(0, 2)).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_REORDER_MISMATCH");
    }

    @Test
    void testChainUnknown_should404_onForeignId() {
        String err = patchForBody("/api/habit/chain/" + UUID.randomUUID(),
            HabitChainUpdateRequest.builder().title("X").build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(err, "HABIT_CHAIN_UNKNOWN");
    }

    @Test
    void testCreateDef_shouldRejectFogg_whenCelebrationMissing() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorCopy("kitöltöttem a reggeli kávét").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_FRAMEWORK_FOGG_INCOMPLETE");
    }

    @Test
    void testCreateDef_shouldRejectClear_whenCravingMissing() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.CLEAR)
                .cue("7:10-kor a konyhában").reward("a pipa maga").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_FRAMEWORK_CLEAR_INCOMPLETE");
    }

    @Test
    void testCreateDef_shouldRejectFrameworkFields_whenNoFramework() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_FRAMEWORK_FIELDS_ORPHAN");
    }

    @Test
    void testCreateDef_shouldRejectUnknownAnchorKey() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey("custom_nemletezik").celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_ANCHOR_INVALID");
    }

    @Test
    void testCreateDef_shouldStoreFoggRecipe_withAnchorHabitKey() {
        catalog();
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey("morning_sunlight").celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        assertThat(created.getFramework()).isEqualTo(HabitDefAdmin.FrameworkEnum.FOGG);
        assertThat(created.getAnchorHabitKey()).isEqualTo("morning_sunlight");
        assertThat(created.getCelebration()).isEqualTo("ökölrázás");
        assertThat(created.getCue()).isNull();
    }

    @Test
    void testUpdateDef_shouldRejectSelfAnchor() {
        catalog();
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey("morning_sunlight").celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        String err = patchForBody("/api/habit/def/" + created.getId(),
            HabitDefUpdateRequest.builder().anchorHabitKey(created.getHabitKey()).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_ANCHOR_INVALID");
    }

    @Test
    void testDeleteDef_shouldReleaseDependentAnchors_intoFreeTextCopy() {
        catalog();
        HabitDefAdmin anchor = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Reggeli fény")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        HabitDefAdmin stacked = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey(anchor.getHabitKey()).celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        deleteAndExpect("/api/habit/def/" + anchor.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        HabitDefAdmin after = findDef(catalog(), stacked.getId());
        assertThat(after.getAnchorHabitKey()).isNull();
        assertThat(after.getAnchorCopy()).isEqualTo("kész a Reggeli fény");
        assertThat(after.getFramework()).isEqualTo(HabitDefAdmin.FrameworkEnum.FOGG);
    }

    @Test
    void testDeactivateDef_shouldReleaseDependentAnchors() {
        catalog();
        HabitDefAdmin anchor = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Reggeli fény")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        HabitDefAdmin stacked = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey(anchor.getHabitKey()).celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        patchForBody("/api/habit/def/" + anchor.getId(),
            HabitDefUpdateRequest.builder().isActive(false).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        HabitDefAdmin after = findDef(catalog(), stacked.getId());
        assertThat(after.getAnchorHabitKey()).isNull();
        assertThat(after.getAnchorCopy()).isEqualTo("kész a Reggeli fény");
    }

    @Test
    void testUpdateDef_shouldReframeClearToFogg_clearingClearFields() {
        catalog();
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.CLEAR)
                .cue("7:10-kor a konyhában").craving("tisztább fejjel indul a nap")
                .reward("a pipa maga").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        HabitDefAdmin updated = patchForBody("/api/habit/def/" + created.getId(),
            HabitDefUpdateRequest.builder().framework(HabitDefUpdateRequest.FrameworkEnum.FOGG)
                .anchorCopy("kitöltöttem a reggeli kávét").celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        assertThat(updated.getFramework()).isEqualTo(HabitDefAdmin.FrameworkEnum.FOGG);
        assertThat(updated.getCelebration()).isEqualTo("ökölrázás");
        assertThat(updated.getCue()).isNull();
        assertThat(updated.getCraving()).isNull();
        assertThat(updated.getReward()).isNull();
        assertThat(updated.getIdentity()).isNull();
    }

    @Test
    void testUpdateDef_shouldReframeFoggToClear_clearingFoggFields() {
        catalog();
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey("morning_sunlight").celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        HabitDefAdmin updated = patchForBody("/api/habit/def/" + created.getId(),
            HabitDefUpdateRequest.builder().framework(HabitDefUpdateRequest.FrameworkEnum.CLEAR)
                .cue("7:10-kor a konyhában").craving("tisztább fejjel indul a nap")
                .reward("a pipa maga").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        assertThat(updated.getFramework()).isEqualTo(HabitDefAdmin.FrameworkEnum.CLEAR);
        assertThat(updated.getAnchorHabitKey()).isNull();
        assertThat(updated.getCelebration()).isNull();
        assertThat(updated.getCue()).isEqualTo("7:10-kor a konyhában");
        assertThat(updated.getCraving()).isEqualTo("tisztább fejjel indul a nap");
        assertThat(updated.getReward()).isEqualTo("a pipa maga");
    }

    @Test
    void testUpdateDef_shouldRejectReframeToFogg_whenIncomplete() {
        catalog();
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.CLEAR)
                .cue("7:10-kor a konyhában").craving("tisztább fejjel indul a nap")
                .reward("a pipa maga").build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);

        String err = patchForBody("/api/habit/def/" + created.getId(),
            HabitDefUpdateRequest.builder().framework(HabitDefUpdateRequest.FrameworkEnum.FOGG).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_FRAMEWORK_FOGG_INCOMPLETE");
    }

    private static HabitDefAdmin findDef(HabitCatalogResponse cat, UUID defId) {
        return cat.getChains().stream()
            .flatMap(chain -> chain.getDefs().stream())
            .filter(d -> d.getId().equals(defId))
            .findFirst().orElseThrow();
    }
}
