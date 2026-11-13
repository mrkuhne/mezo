package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.common.image.repository.StoredImageRepository;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/** Meal photo store (Boop B4, mezo-r36n9.14): ownership, content checks, and byte reclamation. */
class MealPhotoIT extends ApiIntegrationTest {

    @Autowired private StoredImageRepository images;
    @Autowired private MealRepository meals;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private static byte[] jpeg(int w, int h) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return out.toByteArray();
    }

    private UUID logMeal(HttpHeaders auth) {
        MealItemRequest item = new MealItemRequest();
        item.setSource("estimate");
        item.setAmount(new BigDecimal("1"));
        item.setUnit("db");
        item.setName("Csirkés wrap");
        item.setPer(new BigDecimal("1"));
        item.setBasisUnit("db");
        item.setKcal(new BigDecimal("450"));
        item.setProteinG(new BigDecimal("28"));
        item.setCarbsG(new BigDecimal("40"));
        item.setFatG(new BigDecimal("18"));
        MealRequest r = new MealRequest();
        r.setSlot("lunch");
        r.setLoggedAt(OffsetDateTime.of(2026, 6, 24, 12, 30, 0, 0, ZoneOffset.UTC));
        r.setTitle("Ebéd");
        r.setItems(List.of(item));
        return postForBody("/api/meal", r, auth, HttpStatus.CREATED, MealResponse.class).getId();
    }

    private ResponseEntity<String> upload(HttpHeaders auth, UUID mealId, byte[] bytes, String partType) {
        HttpHeaders partHeaders = new HttpHeaders();
        partHeaders.setContentType(MediaType.parseMediaType(partType));
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("photo", new HttpEntity<>(photoPart(bytes, "meal.jpg"), partHeaders));
        HttpHeaders headers = new HttpHeaders();
        headers.putAll(auth);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        return rest.exchange("/api/meal/" + mealId + "/photo", HttpMethod.POST, new HttpEntity<>(parts, headers), String.class);
    }

    private ResponseEntity<byte[]> fetch(HttpHeaders auth, UUID mealId) {
        return rest.exchange("/api/meal/" + mealId + "/photo", HttpMethod.GET, new HttpEntity<>(auth), byte[].class);
    }

    @Test
    void photoIsScopedToItsOwner() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        RegisteredUser other = registerUser("Mas");
        UUID mealId = logMeal(owner);
        byte[] bytes = jpeg(40, 30);

        assertThat(upload(owner, mealId, bytes, "image/jpeg").getStatusCode()).isEqualTo(HttpStatus.OK);
        ResponseEntity<byte[]> mine = fetch(owner, mealId);
        assertThat(mine.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mine.getBody()).isEqualTo(bytes);
        assertThat(mine.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_JPEG);

        // another user's id is indistinguishable from a missing one, on every verb
        assertThat(fetch(other.headers(), mealId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(upload(other.headers(), mealId, bytes, "image/jpeg").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        deleteAndExpect("/api/meal/" + mealId + "/photo", other.headers(), HttpStatus.NOT_FOUND);
        // ...and another user's bulk delete never touches the owner's photo
        deleteAndExpect("/api/meal/photos", other.headers(), HttpStatus.NO_CONTENT);
        assertThat(fetch(owner, mealId).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(images.count()).isEqualTo(1);
    }

    @Test
    void bulkDeleteRemovesEveryPhotoButKeepsTheMeals() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID a = logMeal(owner);
        UUID b = logMeal(owner);
        UUID noPhoto = logMeal(owner);
        assertThat(upload(owner, a, jpeg(8, 8), "image/jpeg").getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(upload(owner, b, jpeg(9, 9), "image/jpeg").getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(images.count()).isEqualTo(2);

        deleteAndExpect("/api/meal/photos", owner, HttpStatus.NO_CONTENT);

        assertThat(fetch(owner, a).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(fetch(owner, b).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(images.count()).isZero(); // the bytes are gone, not just unlinked
        UUID ownerId = meals.findById(a).orElseThrow().getCreatedBy();
        assertThat(meals.findByIdAndCreatedByAndDeletedFalse(a, ownerId)).isPresent();
        assertThat(meals.findByIdAndCreatedByAndDeletedFalse(b, ownerId)).isPresent();
        assertThat(meals.findByIdAndCreatedByAndDeletedFalse(noPhoto, ownerId)).isPresent();
    }

    @Test
    void replacingAndDeletingAPhotoReclaimsTheOldBytes() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID mealId = logMeal(owner);
        upload(owner, mealId, jpeg(8, 8), "image/jpeg");
        upload(owner, mealId, jpeg(16, 16), "image/jpeg");
        assertThat(images.count()).isEqualTo(1);

        deleteAndExpect("/api/meal/" + mealId + "/photo", owner, HttpStatus.NO_CONTENT);
        assertThat(images.count()).isZero();
    }

    @Test
    void deletingAMealDeletesItsPhotoToo() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID mealId = logMeal(owner);
        upload(owner, mealId, jpeg(8, 8), "image/jpeg");

        deleteAndExpect("/api/meal/" + mealId, owner, HttpStatus.NO_CONTENT);
        assertThat(images.count()).isZero();
    }

    @Test
    void rejectsAnUploadThatIsNotAnImage() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID mealId = logMeal(owner);

        assertThat(upload(owner, mealId, jpeg(8, 8), "application/pdf").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(upload(owner, mealId, "<html></html>".getBytes(), "image/jpeg").getStatusCode())
            .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(images.count()).isZero();
    }

    @Test
    void aReplacedPhotoIsServedFreshNotFromCache() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID mealId = logMeal(owner);
        upload(owner, mealId, jpeg(8, 8), "image/jpeg");

        ResponseEntity<byte[]> first = fetch(owner, mealId);
        String etag = first.getHeaders().getETag();
        assertThat(etag).isNotBlank();
        assertThat(first.getHeaders().getCacheControl()).contains("no-cache").doesNotContain("max-age");

        HttpHeaders conditional = new HttpHeaders();
        conditional.putAll(owner);
        conditional.set(HttpHeaders.IF_NONE_MATCH, etag);
        assertThat(fetch(conditional, mealId).getStatusCode()).isEqualTo(HttpStatus.NOT_MODIFIED);

        byte[] replacement = jpeg(20, 20);
        upload(owner, mealId, replacement, "image/jpeg");
        ResponseEntity<byte[]> after = fetch(conditional, mealId); // the OLD etag no longer matches
        assertThat(after.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(after.getBody()).isEqualTo(replacement);
        assertThat(after.getHeaders().getETag()).isNotEqualTo(etag);
    }

    @Test
    void mealListsCarryHasPhotoSoNobodyProbesFor404() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID withPhoto = logMeal(owner);
        UUID without = logMeal(owner);
        upload(owner, withPhoto, jpeg(8, 8), "image/jpeg");

        var day = getForBody("/api/fuel/day/2026-06-24", owner, HttpStatus.OK, io.mrkuhne.mezo.api.dto.FuelDayResponse.class);
        assertThat(day.getMeals()).filteredOn(m -> m.getId().equals(withPhoto)).extracting(MealResponse::getHasPhoto).containsExactly(true);
        assertThat(day.getMeals()).filteredOn(m -> m.getId().equals(without)).extracting(MealResponse::getHasPhoto).containsExactly(false);
    }

    @Test
    void bulkDeleteAlsoClearsASoftDeletedMealsPhoto() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID mealId = logMeal(owner);
        upload(owner, mealId, jpeg(8, 8), "image/jpeg");
        // a soft-delete path that does NOT go through MealService.delete (e.g. a future one)
        jdbc.update("update meal set is_deleted = true where id = ?", mealId);
        assertThat(images.count()).isEqualTo(1);

        deleteAndExpect("/api/meal/photos", owner, HttpStatus.NO_CONTENT);
        assertThat(images.count()).isZero();
    }
}
