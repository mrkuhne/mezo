package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.RecipeImageResponse;
import io.mrkuhne.mezo.common.image.ImageStore;
import io.mrkuhne.mezo.common.image.StoredImage;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.io.IOException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * The owner's own photo of a recipe (Boop B4, decision 20): one per recipe, kept until the owner replaces or removes
 * it. Nothing else writes {@code recipe.image_id} (an import stores no picture). Every path resolves the recipe through
 * the owner-scoped finder first, so another user's recipe id is a 404 before any image is touched. The bytes live in
 * {@link ImageStore}; a replacement and a removal delete the old bytes ({@code RecipeService.delete} does the same
 * when the recipe is soft-deleted), so no picture is left behind without an owner.
 */
@Service
@RequiredArgsConstructor
public class RecipeImageService {

    private final RecipeRepository recipes;
    private final ImageStore images;

    @Transactional
    public RecipeImageResponse put(UUID userId, UUID recipeId, MultipartFile photo) {
        RecipeEntity recipe = requireRecipe(userId, recipeId);
        // Reject oversize on the declared size BEFORE the body is read into memory.
        if (photo == null || photo.isEmpty() || photo.getSize() > ImageStore.MAX_BYTES) {
            throw invalidPhoto();
        }
        byte[] bytes;
        try {
            bytes = photo.getBytes();
        } catch (IOException e) {
            throw invalidPhoto();
        }
        StoredImage stored = images.put(userId, bytes, photo.getContentType());
        UUID old = recipe.getImageId();
        recipe.setImageId(stored.id());
        recipes.saveAndFlush(recipe); // repoint first; the old bytes are released only after
        if (old != null) {
            images.delete(userId, old);
        }
        return new RecipeImageResponse().bytes((long) stored.bytes().length).width(stored.width()).height(stored.height());
    }

    @Transactional(readOnly = true)
    public StoredImage get(UUID userId, UUID recipeId) {
        RecipeEntity recipe = requireRecipe(userId, recipeId);
        return images.get(userId, requireImageId(recipe)).orElseThrow(OwnershipGuard::notFound);
    }

    @Transactional
    public void delete(UUID userId, UUID recipeId) {
        RecipeEntity recipe = requireRecipe(userId, recipeId);
        UUID imageId = requireImageId(recipe);
        recipe.setImageId(null);
        recipes.saveAndFlush(recipe);
        images.delete(userId, imageId);
    }

    private RecipeEntity requireRecipe(UUID userId, UUID recipeId) {
        return recipes.findByIdAndCreatedByAndDeletedFalse(recipeId, userId).orElseThrow(OwnershipGuard::notFound);
    }

    private static UUID requireImageId(RecipeEntity recipe) {
        if (recipe.getImageId() == null) {
            throw OwnershipGuard.notFound();
        }
        return recipe.getImageId();
    }

    private static SystemRuntimeErrorException invalidPhoto() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
    }
}
