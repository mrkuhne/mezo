package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeListResponse;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.common.image.repository.StoredImageRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
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

/**
 * The owner's recipe photo (Boop B4 Task 12, decision 20): ownership, content checks, and — the acceptance item Task 5's
 * review set — the bytes are deleted when the recipe is soft-deleted and when the photo is replaced.
 */
class RecipeImageIT extends ApiIntegrationTest {

    @Autowired private StoredImageRepository images;

    private static byte[] jpeg(int w, int h) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return out.toByteArray();
    }

    private UUID makeRecipe(HttpHeaders auth) {
        PantryItemRequest p = new PantryItemRequest();
        p.setKind(PantryItemRequest.KindEnum.FOOD);
        p.setName("Zab");
        p.setPer(new BigDecimal("100"));
        p.setUnit("g");
        p.setKcal(new BigDecimal("370"));
        p.setProteinG(new BigDecimal("13"));
        p.setCarbsG(new BigDecimal("60"));
        p.setFatG(new BigDecimal("7"));
        UUID food = postForBody("/api/pantry", p, auth, HttpStatus.CREATED, PantryItemResponse.class).getId();
        RecipeIngredientRequest l = new RecipeIngredientRequest();
        l.setPantryItemId(food);
        l.setAmount(new BigDecimal("80"));
        l.setUnit("g");
        RecipeRequest r = new RecipeRequest();
        r.setName("Zabkása");
        r.setCategory("breakfast");
        r.setServings(1);
        r.setIngredients(List.of(l));
        return postForBody("/api/recipe", r, auth, HttpStatus.CREATED, RecipeResponse.class).getId();
    }

    private ResponseEntity<String> upload(HttpHeaders auth, UUID id, byte[] bytes, String partType) {
        HttpHeaders partHeaders = new HttpHeaders();
        partHeaders.setContentType(MediaType.parseMediaType(partType));
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("photo", new HttpEntity<>(photoPart(bytes, "recipe.jpg"), partHeaders));
        HttpHeaders headers = new HttpHeaders();
        headers.putAll(auth);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        return rest.exchange("/api/recipe/" + id + "/image", HttpMethod.POST, new HttpEntity<>(parts, headers), String.class);
    }

    private ResponseEntity<byte[]> fetch(HttpHeaders auth, UUID id) {
        return rest.exchange("/api/recipe/" + id + "/image", HttpMethod.GET, new HttpEntity<>(auth), byte[].class);
    }

    @Test
    void imageIsScopedToItsOwner() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        RegisteredUser other = registerUser("Mas");
        UUID id = makeRecipe(owner);
        byte[] bytes = jpeg(40, 30);

        assertThat(upload(owner, id, bytes, "image/jpeg").getStatusCode()).isEqualTo(HttpStatus.OK);
        ResponseEntity<byte[]> mine = fetch(owner, id);
        assertThat(mine.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mine.getBody()).isEqualTo(bytes);
        assertThat(mine.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_JPEG);

        assertThat(fetch(other.headers(), id).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(upload(other.headers(), id, bytes, "image/jpeg").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        deleteAndExpect("/api/recipe/" + id + "/image", other.headers(), HttpStatus.NOT_FOUND);
        assertThat(fetch(owner, id).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(images.count()).isEqualTo(1);
    }

    @Test
    void theListSaysWhichRecipesHaveAPhotoSoNobodyProbesFor404() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID with = makeRecipe(owner);
        UUID without = makeRecipe(owner);
        upload(owner, with, jpeg(8, 8), "image/jpeg");

        RecipeListResponse list = getForBody("/api/recipe", owner, HttpStatus.OK, RecipeListResponse.class);
        assertThat(list.getRecipes()).filteredOn(r -> r.getId().equals(with)).extracting(RecipeResponse::getHasImage).containsExactly(true);
        assertThat(list.getRecipes()).filteredOn(r -> r.getId().equals(without)).extracting(RecipeResponse::getHasImage).containsExactly(false);
    }

    @Test
    void replacingThePhotoDeletesTheOldBytes() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID id = makeRecipe(owner);
        upload(owner, id, jpeg(8, 8), "image/jpeg");
        byte[] second = jpeg(16, 16);
        upload(owner, id, second, "image/jpeg");

        assertThat(images.count()).isEqualTo(1); // the first picture's bytes are gone, not just unlinked
        assertThat(fetch(owner, id).getBody()).isEqualTo(second);
    }

    @Test
    void deletingThePhotoDeletesTheBytes() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID id = makeRecipe(owner);
        upload(owner, id, jpeg(8, 8), "image/jpeg");

        deleteAndExpect("/api/recipe/" + id + "/image", owner, HttpStatus.NO_CONTENT);
        assertThat(images.count()).isZero();
        assertThat(fetch(owner, id).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void softDeletingTheRecipeDeletesItsPhotoBytes() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID id = makeRecipe(owner);
        upload(owner, id, jpeg(8, 8), "image/jpeg");
        assertThat(images.count()).isEqualTo(1);

        deleteAndExpect("/api/recipe/" + id, owner, HttpStatus.NO_CONTENT);
        assertThat(images.count()).isZero();
    }

    @Test
    void aRecipeWithNoPhotoDeletesCleanly() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID id = makeRecipe(owner);
        deleteAndExpect("/api/recipe/" + id, owner, HttpStatus.NO_CONTENT);
        assertThat(images.count()).isZero();
    }

    @Test
    void anEditedRecipeKeepsItsPhoto() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID id = makeRecipe(owner);
        upload(owner, id, jpeg(8, 8), "image/jpeg");
        RecipeResponse current = getForBody("/api/recipe/" + id, owner, HttpStatus.OK, RecipeResponse.class);
        RecipeRequest edit = new RecipeRequest();
        edit.setName("Zabkása, átírva");
        edit.setCategory("breakfast");
        edit.setServings(1);
        RecipeIngredientRequest l = new RecipeIngredientRequest();
        l.setPantryItemId(current.getIngredients().get(0).getPantryItemId());
        l.setAmount(new BigDecimal("90"));
        l.setUnit("g");
        edit.setIngredients(List.of(l));
        HttpHeaders h = new HttpHeaders();
        h.putAll(owner);
        h.setContentType(MediaType.APPLICATION_JSON);
        assertThat(rest.exchange("/api/recipe/" + id, HttpMethod.PUT, new HttpEntity<>(edit, h), String.class).getStatusCode())
            .isEqualTo(HttpStatus.NO_CONTENT);

        assertThat(fetch(owner, id).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(images.count()).isEqualTo(1);
    }

    @Test
    void rejectsAnUploadThatIsNotAnImage() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID id = makeRecipe(owner);

        assertThat(upload(owner, id, jpeg(8, 8), "application/pdf").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(upload(owner, id, "<html></html>".getBytes(), "image/jpeg").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(images.count()).isZero();
    }

    @Test
    void aReplacedPhotoIsServedFreshNotFromCache() throws Exception {
        HttpHeaders owner = ownerAuthHeaders();
        UUID id = makeRecipe(owner);
        upload(owner, id, jpeg(8, 8), "image/jpeg");

        ResponseEntity<byte[]> first = fetch(owner, id);
        String etag = first.getHeaders().getETag();
        assertThat(etag).isNotBlank();
        assertThat(first.getHeaders().getCacheControl()).contains("no-cache").doesNotContain("max-age");

        HttpHeaders conditional = new HttpHeaders();
        conditional.putAll(owner);
        conditional.set(HttpHeaders.IF_NONE_MATCH, etag);
        assertThat(fetch(conditional, id).getStatusCode()).isEqualTo(HttpStatus.NOT_MODIFIED);

        byte[] replacement = jpeg(20, 20);
        upload(owner, id, replacement, "image/jpeg");
        ResponseEntity<byte[]> after = fetch(conditional, id);
        assertThat(after.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(after.getBody()).isEqualTo(replacement);
        assertThat(after.getHeaders().getETag()).isNotEqualTo(etag);
    }
}
